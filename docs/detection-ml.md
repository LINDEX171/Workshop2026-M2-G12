# Détection d'anomalies par Machine Learning — dossier technique

> Service `detector` (Phase 6). Les valeurs entre crochets `[...]` sont à reporter
> depuis `services/detector/model/report.json` après chaque entraînement.

## 1. Objectif

Détecter une dégradation du service de paiement (DoS applicatif, panne) **sans seuils
codés en dur**, à partir d'un modèle appris sur le comportement normal de la plateforme,
puis alerter le `remediator` avec des éléments d'explication.

## 2. Données

| Élément | Choix |
|---|---|
| Source | Prometheus (API HTTP), métriques de `payment-api`, `postgres-exporter` |
| Fenêtre des features | taux sur 1 minute glissante (`rate(...[1m])`) |
| Échantillonnage | 1 point toutes les 10 s (`--step 10`) |
| Volume d'entraînement | 25 min de trafic normal ≈ 150 échantillons `[n_samples]` |
| Génération du trafic normal | `load-generator` (Locust) : 5 opérateurs simulés qui se connectent, consultent comptes et transactions, et font de petits virements aléatoires, via le WAF |
| Étiquettes | aucune : apprentissage **non supervisé** sur du trafic supposé sain |

### Features (8)

| Feature | Requête (résumé) | Ce qu'elle capte |
|---|---|---|
| `req_rate` | requêtes/s applicatives de payment-api | afflux de requêtes |
| `err_ratio` | part des réponses 5xx | service qui craque |
| `p95_latency` | latence p95 (histogramme haute résolution) | saturation |
| `cpu` | CPU du processus payment-api | charge de calcul |
| `ram_mb` | mémoire résidente du processus | fuite, surcharge |
| `db_active` | requêtes SQL en cours sur `payments` (`pg_stat_activity`, état `active`) | base saturée |
| `tx_fail_ratio` | part des transactions en échec | impact métier |
| `up` | payment-api joignable par Prometheus | panne franche |

## 3. Préparation

- Valeurs absentes, `NaN` ou infinies (ex. latence sans trafic) remplacées par 0.
- Les instants où `payment-api` est injoignable, ou sans aucun trafic, sont exclus de l'entraînement.
- **Bruit d'entraînement** (2 % de l'amplitude moyenne, plancher 0,001) : en trafic normal,
  certaines features sont constantes (`err_ratio = 0`, `up = 1`). Un Isolation Forest ne
  peut pas découper une feature constante, donc son explosion passerait inaperçue. Le bruit
  donne une petite variance de référence, et une valeur aberrante sur ces features devient
  facile à isoler.
- Standardisation (`StandardScaler`) avant le modèle.

## 4. Modèle

Score final = **max(score Isolation Forest, score enveloppe)**, les deux composantes étant
apprises sur le même trafic normal.

