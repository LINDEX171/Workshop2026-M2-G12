const euros = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export const formatEuros = (value: number) => euros.format(value);

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
