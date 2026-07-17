-- JOBZ · RLS por papel
--
-- Rode este arquivo somente depois de:
-- 1. criar os usuários em Supabase Authentication;
-- 2. importar/cadastrar a equipe no app;
-- 3. garantir que cada consultor tenha o mesmo e-mail do login;
-- 4. confirmar que pelo menos um consultor está com papel = 'admin'.
--
-- Este script substitui a policy inicial "auth_all" por regras reais:
-- admin vê tudo; consultor vê somente os próprios dados operacionais.

create or replace function jobz_consultor_id() returns text
  language sql stable security definer set search_path = public as $$
    select id from consultores
    where lower(email) = lower(auth.jwt() ->> 'email') limit 1
  $$;

create or replace function jobz_is_admin() returns boolean
  language sql stable security definer set search_path = public as $$
    select exists(
      select 1
      from consultores
      where lower(email) = lower(auth.jwt() ->> 'email')
        and papel = 'admin'
    )
  $$;

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

do $$
declare t text;
begin
  foreach t in array array[
    'consultores','projetos','parcelas','tarefas','lancamentos',
    'pagamentos','custos','comentarios','categorias_custo'
  ]
  loop
    execute format('drop policy if exists "auth_all" on %I;', t);
    execute format('drop policy if exists "admin_all" on %I;', t);
  end loop;
  drop policy if exists "lancamentos_select_active" on lancamentos;
  drop policy if exists "lancamentos_insert_auth" on lancamentos;
  drop policy if exists "lancamentos_update_auth" on lancamentos;
  drop policy if exists "lancamentos_delete_auth" on lancamentos;
  drop policy if exists "admin_lancam_sel" on lancamentos;
  drop policy if exists "admin_lancam_ins" on lancamentos;
  drop policy if exists "admin_lancam_upd" on lancamentos;
  drop policy if exists "admin_lancam_del" on lancamentos;
end $$;

drop function if exists jobz_lancamento_tarefa_contabiliza(text);

do $$
declare t text;
begin
  foreach t in array array[
    'consultores','projetos','parcelas','tarefas',
    'pagamentos','custos','comentarios','categorias_custo'
  ]
  loop
    execute format(
      'create policy "admin_all" on %I for all to authenticated using (jobz_is_admin()) with check (jobz_is_admin());',
      t
    );
  end loop;
end $$;

drop policy if exists "consultor_projetos" on projetos;
drop policy if exists "consultor_consultores" on consultores;
drop policy if exists "consultor_tarefas" on tarefas;
drop policy if exists "consultor_lancam_sel" on lancamentos;
drop policy if exists "consultor_lancam_ins" on lancamentos;
drop policy if exists "consultor_pagam_sel" on pagamentos;

create policy "consultor_projetos"
  on projetos for select to authenticated
  using (true);

create policy "consultor_consultores"
  on consultores for select to authenticated
  using (id = jobz_consultor_id());

create policy "consultor_tarefas"
  on tarefas for select to authenticated
  using (resp_id = jobz_consultor_id());

create policy "admin_lancam_sel"
  on lancamentos for select to authenticated
  using (jobz_is_admin() and jobz_lancamento_tarefa_contabiliza(tarefa_id, contabiliza));

create policy "admin_lancam_ins"
  on lancamentos for insert to authenticated
  with check (jobz_is_admin());

create policy "admin_lancam_upd"
  on lancamentos for update to authenticated
  using (jobz_is_admin())
  with check (jobz_is_admin());

create policy "admin_lancam_del"
  on lancamentos for delete to authenticated
  using (jobz_is_admin());

create policy "consultor_lancam_sel"
  on lancamentos for select to authenticated
  using (
    consultor_id = jobz_consultor_id()
    and jobz_lancamento_tarefa_contabiliza(tarefa_id, contabiliza)
  );

create policy "consultor_lancam_ins"
  on lancamentos for insert to authenticated
  with check (
    consultor_id = jobz_consultor_id()
    and jobz_lancamento_tarefa_contabiliza(tarefa_id, contabiliza)
  );

create policy "consultor_pagam_sel"
  on pagamentos for select to authenticated
  using (consultor_id = jobz_consultor_id());
