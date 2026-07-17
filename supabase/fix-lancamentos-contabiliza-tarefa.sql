-- JOBZ - Controle definitivo de contabilizacao de horas por tarefa
--
-- Resolve:
--   1. horas de tarefa inativa ainda aparecendo em /pagamentos;
--   2. horas de tarefa apagada ainda contando depois que tarefa_id vira NULL;
--   3. reativacao de tarefa deve fazer as horas voltarem a contar.
--
-- Regra adotada:
--   lancamento so contabiliza se estiver vinculado a uma tarefa existente e ativa.

alter table lancamentos
  add column if not exists contabiliza boolean not null default true;

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

-- Backfill: qualquer lancamento sem tarefa existente e ativa deixa de contar.
update lancamentos l
  set contabiliza = exists (
    select 1
    from tarefas t
    where t.id = l.tarefa_id
      and t.ativa = true
  );

alter table lancamentos enable row level security;

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

drop function if exists jobz_lancamento_tarefa_contabiliza(text);

create policy "lancamentos_select_active"
  on lancamentos for select to authenticated
  using (jobz_lancamento_tarefa_contabiliza(tarefa_id, contabiliza));

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
