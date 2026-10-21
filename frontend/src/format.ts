const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export const formatEuros = (value: number) => euros.format(value);

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });

// Numéro de compte fictif, toujours masqué (dérivé de l'id, jamais un IBAN)
export const formatAccount = (id: number) => `•••• ${String(id).padStart(4, "0")}`;

export const formatTxRef = (id: number) => `TX-${String(id).padStart(6, "0")}`;
