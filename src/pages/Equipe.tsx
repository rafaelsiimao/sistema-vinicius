import { useState } from "react";
import { useData } from "@/store/useData";
import { Modal } from "@/ui/Modal";
import { fmtBRL2, reaisToCents, centsToReais } from "@/lib/money";
import { uuid } from "@/lib/id";
import type { Consultor, Papel } from "@/types";

export function Equipe() {
  const { snap, save, remove, toast } = useData();
  const [editing, setEditing] = useState<Consultor | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="page-title">Equipe & Custo/hora</div>
      <div className="page-sub">
        Base de todo o cálculo financeiro — cada hora lançada é custeada por este valor
      </div>

      <div className="filter-bar">
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Novo consultor
        </button>
      </div>

      <div className="tbl-wrap">
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th className="l">Nome</th>
                <th className="l">E-mail</th>
                <th className="l">Função</th>
                <th>Papel</th>
                <th>Custo/hora</th>
                <th>Ativo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {snap.equipe.map((c) => (
                <tr key={c.id}>
                  <td className="l td-name">{c.nome}</td>
                  <td className="l" style={{ fontSize: 11 }}>{c.email || <span className="muted">—</span>}</td>
                  <td className="l">{c.funcao}</td>
                  <td>
                    <span className={`badge ${c.papel === "admin" ? "b-blue" : "b-gray"}`}>
                      {c.papel === "admin" ? "Admin" : "Consultor"}
                    </span>
                  </td>
                  <td className="td-val">{fmtBRL2(c.custoHoraCents)}</td>
                  <td>
                    {c.ativo ? (
                      <span className="badge b-green">Sim</span>
                    ) : (
                      <span className="badge b-gray">Não</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-sm" onClick={() => setEditing(c)}>
                        editar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {snap.equipe.length === 0 && (
                <tr>
                  <td colSpan={7} className="empty-state">
                    Nenhum consultor cadastrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(creating || editing) && (
        <ConsultorForm
          consultor={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={(c) => {
            void save("equipe", c);
            toast("Consultor salvo");
            setCreating(false);
            setEditing(null);
          }}
          onDelete={
            editing
              ? () => {
                  const usado = snap.lancamentos.some((l) => l.consultorId === editing.id);
                  if (usado) {
                    toast("Consultor tem horas lançadas — inative em vez de excluir", "err");
                    return;
                  }
                  void remove("equipe", editing.id);
                  toast("Consultor removido");
                  setEditing(null);
                }
              : undefined
          }
        />
      )}
    </>
  );
}

function ConsultorForm({
  consultor,
  onClose,
  onSave,
  onDelete,
}: {
  consultor: Consultor | null;
  onClose: () => void;
  onSave: (c: Consultor) => void;
  onDelete?: () => void;
}) {
  const [nome, setNome] = useState(consultor?.nome ?? "");
  const [email, setEmail] = useState(consultor?.email ?? "");
  const [funcao, setFuncao] = useState(consultor?.funcao ?? "Consultor");
  const [custoReais, setCustoReais] = useState(
    consultor ? String(centsToReais(consultor.custoHoraCents)) : "",
  );
  const [ativo, setAtivo] = useState(consultor?.ativo ?? true);
  const [papel, setPapel] = useState<Papel>(consultor?.papel ?? "consultor");
  const [erro, setErro] = useState("");

  function salvar() {
    if (!nome.trim()) {
      setErro("Informe o nome.");
      return;
    }
    onSave({
      id: consultor?.id ?? uuid(),
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      funcao: funcao.trim() || "Consultor",
      custoHoraCents: reaisToCents(custoReais || "0"),
      ativo,
      papel,
    });
  }

  return (
    <Modal
      title={consultor ? "Editar consultor" : "Novo consultor"}
      onClose={onClose}
      actions={
        <>
          {onDelete && (
            <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={onDelete}>
              Excluir
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={salvar}>
            Salvar
          </button>
        </>
      }
    >
      <div className="form-full">
        <label>Nome</label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-invalid={!!erro}
          onKeyDown={(e) => e.key === "Enter" && salvar()}
        />
        {erro && <div className="field-error">{erro}</div>}
      </div>
      <div className="form-full">
        <label>E-mail (usado para login)</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="consultor@jobz.com.br"
        />
        <div className="hint">Deve ser o mesmo e-mail cadastrado no login (Supabase Auth).</div>
      </div>
      <div className="form-grid">
        <div>
          <label>Função</label>
          <input value={funcao} onChange={(e) => setFuncao(e.target.value)} />
        </div>
        <div>
          <label>Custo/hora (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={custoReais}
            onChange={(e) => setCustoReais(e.target.value)}
          />
        </div>
      </div>
      <div className="form-full">
        <label>Papel de acesso</label>
        <select value={papel} onChange={(e) => setPapel(e.target.value as Papel)}>
          <option value="consultor">Consultor — vê só as próprias tarefas e o próprio a receber</option>
          <option value="admin">Admin — vê e edita tudo</option>
        </select>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={ativo}
          onChange={(e) => setAtivo(e.target.checked)}
          style={{ width: "auto" }}
        />
        Ativo
      </label>
    </Modal>
  );
}
