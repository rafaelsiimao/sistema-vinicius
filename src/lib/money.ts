// ═══════════════════════════════════════════════════════════════
// DINHEIRO — sempre em CENTAVOS (inteiro), nunca float.
// Corrige a fragilidade #6/#7/#8 da auditoria: aritmética monetária confiável.
// ═══════════════════════════════════════════════════════════════

const BRL0 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const BRL2 = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formata centavos como R$ inteiro (sem centavos). Ex.: 1400000 → "R$ 14.000". */
export function fmtBRL(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return BRL0.format(cents / 100);
}

/** Formata centavos como R$ com 2 casas. Ex.: 145055 → "R$ 1.450,55". */
export function fmtBRL2(cents: number | null | undefined): string {
  if (cents == null) return "—";
  return BRL2.format(cents / 100);
}

/** Converte um valor digitado em reais (ex.: "1400,50" ou 1400.5) para centavos. */
export function reaisToCents(reais: number | string): number {
  if (typeof reais === "number") return Math.round(reais * 100);
  const normalized = reais
    .trim()
    .replace(/\s|R\$/g, "")
    .replace(/\.(?=\d{3}(\D|$))/g, "") // remove separador de milhar
    .replace(",", ".");
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Converte centavos para reais (número) — útil para inputs. */
export function centsToReais(cents: number): number {
  return cents / 100;
}

/**
 * Divide um total (em centavos) em N partes inteiras, jogando o resto de
 * arredondamento na última parte — a soma das partes bate EXATAMENTE com o total.
 */
export function splitCents(totalCents: number, parts: number): number[] {
  if (parts <= 0) return [];
  const base = Math.floor(totalCents / parts);
  const result = new Array<number>(parts).fill(base);
  const remainder = totalCents - base * parts;
  result[parts - 1] += remainder;
  return result;
}
