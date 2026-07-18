import { useMemo, useState } from "react";
import { useData } from "@/store/useData";
import { Modal } from "@/ui/Modal";
import { Semaforo, StatusBadge } from "@/ui/primitives";
import { calcProjeto, calcularParcelas } from "@/lib/calc";
import { fmtBRL, reaisToCents, centsToReais } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { nextProjetoId, uuid } from "@/lib/id";
import type { Kind, Parcela, Projeto, ProjetoStatus } from "@/types";

const STATUSES: ProjetoStatus[] = ["Planejamento", "Em Andamento", "Concluído", "Pausado", "Cancelado"];

export function Projetos() {
  const { snap, rateOf } = useData();
  const [tab, setTab] = useState<Kind>("projeto");
  const [editing, setEditing] = useState<Projeto | null>(null);
  const [creating, setCreating] = useState(false);

  const items = snap.projetos.filter((p) => p.kind === tab);

  return (
    <>
      <div className="page-title">Projetos & Treinamentos</div>
      <div className="page-sub">Cadastro com composição de custos e geração de faturamento</div>

      <div className="tabs">
        <button className={`tab ${tab === "projeto" ? "active" : ""}`} onClick={() => setTab("projeto")}>
          Projetos
        </button>
        <button className={`tab ${tab === "treinamento" ? "active" : ""}`} onClick={() => setTab("treinamento")}>
          Treinamentos
        </button>
      </div>

      <div className="filter-bar">
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Novo {tab === "projeto" ? "projeto" : "treinamento"}
        </button>
      </div>

      <div className="tbl-wrap">
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th className="l">ID</th>
                <th className="l">Nome</th>
                <th className="l">Cliente</th>
                <th>Valor</th>
                <th>ADM</th>
                <th>Comissão</th>
                <th>Lucro</th>
                <th>Disp. H/T</th>
                <th>Gasto H/H</th>
                <th>% Gasto</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const c = calcProjeto(p, snap.lancamentos, snap.pagamentos, rateOf);
                return (
                  <tr key={p.id}>
                    <td className="td-id">{p.id}</td>
                    <td className="td-name">{p.nome}</td>
                    <td className="l">{p.cliente}</td>
                    <td className="td-val">{fmtBRL(c.valorCents)}</td>
                    <td className="td-val muted">{fmtBRL(c.custoAdmCents)}</td>
                    <td className="td-val muted">{fmtBRL(c.custoComCents)}</td>
                    <td className="td-val muted">{fmtBRL(c.lucroCents)}</td>
                    <td className="td-val" style={{ color: "var(--accent2)", fontWeight: 700 }}>
                      {fmtBRL(c.dispHTCents)}
                    </td>
                    <td className="td-val">{fmtBRL(c.custoHTrabCents)}</td>
                    <td>
                      <Semaforo pctGasto={c.pctGasto} />
                    </td>
                    <td>
                      <StatusBadge status={p.status} />
                    </td>
                    <td>
                      <button className="btn btn-sm" onClick={() => setEditing(p)}>
                        editar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={12} className="empty-state">
                    Nenhum {tab} cadastrado. Clique em “+ Novo”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="alert alert-blue">
        ADM, Comissão e Lucro são derivados dos percentuais. O <b>Disponível para horas
        técnicas</b> é o que sobra para executar — e o semáforo alerta quando o custo real das
        horas se aproxima (ou estoura) esse limite.
      </div>

      {(creating || editing) && (
        <ProjetoForm kind={tab} projeto={editing} onClose={() => { setCreating(false); setEditing(null); }} />
      )}
    </>
  );
}

function ProjetoForm({
  kind,
  projeto,
  onClose,
}: {
  kind: Kind;
  projeto: Projeto | null;
  onClose: () => void;
}) {
  const { snap, save, remove, toast } = useData();
  const isEdit = !!projeto;

  const [form, setForm] = useState(() => ({
    id: projeto?.id ?? nextProjetoId(snap.projetos.map((p) => p.id), kind),
    nome: projeto?.nome ?? "",
    cliente: projeto?.cliente ?? "",
    tipo: projeto?.tipo ?? "",
    gerenteId: projeto?.gerenteId ?? "",
    valorReais: projeto ? String(centsToReais(projeto.valorCents)) : "",
    pctAdm: projeto ? projeto.pctAdm * 100 : 20,
    pctCom: projeto ? projeto.pctCom * 100 : 2,
    pctLucro: projeto ? projeto.pctLucro * 100 : 20,
    pctImpostos: projeto ? (projeto.pctImpostos ?? 0) * 100 : 0,
    pctMarketing: projeto ? (projeto.pctMarketing ?? 0) * 100 : 0,
    status: projeto?.status ?? ("Planejamento" as ProjetoStatus),
    dtIni: projeto?.dtIni ?? "",
    dtFim: projeto?.dtFim ?? "",
    nParcelas: 1,
    dtParc1: projeto?.dtIni ?? "",
    temEntrada: false,
    valorEntradaReais: "",
    gerarParcelas: false,
  }));
  const [erros, setErros] = useState<Record<string, string>>({});

  const valorCents = reaisToCents(form.valorReais || "0");
  const dispCents = Math.round(
    valorCents * (1 - form.pctAdm / 100 - form.pctCom / 100 - form.pctLucro / 100 - form.pctImpostos / 100 - form.pctMarketing / 100),
  );

  const preview = useMemo(
    () =>
      calcularParcelas(
        valorCents,
        form.nParcelas,
        form.temEntrada,
        reaisToCents(form.valorEntradaReais || "0"),
        form.dtParc1 || null,
      ),
    [valorCents, form.nParcelas, form.temEntrada, form.valorEntradaReais, form.dtParc1],
  );

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }) as typeof form);
  }

  async function salvar() {
    const e: Record<string, string> = {};
    if (!form.id.trim()) e.id = "Obrigatório";
    if (!form.nome.trim()) e.nome = "Informe o nome";
    if (!isEdit && snap.projetos.some((p) => p.id === form.id)) e.id = "ID já existe";
    if (valorCents < 0) e.valor = "Valor inválido";
    setErros(e);
    if (Object.keys(e).length) return;

    const obj: Projeto = {
      id: form.id.trim(),
      kind,
      nome: form.nome.trim(),
      cliente: form.cliente.trim(),
      tipo: form.tipo.trim(),
      gerenteId: form.gerenteId || null,
      valorCents,
      pctAdm: form.pctAdm / 100,
      pctCom: form.pctCom / 100,
      pctLucro: form.pctLucro / 100,
      pctImpostos: form.pctImpostos / 100,
      pctMarketing: form.pctMarketing / 100,
      status: form.status,
      dtIni: form.dtIni || null,
      dtFim: form.dtFim || null,
    };
    await save("projetos", obj);

    if (form.gerarParcelas) {
      const antigas = snap.parcelas.filter((p) => p.projetoId === obj.id);
      for (const p of antigas) await remove("parcelas", p.id);
      const novas = calcularParcelas(
        valorCents,
        form.nParcelas,
        form.temEntrada,
        reaisToCents(form.valorEntradaReais || "0"),
        form.dtParc1 || null,
      );
      for (const p of novas) {
        const parcela: Parcela = {
          id: uuid(),
          projetoId: obj.id,
          numero: p.numero,
          vencimento: p.vencimento,
          valorCents: p.valorCents,
          status: "a_receber",
          recebidoEm: null,
          entrada: p.entrada,
        };
        await save("parcelas", parcela);
      }
      toast(`${novas.length} parcela(s) geradas`);
    } else {
      toast("Projeto salvo");
    }
    onClose();
  }

  return (
    <Modal
      title={`${isEdit ? "Editar" : "Novo"} ${kind === "projeto" ? "projeto" : "treinamento"}`}
      onClose={onClose}
      large
      actions={
        <>
          {isEdit && (
            <button
              className="btn btn-danger"
              style={{ marginRight: "auto" }}
              onClick={() => {
                void save("projetos", { ...projeto!, status: "Cancelado" });
                toast("Projeto cancelado");
                onClose();
              }}
            >
              Cancelar projeto
            </button>
          )}
          <button className="btn" onClick={onClose}>
            Fechar
          </button>
          <button className="btn btn-primary" onClick={() => void salvar()}>
            Salvar
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div>
          <label>ID</label>
          <input value={form.id} readOnly={isEdit} onChange={(e) => set("id", e.target.value)} aria-invalid={!!erros.id} />
          {erros.id && <div className="field-error">{erros.id}</div>}
        </div>
        <div>
          <label>Status</label>
          <select value={form.status} onChange={(e) => set("status", e.target.value as ProjetoStatus)}>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-full">
        <label>Nome</label>
        <input value={form.nome} onChange={(e) => set("nome", e.target.value)} aria-invalid={!!erros.nome} />
        {erros.nome && <div className="field-error">{erros.nome}</div>}
      </div>

      <div className="form-grid">
        <div>
          <label>Cliente</label>
          <input value={form.cliente} onChange={(e) => set("cliente", e.target.value)} />
        </div>
        <div>
          <label>Tipo</label>
          <input value={form.tipo} onChange={(e) => set("tipo", e.target.value)} />
        </div>
      </div>

      <div className="form-grid">
        <div>
          <label>Responsável</label>
          <select value={form.gerenteId} onChange={(e) => set("gerenteId", e.target.value)}>
            <option value="">—</option>
            {snap.equipe.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Valor contratado (R$)</label>
          <input type="number" step="0.01" value={form.valorReais} onChange={(e) => set("valorReais", e.target.value)} />
        </div>
      </div>

      <div className="form-grid">
        <div>
          <label>Data início</label>
          <input type="date" value={form.dtIni} onChange={(e) => set("dtIni", e.target.value)} />
        </div>
        <div>
          <label>Data término</label>
          <input type="date" value={form.dtFim} onChange={(e) => set("dtFim", e.target.value)} />
        </div>
      </div>

      <div className="section-label">Composição de custos</div>
      <div className="form-grid">
        <div>
          <label>% ADM</label>
          <input type="number" min="0" max="100" step="0.1" value={form.pctAdm} onChange={(e) => set("pctAdm", Number(e.target.value))} />
        </div>
        <div>
          <label>% Comissão</label>
          <input type="number" min="0" max="100" step="0.1" value={form.pctCom} onChange={(e) => set("pctCom", Number(e.target.value))} />
        </div>
      </div>
      <div className="form-grid">
        <div>
          <label>% Impostos</label>
          <input type="number" min="0" max="100" step="0.1" value={form.pctImpostos} onChange={(e) => set("pctImpostos", Number(e.target.value))} />
        </div>
        <div>
          <label>% Marketing</label>
          <input type="number" min="0" max="100" step="0.1" value={form.pctMarketing} onChange={(e) => set("pctMarketing", Number(e.target.value))} />
        </div>
      </div>
      <div className="form-grid">
        <div>
          <label>% Lucro desejado</label>
          <input type="number" min="0" max="100" step="0.1" value={form.pctLucro} onChange={(e) => set("pctLucro", Number(e.target.value))} />
        </div>
        <div>
          <label>Disponível p/ horas técnicas</label>
          <input
            readOnly
            value={fmtBRL(dispCents)}
            style={{ color: dispCents < 0 ? "var(--red)" : "var(--accent2)", fontWeight: 700 }}
          />
        </div>
      </div>

      <div className="section-label">Parcelamento (faturamento)</div>
      <div className="form-grid">
        <div>
          <label>Nº de parcelas</label>
          <input type="number" min="1" value={form.nParcelas} onChange={(e) => set("nParcelas", Math.max(1, Number(e.target.value)))} />
        </div>
        <div>
          <label>1º vencimento</label>
          <input type="date" value={form.dtParc1} onChange={(e) => set("dtParc1", e.target.value)} />
        </div>
      </div>
      <div className="form-grid">
        <div>
          <label>Tem entrada?</label>
          <select value={form.temEntrada ? "sim" : "nao"} onChange={(e) => set("temEntrada", e.target.value === "sim")}>
            <option value="nao">Não</option>
            <option value="sim">Sim</option>
          </select>
        </div>
        <div>
          <label>Valor da entrada (R$)</label>
          <input
            type="number"
            step="0.01"
            value={form.valorEntradaReais}
            disabled={!form.temEntrada}
            onChange={(e) => set("valorEntradaReais", e.target.value)}
          />
        </div>
      </div>

      <div className="calc-box">
        {preview.length === 0 ? (
          <span className="muted">Informe valor e 1º vencimento para prever a divisão.</span>
        ) : (
          <>
            {preview.slice(0, 4).map((p) => (
              <div className="calc-line" key={p.numero}>
                <span>
                  {p.entrada ? "Entrada" : `Parcela ${p.numero}`} · {fmtDate(p.vencimento)}
                </span>
                <b>{fmtBRL(p.valorCents)}</b>
              </div>
            ))}
            {preview.length > 4 && <div className="hint">… {preview.length - 4} parcela(s) a mais</div>}
            <div className="calc-line calc-final">
              <span>Total ({preview.length} parcela(s))</span>
              <b>{fmtBRL(preview.reduce((s, p) => s + p.valorCents, 0))}</b>
            </div>
          </>
        )}
      </div>

      <label style={{ display: "flex", gap: 8, alignItems: "center", cursor: "pointer", color: "var(--amber)" }}>
        <input type="checkbox" checked={form.gerarParcelas} onChange={(e) => set("gerarParcelas", e.target.checked)} style={{ width: "auto" }} />
        Gerar/substituir as parcelas deste projeto no faturamento ao salvar
      </label>
      <div className="hint">Deixe desmarcado para preservar parcelas já lançadas manualmente.</div>
    </Modal>
  );
}
