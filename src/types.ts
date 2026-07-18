// ═══════════════════════════════════════════════════════════════
// MODELO DE DOMÍNIO
// Regras adotadas (correções da auditoria do protótipo):
//  • Dinheiro SEMPRE em centavos (inteiro) — nunca float. Ver lib/money.ts
//  • Percentuais como fração decimal (0.20 = 20%)
//  • Competência no formato "YYYY-MM"
//  • Datas no formato ISO "YYYY-MM-DD"
//  • "vencida" NÃO é um status armazenado: é derivado da data. Recebimento
//    exige data explícita (recebidoEm) — vencimento nunca vira recebimento sozinho.
// ═══════════════════════════════════════════════════════════════

export type Kind = "projeto" | "treinamento";

export type ProjetoStatus =
  | "Planejamento"
  | "Em Andamento"
  | "Concluído"
  | "Pausado"
  | "Cancelado";

export type TarefaStatus =
  | "Não Iniciada"
  | "Em Andamento"
  | "Concluída"
  | "Pausada";

/** Status ARMAZENADO de uma parcela. "Vencida" é derivado (ver lib/calc.ts). */
export type ParcelaStatus = "a_receber" | "recebida" | "cancelada";

export type Frequencia = "unica" | "recorrente";

/** Regra de rateio de um custo entre projetos. */
export type Rateio = "projeto" | "ativos" | "ativos_todos" | "personalizado";

/** Papel de acesso. admin vê tudo; consultor vê só as próprias tarefas e o próprio a receber. */
export type Papel = "admin" | "consultor";

export interface Consultor {
  id: string;
  nome: string;
  funcao: string;
  /** E-mail — usado para casar o consultor com o usuário logado (Supabase Auth). */
  email: string;
  /** Custo por hora, em centavos. */
  custoHoraCents: number;
  ativo: boolean;
  papel: Papel;
}

export interface Projeto {
  id: string; // "P001", "TR001" — legível
  kind: Kind;
  nome: string;
  cliente: string;
  tipo: string;
  /** Id do consultor responsável (gerente). */
  gerenteId: string | null;
  /** Valor contratado, em centavos. */
  valorCents: number;
  pctAdm: number;
  pctCom: number;
  pctLucro: number;
  status: ProjetoStatus;
  dtIni: string | null; // ISO date
  dtFim: string | null; // ISO date
}

export interface Parcela {
  id: string;
  projetoId: string;
  numero: number;
  vencimento: string; // ISO date
  /** Valor em centavos. */
  valorCents: number;
  status: ParcelaStatus;
  /** Data de recebimento efetivo (ISO). Preenchido só quando status = "recebida". */
  recebidoEm: string | null;
  entrada: boolean;
}

export interface Tarefa {
  id: string;
  projetoId: string;
  nome: string;
  /** Id do consultor responsável. */
  respId: string | null;
  status: TarefaStatus;
  /** Horas previstas. */
  hPrev: number;
  dtIni: string | null;
  dtFim: string | null;
  ativa: boolean;
  /** Semana do plano (opcional). */
  semana: number | null;
}

/** Apontamento de horas efetivamente trabalhadas. */
export interface Lancamento {
  id: string;
  projetoId: string;
  tarefaId: string | null;
  consultorId: string;
  competencia: string; // "YYYY-MM"
  horas: number;
  data: string; // ISO date
  obs: string;
}

/** Pagamento de horas a um consultor (sempre alocado a um projeto, quando possível). */
export interface Pagamento {
  id: string;
  consultorId: string;
  /** Projeto ao qual o pagamento se refere (recomendado). null = geral. */
  projetoId: string | null;
  horas: number;
  /** Valor em centavos (horas × custo/hora no momento do pagamento). */
  valorCents: number;
  /** Data em que o pagamento foi feito (ISO). */
  data: string;
  /** Competência TRABALHADA que este pagamento quita ("YYYY-MM") — permite ver pago/a pagar por mês. */
  competencia: string;
  obs: string;
}

export interface RateioItem {
  projetoId: string;
  /** Percentual (0..100) atribuído ao projeto. */
  pct: number;
}

export interface Custo {
  id: string;
  categoria: string;
  descricao: string;
  /** Valor em centavos. */
  valorCents: number;
  competencia: string; // "YYYY-MM" — início/competência
  competenciaFim: string | null; // para recorrentes
  frequencia: Frequencia;
  rateio: Rateio;
  projetoId: string | null; // usado quando rateio = "projeto"
  rateioCustom: RateioItem[]; // usado quando rateio = "personalizado"
}

export interface Comentario {
  id: string;
  tarefaId: string;
  autor: string;
  texto: string;
  data: string; // ISO date
  horas: number | null;
}

export interface CategoriaCusto {
  id: string;
  nome: string;
}

/** Snapshot completo do banco (o que a camada de dados carrega/salva). */
export interface Snapshot {
  equipe: Consultor[];
  projetos: Projeto[];
  parcelas: Parcela[];
  tarefas: Tarefa[];
  lancamentos: Lancamento[];
  pagamentos: Pagamento[];
  custos: Custo[];
  comentarios: Comentario[];
  categoriasCusto: CategoriaCusto[];
}

/** Nomes das coleções — usados pela camada de dados de forma type-safe. */
export type CollectionName = keyof Snapshot;

export const EMPTY_SNAPSHOT: Snapshot = {
  equipe: [],
  projetos: [],
  parcelas: [],
  tarefas: [],
  lancamentos: [],
  pagamentos: [],
  custos: [],
  comentarios: [],
  categoriasCusto: [],
};
