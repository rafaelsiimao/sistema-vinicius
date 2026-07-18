import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { DATA_SOURCE } from "@/data";
import { supabase } from "@/data/supabaseClient";

type Mode = "local" | "supabase";

interface AuthValue {
  mode: Mode;
  /** Pronto para decidir (sessão já verificada). */
  ready: boolean;
  session: Session | null;
  /** E-mail do usuário logado (identidade). Null no modo local. */
  authEmail: string | null;
  /** true quando o modo é nuvem e ainda não há sessão. */
  needsLogin: boolean;
  signIn: (email: string, senha: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const mode = DATA_SOURCE;
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(mode === "local");

  useEffect(() => {
    if (mode !== "supabase" || !supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, [mode]);

  async function signIn(email: string, senha: string) {
    if (!supabase) return { error: "Supabase não configurado." };
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
    return { error: error ? traduzErro(error.message) : null };
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut();
  }

  const value: AuthValue = {
    mode,
    ready,
    session,
    authEmail: session?.user?.email ?? null,
    needsLogin: mode === "supabase" && !session,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}

function traduzErro(msg: string): string {
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg)) return "E-mail ainda não confirmado.";
  if (/failed to fetch|network|fetch/i.test(msg)) return "Não foi possível conectar ao servidor. Verifique a internet e a configuração do Supabase.";
  return msg;
}
