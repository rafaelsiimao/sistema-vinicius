import { useMemo, useState } from "react";
import { useData } from "@/store/useData";
import { Modal } from "@/ui/Modal";
import { Kpi } from "@/ui/primitives";
import {
  competenciasDoSistema,
  custoBaseMesCents,
  custoVigenteNoMes,
  projetoAtivoNoMes,
} from "@/lib/calc";
import { centsToReais, fmtBRL, reaisToCents } from "@/lib/money";
import { currentCompetencia, labelCompetencia, todayISO } from "@/lib/dates";
import { uuid } from "@/lib/id";
import type { Custo, Frequencia, Rateio } from "@/types";

const CATEGORIAS_PADRAO = [
  "Horas de Consultoria", "Impostos", "Marketing", "Salário Comercial", "CRM",
  "Desenvolvimento de Sistemas", "Softwares e Licenças", "Administrativo",
  "Financeiro", "Despesas Gerais",
];

const RATEIO_LABEL: Record<Rateio, string> = {
  projeto: "Direto no projeto",
  ativos: "Rateado — projetos ativos",
  ativos_todos: "Rateado — projetos + treinamentos",
  personalizado: "Personalizado (%)",
};

export function Custos() {
  const { snap, toast, save, remove } = useData();
  const today = todayISO();
  const [comp, setComp] = useState(currentCompetencia());
  const [fCategoria, setFCategoria] = useState("");
  const [editando, setEditando] = useState<Custo | null>(null);
  const [criando, setCriando] = useState(false);
  const [novaCategoria, setNovaCategoria] = useState(false);

  const meses = useMemo(() => competenciasDoSistema(snap, today), [snap, today]);
  const nomeProjeto = (id: string | null) => (id ? snap.projetos.find((p) => p.id === id)?.nome ?? id : "—");

  const categorias = useMemo(() => {
    const usadas = snap.custos.map((c) => c.categoria).filter(Boolean);
    const cadastradas = snap.categoriasCusto.map((c) => c.nome);
    return [...new Set([...CATEGORIAS_PADRAO, ...cadastradas, ...usadas])];
  }, [snap.custos, snap.categoriasCusto]);

  const custosFiltrados = snap.custos
    .filter((c) => (fCategoria ? c.categoria === fCategoria : true))
    .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.competencia.localeCompare(b.competencia));

  const vigentes = snap.custos.filter((c) => custoVigenteNoMes(c, comp));
  const totalVigenteCents = vigentes.reduce((s, c) => s + c.valorCents, 0);
  const recorrentesCents = vigentes.filter((c) => c.frequencia === "recorrente").reduce((s, c) => s + c.valorCents, 0);

  // Custo apropriado a cada projeto ativo na competência.
  const porProjeto = snap.projetos
    .filter((p) => projetoAtivoNoMes(p, comp))
    .map((p) => ({ p, cents: custoBaseMesCents(p.id, comp, snap.custos, snap.projetos) }))
    .filter((x) => x.cents > 0)
    .sort((a, b) => b.cents - a.cents);
  const totalAlocadoCents = porProjeto.reduce((s, x) => s + x.cents, 0);

  return (
    <>
      <div className="page-title">Custos</div>
      <div className="page-sub">Despesas, rateio entre projetos e apropriação por competência</div>

      <div className="filter-bar">
        <div>
          <label>Competência</label>
          <select value={comp} onChange={(e) => setComp(e.target.value)}>
            {meses.map((m) => (
              <option key={m} value={m}>{labelCompetencia(m)}</option>
            ))}
          </select>
        </div>
        <div>
          <label>Categoria</label>
          <select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)}>
            <option value="">Todas</option>
            {categorias.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div style={{ alignSelf: "flex-end", display: "flex", gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setCriando(true)}>+ Novo custo</button>
          <button className="btn" onClick={() => setNovaCategoria(true)}>+ Categoria</button>
        </div>
      </div>

      <div className="kpi-row">
        <Kpi label={`Custos vigentes em ${labelCompetencia(comp)}`} value={fmtBRL(totalVigenteCents)} tone="red" />
        <Kpi label="Recorrentes no mês" value={fmtBRL(recorrentesCents)} tone="amber" />
        <Kpi label="Apropriado a projetos" value={fmtBRL(totalAlocadoCents)} tone="accent" />
      </div>

      <div className="tbl-wrap">
        <div className="tbl-title">Apropriação por projeto — {labelCompetencia(comp)}</div>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th className="l">Projeto</th>
                <th className="l">Cliente</th>
                <th>Custo no mês</th>
              </tr>
            </thead>
            <tbody>
              {porProjeto.map(({ p, cents }) => (
                <tr key={p.id}>
                  <td className="l td-name">{p.id} — {p.nome}</td>
                  <td className="l" style={{ fontSize: 11 }}>{p.cliente}</td>
                  <td className="td-val">{fmtBRL(cents)}</td>
                </tr>
              ))}
              {porProjeto.length === 0 && (
                <tr><td colSpan={3} className="empty-state">Nenhum custo apropriado nesta competência.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {Math.abs(totalAlocadoCents - totalVigenteCents) > 1 && (
          <div className="hint" style={{ padding: "0 16px 12px" }}>
            Diferença de {fmtBRL(totalVigenteCents - totalAlocadoCents)} entre custos vigentes e apropriados —
            há custo sem destino de rateio válido nesta competência (ex.: rateio “ativos” sem projeto ativo).
          </div>
        )}
      </div>

      <div className="tbl-wrap">
        <div className="tbl-title">Todos os custos</div>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th className="l">Categoria</th>
                <th className="l">Descrição</th>
                <th>Valor</th>
                <th>Vigência</th>
                <th>Frequência</th>
                <th className="l">Rateio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {custosFiltrados.map((c) => (
                <tr key={c.id} className={custoVigenteNoMes(c, comp) ? "" : "row-inactive"}>
                  <td className="l td-name">{c.categoria}</td>
                  <td className="l" style={{ fontSize: 11 }}>{c.descricao}</td>
                  <td className="td-val">{fmtBRL(c.valorCents)}</td>
                  <td style={{ fontSize: 10 }} className="muted">
                    {labelCompetencia(c.competencia)}
                    {c.frequencia === "recorrente" ? ` → ${c.competenciaFim ? labelCompetencia(c.competenciaFim) : "…"}` : ""}
                  </td>
                  <td>{c.frequencia === "recorrente" ? <span className="badge b-blue">Recorrente</span> : <span className="badge b-gray">Única</span>}</td>
                  <td className="l" style={{ fontSize: 11 }}>
                    {RATEIO_LABEL[c.rateio]}
                    {c.rateio === "projeto" && <span className="muted"> · {nomeProjeto(c.projetoId)}</span>}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button className="btn btn-sm" onClick={() => setEditando(c)}>editar</button>
                    </div>
                  </td>
                </tr>
              ))}
              {custosFiltrados.length === 0 && (
                <tr><td colSpan={7} className="empty-state">Nenhum custo cadastrado.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(criando || editando) && (
        <CustoForm
          custo={editando}
          categorias={categorias}
          onClose={() => { setCriando(false); setEditando(null); }}
          onSave={(c) => { void save("custos", c); toast("Custo salvo"); setCriando(false); setEditando(null); }}
          onDelete={editando ? () => { void remove("custos", editando.id); toast("Custo excluído"); setEditando(null); } : undefined}
        />
      )}
      {novaCategoria && (
        <CategoriaForm
          onClose={() => setNovaCategoria(false)}
          onSave={(nome) => {
            if (categorias.includes(nome)) { toast("Categoria já existe", "err"); return; }
            void save("categoriasCusto", { id: uuid(), nome });
            toast("Categoria criada");
            setNovaCategoria(false);
          }}
        />
      )}
    </>
  );
}

function CustoForm({
  custo,
  categorias,
  onClose,
  onSave,
  onDelete,
}: {
  custo: Custo | null;
  categorias: string[];
  onClose: () => void;
  onSave: (c: Custo) => void;
  onDelete?: () => void;
}) {
  const { snap } = useData();
  const projetosAtivos = snap.projetos.filter((p) => p.status !== "Cancelado");

  const [categoria, setCategoria] = useState(custo?.categoria ?? categorias[0] ?? "");
  const [descricao, setDescricao] = useState(custo?.descricao ?? "");
  const [valorReais, setValorReais] = useState(custo ? String(centsToReais(custo.valorCents)) : "");
  const [competencia, setCompetencia] = useState(custo?.competencia ?? currentCompetencia());
  const [frequencia, setFrequencia] = useState<Frequencia>(custo?.frequencia ?? "unica");
  const [competenciaFim, setCompetenciaFim] = useState(custo?.competenciaFim ?? "");
  const [rateio, setRateio] = useState<Rateio>(custo?.rateio ?? "ativos_todos");
  const [projetoId, setProjetoId] = useState(custo?.projetoId ?? projetosAtivos[0]?.id ?? "");
  const [pctByProj, setPctByProj] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const r of custo?.rateioCustom ?? []) init[r.projetoId] = r.pct;
    return init;
  });
  const [erro, setErro] = useState("");

  const somaPct = Object.values(pctByProj).reduce((s, v) => s + (v || 0), 0);

  function salvar() {
    if (!categoria) { setErro("Selecione a categoria."); return; }
    if (reaisToCents(valorReais || "0") <= 0) { setErro("Informe um valor."); return; }
    if (!competencia) { setErro("Informe a competência."); return; }
    onSave({
      id: custo?.id ?? uuid(),
      categoria,
      descricao: descricao.trim(),
      valorCents: reaisToCents(valorReais || "0"),
      competencia,
      competenciaFim: frequencia === "recorrente" && competenciaFim ? competenciaFim : null,
      frequencia,
      rateio,
      projetoId: rateio === "projeto" ? projetoId : null,
      rateioCustom:
        rateio === "personalizado"
          ? projetosAtivos.map((p) => ({ projetoId: p.id, pct: pctByProj[p.id] || 0 })).filter((r) => r.pct > 0)
          : [],
    });
  }

  return (
    <Modal
      title={custo ? "Editar custo" : "Novo custo"}
      onClose={onClose}
      large
      actions={
        <>
          {onDelete && <button className="btn btn-danger" style={{ marginRight: "auto" }} onClick={onDelete}>Excluir</button>}
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={salvar}>Salvar</button>
        </>
      }
    >
      <div className="form-grid">
        <div>
          <label>Categoria</label>
          <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-invalid={!!erro}>
            {categorias.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </div>
        <div>
          <label>Valor (R$)</label>
          <input type="number" step="0.01" value={valorReais} onChange={(e) => setValorReais(e.target.value)} />
        </div>
      </div>
      <div className="form-full">
        <label>Descrição</label>
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex.: assinatura do CRM" />
      </div>

      <div className="form-grid">
        <div>
          <label>Frequência</label>
          <select value={frequencia} onChange={(e) => setFrequencia(e.target.value as Frequencia)}>
            <option value="unica">Única (só nesta competência)</option>
            <option value="recorrente">Recorrente (todo mês)</option>
          </select>
        </div>
        <div>
          <label>Competência {frequencia === "recorrente" ? "(início)" : ""}</label>
          <input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
        </div>
      </div>
      {frequencia === "recorrente" && (
        <div className="form-full">
          <label>Competência fim (opcional — em branco = sem fim)</label>
          <input type="month" value={competenciaFim} onChange={(e) => setCompetenciaFim(e.target.value)} />
        </div>
      )}

      <div className="section-label">Rateio</div>
      <div className="form-full">
        <select value={rateio} onChange={(e) => setRateio(e.target.value as Rateio)}>
          {(Object.keys(RATEIO_LABEL) as Rateio[]).map((r) => (
            <option key={r} value={r}>{RATEIO_LABEL[r]}</option>
          ))}
        </select>
      </div>
      {rateio === "projeto" && (
        <div className="form-full">
          <label>Projeto</label>
          <select value={projetoId} onChange={(e) => setProjetoId(e.target.value)}>
            {projetosAtivos.map((p) => (<option key={p.id} value={p.id}>{p.id} — {p.nome || p.cliente}</option>))}
          </select>
        </div>
      )}
      {rateio === "personalizado" && (
        <div>
          <div className="hint" style={{ marginBottom: 8 }}>
            Distribua o custo em % entre os projetos. Soma atual:{" "}
            <b style={{ color: Math.abs(somaPct - 100) < 0.01 ? "var(--green)" : "var(--amber)" }}>{somaPct.toFixed(0)}%</b>
          </div>
          <div className="scroll-y" style={{ maxHeight: 240 }}>
            <table>
              <thead><tr><th className="l">Projeto</th><th>%</th></tr></thead>
              <tbody>
                {projetosAtivos.map((p) => (
                  <tr key={p.id}>
                    <td className="l td-name" style={{ fontSize: 11 }}>{p.id} — {p.nome || p.cliente}</td>
                    <td style={{ textAlign: "right" }}>
                      <input
                        type="number" min="0" max="100" step="1"
                        value={pctByProj[p.id] ?? ""}
                        onChange={(e) => setPctByProj((v) => ({ ...v, [p.id]: Number(e.target.value) }))}
                        style={{ width: 80, textAlign: "right" }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {erro && <div className="field-error" style={{ marginTop: 10 }}>{erro}</div>}
    </Modal>
  );
}

function CategoriaForm({ onClose, onSave }: { onClose: () => void; onSave: (nome: string) => void }) {
  const [nome, setNome] = useState("");
  return (
    <Modal
      title="Nova categoria de custo"
      onClose={onClose}
      actions={
        <>
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => nome.trim() && onSave(nome.trim())}>Salvar</button>
        </>
      }
    >
      <div className="form-full">
        <label>Nome da categoria</label>
        <input value={nome} onChange={(e) => setNome(e.target.value)} onKeyDown={(e) => e.key === "Enter" && nome.trim() && onSave(nome.trim())} />
      </div>
    </Modal>
  );
}
