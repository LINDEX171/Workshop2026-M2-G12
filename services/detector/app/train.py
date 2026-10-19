"""Entraînement du modèle sur l'historique Prometheus (trafic NORMAL uniquement).

Usage (dans le conteneur detector) :
    python -m app.train --minutes 25 [--step 10]
Produit model/model.pkl (rechargé automatiquement par le detector) et model/report.json.
"""
import argparse
import json
from pathlib import Path

from app.config import get_settings
from app.features import fetch_history
from app.model import THRESHOLD_MARGIN, train


def main() -> None:
    settings = get_settings()
    parser = argparse.ArgumentParser(description="Entraîne l'Isolation Forest sur le trafic normal")
    parser.add_argument("--minutes", type=int, default=25, help="fenêtre d'historique (min)")
    parser.add_argument("--step", type=int, default=10, help="pas d'échantillonnage (s)")
    args = parser.parse_args()

    rows = fetch_history(settings.prometheus_url, args.minutes, args.step)
    # Trafic normal = service joignable ET trafic de fond présent : on écarte les
    # redémarrages et les instants sans aucune requête (démarrage du load-generator)
    normal = [r for r in rows if r["up"] >= 1 and r["req_rate"] > 0]
    print(f"{len(rows)} échantillons collectés, {len(normal)} retenus (payment-api UP, avec trafic)")

    detector = train(normal)
    model_path = Path(settings.model_path)
    detector.save(model_path)

    report = {**detector.meta, "window_minutes": args.minutes, "step_seconds": args.step,
              "threshold_margin": THRESHOLD_MARGIN, "features": detector.features}
    report_path = model_path.with_name("report.json")
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    s = detector.meta["score_train"]
    print(f"Modèle enregistré : {model_path}")
    print(f"Score sur le trafic normal : médiane {s['p50']}, p99 {s['p99']}, max {s['max']}")
    print(f"Seuil calibré : {detector.meta['threshold']} (max + {THRESHOLD_MARGIN})")
    env = detector.meta["envelope"]
    print(f"Enveloppe : >= {env['min_features']} indicateurs à plus de {env['sigma']} dispersions "
          f"-> déclenchements sur le trafic normal : {env['false_alerts_on_train']}")
    if settings.detector_threshold.strip().lower() != "auto":
        print(f"NB : DETECTOR_THRESHOLD={settings.detector_threshold} force un seuil fixe (calibrage ignoré)")
    for name, st in detector.meta["feature_stats"].items():
        print(f"  {name:15s} min {st['min']:>10} | moy {st['mean']:>10} | max {st['max']:>10}"
              f" | dispersion {st['scale']:>8}")


if __name__ == "__main__":
    main()
