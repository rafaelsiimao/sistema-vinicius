import { useAuth } from "@/auth/useAuth";
import { DataProvider } from "@/store/useData";
import { App } from "./App";
import { Login } from "@/pages/Login";

/** Decide entre carregando / login / app, conforme a autenticação. */
export function Root() {
  const { ready, needsLogin } = useAuth();

  if (!ready) return <div className="loading-screen">Carregando…</div>;
  if (needsLogin) return <Login />;

  // Só monta a camada de dados (e carrega do banco) depois de autenticado.
  return (
    <DataProvider>
      <App />
    </DataProvider>
  );
}
