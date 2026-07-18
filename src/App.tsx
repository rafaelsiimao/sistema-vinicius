import { Navigate, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { Sidebar } from "@/ui/Sidebar";
import { useData } from "@/store/useData";
import { useAuth } from "@/auth/useAuth";
import { Painel } from "@/pages/Painel";
import { Projetos } from "@/pages/Projetos";
import { Faturamento } from "@/pages/Faturamento";
import { Pagamentos } from "@/pages/Pagamentos";
import { Equipe } from "@/pages/Equipe";
import { Tarefas } from "@/pages/Tarefas";
import { Custos } from "@/pages/Custos";
import { Evolucao } from "@/pages/Evolucao";
import { Kanban } from "@/pages/Kanban";
import { Gantt } from "@/pages/Gantt";
import { Calendario } from "@/pages/Calendario";

/** Bloqueia rotas de admin para consultores (defesa em profundidade além do menu). */
function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useData();
  return isAdmin ? <>{children}</> : <Navigate to="/" replace />;
}

export function App() {
  const { loading, error, currentUser, snap } = useData();
  const { mode, authEmail, signOut } = useAuth();

  const bootstrap = mode === "supabase" && !!authEmail && snap.equipe.length === 0;

  // Autenticado na nuvem, e-mail não corresponde a consultor E o sistema já tem equipe.
  if (mode === "supabase" && !loading && !currentUser && !bootstrap) {
    return (
      <div className="loading-screen" style={{ flexDirection: "column", gap: 14, textAlign: "center", padding: 20 }}>
        <div>
          Sua conta (<b>{authEmail}</b>) não está vinculada a nenhum consultor.
          <br />Peça a um administrador para cadastrar você em <b>Equipe</b> com este e-mail.
        </div>
        <button className="btn" onClick={() => void signOut()}>Sair</button>
      </div>
    );
  }

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        {loading ? (
          <div className="loading-screen">Carregando…</div>
        ) : error ? (
          <div className="alert alert-amber">Erro ao carregar dados: {error}</div>
        ) : (
          <>
          {bootstrap && (
            <div className="alert alert-amber">
              Sistema ainda sem dados. Vá em <b>Dados → Importar / migrar backup</b> (barra lateral)
              para carregar o backup inicial. Depois disso os papéis passam a valer normalmente.
            </div>
          )}
          <Routes>
            <Route path="/" element={<Painel />} />
            <Route path="/tarefas" element={<Tarefas />} />
            <Route path="/pagamentos" element={<Pagamentos />} />
            <Route path="/projetos" element={<RequireAdmin><Projetos /></RequireAdmin>} />
            <Route path="/faturamento" element={<RequireAdmin><Faturamento /></RequireAdmin>} />
            <Route path="/equipe" element={<RequireAdmin><Equipe /></RequireAdmin>} />
            <Route path="/custos" element={<RequireAdmin><Custos /></RequireAdmin>} />
            <Route path="/evolucao" element={<RequireAdmin><Evolucao /></RequireAdmin>} />
            <Route path="/kanban" element={<RequireAdmin><Kanban /></RequireAdmin>} />
            <Route path="/gantt" element={<RequireAdmin><Gantt /></RequireAdmin>} />
            <Route path="/calendario" element={<RequireAdmin><Calendario /></RequireAdmin>} />
            <Route path="*" element={<Painel />} />
          </Routes>
          </>
        )}
      </main>
    </div>
  );
}
