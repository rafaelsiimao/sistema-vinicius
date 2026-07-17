-- ═══════════════════════════════════════════════════════════════
-- JOBZ · Schema PostgreSQL (Supabase)
-- Cole no Supabase Studio → SQL Editor → Run.
--
-- Notas de design:
--  • Ids são TEXT (projetos usam "P001"; demais usam uuid gerado no cliente).
--  • Datas são TEXT em ISO "YYYY-MM-DD" — casa 1:1 com o modelo do app e evita
--    coerção; ordenam corretamente como texto. Competência é TEXT "YYYY-MM".
--  • Dinheiro é BIGINT em centavos. Percentuais são NUMERIC (fração 0..1).
--  • Colunas em snake_case = snake_case dos campos TypeScript (mapeamento auto).
--  • RLS ligada: só usuários autenticados acessam. Crie usuários em Auth.
-- ═══════════════════════════════════════════════════════════════

-- ── Tabelas ───────────────────────────────────────────────────

create table if not exists consultores (
  id                text primary key,
  nome              text not null,
  -- E-mail que casa o consultor com o usuário do Supabase Auth (identidade do login).
  email             text not null default '',
  funcao            text not null default 'Consultor',
  custo_hora_cents  bigint not null default 0,
  ativo             boolean not null default true,
  papel             text not null default 'consultor' check (papel in ('admin','consultor'))
);

create table if not exists projetos (
  id          text primary key,
  kind        text not null check (kind in ('projeto','treinamento')),
  nome        text not null default '',
  cliente     text not null default '',
  tipo        text not null default '',
  gerente_id  text references consultores(id) on delete set null,
  valor_cents bigint not null default 0,
  pct_adm     numeric not null default 0,
  pct_com     numeric not null default 0,
  pct_lucro   numeric not null default 0,
  status      text not null default 'Planejamento',
  dt_ini      text,
  dt_fim      text
);

create table if not exists parcelas (
  id          text primary key,
  projeto_id  text not null references projetos(id) on delete cascade,
  numero      integer not null default 1,
  vencimento  text not null,
  valor_cents bigint not null default 0,
  status      text not null default 'a_receber' check (status in ('a_receber','recebida','cancelada')),
  recebido_em text,
  entrada     boolean not null default false
);

create table if not exists tarefas (
  id          text primary key,
  projeto_id  text not null references projetos(id) on delete cascade,
  nome        text not null default '',
  resp_id     text references consultores(id) on delete set null,
  status      text not null default 'Não Iniciada',
  h_prev      numeric not null default 0,
  dt_ini      text,
  dt_fim      text,
  ativa       boolean not null default true,
  semana      integer
);

create table if not exists lancamentos (
  id           text primary key,
  projeto_id   text not null references projetos(id) on delete cascade,
  tarefa_id    text references tarefas(id) on delete set null,
  consultor_id text not null references consultores(id) on delete restrict,
  competencia  text not null,
  horas        numeric not null default 0,
  data         text not null,
  obs          text not null default '',
  contabiliza  boolean not null default true
);

-- O app pode enviar tarefa_id vazio/inexistente em alguns fluxos/importacoes.
-- Para pagamentos, so conta lancamento vinculado a tarefa existente e ativa.
create or replace function jobz_normalize_lancamento_tarefa_id()
returns trigger
language plpgsql
as $$
declare
  v_tarefa_ativa boolean;
begin
  if new.tarefa_id is null or trim(new.tarefa_id) = '' then
    new.tarefa_id := null;
    new.contabiliza := false;
    return new;
  end if;

  select ativa
    into v_tarefa_ativa
    from tarefas
    where id = new.tarefa_id;

  if v_tarefa_ativa is null then
    new.tarefa_id := null;
    new.contabiliza := false;
  else
    new.contabiliza := v_tarefa_ativa;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_jobz_normalize_lancamento_tarefa_id on lancamentos;

create trigger trg_jobz_normalize_lancamento_tarefa_id
before insert or update of tarefa_id on lancamentos
for each row
execute function jobz_normalize_lancamento_tarefa_id();

create or replace function jobz_sync_lancamentos_contabiliza_por_tarefa()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    update lancamentos
      set contabiliza = false
      where tarefa_id = old.id;
    return old;
  end if;

  if old.ativa is distinct from new.ativa then
    update lancamentos
      set contabiliza = new.ativa
      where tarefa_id = new.id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_jobz_tarefas_sync_lancamentos_update on tarefas;
drop trigger if exists trg_jobz_tarefas_sync_lancamentos_delete on tarefas;

create trigger trg_jobz_tarefas_sync_lancamentos_update
after update of ativa on tarefas
for each row
execute function jobz_sync_lancamentos_contabiliza_por_tarefa();

create trigger trg_jobz_tarefas_sync_lancamentos_delete
before delete on tarefas
for each row
execute function jobz_sync_lancamentos_contabiliza_por_tarefa();

-- Usado na policy de SELECT: tarefas inativas/apagadas nao entram em calculos.
create or replace function jobz_lancamento_tarefa_contabiliza(
  p_tarefa_id text,
  p_contabiliza boolean default true
)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    coalesce(p_contabiliza, false)
    and p_tarefa_id is not null
    and trim(p_tarefa_id) <> ''
    and exists (
      select 1
      from tarefas
      where id = p_tarefa_id
        and ativa = true
    )
$$;

create table if not exists pagamentos (
  id           text primary key,
  consultor_id text not null references consultores(id) on delete restrict,
  projeto_id   text references projetos(id) on delete set null,
  horas        numeric not null default 0,
  valor_cents  bigint not null default 0,
  data         text not null,
  competencia  text not null default '',
  obs          text not null default ''
);

