-- JOBZ · Fix para lancamentos com tarefa_id invalido
--
-- Sintoma:
--   insert or update on table "lancamentos" violates foreign key constraint
--   "lancamentos_tarefa_id_fkey"
--
-- Causa:
--   O app pode enviar um tarefa_id vazio/inexistente em alguns fluxos/importacoes.
--   Para calculo de pagamentos, o essencial e consultor_id, projeto_id, horas,
--   competencia e data. Entao o banco normaliza tarefa_id para NULL quando a
--   tarefa nao existir, em vez de bloquear o lancamento de horas.

create or replace function jobz_normalize_lancamento_tarefa_id()
returns trigger
language plpgsql
as $$
begin
  if new.tarefa_id is null or trim(new.tarefa_id) = '' then
    new.tarefa_id := null;
    return new;
  end if;

  if not exists (
    select 1
    from tarefas
    where id = new.tarefa_id
  ) then
    new.tarefa_id := null;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_jobz_normalize_lancamento_tarefa_id on lancamentos;

create trigger trg_jobz_normalize_lancamento_tarefa_id
before insert or update of tarefa_id on lancamentos
for each row
execute function jobz_normalize_lancamento_tarefa_id();

-- Corrige registros existentes, se houver algum criado antes da FK/trigger.
update lancamentos l
set tarefa_id = null
where tarefa_id is not null
  and trim(tarefa_id) <> ''
  and not exists (
    select 1
    from tarefas t
    where t.id = l.tarefa_id
  );
