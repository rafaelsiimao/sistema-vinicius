import type { CollectionName, Snapshot } from "@/types";
import { EMPTY_SNAPSHOT } from "@/types";
import { PersistError, type Repository } from "./repository";
import { SEED } from "./seed";

const STORAGE_KEY = "jobz_v4";

interface HasId {
  id: string;
}

/**
 * Implementação LOCAL (localStorage). Funciona offline, sem backend.
 * Mantém uma cópia em memória e persiste a cada mutação.
 * Diferente do protótipo: erros de cota SÃO propagados (PersistError),
 * nunca engolidos (corrige a fragilidade #2).
 */
export class LocalRepository implements Repository {
  private cache: Snapshot | null = null;

  async loadAll(): Promise<Snapshot> {
    if (this.cache) return clone(this.cache);
    const raw = safeGet(STORAGE_KEY);
    if (raw) {
      try {
        this.cache = mergeDefaults(JSON.parse(raw) as Partial<Snapshot>);
      } catch {
        this.cache = clone(SEED);
      }
    } else {
      // Primeiro acesso: semeia com dados de demonstração.
      this.cache = clone(SEED);
      this.persist();
    }
    return clone(this.cache);
  }

  async upsert<C extends CollectionName>(
    collection: C,
    row: Snapshot[C][number],
  ): Promise<void> {
    const snap = await this.ensure();
    const list = snap[collection] as unknown as HasId[];
    const item = row as unknown as HasId;
    const idx = list.findIndex((r) => r.id === item.id);
    if (idx >= 0) list[idx] = item;
    else list.push(item);
    this.persist();
  }

  async remove(collection: CollectionName, id: string): Promise<void> {
    const snap = await this.ensure();
    const list = snap[collection] as unknown as HasId[];
    const idx = list.findIndex((r) => r.id === id);
    if (idx >= 0) list.splice(idx, 1);
    this.persist();
  }

  async replaceAll(snap: Snapshot): Promise<void> {
    this.cache = mergeDefaults(snap);
    this.persist();
  }

  private async ensure(): Promise<Snapshot> {
    if (!this.cache) await this.loadAll();
    return this.cache!;
  }

  private persist(): void {
    if (!this.cache) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cache));
    } catch (e) {
      throw new PersistError(
        "Não foi possível salvar localmente (armazenamento cheio ou bloqueado). " +
          "Considere ativar o modo nuvem (Supabase).",
        e,
      );
    }
  }
}

/** Garante que todas as coleções existam (evita crash com backup antigo). #3 */
function mergeDefaults(partial: Partial<Snapshot>): Snapshot {
  return { ...clone(EMPTY_SNAPSHOT), ...clone(partial as Snapshot) };
}

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
