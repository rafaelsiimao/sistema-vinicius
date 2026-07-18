import type { Repository } from "./repository";
import { LocalRepository } from "./localRepository";
import { SupabaseRepository } from "./supabaseRepository";
import { CONFIG } from "@/config";

export const DATA_SOURCE: "local" | "supabase" = CONFIG.dataSource;

/** Escolhe a implementação da camada de dados conforme o ambiente. */
export function createRepository(): Repository {
  return DATA_SOURCE === "supabase"
    ? new SupabaseRepository()
    : new LocalRepository();
}

export type { Repository } from "./repository";
export { PersistError } from "./repository";
