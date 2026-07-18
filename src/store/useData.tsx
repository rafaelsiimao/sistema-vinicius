import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CollectionName, Consultor, Snapshot } from "@/types";
import { EMPTY_SNAPSHOT } from "@/types";
import { createRepository, DATA_SOURCE, PersistError, type Repository } from "@/data";
import { makeRateOf } from "@/lib/calc";
import { useAuth } from "@/auth/useAuth";
import { Toast, type ToastState } from "@/ui/Toast";

interface HasId {
  id: string;
}

interface DataContextValue {
  snap: Snapshot;
  loading: boolean;
  error: string | null;
  dataSource: "local" | "supabase";
  /** Id do consultor "logado" / perfil ativo. */
  who: string;
  setWho: (id: string) => void;
  /** Consultor correspondente ao perfil ativo (null se não encontrado). */
  currentUser: Consultor | null;
  /** true se o perfil ativo tem papel de admin. */
  isAdmin: boolean;
  /** custo/hora (centavos) de um consultor. */
  rateOf: (consultorId: string) => number;
  save: <C extends CollectionName>(c: C, row: Snapshot[C][number]) => Promise<void>;
  remove: (c: CollectionName, id: string) => Promise<void>;
  importSnapshot: (snap: Snapshot) => Promise<void>;
  reload: () => Promise<void>;
  toast: (msg: string, kind?: "ok" | "err") => void;
}

const DataContext = createContext<DataContextValue | null>(null);

const WHO_KEY = "jobz_who";

export function DataProvider({ children }: { children: ReactNode }) {
  const repoRef = useRef<Repository | null>(null);
  if (repoRef.current === null) repoRef.current = createRepository();
  const repo = repoRef.current;
  if (!repo) throw new Error("repo");

  const [snap, setSnap] = useState<Snapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [who, setWhoState] = useState<string>(() => localStorage.getItem(WHO_KEY) ?? "");
  const [toastState, setToastState] = useState<ToastState | null>(null);

  const toast = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    setToastState({ msg, kind, at: Date.now() });
  }, []);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await repo.loadAll();
      setSnap(data);
      setError(null);
      // Perfil padrão: mantém o atual se ainda existir; senão cai para o 1º da equipe.
      setWhoState((cur) => (data.equipe.some((c) => c.id === cur) ? cur : data.equipe[0]?.id ?? ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [repo]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const setWho = useCallback((id: string) => {
    setWhoState(id);
    localStorage.setItem(WHO_KEY, id);
  }, []);

  const save = useCallback(
    async <C extends CollectionName>(c: C, row: Snapshot[C][number]) => {
      const item = row as unknown as HasId;
      setSnap((prev) => {
        const list = prev[c] as unknown as HasId[];
        const idx = list.findIndex((r) => r.id === item.id);
        const nextList = idx >= 0
          ? list.map((r) => (r.id === item.id ? item : r))
          : [...list, item];
        return { ...prev, [c]: nextList } as Snapshot;
      });
      try {
        await repo.upsert(c, row);
      } catch (e) {
        toast(e instanceof PersistError ? e.message : "Erro ao salvar", "err");
        await reload(); // reverte para o estado persistido
      }
    },
    [repo, toast, reload],
  );

  const remove = useCallback(
    async (c: CollectionName, id: string) => {
      setSnap((prev) => {
        const list = prev[c] as unknown as HasId[];
        return { ...prev, [c]: list.filter((r) => r.id !== id) } as Snapshot;
      });
      try {
        await repo.remove(c, id);
      } catch (e) {
        toast(e instanceof PersistError ? e.message : "Erro ao excluir", "err");
        await reload();
      }
    },
    [repo, toast, reload],
  );

  const importSnapshot = useCallback(
    async (data: Snapshot) => {
      setSnap(data);
      try {
        await repo.replaceAll(data);
        toast("Backup importado");
      } catch (e) {
        toast(e instanceof PersistError ? e.message : "Erro ao importar", "err");
        await reload();
      }
    },
    [repo, toast, reload],
  );

  const rateOf = useMemo(() => makeRateOf(snap.equipe), [snap.equipe]);

  // No modo nuvem a identidade vem do usuário logado (por e-mail); no modo local,
  // do seletor "Quem sou eu".
  const { mode, authEmail } = useAuth();
  const currentUser = useMemo(() => {
    if (mode === "supabase") {
      if (!authEmail) return null;
      const e = authEmail.toLowerCase();
      return snap.equipe.find((c) => c.email && c.email.toLowerCase() === e) ?? null;
    }
    return snap.equipe.find((c) => c.id === who) ?? null;
  }, [mode, authEmail, snap.equipe, who]);

  // Bootstrap: banco novo (sem equipe) + usuário autenticado = admin, só para
  // permitir a carga inicial dos dados. Depois que houver equipe, valem os papéis.
  const bootstrap = mode === "supabase" && !!authEmail && snap.equipe.length === 0;
  const isAdmin = currentUser?.papel === "admin" || bootstrap;

  const value: DataContextValue = {
    snap,
    loading,
    error,
    dataSource: DATA_SOURCE,
    who,
    setWho,
    currentUser,
    isAdmin,
    rateOf,
    save,
    remove,
    importSnapshot,
    reload,
    toast,
  };

  return (
    <DataContext.Provider value={value}>
      {children}
      <Toast state={toastState} />
    </DataContext.Provider>
  );
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error("useData deve ser usado dentro de <DataProvider>");
  return ctx;
}