create table if not exists custos (
  id              text primary key,
  categoria       text not null default 'Despesas Gerais',
  descricao       text not null default '',
  valor_cents     bigint not null default 0,
  competencia     text not null,
  competencia_fim text,
  frequencia      text not null default 'unica' check (frequencia in ('unica','recorrente')),
  rateio          text not null default 'ativos_todos' check (rateio in ('projeto','ativos','ativos_todos','personalizado')),
  projeto_id      text references projetos(id) on delete set null,
  rateio_custom   jsonb not null default '[]'::jsonb
);

create table if not exists comentarios (
  id         text primary key,
  tarefa_id  text not null references tarefas(id) on delete cascade,
  autor      text not null default '',
  texto      text not null default '',
  data       text not null,
  horas      numeric
);

create table if not exists categorias_custo (
  id   text primary key,
  nome text not null
);

-- ── Índices úteis ─────────────────────────────────────────────
create index if not exists idx_parcelas_projeto     on parcelas(projeto_id);
create index if not exists idx_tarefas_projeto      on tarefas(projeto_id);
create index if not exists idx_lancamentos_projeto  on lancamentos(projeto_id);
create index if not exists idx_lancamentos_consultor on lancamentos(consultor_id);
create index if not exists idx_lancamentos_comp     on lancamentos(competencia);
create index if not exists idx_pagamentos_consultor on pagamentos(consultor_id);
create index if not exists idx_comentarios_tarefa   on comentarios(tarefa_id);

-- ── Row Level Security ────────────────────────────────────────
-- PASSO 1 (ative já): qualquer usuário AUTENTICADO tem acesso total. Simples e
-- suficiente para começar. A separação por papel abaixo (PASSO 2) é o alvo.

do $$
declare t text;
begin
  foreach t in array array[
    'consultores','projetos','parcelas','tarefas','lancamentos',
    'pagamentos','custos','comentarios','categorias_custo'
  ]
  loop
    execute format('alter table %I enable row level security;', t);
    execute format('drop policy if exists "auth_all" on %I;', t);
    if t = 'lancamentos' then
      execute 'drop policy if exists "lancamentos_select_active" on lancamentos;';
      execute 'drop policy if exists "lancamentos_insert_auth" on lancamentos;';
      execute 'drop policy if exists "lancamentos_update_auth" on lancamentos;';
      execute 'drop policy if exists "lancamentos_delete_auth" on lancamentos;';
      execute 'create policy "lancamentos_select_active" on lancamentos for select to authenticated using (jobz_lancamento_tarefa_contabiliza(tarefa_id, contabiliza));';
      execute 'create policy "lancamentos_insert_auth" on lancamentos for insert to authenticated with check (true);';
      execute 'create policy "lancamentos_update_auth" on lancamentos for update to authenticated using (true) with check (true);';
      execute 'create policy "lancamentos_delete_auth" on lancamentos for delete to authenticated using (true);';
    else
      execute format(
        'create policy "auth_all" on %I for all to authenticated using (true) with check (true);',
        t
      );
    end if;
  end loop;
end $$;

-- ── PASSO 2 (imposição real por papel) ────────────────────────
-- Habilite depois de: (a) criar os usuários em Authentication e (b) cadastrar
-- cada consultor em Equipe com o MESMO e-mail do login. Então rode o bloco
-- abaixo para SUBSTITUIR o "auth_all" pelas regras: admin vê tudo; consultor vê
-- só as próprias tarefas, lançamentos e pagamentos (o "a receber" dele).
-- A identidade é casada pelo e-mail do JWT (auth.jwt() ->> 'email').
/*
-- Helpers (security definer p/ evitar recursão de RLS ao ler consultores)
create or replace function jobz_consultor_id() returns text
  language sql stable security definer set search_path = public as $$
    select id from consultores
    where lower(email) = lower(auth.jwt() ->> 'email') limit 1
  $$;
create or replace function jobz_is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
    select exists(select 1 from consultores
                  where lower(email) = lower(auth.jwt() ->> 'email') and papel = 'admin')
  $$;

-- Remove o acesso total
do $$
declare t text;
begin
  foreach t in array array[
    'consultores','projetos','parcelas','tarefas','lancamentos',
    'pagamentos','custos','comentarios','categorias_custo'
  ]
  loop execute format('drop policy if exists "auth_all" on %I;', t); end loop;
end $$;

-- Admin: acesso total a tudo
do $$
declare t text;
begin
  foreach t in array array[
    'consultores','projetos','parcelas','tarefas','lancamentos',
    'pagamentos','custos','comentarios','categorias_custo'
  ]
  loop
    execute format('create policy "admin_all" on %I for all to authenticated using (jobz_is_admin()) with check (jobz_is_admin());', t);
  end loop;
end $$;

-- Consultor: leitura restrita
create policy "consultor_projetos"   on projetos    for select to authenticated using (true);
create policy "consultor_consultores" on consultores for select to authenticated using (id = jobz_consultor_id());
create policy "consultor_tarefas"    on tarefas     for select to authenticated using (resp_id = jobz_consultor_id());
create policy "consultor_lancam_sel" on lancamentos for select to authenticated using (consultor_id = jobz_consultor_id() and jobz_lancamento_tarefa_contabiliza(tarefa_id, contabiliza));
create policy "consultor_lancam_ins" on lancamentos for insert to authenticated with check (consultor_id = jobz_consultor_id() and jobz_lancamento_tarefa_contabiliza(tarefa_id, contabiliza));
create policy "consultor_pagam_sel"  on pagamentos  for select to authenticated using (consultor_id = jobz_consultor_id());
-- (consultor NÃO recebe policy em parcelas/custos/faturamento => não enxerga)
*/
