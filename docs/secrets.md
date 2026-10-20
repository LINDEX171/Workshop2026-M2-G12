# Gestion des secrets — SOPS + age

Aucun secret n'est en clair dans le dépôt. Les secrets réels sont chiffrés avec **SOPS**
et une clé **age**, et déchiffrés uniquement au déploiement.

## Principe
- **Clé age** : paire asymétrique. La clé **privée** reste hors dépôt
  (`~/.config/sops/age/keys.txt`), partagée dans l'équipe par un canal sûr. La clé
  **publique** est dans `.sops.yaml`.
- **Fichier chiffré versionné** : `secrets/secrets.enc.env` (valeurs chiffrées, noms
  lisibles). C'est le seul fichier de secrets commité.
- **Secrets Docker** : au déploiement, `secrets/secrets.enc.env` est déchiffré vers
  `secrets/*.txt` (gitignorés), montés comme secrets Docker (`/run/secrets/...`).

## Mise en place (une fois)
```bash
# 1. Installer les outils (voir ci-dessous), puis générer la clé age :
./scripts/init_age_key.sh          # crée la clé privée hors dépôt + remplit .sops.yaml

# 2. Générer des secrets de dev et les chiffrer :
./scripts/init_dev_secrets.sh
./scripts/encrypt_secrets.sh       # produit secrets/secrets.enc.env (versionnable)
```

## Déploiement / usage quotidien
```bash
./scripts/decrypt_secrets.sh       # secrets.enc.env -> secrets/*.txt (fait aussi par ansible/deploy.yml)
```
`ansible-playbook ansible/deploy.yml` déchiffre automatiquement avant de démarrer la stack.

## Installation des outils
- **Windows** : `winget install FiloSottile.age` et `winget install getsops.sops`
- **Linux/Kali** : `apt install age` ; SOPS depuis les releases GitHub `getsops/sops`.

## Vérifications
```bash
git grep -nE "BEGIN (RSA|OPENSSH) PRIVATE KEY" ; echo "ok si vide"
git ls-files secrets/        # doit ne lister que secrets.enc.env (jamais de *.txt)
```

## Rotation
Régénérer puis rechiffrer : `./scripts/init_dev_secrets.sh --force && ./scripts/encrypt_secrets.sh`,
puis `./scripts/decrypt_secrets.sh` et redéployer. Pour changer de clé age, relancer
`init_age_key.sh` sur une nouvelle clé et rechiffrer.

## Limites
- La clé privée age doit être distribuée hors bande (jamais dans Git). Sa perte rend le
  vault illisible ; sa fuite compromet tous les secrets.
- Démo mono-poste : une seule clé. En production, une clé par environnement et par
  opérateur (SOPS gère plusieurs destinataires age).
