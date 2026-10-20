# Checklist finale avant rendu

- [ ] `make reset && make up` (ou `docker compose --profile full up -d`) : toute la stack `healthy`.
- [ ] Démo rejouée 10× : **10/10** reprises autonomes, RTO logué (`demo_rto.csv`).
- [ ] Clip Chrono ≤ 60 s, sans coupe, exporté `Workshop2026-M2-G12-VidChrono.mp4`.
- [ ] `git ls-files secrets/` ne liste que `secrets.enc.env` ; aucun `.env`/clé en clair.
- [ ] README racine + 6 README de services + Adminer documenté.
- [ ] Gouvernance : EBIOS RM, PCA/PRA, NIS2/DORA reliés à l'archi et au RTO réel.
- [ ] Contributions individuelles renseignées (README §12).
- [ ] Sécurité respectée : attaques limitées au SI fictif, rien sur le réseau campus.

## Livrables (noms stricts)
- [ ] `Workshop2026-M2-G12-Dossier.pdf` (8–12 p.)
- [ ] `Workshop2026-M2-G12-Pres.pptx`
- [ ] `Workshop2026-M2-G12-VidChrono.mp4` (≤ 60 s)
- [ ] `Workshop2026-M2-G12-Code.zip` (le dépôt Git, aucun secret en clair)

## Préparer le PC de démo
- [ ] `.env` : `WAF_BIND_IP=192.168.137.1` (exposer le WAF au PC Attaquant).
- [ ] `./scripts/pull_models.sh` exécuté (modèles Ollama présents).
- [ ] Clé age présente dans `~/.config/sops/age/keys.txt`.
- [ ] `./scripts/gen_cert.sh` (certificat), `mkcert -install` si on veut éviter l'avertissement navigateur.
