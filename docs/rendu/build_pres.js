// Génère livrables/Workshop2026-M2-G12-Pres.pptx (support du pitch de 5 minutes).
// Prérequis : `npm install pptxgenjs@3.12.0 sharp@0.33.5` dans un dossier de travail,
// puis depuis la racine du dépôt :  NODE_PATH=<dossier>/node_modules node docs/rendu/build_pres.js
const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "..", "..");
const OUT = path.join(ROOT, "livrables", "Workshop2026-M2-G12-Pres.pptx");
const LOGO_SVG = fs.readFileSync(path.join(ROOT, "frontend/src/components/resilience-alpha-logo.svg"), "utf8");

const NAVY = "0B1620";
const GREEN = "0E8A66";
const MINT = "6EE7B7";
const TINT = "F4F6F8";
const GREEN_SOFT = "E7F4EF";
const INK = "1F2933";
const MUTED = "5B6875";
const RED = "B42318";
const RED_SOFT = "FDECEA";
const WHITE = "FFFFFF";

const THEME = {
  name: "Resilience Alpha",
  headFontFace: "Calibri",
  bodyFontFace: "Calibri",
  colors: {
    dk1: INK, lt1: WHITE, dk2: NAVY, lt2: TINT,
    accent1: GREEN, accent2: NAVY, accent3: MINT, accent4: RED, accent5: "8A96A3", accent6: "D9DEE3",
    hlink: GREEN, folHlink: MUTED,
  },
};

