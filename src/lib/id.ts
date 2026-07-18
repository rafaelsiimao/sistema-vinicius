// ═══════════════════════════════════════════════════════════════
// IDs — corrige a fragilidade #13 (uid = Date.now()+random podia colidir).
// ═══════════════════════════════════════════════════════════════

/** UUID v4 confiável para entidades sem id legível (lançamentos, pagamentos...). */
export function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback (ambientes muito antigos)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Próximo id legível de projeto/treinamento no padrão "P001" / "TR001".
 * Baseado no maior número já existente do mesmo tipo.
 */
export function nextProjetoId(
  existingIds: string[],
  kind: "projeto" | "treinamento",
): string {
  const prefix = kind === "projeto" ? "P" : "TR";
  const nums = existingIds
    .filter((id) => id.startsWith(prefix))
    .map((id) => parseInt(id.replace(/\D/g, ""), 10) || 0);
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return prefix + String(next).padStart(3, "0");
}
