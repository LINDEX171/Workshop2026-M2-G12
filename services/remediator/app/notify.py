"""Notifications e-mail du SOC : alerte à la détection, confirmation à la reprise.

Best-effort et JAMAIS bloquant : l'envoi part dans un thread démon et toute erreur est
avalée (journalisée seulement). Un souci de mail ne doit pas retarder ni casser la
remédiation, qui est notée. Compatible SMTP local (Mailpit, sans TLS ni auth) comme
Gmail (STARTTLS + mot de passe d'application lu via les secrets Docker).

Chaque message est multipart : version texte (anti-spam / clients sans HTML) + version
HTML soignée aux couleurs de la marque. Désactivé par défaut (notify_enabled=False).
"""
import smtplib
import threading
from email.message import EmailMessage

import structlog

from app.config import Settings

log = structlog.get_logger()

# Couleurs de la marque (identiques au frontend)
NAVY = "#0B1620"
BRAND = "#0E8A66"


def _html(badge_bg: str, badge_fg: str, badge_text: str, title: str, intro: str,
          rows: list[tuple[str, str]]) -> str:
    """Gabarit e-mail HTML (styles inline, mise en page par tableaux : compatible Gmail)."""
    cells = "".join(
        f'<tr>'
        f'<td style="padding:10px 0;border-bottom:1px solid #eef2f6;color:#64748b;width:42%;">{k}</td>'
        f'<td style="padding:10px 0;border-bottom:1px solid #eef2f6;color:#0f172a;font-weight:600;">{v}</td>'
        f'</tr>'
        for k, v in rows
    )
    return f"""\
<!doctype html><html lang="fr"><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;"><tr><td align="center">
  <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:92%;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
    <tr><td style="background:{NAVY};padding:18px 28px;">
      <table role="presentation" width="100%"><tr>
        <td style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:.5px;"><span style="color:{BRAND};">&#9679;</span>&nbsp;RESILIENCE-ALPHA</td>
        <td align="right" style="font-size:11px;color:#94a3b8;">SOC &middot; Zero-Touch</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:26px 28px 0;">
      <span style="display:inline-block;background:{badge_bg};color:{badge_fg};font-size:12px;font-weight:700;padding:6px 12px;border-radius:999px;">{badge_text}</span>
      <h1 style="margin:16px 0 6px;font-size:20px;color:#0f172a;">{title}</h1>
      <p style="margin:0;color:#475569;font-size:14px;line-height:1.5;">{intro}</p>
    </td></tr>
    <tr><td style="padding:16px 28px 4px;">
      <table role="presentation" width="100%" style="border-collapse:collapse;font-size:14px;">{cells}</table>
    </td></tr>
    <tr><td style="padding:18px 28px 28px;">
      <p style="margin:16px 0 0;border-top:1px solid #e2e8f0;padding-top:16px;color:#94a3b8;font-size:12px;line-height:1.5;">
        Notification automatique du moteur de remédiation.<br>
        Plateforme de paiement résiliente &mdash; reprise autonome (Zero-Touch Recovery).
      </p>
    </td></tr>
  </table>
</td></tr></table></body></html>"""


def _deliver(settings: Settings, subject: str, text: str, html: str) -> None:
    msg = EmailMessage()
    msg["From"] = settings.notify_from or settings.smtp_username
    msg["To"] = settings.notify_to
    msg["Subject"] = subject
    msg.set_content(text)                 # version texte
    msg.add_alternative(html, subtype="html")  # version HTML (préférée par les clients)
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
            if settings.smtp_use_tls:
                smtp.starttls()
            password = settings.smtp_password.get_secret_value()
            if settings.smtp_username and password:
                smtp.login(settings.smtp_username, password)
            smtp.send_message(msg)
        log.info("notify_sent", subject=subject, to=settings.notify_to)
    except Exception as exc:  # best-effort : on ne propage jamais
        log.warning("notify_failed", subject=subject, error=str(exc))


def send(settings: Settings, subject: str, text: str, html: str) -> None:
    """Envoie en tâche de fond. Ne bloque pas et ne lève jamais d'exception."""
    if not settings.notify_enabled:
        return
    if not settings.smtp_host or not settings.notify_to:
        log.info("notify_skipped", reason="configuration incomplète (smtp_host / notify_to)")
        return
    threading.Thread(target=_deliver, args=(settings, subject, text, html), daemon=True).start()


def attack_detected(settings: Settings, incident: dict) -> None:
    itype = incident.get("type", "inconnu")
    target = incident.get("target", "?")
    score = incident.get("score", "?")
    text = (
        "RESILIENCE-ALPHA — Incident détecté\n\n"
        f"Type d'incident  : {itype}\n"
        f"Service visé     : {target}\n"
        f"Score d'anomalie : {score}\n\n"
        "La remédiation automatique (Zero-Touch) est engagée. "
        "Un second message confirmera le rétablissement du service.\n"
    )
    html = _html(
        "#fef2f2", "#b42318", "&#9888; INCIDENT DÉTECTÉ",
        "Anomalie détectée sur la plateforme",
        "Un comportement anormal vient d'être repéré. La remédiation automatique est engagée.",
        [("Type d'incident", itype), ("Service visé", target), ("Score d'anomalie", str(score)),
         ("Réponse", "Remédiation Zero-Touch en cours")],
    )
    send(settings, f"[RESILIENCE-ALPHA] Incident detecte : {itype}", text, html)


def service_recovered(settings: Settings, incident: dict, action: str,
                      recovery: dict, downtime_sec: float) -> None:
    itype = incident.get("type", "inconnu")
    proof = f"transaction #{recovery.get('tx_id')} aboutie après {recovery.get('attempts')} essai(s)"
    text = (
        "RESILIENCE-ALPHA — Service rétabli\n\n"
        f"Type d'incident         : {itype}\n"
        f"Action corrective       : {action}\n"
        f"Preuve de reprise       : {proof}\n"
        f"Durée d'indisponibilité : ~{downtime_sec:.0f} s\n\n"
        "Reprise vérifiée automatiquement, sans intervention humaine.\n"
    )
    html = _html(
        "#ecfdf5", "#047857", "&#10003; SERVICE RÉTABLI",
        "Reprise automatique confirmée",
        "Le service de paiement est de nouveau opérationnel, vérifié par une transaction réelle.",
        [("Type d'incident", itype), ("Action corrective", action),
         ("Preuve de reprise", proof), ("Indisponibilité", f"~{downtime_sec:.0f} s")],
    )
    send(settings, "[RESILIENCE-ALPHA] Service retabli", text, html)