**Enveloppe statistique** : pour chaque indicateur, moyenne et dispersion de référence
(max de l'écart-type observé, 25 % de la moyenne, plancher 0,001) en trafic normal. Elle
se déclenche quand **au moins 2 indicateurs** s'écartent de plus de **6 dispersions**.
Au-delà, son score croît du seuil vers 1 avec l'ampleur de l'écart. Exiger 2 indicateurs
évite qu'un incident isolé (une requête lente, une connexion DB de plus) déclenche une
remédiation. Le plancher relatif de 25 % (un trafic légitime doublé reste normal) évite qu'un indicateur très stable en normal
(toujours 4 connexions DB) devienne hypersensible. Le nombre de déclenchements de
l'enveloppe sur les données d'entraînement est contrôlé et reporté
(`envelope.false_alerts_on_train`, attendu : 0).

**Isolation Forest** :

- `sklearn.ensemble.IsolationForest`, 200 arbres, `contamination="auto"`, graine fixe (42).
- **Score d'anomalie** = `-score_samples(x)`, c'est-à-dire le score s(x) de Liu et al. (2008),
  entre 0 et 1 : environ 0,5 ou moins pour un point normal, proche de 1 pour un point très
  facile à isoler.
- **Seuil d'alerte calibré** (`DETECTOR_THRESHOLD=auto`) : score maximal observé sur le
  trafic normal d'entraînement **+ 0,05**. Ce n'est pas une valeur fixée à la main : il est
  recalculé à chaque entraînement. Une valeur numérique dans `.env` force un seuil fixe.
  Ce choix découle du diagnostic du §5 : un seuil arbitraire de 0,65 manquait des DoS.
- **Explicabilité** : chaque alerte contient les 3 features les plus éloignées du trafic
  normal (écart en nombre d'écarts-types) et les valeurs brutes (p95, taux 5xx, req/s, CPU).
- Toutes les `DETECTOR_INTERVAL_SEC` (10 s) : calcul du score, exposition (`/score`,
  métriques `anomaly_score` et `anomaly_threshold`), puis `POST remediator:/alert` si le score dépasse le seuil, avec au plus
  une alerte par `ALERT_COOLDOWN_SEC` (60 s) pour laisser la remédiation agir.
- Type d'alerte : `service_down` si `up = 0`, sinon `availability_dos`.

## 5. Résultats

### 5.1 Diagnostic sur données synthétiques (avant calibrage)

Modèle appris sur 300 points de trafic normal simulé, évalué sur 500 nouveaux points
normaux et sur des anomalies construites :

| Cas | Score (`max_samples=256`) | Score (`max_samples=64`) |
|---|---|---|
| Trafic normal : médiane / p99 / max | 0,411 / 0,486 / 0,529 | 0,436 / 0,498 / 0,529 |
| Charge légitime ×3 (req/s, CPU) | 0,538 | 0,515 |
| Latence p95 seule à 4 s | 0,456 | 0,456 |
| DoS, 4 indicateurs dégradés | 0,629 | 0,569 |
| DoS, 6 indicateurs dégradés | 0,671 | 0,635 |
| Service arrêté (tout à 0) | 0,671 | 0,635 |

Enseignements :
- Le modèle **classe correctement** : toute attaque dépasse le pire point normal (0,53).
- Le score **sature** vers 0,63-0,67 : l'Isolation Forest ne récompense pas l'ampleur d'un
  dépassement (une latence de 4 s compte comme une latence juste au-dessus du maximum appris).
  Le seuil arbitraire de 0,65 du cahier des charges aurait manqué le DoS à 4 indicateurs,
  d'où le **seuil calibré** (≈ 0,58 ici).
- `max_samples=256` sépare mieux normal et attaque que 64 : c'est la valeur retenue.
- Une dégradation **d'un seul indicateur** (latence seule) n'est pas détectée par le modèle :
  elle est couverte par la règle Prometheus `HighLatencyP95` (double voie d'alerte).

### 5.2 Constat sur la plateforme réelle : pourquoi l'enveloppe

Premier modèle (Isolation Forest seul) entraîné sur 126 échantillons de trafic normal
(médiane 0,404, max 0,515, seuil calibré 0,565). Test de montée en charge à 300 utilisateurs
simulés :

| Indicateur | Normal (moyenne) | Sous charge | Écart |
|---|---|---|---|
| Requêtes/s | 1,65 | 109 | 120 σ |
| Connexions DB | 4 | 12 | 93 σ |
| CPU | 0,02 | 0,79 | 71 σ |
| Latence p95 | 30 ms | 240 ms | — |

Score Isolation Forest : **0,506, sous le seuil**, alors que trois indicateurs sont à plusieurs
dizaines d'écarts-types du normal. C'est la saturation décrite au §5.1, plus marquée sur
données réelles. D'où l'ajout de l'enveloppe statistique, qui mesure l'ampleur de l'écart.

### 5.3 Mesures sur la plateforme réelle (modèle hybride)

Entraînement : 151 échantillons (25 min de trafic normal à environ 2,2 requêtes/s, latence p95 de 40 ms).
Indicateur DB remplacé par les requêtes SQL **actives** : le nombre de connexions ouvertes
dépendait de l'historique du pool (resté à 12 après un test de charge) et aurait provoqué
une fausse alerte après chaque redémarrage réparateur.

Test de montée en charge (5 → 300 utilisateurs simulés, notre propre load-generator) :

| Mesure | Valeur |
|---|---|
| Score du trafic normal : médiane / p99 / max | 0,406 / 0,517 / 0,558 |
| Seuil calibré | 0,608 |
| Déclenchements de l'enveloppe sur le trafic normal | 0 / 151 |
| Première alerte | pendant la montée en charge, dès environ 14 requêtes/s : score 0,972 |
| Explication de l'alerte | latence p95 +26,6 σ, req/s +21,7 σ, CPU +17,2 σ |
| Score au plus fort de la charge (37 requêtes/s) | 0,999 (Isolation Forest seul : 0,536) |
| Délai detector → réception par le remediator | 7 ms |
| Score pendant l'attaque DoS (pic) | `[à mesurer, Phase 9]` |
| Délai de détection (début d'attaque → alerte) | `[à mesurer, Phase 11]` |
| Fausses alertes sur 30 min de trafic normal | `[à mesurer]` |

## 6. Limites (exigées par le sujet)

- **Données d'entraînement courtes et synthétiques** : 25 min de trafic simulé ne couvrent
  pas les variations réelles (heures de pointe, campagnes, batchs). En production, il faudrait
  plusieurs semaines d'historique et un réentraînement régulier.
- **Hypothèse « trafic sain »** : si une attaque a lieu pendant la collecte, elle est apprise
  comme normale (empoisonnement des données). La collecte doit être surveillée.
- **Un seul service modélisé** (`payment-api`) : une attaque sur `auth` seul n'est vue que
  par les règles Prometheus et la vue SOC.
- **Détection de volume, pas d'intention** : le modèle voit une dégradation de disponibilité,
  pas une compromission discrète (exfiltration lente, injection réussie). Ces menaces relèvent
  du WAF, des journaux et du SOC.
- **Saturation du score** : l'Isolation Forest mesure la facilité d'isolement, pas l'ampleur.
  L'enveloppe statistique compense, mais une anomalie sur **un seul** indicateur reste
  volontairement sous le seuil. Elle est couverte par la double voie (règles Prometheus).
- **Profil « trafic de fond »** : l'enveloppe suppose un trafic de fond similaire à celui de
  l'entraînement. Une plateforme totalement inactive s'en écarte aussi : à surveiller si le
  load-generator est arrêté.
- **Seuil global** : un seuil unique sur un score agrégé. Un trafic légitime exceptionnel
  (pic commercial) peut déclencher une fausse alerte, et une attaque « basse et lente » peut
  rester sous le seuil.
- **Fenêtre de 1 min** : la détection ne peut pas être plus rapide qu'environ 20 à 40 s
  après le début de l'attaque (temps de remplissage de la fenêtre + intervalle de calcul).
- **Dérive** : tout changement de l'application (nouvelle version, plus de comptes) modifie
  le profil normal et impose un réentraînement (`scripts/train_model.sh`).
- **Sérialisation `pickle`** (joblib) : le fichier modèle ne doit provenir que de notre
  propre entraînement (un pickle malveillant exécuterait du code au chargement).

## 7. Reproduire

```bash
./scripts/train_model.sh            # 25 min de trafic normal puis entraînement
./scripts/train_model.sh --no-wait  # réentraîne sur l'historique déjà présent
```

Le detector recharge `model.pkl` automatiquement. `report.json` contient les statistiques
à reporter dans ce document.
