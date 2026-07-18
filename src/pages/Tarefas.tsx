import { useMemo, useState } from "react";
import { useData } from "@/store/useData";
import { Modal } from "@/ui/Modal";
import { MultiSelect } from "@/ui/MultiSelect";
import { addMonths, competenciaOf, fmtDate, labelCompetencia, todayISO } from "@/lib/dates";
import { uuid } from "@/lib/id";
import type { Consultor, Lancamento, Projeto, Tarefa, TarefaStatus } from "@/types";

const STATUS_TAREFA: TarefaStatus[] = ["Não Iniciada", "Em Andamento", "Concluída", "Pausada"];
const fmtH = (h: number) => h.toFixed(1);

type Recorrencia = "diaria" | "semanal" | "mensal" | "anual";

// ─── permissões ──────────────────────────────────────────────────
function podeEditarTarefa(t: Tarefa, user: Consultor | null, isAdmin: boolean, projetos: Projeto[]): boolean {
  if (isAdmin) return true;
  if (!user) return false;
  if (t.respId === user.id) return true;
  return projetos.find((p) => p.id === t.projetoId)?.gerenteId === user.id;
}

function podeCriarNoProjeto(projetoId: string, user: Consultor | null, isAdmin: boolean, projetos: Projeto[]): boolean {
  if (isAdmin) return true;
  if (!user) return false;
  return projetos.find((p) => p.id === projetoId)?.gerenteId === user.id;
}

function podeExcluirTodas(projetoId: string, user: Consultor | null, isAdmin: boolean, projetos: Projeto[]): boolean {
  if (isAdmin) return true;
  if (!user) return false;
  return projetos.find((p) => p.id === projetoId)?.gerenteId === user.id;
}

