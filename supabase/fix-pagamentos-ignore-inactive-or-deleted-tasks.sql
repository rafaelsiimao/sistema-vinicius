-- JOBZ - Hotfix leve para /pagamentos
--
-- Use este script se o fix completo travar com deadlock.
-- Regra:
--   lancamento so aparece/contabiliza quando tarefa_id aponta para uma tarefa
--   existente e ativa. Se a tarefa for inativada ou apagada, sai de /pagamentos.

create or replace function jobz_lancamento_tarefa_contabiliza(p_tarefa_id text)
returns boolean
language sql stable security definer set search_path = public as $$
  select
    p_tarefa_id is not null
    and trim(p_tarefa_id) <> ''
    and exists (
      select 1
      from tarefas
      where id = p_tarefa_id
        and ativa = true
    )
$$;

drop policy if exists "auth_all" on lancamentos;
drop policy if exists "admin_all" on lancamentos;
drop policy if exists "lancamentos_select_active" on lancamentos;
drop policy if exists "lancamentos_insert_auth" on lancamentos;
drop policy if exists "lancamentos_update_auth" on lancamentos;
drop policy if exists "lancamentos_delete_auth" on lancamentos;
drop policy if exists "admin_lancam_sel" on lancamentos;
drop policy if exists "admin_lancam_ins" on lancamentos;
drop policy if exists "admin_lancam_upd" on lancamentos;
drop policy if exists "admin_lancam_del" on lancamentos;
drop policy if exists "consultor_lancam_sel" on lancamentos;
drop policy if exists "consultor_lancam_ins" on lancamentos;

create policy "lancamentos_select_active"
  on lancamentos for select to authenticated
  using (jobz_lancamento_tarefa_contabiliza(tarefa_id));

create policy "lancamentos_insert_auth"
  on lancamentos for insert to authenticated
  with check (true);

create policy "lancamentos_update_auth"
  on lancamentos for update to authenticated
  using (true)
  with check (true);

create policy "lancamentos_delete_auth"
  on lancamentos for delete to authenticated
  using (true);
