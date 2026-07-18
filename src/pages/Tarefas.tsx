import { useMemo, useState } from "react";
import { useData } from "@/store/useData";
import { Modal } from "@/ui/Modal";
import { competenciaOf, fmtDate, labelCompetencia, todayISO } from "@/lib/dates";
import { uuid } from "@/lib/id";
import type { Lancamento, Tarefa, TarefaStatus } from "@/types";

const STATUS_TAREFA: TarefaStatus[] = ["Não Iniciada", "Em Andamento", "Concluída", "Pausada"];
const fmtH = (h: number) => h.toFixed(1);

export function Tarefas() {
  const { snap, currentUser, isAdmin, save, remove, toast } = useData();
  const [fProjeto, setFProjeto] = useState("");
  const [fMes, setFMes] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [lancar, setLancar] = useState<Tarefa | null>(null);
  const [editar, setEditar] = useState<Tarefa | null>(null);
  const [criar, setCriar] = useState(false);

  const nomeProjeto = useMemo(() => {
    const m = new Map(snap.projetos.map((p) => [p.id, p.nome || p.cliente]));
    return (id: string) => m.get(id) ?? id;
  }, [snap.projetos]);
  const nomeConsultor = useMemo(() => {
    const m = new Map(snap.equipe.map((c) => [c.id, c.nome]));
    return (id: string | null) => (id ? m.get(id) ?? id : "—");
  }, [snap.equipe]);

  const horasLancadas = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of snap.lancamentos) {
      if (l.tarefaId) m.set(l.tarefaId, (m.get(l.tarefaId) ?? 0) + l.horas);
    }
    return (tarefaId: string) => m.get(tarefaId) ?? 0;
  }, [snap.lancamentos]);

  const mesesDisponiveis = useMemo(
    () => [...new Set(snap.tarefas.map((t) => (t.dtIni ? competenciaOf(t.dtIni) : "")).filter(Boolean))].sort(),
    [snap.tarefas],
  );

  const tarefas = useMemo(() => {
    return snap.tarefas
      .filter((t) => (isAdmin ? true : t.respId === currentUser?.id))
      .filter((t) => (fProjeto ? t.projetoId === fProjeto : true))
      .filter((t) => (fMes ? t.dtIni?.slice(0, 7) === fMes : true))
      .filter((t) => (fStatus ? t.status === fStatus : true))
      .sort((a, b) => (a.dtIni ?? "").localeCompare(b.dtIni ?? ""));
  }, [snap.tarefas, isAdmin, currentUser?.id, fProjeto, fMes, fStatus]);

  function mudarStatus(t: Tarefa, status: TarefaStatus) {
    void save("tarefas", { ...t, status });
  }

  return (
    <>
      <div className="page-title">Tarefas</div>
      <div className="page-sub">
        {isAdmin ? "Todas as tarefas — lançamento de horas e andamento" : "Minhas tarefas — lance horas e atualize o andamento"}
      </div>

      <div className="filter-bar">
        {isAdmin && (
          <select value={fProjeto} onChange={(e) => setFProjeto(e.target.value)}>
            <option value="">Projeto: todos</option>
            {snap.projetos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id} — {p.nome || p.cliente}
              </option>
            ))}
          </select>
        )}
        <select value={fMes} onChange={(e) => setFMes(e.target.value)}>
          <option value="">Mês: todos</option>
          {mesesDisponiveis.map((m) => (
            <option key={m} value={m}>
              {labelCompetencia(m)}
            </option>
          ))}
        </select>
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
          <option value="">Status: todos</option>
          {STATUS_TAREFA.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => setCriar(true)}>
            + Nova tarefa
          </button>
        )}
      </div>

      <div className="tbl-wrap">
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th className="l" style={{ minWidth: 280 }}>Tarefa</th>
                <th className="l">Projeto</th>
                <th className="l">Resp.</th>
                <th>Período</th>
                <th>Status</th>
                <th>H. Prev</th>
                <th>H. Lanç.</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {tarefas.map((t) => (
                <tr key={t.id} className={t.ativa ? "" : "row-inactive"}>
                  <td className="l td-name" style={{ whiteSpace: "normal" }}>{t.nome}</td>
                  <td className="l" style={{ fontSize: 11 }}>{nomeProjeto(t.projetoId)}</td>
                  <td className="l" style={{ fontSize: 11 }}>{nomeConsultor(t.respId)}</td>
                  <td style={{ fontSize: 10 }} className="muted">{fmtDate(t.dtIni)}</td>
                  <td>
                    <select
                      value={t.status}
                      onChange={(e) => mudarStatus(t, e.target.value as TarefaStatus)}
                      style={{ width: "auto", fontSize: 11, padding: "3px 6px" }}
                      aria-label="Status da tarefa"
                    >
                      {STATUS_TAREFA.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="td-val">{fmtH(t.hPrev)}</td>
                  <td className="td-val" style={{ color: horasLancadas(t.id) > 0 ? "var(--accent2)" : "var(--tx3)", fontWeight: horasLancadas(t.id) > 0 ? 700 : 400 }}>
                    {fmtH(horasLancadas(t.id))}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-sm" onClick={() => setLancar(t)}>
                        lançar horas
                      </button>
                      {isAdmin && (
                        <button className="btn btn-sm" onClick={() => setEditar(t)}>
                          editar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {tarefas.length === 0 && (
                <tr>
                  <td colSpan={8} className="empty-state">
                    {isAdmin ? "Nenhuma tarefa com os filtros." : "Você não tem tarefas atribuídas para os filtros atuais."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {lancar && (
        <LancarHorasModal
          tarefa={lancar}
          onClose={() => setLancar(null)}
          onSave={(l) => {
            void save("lancamentos", l);
            toast(`${fmtH(l.horas)}h lançadas`);
            setLancar(null);
          }}
        />
      )}
      {(criar || editar) && (
        <TarefaFormModal
          tarefa={editar}
          onClose={() => { setCriar(false); setEditar(null); }}
          onSave={(t) => { void save("tarefas", t); toast("Tarefa salva"); setCriar(false); setEditar(null); }}
          onDelete={editar ? () => {
            const temHoras = snap.lancamentos.some((l) => l.tarefaId === editar.id);
            if (temHoras) { toast("Tarefa tem horas lançadas — inative em vez de excluir", "err"); return; }
            void remove("tarefas", editar.id);
            toast("Tarefa excluída");
            setEditar(null);
          } : undefined}
        />
      )}
    </>
  );
}

function LancarHorasModal({
  tarefa,
  onClose,
  onSave,
}: {
  tarefa: Tarefa;
  onClose: () => void;
  onSave: (l: Lancamento) => void;
}) {
  const { snap, currentUser, isAdmin } = useData();
  // Consultor lança como ele mesmo; admin pode escolher.
  const [consultorId, setConsultorId] = useState(
    isAdmin ? tarefa.respId ?? currentUser?.id ?? snap.equipe[0]?.id ?? "" : currentUser?.id ?? "",
  );
  const [horas, setHoras] = useState(1);
  const [data, setData] = useState(todayISO());
  const [obs, setObs] = useState("");
  const [erro, setErro] = useState("");

  function salvar() {
    if (!consultorId) { setErro("Selecione o consultor."); return; }
    if (horas <= 0) { setErro("Informe as horas."); return; }
    onSave({
      id: uuid(),
      projetoId: tarefa.projetoId,
      tarefaId: tarefa.id,
      consultorId,
      competencia: competenciaOf(data),
      horas,
      data,
      obs: obs.trim(),
    });
  }

  return (
    <Modal
      title="Lançar horas"
      subtitle={tarefa.nome}
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar}>Lançar</button>
        </>
      }
    >
      <div className="form-grid">
        <div>
          <label>Consultor</label>
          {isAdmin ? (
            <select value={consultorId} onChange={(e) => setConsultorId(e.target.value)}>
              {snap.equipe.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          ) : (
            <input value={currentUser?.nome ?? ""} readOnly />
          )}
        </div>
        <div>
          <label>Data</label>
          <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
      </div>
      <div className="form-full">
        <label>Horas</label>
        <input type="number" step="0.5" min="0" value={horas} onChange={(e) => setHoras(Number(e.target.value))} aria-invalid={!!erro} />
        {erro && <div className="field-error">{erro}</div>}
        <div className="hint">Competência: {labelCompetencia(competenciaOf(data))}</div>
      </div>
      <div className="form-full">
        <label>Observação</label>
        <input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="O que foi feito" />
      </div>
    </Modal>
  );
}

function TarefaFormModal({
  tarefa,
  onClose,
  onSave,
  onDelete,
}: {
  tarefa: Tarefa | null;
  onClose: () => void;
  onSave: (t: Tarefa) => void;
  onDelete?: () => void;
}) {
  const { snap } = useData();
  const [projetoId, setProjetoId] = useState(tarefa?.projetoId ?? snap.projetos[0]?.id ?? "");
  const [nome, setNome] = useState(tarefa?.nome ?? "");
  const [respId, setRespId] = useState(tarefa?.respId ?? "");
  const [status, setStatus] = useState<TarefaStatus>(tarefa?.status ?? "Não Iniciada");
  const [hPrev, setHPrev] = useState(tarefa?.hPrev ?? 0);
  const [dtIni, setDtIni] = useState(tarefa?.dtIni ?? "");
  const [dtFim, setDtFim] = useState(tarefa?.dtFim ?? "");
  const [ativa, setAtiva] = useState(tarefa?.ativa ?? true);
  const [erro, setErro] = useState("");

  function salvar() {
    if (!projetoId) { setErro("Selecione o projeto."); return; }
    if (!nome.trim()) { setErro("Informe o nome da tarefa."); return; }
    onSave({
      id: tarefa?.id ?? uuid(),
      projetoId,
      nome: nome.trim(),
      respId: respId || null,
      status,
      hPrev,
      dtIni: dtIni || null,
      dtFim: dtFim || null,
      ativa,
      semana: tarefa?.semana ?? null,
    });
  }

  return (
    <Modal
      title={tarefa ? "Editar tarefa" : "Nova tarefa"}
      onClose={onClose}
      actions={
        <>
          {onDelete && (
            <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={onDelete}>Excluir</button>
          )}
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar}>Salvar</button>
        </>
      }
    >
      <div className="form-full">
        <label>Nome</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} aria-invalid={!!erro} />
        {erro && <div className="field-error">{erro}</div>}
      </div>
      <div className="form-grid">
        <div>
          <label>Projeto</label>
          <select value={projetoId} onChange={(e) => setProjetoId(e.target.value)}>
            {snap.projetos.map((p) => (
              <option key={p.id} value={p.id}>{p.id} — {p.nome || p.cliente}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Responsável</label>
          <select value={respId} onChange={(e) => setRespId(e.target.value)}>
            <option value="">—</option>
            {snap.equipe.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-grid">
        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as TarefaStatus)}>
            {STATUS_TAREFA.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Horas previstas</label>
          <input type="number" step="0.5" min="0" value={hPrev} onChange={(e) => setHPrev(Number(e.target.value))} />
        </div>
      </div>
      <div className="form-grid">
        <div>
          <label>Início</label>
          <input type="date" value={dtIni} onChange={(e) => setDtIni(e.target.value)} />
        </div>
        <div>
          <label>Término</label>
          <input type="date" value={dtFim} onChange={(e) => setDtFim(e.target.value)} />
        </div>
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
        <input type="checkbox" checked={ativa} onChange={(e) => setAtiva(e.target.checked)} style={{ width: "auto" }} />
        Ativa
      </label>
    </Modal>
  );
}
