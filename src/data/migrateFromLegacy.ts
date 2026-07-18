import type {
  CategoriaCusto,
  Comentario,
  Consultor,
  Custo,
  Lancamento,
  Pagamento,
  Parcela,
  Projeto,
  ProjetoStatus,
  Snapshot,
  TarefaStatus,
} from "@/types";
import { reaisToCents } from "@/lib/money";
import { uuid } from "@/lib/id";
import { competenciaOf } from "@/lib/dates";

/**
 * Migração best-effort do backup JSON do sistema ANTIGO (arquivo único) para o
 * novo schema. Faz as conversões que a auditoria exigia:
 *  • valores em reais → centavos (inteiro)
 *  • nomes de consultor/gerente → ids
 *  • status em português → enums estáveis
 *  • parcela "Recebida" antiga: mantém como recebida, mas registra recebidoEm
 *    (o dado original não separava vencimento de recebimento; revise depois)
 */
export function migrateFromLegacy(legacy: unknown): Snapshot {
  const L = legacy as LegacyRoot;

  // 1) Equipe → ids estáveis por slug do nome
  const consultorId = new Map<string, string>();
  const equipe: Consultor[] = (L.equipe ?? []).map((e) => {
    const id = slug("c", e.nome);
    consultorId.set(e.nome, id);
    return {
      id,
      nome: e.nome,
      funcao: e.funcao ?? "Consultor",
      email: "",
      custoHoraCents: reaisToCents(e.custoH ?? 100),
      ativo: true,
      // Importados entram como admin para não trancar o acesso; ajuste na tela Equipe.
      papel: "admin" as const,
    };
  });
  const idOfConsultor = (nome: string | undefined): string | null => {
    if (!nome) return null;
    if (consultorId.has(nome)) return consultorId.get(nome)!;
    const id = slug("c", nome);
    consultorId.set(nome, id);
    equipe.push({ id, nome, funcao: "Consultor", email: "", custoHoraCents: 10000, ativo: true, papel: "consultor" });
    return id;
  };

  // 2) Projetos
  const projetos: Projeto[] = (L.projetos ?? []).map((p) => ({
    id: p.id,
    kind: p.kind === "treinamento" ? "treinamento" : "projeto",
    nome: p.nome ?? "",
    cliente: p.cliente ?? "",
    tipo: p.tipo ?? "",
    gerenteId: idOfConsultor(p.gerente),
    valorCents: reaisToCents(p.valor ?? 0),
    pctAdm: p.pctAdm ?? 0,
    pctCom: p.pctCom ?? 0,
    pctLucro: p.pctLucro ?? 0,
    status: normStatus(p.status),
    dtIni: emptyToNull(p.dtIni),
    dtFim: emptyToNull(p.dtFim),
  }));

  // 3) Tarefas — key antiga → id novo (guarda o mapa p/ lançamentos/comentários)
  const tarefaId = new Map<string, string>();
  const tarefas = (L.tarefas ?? []).map((t) => {
    const id = uuid();
    if (t.key) tarefaId.set(t.key, id);
    return {
      id,
      projetoId: t.projId ?? "",
      nome: t.nome ?? "",
      respId: idOfConsultor(t.resp),
      status: normTarefaStatus(t.status),
      hPrev: t.hPrev ?? 0,
      dtIni: emptyToNull(t.dtIni),
      dtFim: emptyToNull(t.dtFim),
      ativa: t.ativa !== false,
      semana: parseSemana(t.key),
    };
  });

  // 4) Lançamentos
  const lancamentos: Lancamento[] = (L.lancamentos ?? []).map((l) => ({
    id: uuid(),
    projetoId: l.projId ?? "",
    tarefaId: l.tarefaKey ? tarefaId.get(l.tarefaKey) ?? null : null,
    consultorId: idOfConsultor(l.consultor) ?? "",
    competencia: l.mes ?? (l.data ? competenciaOf(l.data) : ""),
    horas: l.horas ?? 0,
    data: l.data ?? "",
    obs: l.obs ?? "",
  }));

  // 5) Pagamentos
  const pagamentos: Pagamento[] = (L.pagamentos ?? []).map((pg) => ({
    id: uuid(),
    consultorId: idOfConsultor(pg.consultor) ?? "",
    projetoId: pg.projId ?? null,
    horas: pg.horas ?? 0,
    valorCents: reaisToCents(pg.valor ?? 0),
    data: pg.data ?? "",
    competencia: pg.data ? competenciaOf(pg.data) : "",
    obs: pg.obs ?? "",
  }));

  // 6) Parcelas — normaliza status
  const parcelas: Parcela[] = (L.parcelas ?? []).map((pa, i) => {
    const recebida = /receb/i.test(pa.status ?? "");
    return {
      id: uuid(),
      projetoId: pa.projId ?? "",
      numero: pa.parcela ?? i + 1,
      vencimento: pa.vencimento ?? "",
      valorCents: reaisToCents(pa.valor ?? 0),
      status: recebida ? "recebida" : "a_receber",
      recebidoEm: recebida ? pa.vencimento ?? null : null,
      entrada: !!pa.entrada,
    };
  });

  // 7) Custos
  const custos: Custo[] = (L.custos ?? []).map((c) => ({
    id: uuid(),
    categoria: c.categoria ?? "Despesas Gerais",
    descricao: c.descricao ?? c.nome ?? "",
    valorCents: reaisToCents(c.valor ?? 0),
    competencia: c.competencia ?? "",
    competenciaFim: emptyToNull(c.competenciaFim),
    frequencia: c.frequencia === "recorrente" ? "recorrente" : "unica",
    rateio: normRateio(c.rateio),
    projetoId: c.projId ?? null,
    rateioCustom: (c.rateioCustom ?? []).map((r) => ({
      projetoId: r.projId,
      pct: r.pct ?? 0,
    })),
  }));

  // 8) Comentários
  const comentarios: Comentario[] = (L.comentarios ?? []).map((co) => ({
    id: uuid(),
    tarefaId: co.tarefaKey ? tarefaId.get(co.tarefaKey) ?? "" : "",
    autor: co.autor ?? "",
    texto: co.texto ?? "",
    data: co.data ?? "",
    horas: co.horas ?? null,
  }));

  // 9) Categorias
  const categoriasCusto: CategoriaCusto[] = (L.categoriasCusto ?? []).map((nome) => ({
    id: uuid(),
    nome,
  }));

  return {
    equipe,
    projetos,
    parcelas,
    tarefas,
    lancamentos,
    pagamentos,
    custos,
    comentarios,
    categoriasCusto,
  };
}