// ─── datas para recorrência ───────────────────────────────────────
function proximaData(dtIso: string, tipo: Recorrencia): string {
  const d = new Date(dtIso + "T00:00:00");
  switch (tipo) {
    case "diaria":  d.setDate(d.getDate() + 1); break;
    case "semanal": d.setDate(d.getDate() + 7); break;
    case "mensal":  return addMonths(dtIso, 1);
    case "anual":   d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().slice(0, 10);
}

export function Tarefas() {
  const { snap, currentUser, isAdmin, save, remove, toast } = useData();

  // projetos não cancelados para filtros e formulário
  const projetosAtivos = useMemo(
    () => snap.projetos.filter((p) => p.status !== "Cancelado"),
    [snap.projetos],
  );

  const [fProjetos, setFProjetos] = useState<string[]>([]);
  const [fMes, setFMes] = useState<string[]>([]);
  const [fStatus, setFStatus] = useState<string[]>([]);
  const [lancar, setLancar] = useState<Tarefa | null>(null);
  const [editar, setEditar] = useState<Tarefa | null>(null);
  const [criar, setCriar] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());

  const projetosOpts = projetosAtivos.map((p) => ({ value: p.id, label: `${p.id} — ${p.nome || p.cliente}` }));
  const statusOpts = STATUS_TAREFA.map((s) => ({ value: s, label: s }));

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
  const mesesOpts = mesesDisponiveis.map((m) => ({ value: m, label: labelCompetencia(m) }));

  // IDs de projetos cancelados (para ocultar tarefas)
  const projetosCancelados = useMemo(
    () => new Set(snap.projetos.filter((p) => p.status === "Cancelado").map((p) => p.id)),
    [snap.projetos],
  );

  const tarefas = useMemo(() => {
    return snap.tarefas
      .filter((t) => !projetosCancelados.has(t.projetoId))
      .filter((t) => (isAdmin ? true : t.respId === currentUser?.id || podeEditarTarefa(t, currentUser, isAdmin, snap.projetos)))
      .filter((t) => (fProjetos.length ? fProjetos.includes(t.projetoId) : true))
      .filter((t) => (fMes.length ? (t.dtIni ? fMes.includes(t.dtIni.slice(0, 7)) : false) : true))
      .filter((t) => (fStatus.length ? fStatus.includes(t.status) : true))
      .sort((a, b) => (a.dtIni ?? "").localeCompare(b.dtIni ?? ""));
  }, [snap.tarefas, projetosCancelados, isAdmin, currentUser, fProjetos, fMes, fStatus, snap.projetos]);

  const todasSelecionadas = tarefas.length > 0 && tarefas.every((t) => selecionadas.has(t.id));

  function toggleTarefa(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleTodas() {
    if (todasSelecionadas) {
      setSelecionadas(new Set());
    } else {
      setSelecionadas(new Set(tarefas.map((t) => t.id)));
    }
  }

  async function excluirSelecionadas() {
    const ids = [...selecionadas];
    for (const id of ids) {
      const t = snap.tarefas.find((x) => x.id === id);
      if (!t) continue;
      // verifica permissão por tarefa
      if (!podeEditarTarefa(t, currentUser, isAdmin, snap.projetos)) continue;
      if (snap.lancamentos.some((l) => l.tarefaId === id)) {
        toast(`"${t.nome}" tem horas lançadas — inative em vez de excluir`, "err");
        continue;
      }
      await remove("tarefas", id);
    }
    toast(`${ids.length} tarefa(s) processada(s)`);
    setSelecionadas(new Set());
  }

  function mudarStatus(t: Tarefa, status: TarefaStatus) {
    void save("tarefas", { ...t, status });
  }

  // Consultor pode criar se for gerente de algum projeto ativo
  const podeVerBotaoNovo = isAdmin || projetosAtivos.some((p) => p.gerenteId === currentUser?.id);

  return (
    <>
      <div className="page-title">Tarefas</div>
      <div className="page-sub">
        {isAdmin ? "Todas as tarefas — lançamento de horas e andamento" : "Suas tarefas e as dos projetos que você gerencia"}
      </div>

      <div className="filter-bar">
        <MultiSelect label="Projeto" options={projetosOpts} selected={fProjetos} onChange={setFProjetos} placeholder="Todos" />
        <MultiSelect label="Mês" options={mesesOpts} selected={fMes} onChange={setFMes} placeholder="Todos" />
        <MultiSelect label="Status" options={statusOpts} selected={fStatus} onChange={setFStatus} placeholder="Todos" />
        {selecionadas.size > 0 && (
          <button className="btn btn-danger" onClick={() => void excluirSelecionadas()}>
            Excluir selecionadas ({selecionadas.size})
          </button>
        )}
        {podeVerBotaoNovo && (
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
                <th style={{ width: 32 }}>
                  <input
                    type="checkbox"
                    checked={todasSelecionadas}
                    onChange={toggleTodas}
                    style={{ width: "auto" }}
                    title="Selecionar todas"
                  />
                </th>
                <th className="l" style={{ minWidth: 240 }}>Tarefa</th>
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
              {tarefas.map((t) => {
                const podeEditar = podeEditarTarefa(t, currentUser, isAdmin, snap.projetos);
                return (
                  <tr key={t.id} className={t.ativa ? "" : "row-inactive"}>
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={selecionadas.has(t.id)}
                        onChange={() => toggleTarefa(t.id)}
                        style={{ width: "auto" }}
                      />
                    </td>
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
                        disabled={!podeEditar}
                      >
                        {STATUS_TAREFA.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                    <td className="td-val">{fmtH(t.hPrev)}</td>
                    <td className="td-val" style={{ color: horasLancadas(t.id) > 0 ? "var(--accent2)" : "var(--tx3)", fontWeight: horasLancadas(t.id) > 0 ? 700 : 400 }}>
                      {fmtH(horasLancadas(t.id))}
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn btn-sm" onClick={() => setLancar(t)}>lançar horas</button>
                        {podeEditar && (
                          <button className="btn btn-sm" onClick={() => setEditar(t)}>editar</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {tarefas.length === 0 && (
                <tr>
                  <td colSpan={9} className="empty-state">
                    {isAdmin ? "Nenhuma tarefa com os filtros." : "Você não tem tarefas visíveis com os filtros atuais."}
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
          onSave={(l) => { void save("lancamentos", l); toast(`${fmtH(l.horas)}h lançadas`); setLancar(null); }}
        />
      )}
      {(criar || editar) && (
        <TarefaFormModal
          tarefa={editar}
          projetosAtivos={projetosAtivos}
          currentUser={currentUser}
          isAdmin={isAdmin}
          onClose={() => { setCriar(false); setEditar(null); }}
          onSave={(tarefas) => {
            for (const t of tarefas) void save("tarefas", t);
            toast(tarefas.length > 1 ? `${tarefas.length} tarefas criadas` : "Tarefa salva");
            setCriar(false);
            setEditar(null);
          }}
          onDelete={editar ? () => {
            const temHoras = snap.lancamentos.some((l) => l.tarefaId === editar.id);
            if (temHoras) { toast("Tarefa tem horas lançadas — inative em vez de excluir", "err"); return; }
            void remove("tarefas", editar.id);
            toast("Tarefa excluída");
            setEditar(null);
          } : undefined}
          podeExcluirTodas={editar ? podeExcluirTodas(editar.projetoId, currentUser, isAdmin, snap.projetos) : false}
        />
      )}
    </>
  );
}

// ─── Lançar Horas ────────────────────────────────────────────────
function LancarHorasModal({ tarefa, onClose, onSave }: { tarefa: Tarefa; onClose: () => void; onSave: (l: Lancamento) => void }) {
  const { snap, currentUser, isAdmin } = useData();
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
    onSave({ id: uuid(), projetoId: tarefa.projetoId, tarefaId: tarefa.id, consultorId, competencia: competenciaOf(data), horas, data, obs: obs.trim() });
  }

  return (
    <Modal
      title="Lançar horas"
      subtitle={tarefa.nome}
      onClose={onClose}
      actions={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn btn-primary" onClick={salvar}>Lançar</button></>}
    >
      <div className="form-grid">
        <div>
          <label>Consultor</label>
          {isAdmin ? (
            <select value={consultorId} onChange={(e) => setConsultorId(e.target.value)}>
              {snap.equipe.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
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

// ─── Formulário de Tarefa ─────────────────────────────────────────
function TarefaFormModal({
  tarefa,
  projetosAtivos,
  currentUser,
  isAdmin,
  onClose,
  onSave,
  onDelete,
  podeExcluirTodas: _podeExcluirTodas,
}: {
  tarefa: Tarefa | null;
  projetosAtivos: Projeto[];
  currentUser: Consultor | null;
  isAdmin: boolean;
  onClose: () => void;
  onSave: (tarefas: Tarefa[]) => void;
  onDelete?: () => void;
  podeExcluirTodas: boolean;
}) {
  const { snap } = useData();

  // Projetos disponíveis para este usuário criar tarefas
  const projetosDisp = isAdmin
    ? projetosAtivos
    : projetosAtivos.filter((p) => podeCriarNoProjeto(p.id, currentUser, isAdmin, projetosAtivos));

  const [projetoId, setProjetoId] = useState(tarefa?.projetoId ?? projetosDisp[0]?.id ?? "");
  const [nome, setNome] = useState(tarefa?.nome ?? "");
  const [respId, setRespId] = useState(tarefa?.respId ?? "");
  const [status, setStatus] = useState<TarefaStatus>(tarefa?.status ?? "Não Iniciada");
  const [hPrev, setHPrev] = useState(tarefa?.hPrev ?? 0);
  const [dtIni, setDtIni] = useState(tarefa?.dtIni ?? "");
  const [dtFim, setDtFim] = useState(tarefa?.dtFim ?? "");
  const [ativa, setAtiva] = useState(tarefa?.ativa ?? true);
  const [erro, setErro] = useState("");

  // Recorrência
  const [recorrente, setRecorrente] = useState(false);
  const [tipoRec, setTipoRec] = useState<Recorrencia>("mensal");
  const [qtdRec, setQtdRec] = useState(3);

  function salvar() {
    if (!projetoId) { setErro("Selecione o projeto."); return; }
    if (!nome.trim()) { setErro("Informe o nome da tarefa."); return; }

    const base: Tarefa = {
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
    };

    if (!tarefa && recorrente && dtIni && qtdRec > 1) {
      const tarefas: Tarefa[] = [];
      let dataAtual = dtIni;
      for (let i = 0; i < qtdRec; i++) {
        const dtF = dtFim ? dtFim : dataAtual;
        tarefas.push({
          ...base,
          id: uuid(),
          nome: `${nome.trim()} (${i + 1}/${qtdRec})`,
          dtIni: dataAtual,
          dtFim: dtF,
        });
        dataAtual = proximaData(dataAtual, tipoRec);
      }
      onSave(tarefas);
    } else {
      onSave([base]);
    }
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
            {projetosDisp.map((p) => (
              <option key={p.id} value={p.id}>{p.id} — {p.nome || p.cliente}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Responsável</label>
          <select value={respId} onChange={(e) => setRespId(e.target.value)}>
            <option value="">—</option>
            {snap.equipe.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
        </div>
      </div>
      <div className="form-grid">
        <div>
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value as TarefaStatus)}>
            {STATUS_TAREFA.map((s) => <option key={s} value={s}>{s}</option>)}
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

      {/* Recorrência — só para criação */}
      {!tarefa && (
        <>
          <div className="section-label" style={{ marginTop: 12 }}>Recorrência</div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer" }}>
            <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} style={{ width: "auto" }} />
            Criar tarefa recorrente
          </label>
          {recorrente && (
            <div className="form-grid" style={{ marginTop: 8 }}>
              <div>
                <label>Tipo de recorrência</label>
                <select value={tipoRec} onChange={(e) => setTipoRec(e.target.value as Recorrencia)}>
                  <option value="diaria">Diária</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensal">Mensal</option>
                  <option value="anual">Anual</option>
                </select>
              </div>
              <div>
                <label>Quantidade de ocorrências</label>
                <input type="number" min="2" max="60" value={qtdRec} onChange={(e) => setQtdRec(Math.max(2, Number(e.target.value)))} />
              </div>
            </div>
          )}
          {recorrente && (
            <div className="hint">
              Serão criadas {qtdRec} tarefas com nomes "{nome || "Tarefa"} (1/{qtdRec})", "(2/{qtdRec})"…, espaçadas {tipoRec === "diaria" ? "1 dia" : tipoRec === "semanal" ? "7 dias" : tipoRec === "mensal" ? "1 mês" : "1 ano"} cada.
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
