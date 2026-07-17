-- JOBZ · Diagnostico de Pagamentos e Custos
--
-- Rode no Supabase SQL Editor quando /pagamentos ou /custos aparentarem falhar
-- apos importacao. O objetivo e achar dados orfaos, campos vazios ou formatos
-- que quebram calculos/telas.

-- 1) Contagens gerais.
select 'consultores' as tabela, count(*) as linhas from consultores
union all select 'projetos', count(*) from projetos
union all select 'tarefas', count(*) from tarefas
union all select 'lancamentos', count(*) from lancamentos
union all select 'pagamentos', count(*) from pagamentos
union all select 'custos', count(*) from custos
union all select 'parcelas', count(*) from parcelas
order by tabela;

-- 2) Pagamentos apontando para consultor inexistente.
select
  p.*
from pagamentos p
left join consultores c on c.id = p.consultor_id
where c.id is null;

-- 3) Pagamentos apontando para projeto inexistente.
select
  p.*
from pagamentos p
left join projetos pr on pr.id = p.projeto_id
where p.projeto_id is not null
  and pr.id is null;

-- 4) Pagamentos com datas/competencias possivelmente invalidas.
select
  *
from pagamentos
where coalesce(data, '') !~ '^\d{4}-\d{2}-\d{2}$'
   or coalesce(competencia, '') !~ '^\d{4}-\d{2}$'
   or horas is null
   or valor_cents is null;

-- 5) Custos com competencia/formato invalidos.
select
  *
from custos
where coalesce(competencia, '') !~ '^\d{4}-\d{2}$'
   or (competencia_fim is not null and competencia_fim !~ '^\d{4}-\d{2}$')
   or valor_cents is null;

-- 6) Custos com rateio fora do esperado.
select
  *
from custos
where rateio not in ('projeto', 'ativos', 'ativos_todos', 'personalizado')
   or frequencia not in ('unica', 'recorrente');

-- 7) Custos com rateio por projeto apontando para projeto inexistente.
select
  cu.*
from custos cu
left join projetos pr on pr.id = cu.projeto_id
where cu.rateio = 'projeto'
  and pr.id is null;

-- 8) Custos personalizados com JSON vazio ou em formato suspeito.
select
  *
from custos
where rateio = 'personalizado'
  and (
    jsonb_typeof(rateio_custom) <> 'array'
    or jsonb_array_length(rateio_custom) = 0
  );

-- 9) Projetos ativos por competencia, usado pelos rateios "ativos".
select
  status,
  count(*) as projetos
from projetos
group by status
order by status;

-- 10) Amostra dos dados que alimentam /pagamentos.
select
  p.id,
  p.data,
  p.competencia,
  p.horas,
  p.valor_cents,
  p.consultor_id,
  c.nome as consultor,
  p.projeto_id,
  pr.nome as projeto
from pagamentos p
left join consultores c on c.id = p.consultor_id
left join projetos pr on pr.id = p.projeto_id
order by p.data desc
limit 50;

-- 11) Amostra dos dados que alimentam /custos.
select
  id,
  categoria,
  descricao,
  valor_cents,
  competencia,
  competencia_fim,
  frequencia,
  rateio,
  projeto_id,
  rateio_custom
from custos
order by competencia desc, categoria
limit 50;
