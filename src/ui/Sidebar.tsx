import { useEffect, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useData } from "@/store/useData";
import { useAuth } from "@/auth/useAuth";
import { migrateFromLegacy } from "@/data/migrateFromLegacy";
import { SEED } from "@/data/seed";
import { isoDate } from "@/lib/dates";
import type { Snapshot } from "@/types";
import { Modal } from "./Modal";

interface NavItem {
  to: string;
  label: string;
  icon: JSX.Element;
  /** true = visível só para admin. */
  admin?: boolean;
}
interface NavSection {
  title: string;
  admin?: boolean;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    title: "Gestão",
    items: [
      { to: "/", label: "Painel", icon: icon("M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z") },
      { to: "/projetos", label: "Projetos & Treinamentos", admin: true, icon: icon("M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z") },
      { to: "/tarefas", label: "Tarefas", icon: icon("M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11") },
    ],
  },
  {
    title: "Financeiro",
    items: [
      { to: "/faturamento", label: "Faturamento", admin: true, icon: icon("M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6") },
      { to: "/pagamentos", label: "Pagamento de Horas", icon: icon("M1 4h22v16H1zM1 10h22") },
      { to: "/custos", label: "Custos", admin: true, icon: icon("M2 5h20v14H2zM2 10h20") },
      { to: "/evolucao", label: "Evolução Mensal", admin: true, icon: icon("M22 12h-4l-3 9L9 3l-3 9H2") },
    ],
  },
  {
    title: "Visões",
    admin: true,
    items: [
      { to: "/kanban", label: "Kanban", icon: icon("M3 3h6v18H3zM9.5 3h6v12h-6zM16 3h6v9h-6z") },
      { to: "/gantt", label: "Gantt", icon: icon("M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1") },
      { to: "/calendario", label: "Calendário", icon: icon("M3 4h18v18H3zM16 2v4M8 2v4M3 10h18") },
    ],
  },
  {
    title: "Cadastros",
    admin: true,
    items: [{ to: "/equipe", label: "Equipe & Custo/hora", icon: icon("M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87") }],
  },
];

export function Sidebar() {
  const { snap, who, setWho, currentUser, isAdmin, importSnapshot, dataSource, toast } = useData();
  const { mode, authEmail, signOut } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("jobz_theme");
    return saved ? saved === "dark" : true;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("light", !isDark);
    localStorage.setItem("jobz_theme", isDark ? "dark" : "light");
  }, [isDark]);

  const sections = SECTIONS.map((sec) => ({
    ...sec,
    items: sec.items.filter((it) => isAdmin || !it.admin),
  })).filter((sec) => (isAdmin || !sec.admin) && sec.items.length > 0);

  function baixarBackup() {
    const blob = new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jobz_backup_${isoDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Backup baixado");
  }

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result));
        const snapshot = isNewSchema(parsed) ? (parsed as Snapshot) : migrateFromLegacy(parsed);
        void importSnapshot(snapshot);
      } catch {
        toast("Arquivo inválido", "err");
      }
    };
    reader.readAsText(file);
  }

  return (
    <nav className="sidebar">
      <div className="brand">
        JO<span>B</span>Z
      </div>

      <div className="who-box">
        {mode === "supabase" ? (
          <>
            <div className="who-label">Conectado</div>
            <div style={{ fontSize: 13, color: "var(--tx)", fontWeight: 500 }}>
              {currentUser?.nome ?? authEmail}
            </div>
            <div style={{ fontSize: 10, color: "var(--tx3)", marginBottom: 8 }}>{authEmail}</div>
            <button className="btn btn-sm" style={{ width: "100%", justifyContent: "center" }} onClick={() => void signOut()}>
              Sair
            </button>
          </>
        ) : (
          <>
            <div className="who-label">Quem sou eu</div>
            <select value={who} onChange={(e) => setWho(e.target.value)} aria-label="Perfil ativo">
              {snap.equipe.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </>
        )}
        {currentUser && (
          <span className={`badge ${isAdmin ? "b-blue" : "b-gray"}`} style={{ marginTop: 8, display: "inline-block" }}>
            {isAdmin ? "Admin — vê tudo" : "Consultor — vê só o seu"}
          </span>
        )}
      </div>

      {sections.map((sec) => (
        <div key={sec.title}>
          <div className="nav-section">{sec.title}</div>
          {sec.items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === "/"}
              className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
            >
              {it.icon}
              {it.to === "/pagamentos" && !isAdmin ? "Meus Pagamentos" : it.label}
            </NavLink>
          ))}
        </div>
      ))}

      <div className="sidebar-foot">
        {isAdmin && (
          <>
            <div className="nav-section">Dados</div>
            <div className="nav-item" onClick={baixarBackup} role="button" tabIndex={0}>
              {icon("M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3")}
              Baixar backup
            </div>
            <div className="nav-item" onClick={() => fileRef.current?.click()} role="button" tabIndex={0}>
              {icon("M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12")}
              Importar / migrar backup
            </div>
            <input ref={fileRef} type="file" accept="application/json" hidden onChange={onImportFile} />
            <div className="nav-item" style={{ color: "var(--red)" }} onClick={() => setConfirmRestore(true)} role="button" tabIndex={0}>
              {icon("M1 4v6h6M3.5 15a9 9 0 102.1-9.36L1 10")}
              Restaurar demonstração
            </div>
          </>
        )}
        <div style={{ padding: "10px 14px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <button
            className="btn btn-sm"
            style={{ flex: 1, justifyContent: "center" }}
            onClick={() => setIsDark((d) => !d)}
            title={isDark ? "Ativar tema claro" : "Ativar tema escuro"}
          >
            {isDark ? "☀ Claro" : "🌙 Escuro"}
          </button>
        </div>
        <div className="data-badge">
          fonte: <b>{dataSource === "supabase" ? "nuvem (Supabase)" : "local (navegador)"}</b>
        </div>
      </div>

      {confirmRestore && (
        <Modal
          title="Restaurar dados de demonstração?"
          subtitle="Isto substitui TODOS os dados atuais pelos dados de exemplo. Baixe um backup antes."
          onClose={() => setConfirmRestore(false)}
          actions={
            <>
              <button className="btn" onClick={() => setConfirmRestore(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  void importSnapshot(structuredClone(SEED));
                  setConfirmRestore(false);
                }}
              >
                Restaurar
              </button>
            </>
          }
        >
          <p style={{ fontSize: 13, color: "var(--tx2)" }}>
            Recomendado apenas para recomeçar do zero em ambiente de testes.
          </p>
        </Modal>
      )}
    </nav>
  );
}

function isNewSchema(o: unknown): boolean {
  const p = (o as Snapshot).projetos;
  return Array.isArray(p) && (p.length === 0 || "valorCents" in (p[0] as object));
}

function icon(d: string): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      {d.split("M").filter(Boolean).map((seg, i) => (
        <path key={i} d={"M" + seg} />
      ))}
    </svg>
  );
}
