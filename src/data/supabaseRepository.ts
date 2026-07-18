import type { CollectionName, Snapshot } from "@/types";
import { EMPTY_SNAPSHOT } from "@/types";
import { PersistError, type Repository } from "./repository";
import { requireSupabase } from "./supabaseClient";

/** Coleção (TS) → tabela (Postgres). */
const TABLES: Record<CollectionName, string> = {
  equipe: "consultores",
  projetos: "projetos",
  parcelas: "parcelas",
  tarefas: "tarefas",
  lancamentos: "lancamentos",
  pagamentos: "pagamentos",
  custos: "custos",
  comentarios: "comentarios",
  categoriasCusto: "categorias_custo",
};

/**
 * Implementação NUVEM (Supabase / PostgreSQL). Multiusuário, com backups
 * automáticos e RLS. As colunas do banco são o snake_case dos campos TS, então
 * o mapeamento é automático (camel ⇄ snake) — sem escrever mapper por entidade.
 */
export class SupabaseRepository implements Repository {
  async loadAll(): Promise<Snapshot> {
    const sb = requireSupabase();
    const names = Object.keys(TABLES) as CollectionName[];
    const results = await Promise.all(
      names.map((n) => sb.from(TABLES[n]).select("*")),
    );
    const snap = { ...EMPTY_SNAPSHOT } as Record<CollectionName, unknown[]>;
    names.forEach((n, i) => {
      const { data, error } = results[i];
      if (error) throw new PersistError(`Erro ao carregar ${n}: ${error.message}`, error);
      snap[n] = (data ?? []).map((r) => toCamel(r));
    });
    return snap as unknown as Snapshot;
  }

  async upsert<C extends CollectionName>(
    collection: C,
    row: Snapshot[C][number],
  ): Promise<void> {
    const sb = requireSupabase();
    const { error } = await sb.from(TABLES[collection]).upsert(toSnake(row));
    if (error) throw new PersistError(error.message, error);
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    const sb = requireSupabase();
    const { error } = await sb.from(TABLES[collection]).delete().eq("id", id);
    if (error) throw new PersistError(error.message, error);
  }

  async replaceAll(snap: Snapshot): Promise<void> {
    const sb = requireSupabase();
    const names = Object.keys(TABLES) as CollectionName[];
    // Limpa em ordem inversa (filhos antes dos pais) para respeitar as FKs...
    for (const n of [...names].reverse()) {
      await sb.from(TABLES[n]).delete().neq("id", "__none__");
    }
    // ...e insere na ordem direta (pais antes de filhos).
    for (const n of names) {
      const rows = (snap[n] as unknown[]).map(toSnake);
      if (rows.length) {
        const { error } = await sb.from(TABLES[n]).insert(rows);
        if (error) throw new PersistError(`Erro ao importar ${n}: ${error.message}`, error);
      }
    }
  }
}

// ── conversão de chaves camelCase ⇄ snake_case ────────────────
function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
}
function snakeToCamel(s: string): string {
  return s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}
function toSnake(obj: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[camelToSnake(k)] = v;
  }
  return out;
}
function toCamel<T>(obj: unknown): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[snakeToCamel(k)] = v;
  }
  return out as T;
}
