-- =====================================================================
-- conferir-cartao.sql — tira um retrato do que JÁ EXISTE no banco para
-- um cartão, para conferir contra a fatura real antes de lançar nada.
--
-- Rode no SQL Editor do Supabase. Só lê (SELECT), não altera nada.
--
-- Por que não basta um `select * from lancamentos`: recorrência e
-- parcelamento são UMA REGRA, não N linhas (§4.1). O passo 2 abaixo
-- expande as regras em ocorrências concretas, do mesmo jeito que
-- src/lib/recorrencia.ts faz na leitura — inclusive o clamp de dia
-- curto (dia 31 em fevereiro vira 28) e as exceções de série.
-- =====================================================================


-- ---------------------------------------------------------------------
-- PASSO 1 — os cartões, o regime de ciclo e quantas linhas cada um tem.
-- Serve para pegar o nome exato do cartão a usar no passo 2.
-- ---------------------------------------------------------------------
select c.nome                                                        as cartao,
       ct.nome                                                       as conta,
       c.dia_fechamento,
       c.dia_pagamento,
       c.arquivado_em,
       (select count(*) from lancamentos l where l.cartao_id = c.id) as linhas_no_banco,
       (select json_agg(json_build_object('desde_ciclo_abs', x.desde_ciclo_abs,
                                          'fechamento',     x.dia_fechamento,
                                          'pagamento',      x.dia_pagamento))
          from cartoes_ciclos x where x.cartao_id = c.id)            as mudancas_de_regime,
       (select json_agg(json_build_object('ciclo_abs', pg.ciclo_abs,
                                          'data_paga', pg.data_paga))
          from cartoes_pagamentos pg where pg.cartao_id = c.id)      as pagamentos_avulsos
from cartoes c
join contas ct on ct.id = c.conta_id
order by c.nome;


-- ---------------------------------------------------------------------
-- PASSO 2 — as ocorrências do cartão no período, já expandidas.
-- Edite só o bloco `p` abaixo: nome do cartão e a janela de datas.
-- ---------------------------------------------------------------------
with p as (
  select 'NOME DO CARTÃO'::text as cartao,   -- <<< copie do passo 1
         date '2025-01-01'      as ini,      -- <<< início da janela
         date '2026-12-31'      as fim       -- <<< fim da janela
),
regra as (
  select l.id, l.serie_id, l.tipo, l.valor, l.descricao, l.nota, l.data,
         l.repeticao::text as repeticao, l.parcelas, l.recorrencia_fim
  from lancamentos l
  join cartoes c on c.id = l.cartao_id
  cross join p
  where c.nome = p.cartao
),
expandida as (
  select r.*,
         i,
         (date_trunc('month', r.data)::date + (i * interval '1 month'))::date as mes_ini
  from regra r
  cross join p
  cross join lateral generate_series(
    0,
    case
      when r.repeticao = 'avista'        then 0
      when r.repeticao = 'parcelar'      then coalesce(r.parcelas, 1) - 1
      when r.recorrencia_fim is not null then r.recorrencia_fim - 1
      else greatest(
             0,
             ( (extract(year  from p.fim)::int * 12 + extract(month from p.fim)::int)
             - (extract(year  from r.data)::int * 12 + extract(month from r.data)::int) )
           )
    end
  ) as i
),
ocor as (
  -- dia-âncora com clamp no último dia do mês (§4.1)
  select e.*,
         ( e.mes_ini
           + ( least( extract(day from e.data)::int,
                      extract(day from (e.mes_ini + interval '1 month' - interval '1 day'))::int
                    ) - 1 )
         ) as data_ocor
  from expandida e
),
final as (
  select o.data_ocor                        as data,
         coalesce(x.descricao, o.descricao) as descricao,
         coalesce(x.valor, o.valor)         as valor,
         o.tipo::text                       as tipo,
         case
           when o.repeticao = 'avista'   then 'à vista'
           when o.repeticao = 'parcelar' then (o.i + 1) || '/' || o.parcelas
           else 'recorrente ' || (o.i + 1) || coalesce('/' || o.recorrencia_fim, '')
         end                                as origem,
         o.id                               as id_da_regra
  from ocor o
  cross join p
  left join excecoes_serie x
         on x.serie_id = o.serie_id
        and x.mes_alvo = to_char(o.data_ocor, 'YYYY-MM')
  where coalesce(x.excluida, false) = false     -- pula ocorrência excluída
    and o.data_ocor between p.ini and p.fim
)
select * from final order by data, descricao;


-- ---------------------------------------------------------------------
-- PASSO 2b — resumo por mês. Mesmo bloco acima, trocando só a última
-- linha, para achar rápido o mês que não bate:
--
--   select to_char(data, 'YYYY-MM') as mes,
--          count(*)                 as itens,
--          sum(case when tipo = 'saida' then valor else -valor end) as total
--   from final group by 1 order by 1;
-- ---------------------------------------------------------------------
