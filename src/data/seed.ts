import type { Snapshot } from "@/types";

/**
 * Dados de demonstração para o modo LOCAL (para o app não abrir vazio).
 * Em produção com Supabase, o banco começa vazio e é populado pela migração
 * do backup antigo (ver migrateFromLegacy.ts) ou pelo próprio uso.
 */
export const SEED: Snapshot = {
  equipe: [
    { id: "c-vinicius", nome: "Vinícius Barbosa", funcao: "Sócio / Consultor", email: "vinicius@jobz.com.br", custoHoraCents: 12000, ativo: true, papel: "admin" },
    { id: "c-daniely", nome: "Daniely", funcao: "Sócia / Consultora", email: "daniely@jobz.com.br", custoHoraCents: 12000, ativo: true, papel: "admin" },
    { id: "c-kleber", nome: "Kleber", funcao: "Consultor", email: "kleber@jobz.com.br", custoHoraCents: 9000, ativo: true, papel: "consultor" },
    { id: "c-luciana", nome: "Luciana", funcao: "Consultora", email: "luciana@jobz.com.br", custoHoraCents: 9000, ativo: true, papel: "consultor" },
  ],
  projetos: [
    {
      id: "P001", kind: "projeto", nome: "D&R Arquitetura — Mapeamento de Processos",
      cliente: "D&R Arquitetura", tipo: "Mapeamento de processos", gerenteId: "c-vinicius",
      valorCents: 14_000_00, pctAdm: 0.2, pctCom: 0.02, pctLucro: 0.1,
      status: "Em Andamento", dtIni: "2026-01-01", dtFim: "2026-06-30",
    },
    {
      id: "P002", kind: "projeto", nome: "Cartório de Viana — Reestruturação",
      cliente: "Cartório de Viana", tipo: "JOBZ 360", gerenteId: "c-daniely",
      valorCents: 16_100_00, pctAdm: 0.2, pctCom: 0.02, pctLucro: 0.1,
      status: "Em Andamento", dtIni: "2026-04-25", dtFim: "2026-10-25",
    },
    {
      id: "P003", kind: "projeto", nome: "Ita Fabricados — Plano JOBZ 2026",
      cliente: "Ita Fabricados", tipo: "JOBZ 360", gerenteId: "c-vinicius",
      valorCents: 120_000_00, pctAdm: 0.2, pctCom: 0.02, pctLucro: 0.2,
      status: "Em Andamento", dtIni: "2026-05-19", dtFim: "2027-05-19",
    },
    {
      id: "TR001", kind: "treinamento", nome: "Delpupo — Treinamento de Liderança",
      cliente: "Delpupo", tipo: "Treinamento de Liderança", gerenteId: "c-daniely",
      valorCents: 14_200_00, pctAdm: 0.2, pctCom: 0.02, pctLucro: 0.2,
      status: "Em Andamento", dtIni: "2026-03-01", dtFim: "2026-08-31",
    },
  ],
  parcelas: [
    { id: "pa-1", projetoId: "P001", numero: 1, vencimento: "2026-02-01", valorCents: 7_000_00, status: "recebida", recebidoEm: "2026-02-03", entrada: false },
    { id: "pa-2", projetoId: "P001", numero: 2, vencimento: "2026-05-01", valorCents: 7_000_00, status: "a_receber", recebidoEm: null, entrada: false },
    { id: "pa-3", projetoId: "P002", numero: 1, vencimento: "2026-04-25", valorCents: 2_300_00, status: "recebida", recebidoEm: "2026-04-25", entrada: false },
    { id: "pa-4", projetoId: "P002", numero: 2, vencimento: "2026-05-25", valorCents: 2_300_00, status: "a_receber", recebidoEm: null, entrada: false },
  ],
  tarefas: [
    { id: "t-1", projetoId: "P001", nome: "Levantamento AS-IS", respId: "c-vinicius", status: "Concluída", hPrev: 20, dtIni: "2026-01-05", dtFim: "2026-02-10", ativa: true, semana: 1 },
    { id: "t-2", projetoId: "P001", nome: "Desenho TO-BE", respId: "c-vinicius", status: "Em Andamento", hPrev: 24, dtIni: "2026-02-15", dtFim: "2026-04-30", ativa: true, semana: 2 },
    { id: "t-3", projetoId: "P002", nome: "Diagnóstico inicial", respId: "c-daniely", status: "Em Andamento", hPrev: 16, dtIni: "2026-04-25", dtFim: "2026-06-30", ativa: true, semana: 1 },
    { id: "t-4", projetoId: "P002", nome: "Mapa de processos — Compras", respId: "c-kleber", status: "Em Andamento", hPrev: 20, dtIni: "2026-06-01", dtFim: "2026-08-31", ativa: true, semana: 2 },
    { id: "t-5", projetoId: "P003", nome: "Entrevistas — Produção", respId: "c-kleber", status: "Não Iniciada", hPrev: 30, dtIni: "2026-07-01", dtFim: "2026-09-30", ativa: true, semana: 1 },
    { id: "t-6", projetoId: "P003", nome: "Consolidação de indicadores", respId: "c-luciana", status: "Em Andamento", hPrev: 24, dtIni: "2026-07-01", dtFim: "2026-09-30", ativa: true, semana: 1 },
  ],
  lancamentos: [
    { id: "l-1", projetoId: "P001", tarefaId: "t-1", consultorId: "c-vinicius", competencia: "2026-01", horas: 18, data: "2026-01-20", obs: "AS-IS" },
    { id: "l-2", projetoId: "P001", tarefaId: "t-2", consultorId: "c-vinicius", competencia: "2026-03", horas: 12, data: "2026-03-10", obs: "TO-BE parcial" },
    { id: "l-3", projetoId: "P002", tarefaId: "t-3", consultorId: "c-daniely", competencia: "2026-05", horas: 8, data: "2026-05-08", obs: "Diagnóstico" },
    { id: "l-4", projetoId: "P002", tarefaId: "t-4", consultorId: "c-kleber", competencia: "2026-06", horas: 10, data: "2026-06-12", obs: "Mapa AS-IS compras" },
    { id: "l-5", projetoId: "P002", tarefaId: "t-4", consultorId: "c-kleber", competencia: "2026-07", horas: 8, data: "2026-07-08", obs: "Mapa TO-BE compras" },
    { id: "l-6", projetoId: "P003", tarefaId: "t-6", consultorId: "c-luciana", competencia: "2026-07", horas: 12, data: "2026-07-10", obs: "Indicadores" },
  ],
  pagamentos: [
    { id: "pg-1", consultorId: "c-vinicius", projetoId: "P001", horas: 18, valorCents: 18 * 12000, data: "2026-02-05", competencia: "2026-01", obs: "Ref. janeiro" },
    { id: "pg-2", consultorId: "c-kleber", projetoId: "P002", horas: 10, valorCents: 10 * 9000, data: "2026-07-05", competencia: "2026-06", obs: "Ref. junho" },
  ],
  custos: [
    { id: "cu-1", categoria: "Softwares e Licenças", descricao: "CRM + ferramentas", valorCents: 600_00, competencia: "2026-01", competenciaFim: null, frequencia: "recorrente", rateio: "ativos_todos", projetoId: null, rateioCustom: [] },
    { id: "cu-2", categoria: "Marketing", descricao: "Tráfego pago", valorCents: 1_500_00, competencia: "2026-05", competenciaFim: null, frequencia: "recorrente", rateio: "ativos", projetoId: null, rateioCustom: [] },
  ],
  comentarios: [
    { id: "co-1", tarefaId: "t-2", autor: "Vinícius Barbosa", texto: "Cliente validou o fluxo de compras.", data: "2026-03-10", horas: 2 },
  ],
  categoriasCusto: [
    { id: "cat-1", nome: "Horas de Consultoria" },
    { id: "cat-2", nome: "Impostos" },
    { id: "cat-3", nome: "Marketing" },
    { id: "cat-4", nome: "Softwares e Licenças" },
    { id: "cat-5", nome: "Administrativo" },
  ],
};