// ── helpers ───────────────────────────────────────────────────
function slug(prefix: string, nome: string): string {
  return (
    prefix +
    "-" +
    nome
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}
function emptyToNull(v: string | undefined | null): string | null {
  return v ? v : null;
}
function normStatus(s: string | undefined): ProjetoStatus {
  const v = (s ?? "").toLowerCase();
  if (v.includes("andamento")) return "Em Andamento";
  if (v.includes("conclu")) return "Concluído";
  if (v.includes("pausa")) return "Pausado";
  if (v.includes("cancel")) return "Cancelado";
  return "Planejamento";
}
function normTarefaStatus(s: string | undefined): TarefaStatus {
  const v = (s ?? "").toLowerCase();
  if (v.includes("conclu")) return "Concluída";
  if (v.includes("andamento")) return "Em Andamento";
  if (v.includes("pausa")) return "Pausada";
  return "Não Iniciada";
}
function normRateio(r: string | undefined): Custo["rateio"] {
  if (r === "projeto" || r === "ativos" || r === "ativos_todos" || r === "personalizado") {
    return r;
  }
  return "ativos_todos";
}
function parseSemana(key: string | undefined): number | null {
  if (!key) return null;
  const m = key.match(/_sem(\d+)_/);
  return m ? parseInt(m[1], 10) : null;
}

// ── shape (frouxo) do backup antigo ──────────────────────────
interface LegacyRoot {
  equipe?: { nome: string; funcao?: string; custoH?: number }[];
  projetos?: LegacyProjeto[];
  tarefas?: LegacyTarefa[];
  lancamentos?: LegacyLanc[];
  pagamentos?: LegacyPag[];
  parcelas?: LegacyParc[];
  custos?: LegacyCusto[];
  comentarios?: LegacyComent[];
  categoriasCusto?: string[];
}
interface LegacyProjeto {
  id: string; kind?: string; nome?: string; cliente?: string; tipo?: string;
  gerente?: string; valor?: number; pctAdm?: number; pctCom?: number; pctLucro?: number;
  status?: string; dtIni?: string; dtFim?: string;
}
interface LegacyTarefa {
  key?: string; projId?: string; nome?: string; resp?: string; status?: string;
  hPrev?: number; dtIni?: string; dtFim?: string; ativa?: boolean;
}
interface LegacyLanc {
  consultor?: string; projId?: string; tarefaKey?: string; mes?: string;
  horas?: number; data?: string; obs?: string;
}
interface LegacyPag {
  consultor?: string; projId?: string | null; horas?: number; valor?: number;
  data?: string; obs?: string;
}
interface LegacyParc {
  projId?: string; parcela?: number; vencimento?: string; valor?: number;
  status?: string; entrada?: boolean;
}
interface LegacyCusto {
  categoria?: string; descricao?: string; nome?: string; valor?: number;
  competencia?: string; competenciaFim?: string; frequencia?: string;
  rateio?: string; projId?: string | null; rateioCustom?: { projId: string; pct?: number }[];
}
interface LegacyComent {
  tarefaKey?: string; autor?: string; texto?: string; data?: string; horas?: number | null;
}
