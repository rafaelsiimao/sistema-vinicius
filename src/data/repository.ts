import type { CollectionName, Snapshot } from "@/types";

/**
 * Contrato da camada de dados. A UI depende SÓ desta interface — nunca de
 * localStorage ou Supabase diretamente (inversão de dependência).
 * Trocar "local" ⇄ "supabase" não altera uma linha de tela.
 */
export interface Repository {
  /** Carrega o banco inteiro. */
  loadAll(): Promise<Snapshot>;

  /** Insere ou atualiza uma linha (por id) em uma coleção. */
  upsert<C extends CollectionName>(
    collection: C,
    row: Snapshot[C][number],
  ): Promise<void>;

  /** Remove uma linha por id. */
  remove(collection: CollectionName, id: string): Promise<void>;

  /** Substitui todo o banco (usado por importação de backup). */
  replaceAll(snap: Snapshot): Promise<void>;
}

/** Erro de persistência que a UI deve mostrar ao usuário (ex.: cota estourada). */
export class PersistError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "PersistError";
  }
}