async function png(svg, width) {
  const buf = await sharp(Buffer.from(svg)).resize({ width }).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

// Logo : version couleur (fond clair) et version blanche (fond sombre). Ratio 229.18 / 71.
const LOGO_RATIO = 71 / 229.18;

async function main() {
  const logoColor = await png(LOGO_SVG, 1400);
  const logoWhite = await png(LOGO_SVG.replaceAll("#0B1620", "#FFFFFF"), 1400);

  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9"; // 10 x 5.625 in
  pres.title = "RESILIENCE-ALPHA";
  pres.author = "RESILIENCE-ALPHA";
  pres.company = "Workshop2026-M2-G12";
  pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };

  // ---------- Layouts ----------
  pres.defineSlideMaster({
    title: "DARK",
    background: { color: NAVY },
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 2.0, w: 8.8, h: 1.2, fontSize: 36, bold: true, color: WHITE, valign: "top" }, text: "" } },
    ],
  });
  pres.defineSlideMaster({
    title: "CONTENT",
    background: { color: WHITE },
    margin: [0.5, 0.5, 0.6, 0.5],
    objects: [
      { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.3, w: 8.0, h: 0.7, fontSize: 26, bold: true, color: NAVY, valign: "middle", margin: 0 }, text: "" } },
      { image: { x: 8.6, y: 0.42, w: 0.9, h: 0.9 * LOGO_RATIO, data: logoColor } },
      { text: { text: "RESILIENCE-ALPHA", options: { x: 0.5, y: 5.2, w: 5, h: 0.3, fontSize: 9, color: "8A96A3", margin: 0 } } },
    ],
    slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.3, fontSize: 9, color: "8A96A3", align: "right" },
  });

  const C = pres.SchemeColor;

  const card = (s, name, x, y, w, h, fill) =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: fill }, objectName: name });

  const dot = (s, name, x, y, label, fill = GREEN, color = WHITE) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: 0.42, h: 0.42, fill: { color: fill }, line: { color: fill }, objectName: name });
    s.addText(label, { x, y, w: 0.42, h: 0.42, align: "center", valign: "middle", fontSize: 13, bold: true, color, margin: 0, isTextBox: true });
  };

  const box = (s, name, x, y, w, h, title, sub, style = "plain") => {
    const styles = {
      plain: { fill: WHITE, line: NAVY, tc: NAVY, sc: MUTED },
      navy: { fill: NAVY, line: NAVY, tc: WHITE, sc: "CBD5E1" },
      green: { fill: GREEN, line: GREEN, tc: WHITE, sc: "D1FAE5" },
      ops: { fill: WHITE, line: GREEN, tc: NAVY, sc: MUTED },
      red: { fill: RED_SOFT, line: RED, tc: RED, sc: RED },
    }[style];
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.06, fill: { color: styles.fill }, line: { color: styles.line, width: 1 }, objectName: name });
    const runs = [{ text: title, options: { bold: true, fontSize: 11, color: styles.tc, breakLine: !!sub } }];
    if (sub) runs.push({ text: sub, options: { fontSize: 8.5, color: styles.sc } });
    s.addText(runs, { x, y, w, h, align: "center", valign: "middle", margin: 0, isTextBox: true });
  };

  const arrow = (s, x, y, w, h, color = MUTED, opts = {}) =>
    s.addShape(pres.shapes.LINE, { x, y, w, h, line: { color, width: 1.5, endArrowType: "triangle", ...opts } });

  // =============== 1. Titre ===============
  {
    pres.addSection({ title: "Introduction" });
    const s = pres.addSlide({ masterName: "DARK", sectionTitle: "Introduction" });
    s.addImage({ data: logoWhite, x: 0.6, y: 0.55, w: 3.0, h: 3.0 * LOGO_RATIO });
    s.addText("WORKSHOP NATIONAL BAC+5 · EPSI · OCTOBRE 2026", { x: 0.6, y: 1.65, w: 8.8, h: 0.3, fontSize: 11, bold: true, color: MINT, charSpacing: 2, margin: 0, isTextBox: true });
    s.addText("Une plateforme de paiement qui se répare seule", { placeholder: "title" });
    s.addText("Attaque réelle · détection par Machine Learning · remédiation Zero-Touch · preuve par une transaction réussie",
      { x: 0.6, y: 3.25, w: 8.4, h: 0.7, fontSize: 16, color: "CBD5E1", margin: 0, isTextBox: true });
    s.addText("Consortium Workshop2026-M2-G12", { x: 0.6, y: 4.85, w: 8.8, h: 0.3, fontSize: 12, color: "94A3B8", margin: 0, isTextBox: true });
    s.addNotes("Bonjour, nous sommes l'équipe RESILIENCE-ALPHA. En cinq minutes : une plateforme de paiement fictive, une attaque lancée depuis un autre PC, et une reprise automatique prouvée par une transaction qui réussit. (Introduction individuelle en anglais pour la finale.)");
  }

  // =============== 2. Problème et réponse ===============
  {
    pres.addSection({ title: "Démarche" });
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Démarche" });
    s.addText("Une reprise manuelle ne suffit plus", { placeholder: "title" });
    s.addText("Aujourd'hui, chaque incident sur le paiement est réparé à la main : lent, peu reproductible, coûteux pour les partenaires. Notre objectif : une chaîne de résilience observable et vérifiable.",
      { x: 0.5, y: 1.15, w: 9.0, h: 0.7, fontSize: 15, color: INK, margin: 0, isTextBox: true });
    const steps = [
      ["1", "Collecter", "Prometheus, Loki"],
      ["2", "Détecter", "modèle ML"],
      ["3", "Décider", "table de décision"],
      ["4", "Agir", "playbooks Ansible"],
      ["5", "Prouver", "transaction réussie"],
    ];
    const w = 1.66, gap = 0.17, y = 2.3;
    steps.forEach(([n, t, sub], i) => {
      const x = 0.5 + i * (w + gap);
      card(s, `etape-${n}`, x, y, w, 1.9, i === 4 ? GREEN_SOFT : TINT);
      dot(s, `etape-${n}-num`, x + 0.2, y + 0.22, n, i === 4 ? GREEN : NAVY);
      s.addText([{ text: t, options: { bold: true, fontSize: 16, color: NAVY, breakLine: true } }, { text: sub, options: { fontSize: 12, color: MUTED } }],
        { x: x + 0.2, y: y + 0.8, w: w - 0.3, h: 0.9, valign: "top", margin: 0, isTextBox: true });
    });
    s.addText("Sans aucune intervention humaine entre l'attaque et la preuve de reprise.",
      { x: 0.5, y: 4.45, w: 9.0, h: 0.4, fontSize: 14, italic: true, color: GREEN, margin: 0, isTextBox: true });
    s.addNotes("Le sujet : un SI critique doit encaisser un incident et repartir seul. Notre chaîne a cinq étapes. La dernière est la plus importante : un conteneur qui redémarre ne prouve rien, seule une transaction qui réussit prouve la reprise.");
  }

  // =============== 3. Architecture ===============
  {
    pres.addSection({ title: "Solution" });
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Solution" });
    s.addText("Un point d'entrée, cinq réseaux cloisonnés", { placeholder: "title" });
    // zones
    card(s, "zone-metier", 2.05, 1.15, 7.45, 1.8, TINT);
    s.addText("Chemin métier — réseaux public · app · data · auth-data", { x: 2.2, y: 1.2, w: 6, h: 0.25, fontSize: 9, bold: true, color: MUTED, margin: 0, isTextBox: true });
    card(s, "zone-ops", 2.05, 3.1, 7.45, 1.85, GREEN_SOFT);
    s.addText("Réseau ops — observabilité, détection, remédiation (aucun port publié)", { x: 2.2, y: 3.15, w: 7, h: 0.25, fontSize: 9, bold: true, color: GREEN, margin: 0, isTextBox: true });
    // métier
    box(s, "attaquant", 0.4, 1.75, 1.4, 0.75, "PC Attaquant", "dos_attack.py", "red");
    box(s, "waf", 2.25, 1.75, 1.3, 0.75, "WAF", "ModSecurity · 443", "navy");
    box(s, "frontend", 3.95, 1.5, 1.2, 0.45, "frontend", null);
    box(s, "auth", 3.95, 2.3, 1.2, 0.45, "auth", null);
    box(s, "payment", 5.55, 1.75, 1.5, 0.75, "payment-api", "virements");
    box(s, "db", 7.45, 1.5, 1.1, 0.45, "db", null);
    box(s, "authdb", 7.45, 2.3, 1.1, 0.45, "auth-db", null);
    arrow(s, 1.8, 2.125, 0.43, 0, RED);
    arrow(s, 3.55, 2.125, 1.98, 0);
    arrow(s, 7.05, 2.125, 0.38, 0);
    // ops
    box(s, "prometheus", 2.25, 3.5, 1.4, 0.6, "Prometheus", "métriques /5 s", "ops");
    box(s, "detector", 4.0, 3.5, 1.4, 0.6, "detector", "Isolation Forest", "green");
    box(s, "remediator", 5.75, 3.5, 1.4, 0.6, "remediator", "Ansible", "green");
    box(s, "proxy", 7.5, 3.5, 1.85, 0.6, "socket-proxy", "restart / kill seulement", "ops");
    box(s, "grafana", 2.25, 4.3, 1.4, 0.5, "Grafana", "technique + SOC", "ops");
    box(s, "alertmanager", 4.0, 4.3, 1.4, 0.5, "Alertmanager", "2e voie", "ops");
    box(s, "loki", 5.75, 4.3, 1.4, 0.5, "Loki", "journaux du WAF", "ops");
    arrow(s, 3.65, 3.8, 0.33, 0, GREEN);
    arrow(s, 5.4, 3.8, 0.33, 0, GREEN);
    arrow(s, 7.15, 3.8, 0.33, 0, GREEN);
    arrow(s, 6.45, 4.3, 0, -0.18, GREEN);
    arrow(s, 6.45, 3.5, 0, -0.98, GREEN, { dashType: "dash" });
    s.addText("ban + restart", { x: 6.52, y: 2.72, w: 1.1, h: 0.25, fontSize: 9, bold: true, color: GREEN, margin: 0, isTextBox: true });
    s.addText([{ text: "Seul le WAF", options: { bold: true, color: NAVY, breakLine: true } }, { text: "publie un port. Base, secrets et admin jamais exposés.", options: { color: MUTED } }],
      { x: 0.4, y: 3.5, w: 1.5, h: 1.3, fontSize: 10, valign: "top", margin: 0, isTextBox: true });
    s.addNotes("Tout passe par le WAF, le seul port exposé. Derrière, cinq réseaux : auth ne peut pas joindre la base des paiements, les bases n'ont aucun port publié. En bas, la boucle de résilience : Prometheus mesure, le detector décide qu'il y a anomalie, le remediator agit via Ansible et un proxy Docker restreint.");
  }

  // =============== 4. Attaque ===============
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Solution" });
    s.addText("L'incident : un DoS applicatif", { placeholder: "title" });
    const stats = [["40 s", "durée de l'attaque"], ["60", "connexions simultanées"], ["1", "PC distinct, via le WAF"]];
    stats.forEach(([v, l], i) => {
      const x = 0.5 + i * 1.55;
      card(s, `stat-${i}`, x, 1.2, 1.4, 1.3, TINT);
      s.addText(v, { x, y: 1.3, w: 1.4, h: 0.65, fontSize: 30, bold: true, color: RED, align: "center", margin: 0, isTextBox: true });
      s.addText(l, { x: x + 0.1, y: 1.95, w: 1.2, h: 0.45, fontSize: 10, color: MUTED, align: "center", valign: "top", margin: 0, isTextBox: true });
    });
    s.addText([
      { text: "Chaque requête porte un jeton invalide : payment-api doit interroger auth, la latence et le CPU explosent.", options: { bullet: true, breakLine: true } },
      { text: "Crédible : le trafic passe le WAF, qui ne bloque que les charges malveillantes.", options: { bullet: true, breakLine: true } },
      { text: "Reproductible : paramètres fixes, rejoué 10 fois.", options: { bullet: true } },
    ], { x: 0.5, y: 2.75, w: 4.5, h: 2.1, fontSize: 13, color: INK, paraSpaceAfter: 6, valign: "top", margin: 0, isTextBox: true });
    // autres attaques
    card(s, "autres", 5.4, 1.2, 4.1, 3.65, NAVY);
    s.addText("Disponibilité ≠ compromission", { x: 5.65, y: 1.35, w: 3.7, h: 0.4, fontSize: 15, bold: true, color: WHITE, margin: 0, isTextBox: true });
    const rows = [
      ["DoS", "Reprise automatique", MINT],
      ["SQLi / XSS", "Prévention : WAF 403", "FCA5A5"],
      ["Brute force", "Prévention : 429 + SOC", "FCA5A5"],
    ];
    rows.forEach(([a, r, c], i) => {
      const y = 1.95 + i * 0.62;
      s.addText(a, { x: 5.65, y, w: 1.3, h: 0.45, fontSize: 13, bold: true, color: WHITE, valign: "middle", margin: 0, isTextBox: true });
      s.addText(r, { x: 6.95, y, w: 2.45, h: 0.45, fontSize: 12, color: c, valign: "middle", margin: 0, isTextBox: true });
    });
    s.addText("Redémarrer ne corrige pas une fuite : pour une compromission, on prévient, on trace et on investigue.",
      { x: 5.65, y: 3.9, w: 3.7, h: 0.8, fontSize: 11, italic: true, color: "CBD5E1", valign: "top", margin: 0, isTextBox: true });
    s.addNotes("Notre attaque principale est un DoS applicatif depuis le PC attaquant : 60 connexions pendant 40 secondes. Nous avons aussi des scénarios d'injection et de brute force, mais la réponse n'est pas la même : on ne redémarre pas pour réparer une compromission.");
  }

  // =============== 5. Détection ML ===============
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Solution" });
    s.addText("Une détection apprise, sans seuil codé", { placeholder: "title" });
    s.addText([
      { text: "8 indicateurs de payment-api lus dans Prometheus (req/s, 5xx, latence p95, CPU, RAM, SQL actif…)", options: { bullet: true, breakLine: true } },
      { text: "Appris sur 25 min de trafic normal : 151 échantillons", options: { bullet: true, breakLine: true } },
      { text: "Isolation Forest + enveloppe statistique : l'Isolation Forest seul saturait à 0,506 sous une charge à 120 σ", options: { bullet: true, breakLine: true } },
      { text: "Seuil calibré automatiquement (pire score normal + 0,10)", options: { bullet: true, breakLine: true } },
      { text: "Chaque alerte cite les 3 indicateurs les plus anormaux", options: { bullet: true } },
    ], { x: 0.5, y: 1.2, w: 5.0, h: 3.7, fontSize: 13, color: INK, paraSpaceAfter: 8, valign: "top", margin: 0, isTextBox: true });
    const kpis = [["0 / 151", "fausse alerte sur le trafic normal"], ["0,608", "seuil calibré"], ["0,972", "score dès ≈ 14 req/s"]];
    kpis.forEach(([v, l], i) => {
      const y = 1.2 + i * 1.22;
      card(s, `kpi-ml-${i}`, 5.9, y, 3.6, 1.07, i === 0 ? GREEN_SOFT : TINT);
      s.addText(v, { x: 6.1, y: y + 0.1, w: 1.7, h: 0.85, fontSize: 28, bold: true, color: GREEN, valign: "middle", margin: 0, isTextBox: true });
      s.addText(l, { x: 7.8, y: y + 0.1, w: 1.6, h: 0.85, fontSize: 11, color: MUTED, valign: "middle", margin: 0, isTextBox: true });
    });
    s.addNotes("Le modèle apprend le comportement normal. Notre premier Isolation Forest saturait : il ne voyait pas l'ampleur d'une surcharge. Nous avons ajouté une enveloppe statistique. Résultat : zéro fausse alerte sur le trafic normal, et une alerte expliquée dès 14 requêtes par seconde.");
  }

  // =============== 6. Remédiation ===============
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Solution" });
    s.addText("Remédiation Zero-Touch, preuve à l'appui", { placeholder: "title" });
    const steps = [
      ["detected", "alerte du detector ou d'Alertmanager"],
      ["ban", "signature de l'attaquant trouvée dans Loki, bannie au WAF"],
      ["restart", "payment-api redémarré via Ansible si besoin"],
      ["preuve", "vraie transaction via le WAF = 200 et /health sain"],
      ["recovered", "journalisé, affiché dans l'interface et Grafana"],
    ];
    const lineY = 1.65;
    s.addShape(pres.shapes.LINE, { x: 0.75, y: lineY + 0.21, w: 8.5, h: 0, line: { color: "D9DEE3", width: 2 } });
    steps.forEach(([t, d], i) => {
      const x = 0.55 + i * 1.83;
      dot(s, `step-${i}`, x, lineY, String(i + 1), i === 4 ? GREEN : NAVY);
      s.addText(t, { x, y: lineY + 0.55, w: 1.7, h: 0.35, fontSize: 14, bold: true, color: NAVY, margin: 0, isTextBox: true });
      s.addText(d, { x, y: lineY + 0.9, w: 1.65, h: 0.95, fontSize: 11, color: MUTED, valign: "top", margin: 0, isTextBox: true });
    });
    card(s, "securite-moteur", 0.5, 3.75, 9.0, 1.1, TINT);
    s.addText([
      { text: "Un moteur puissant, mais bridé : ", options: { bold: true, color: NAVY } },
      { text: "jamais de socket Docker brut (proxy limité à restart / kill), aucun port publié, WAF rechargé par fichier + signal. Si une action échoue, escalade vers l'action suivante puis vers l'opérateur.", options: { color: INK } },
    ], { x: 0.75, y: 3.85, w: 8.5, h: 0.9, fontSize: 12.5, valign: "middle", margin: 0, isTextBox: true });
    s.addNotes("Quand l'alerte arrive, le remediator cherche dans les journaux du WAF qui envoie le plus de requêtes, le bannit, redémarre le service si nécessaire, puis rejoue une vraie transaction. Ce n'est qu'à ce moment qu'il déclare la reprise. Le moteur a des droits sur les conteneurs, donc on les a limités au strict nécessaire.");
  }

  // =============== 7. Résultats ===============
  {
    pres.addSection({ title: "Preuves" });
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Preuves" });
    s.addText("10 reprises autonomes sur 10", { placeholder: "title" });
    const rto = [13, 48, 47, 48, 48, 47, 46, 47, 51, 45];
    s.addChart(pres.charts.BAR, [{ name: "RTO (s)", labels: rto.map((_, i) => `#${i + 1}`), values: rto }], {
      x: 0.4, y: 1.1, w: 6.1, h: 3.85, barDir: "col",
      chartColors: [GREEN], barGapWidthPct: 45,
      showTitle: true, title: "RTO de bout en bout par essai (secondes, objectif < 60 s)", titleFontSize: 11, titleColor: NAVY, titleFontFace: "+mn-lt",
      showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 10, dataLabelColor: NAVY, dataLabelFontFace: "+mn-lt",
      valAxisMinVal: 0, valAxisMaxVal: 60, valAxisMajorUnit: 20,
      valAxisLabelColor: MUTED, catAxisLabelColor: MUTED, valAxisLabelFontSize: 9, catAxisLabelFontSize: 9,
      valAxisLabelFontFace: "+mn-lt", catAxisLabelFontFace: "+mn-lt",
      valGridLine: { color: "E5E9ED", size: 0.75 }, catGridLine: { style: "none" }, showLegend: false,
    });
    const kpis = [["10 / 10", "reprises sans intervention humaine"], ["47 s", "RTO médian (13 à 51 s)"], ["74", "tests unitaires, 5 microservices"]];
    kpis.forEach(([v, l], i) => {
      const y = 1.15 + i * 1.27;
      card(s, `kpi-res-${i}`, 6.8, y, 2.7, 1.1, i === 0 ? GREEN_SOFT : TINT);
      s.addText(v, { x: 7.0, y: y + 0.08, w: 2.4, h: 0.55, fontSize: 26, bold: true, color: GREEN, margin: 0, isTextBox: true });
      s.addText(l, { x: 7.0, y: y + 0.62, w: 2.4, h: 0.4, fontSize: 10.5, color: MUTED, margin: 0, isTextBox: true });
    });
    s.addNotes("Nous avons rejoué la démonstration dix fois avec remise à zéro entre chaque essai : dix reprises sur dix, sans intervention. Le RTO médian est de 47 secondes, sous l'objectif de 60. La majeure partie de ce temps est la détection, calculée sur une fenêtre d'une minute : nous avons préféré la fiabilité à la vitesse.");
  }

  // =============== 8. Sécurité ===============
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Preuves" });
    s.addText("Défense en profondeur et fonction SOC", { placeholder: "title" });
    const items = [
      ["WAF", "ModSecurity + OWASP CRS en blocage : SQLi / XSS en 403"],
      ["SOC Grafana", "échecs de login, injections bloquées, remédiations, chronologie"],
      ["Secrets", "SOPS + age : rien en clair dans le dépôt"],
      ["Cloisonnement", "auth hors du réseau des paiements, bases sans port"],
      ["Durcissement", "lecture seule, cap_drop ALL, non-root, images épinglées"],
      ["Moindre privilège", "rôles SQL limités, journal en ajout seul, assistant sans droit"],
    ];
    const w = 2.9, h = 1.65;
    items.forEach(([t, d], i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 0.5 + col * (w + 0.15), y = 1.2 + row * (h + 0.15);
      card(s, `secu-${i}`, x, y, w, h, row === 0 ? TINT : GREEN_SOFT);
      dot(s, `secu-${i}-dot`, x + 0.2, y + 0.2, "✓", row === 0 ? NAVY : GREEN);
      s.addText(t, { x: x + 0.75, y: y + 0.2, w: w - 0.9, h: 0.42, fontSize: 15, bold: true, color: NAVY, valign: "middle", margin: 0, isTextBox: true });
      s.addText(d, { x: x + 0.2, y: y + 0.75, w: w - 0.4, h: 0.8, fontSize: 12, color: INK, valign: "top", margin: 0, isTextBox: true });
    });
    s.addNotes("Côté cybersécurité : un WAF en mode blocage, une fonction SOC dans Grafana, des secrets chiffrés avec SOPS, un cloisonnement réseau strict et des conteneurs durcis. L'assistant RAG local, lui, ne fait que lire la documentation : il n'a aucun droit sur le système.");
  }

  // =============== 9. Gouvernance ===============
  {
    pres.addSection({ title: "Gouvernance" });
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Gouvernance" });
    s.addText("Des choix justifiés par le risque", { placeholder: "title" });
    const cols = [
      ["EBIOS RM", "Valeur critique : le paiement disponible. 5 ateliers reliés à l'architecture livrée, risques résiduels assumés.", "Critique", "gravité du DoS"],
      ["PCA / PRA", "4 scénarios couverts, responsabilités automate / opérateur, restauration et risques après reprise.", "RTO < 60 s", "RPO ≈ 0"],
      ["NIS2 / DORA", "Ce que le prototype démontre (tests de résilience, incidents) et ce qu'il ne peut pas prouver (notification, TLPT).", "DORA", "en priorité (finance)"],
    ];
    cols.forEach(([t, d, big, small], i) => {
      const x = 0.5 + i * 3.05;
      card(s, `gouv-${i}`, x, 1.2, 2.9, 3.0, i === 1 ? GREEN_SOFT : TINT);
      s.addText(t, { x: x + 0.2, y: 1.35, w: 2.5, h: 0.4, fontSize: 17, bold: true, color: NAVY, margin: 0, isTextBox: true });
      s.addText(big, { x: x + 0.2, y: 1.8, w: 2.5, h: 0.55, fontSize: 24, bold: true, color: GREEN, margin: 0, isTextBox: true });
      s.addText(small, { x: x + 0.2, y: 2.32, w: 2.5, h: 0.3, fontSize: 11, color: MUTED, margin: 0, isTextBox: true });
      s.addText(d, { x: x + 0.2, y: 2.75, w: 2.5, h: 1.35, fontSize: 11.5, color: INK, valign: "top", margin: 0, isTextBox: true });
    });
    s.addText([
      { text: "Recommandation à la direction : ", options: { bold: true, color: NAVY } },
      { text: "industrialiser sauvegardes et tests de restauration, puis MFA et CI de sécurité.", options: { color: INK } },
    ], { x: 0.5, y: 4.4, w: 9.0, h: 0.5, fontSize: 13, valign: "middle", margin: 0, isTextBox: true });
    s.addNotes("La gouvernance n'est pas un rapport générique : l'analyse EBIOS part de notre architecture, le PCA/PRA reprend notre RTO mesuré, et l'analyse NIS2/DORA distingue honnêtement ce qu'un prototype de quatre jours peut démontrer. Notre première recommandation : industrialiser les sauvegardes.");
  }

  // =============== 10. Limites ===============
  {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Gouvernance" });
    s.addText("Limites assumées et suite industrielle", { placeholder: "title" });
    const rows = [
      ["IP source masquée par Docker Desktop", "bannissement par IP et réputation sur un réseau réel"],
      ["25 min de trafic simulé pour apprendre", "semaines d'historique, réentraînement et suivi de dérive"],
      ["Détection en 20 à 40 s", "fenêtres courte + longue, features par client"],
      ["Restauration de base en squelette", "pg_dump planifiés et restauration testée"],
      ["Mono-poste Docker Compose", "Kubernetes, réplicas, base en haute disponibilité"],
    ];
    s.addText("Limite assumée", { x: 0.5, y: 1.15, w: 4.2, h: 0.35, fontSize: 12, bold: true, color: RED, margin: 0, isTextBox: true });
    s.addText("En contexte industriel", { x: 5.0, y: 1.15, w: 4.5, h: 0.35, fontSize: 12, bold: true, color: GREEN, margin: 0, isTextBox: true });
    rows.forEach(([l, r], i) => {
      const y = 1.55 + i * 0.68;
      card(s, `lim-${i}`, 0.5, y, 9.0, 0.58, i % 2 ? WHITE : TINT);
      s.addText(l, { x: 0.65, y, w: 4.1, h: 0.58, fontSize: 12.5, color: INK, valign: "middle", margin: 0, isTextBox: true });
      s.addText("→", { x: 4.65, y, w: 0.35, h: 0.58, fontSize: 14, color: MUTED, align: "center", valign: "middle", margin: 0, isTextBox: true });
      s.addText(r, { x: 5.0, y, w: 4.4, h: 0.58, fontSize: 12.5, color: NAVY, bold: true, valign: "middle", margin: 0, isTextBox: true });
    });
    s.addNotes("Nous ne prétendons pas livrer une plateforme de production. Ces limites sont documentées dans le dépôt, avec ce que nous ferions en contexte industriel.");
  }

  // =============== 11. Conclusion ===============
  {
    pres.addSection({ title: "Conclusion" });
    const s = pres.addSlide({ masterName: "DARK", sectionTitle: "Conclusion" });
    s.addImage({ data: logoWhite, x: 0.6, y: 0.55, w: 2.4, h: 2.4 * LOGO_RATIO });
    s.addText("Place à la démonstration", { placeholder: "title" });
    s.addText("Attaque depuis le PC Attaquant → anomalie détectée → remédiation automatique → transaction réussie",
      { x: 0.6, y: 3.0, w: 8.4, h: 0.7, fontSize: 16, color: "CBD5E1", margin: 0, isTextBox: true });
    s.addText("Équipe : [Prénom Nom] · [Prénom Nom] · [Prénom Nom] · [Prénom Nom] · [Prénom Nom]",
      { x: 0.6, y: 4.6, w: 8.8, h: 0.35, fontSize: 12, color: MINT, margin: 0, isTextBox: true });
    s.addText("Merci — questions bienvenues", { x: 0.6, y: 4.95, w: 8.8, h: 0.3, fontSize: 12, color: "94A3B8", margin: 0, isTextBox: true });
    s.addNotes("Passons à la démonstration en direct : lancement de l'attaque depuis le PC attaquant, puis on regarde l'onglet Supervision et Grafana jusqu'à la transaction de preuve.");
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  await pres.writeFile({ fileName: OUT });
  const { applyTheme } = require(process.env.APPLY_THEME);
  await applyTheme(OUT, THEME);
  console.log("OK", OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
