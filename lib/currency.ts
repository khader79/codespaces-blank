export type CurrencyCode = "USD" | "ILS" | "JOD";

export const CURRENCIES: CurrencyCode[] = ["USD", "ILS", "JOD"];

export const EXCHANGE_RATES: Record<CurrencyCode, number> = {
  USD: 1,
  ILS: 3.65,
  JOD: 0.709,
};

export function fromUsd(amountUsd: number, currency: CurrencyCode): number {
  return (Number(amountUsd) || 0) * (EXCHANGE_RATES[currency] ?? 1);
}

export function convertCurrency(amount: number, from: CurrencyCode, to: CurrencyCode): number {
  const usd = (Number(amount) || 0) / (EXCHANGE_RATES[from] ?? 1);
  return Math.round(usd * (EXCHANGE_RATES[to] ?? 1) * 100) / 100;
}

export function roundMoney(amount: number): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

export function formatMoney(
  amount: number,
  currency: CurrencyCode,
  locale: "en" | "ar" = "en"
): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.round(amount * 100) / 100);
}