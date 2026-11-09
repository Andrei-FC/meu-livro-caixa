-- Extrai o schema real do Supabase para reconstruir db/schema.sql.
--
-- POR QUE ISTO EXISTE: o DDL do projeto vive no painel do Supabase, não no git.
-- O anon key do .env.local não serve para introspecção (o endpoint de schema do
-- PostgREST exige service_role), então a extração é manual.
--
-- COMO USAR: cole esta query inteira no SQL Editor do Supabase
-- (Dashboard → SQL Editor → New query), rode, e copie o resultado da coluna
-- `linha`. Cada linha é um fato do schema: coluna, constraint, índice, trigger,
-- policy de RLS, o flag de RLS da tabela, ou um tipo enumerado.
--
-- Rode de novo sempre que o schema mudar, e atualize db/schema.sql com a saída.

select linha from (

  -- Colunas: tipo, nullability, default
  select c.table_name as tab, 1 as ord, c.ordinal_position::int as sub,
         c.table_name || '.' || c.column_name || ' : ' || c.data_type ||
         case when c.is_nullable = 'NO' then ' NOT NULL' else '' end ||
         coalesce(' DEFAULT ' || c.column_default, '') as linha
  from information_schema.columns c
  where c.table_schema = 'public'

  union all

  -- Constraints: PK, FK (com ON DELETE), UNIQUE, CHECK
  select rel.relname, 2, 0,
         rel.relname || ' CONSTRAINT ' || con.conname || ': ' ||
         pg_get_constraintdef(con.oid)
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace n on n.oid = rel.relnamespace and n.nspname = 'public'

  union all

  -- Índices
  select i.tablename, 3, 0, i.tablename || ' INDEX: ' || i.indexdef
  from pg_indexes i
  where i.schemaname = 'public'

  union all

  -- Policies de RLS (§6 do spec: deliberadamente permissivas)
  select p.tablename, 4, 0,
         p.tablename || ' POLICY ' || p.policyname || ': cmd=' || p.cmd ||
         ' roles=' || p.roles::text ||
         ' using=' || coalesce(p.qual, '-') ||
         ' check=' || coalesce(p.with_check, '-')
  from pg_policies p
  where p.schemaname = 'public'

  union all

  -- RLS está ligado na tabela?
  select cl.relname, 5, 0, cl.relname || ' RLS_ENABLED=' || cl.relrowsecurity
  from pg_class cl
  join pg_namespace n2 on n2.oid = cl.relnamespace
  where n2.nspname = 'public' and cl.relkind = 'r'

  union all

  -- Triggers (os internos de FK/constraint ficam de fora)
  select cl2.relname, 6, 0,
         cl2.relname || ' TRIGGER: ' || pg_get_triggerdef(tg.oid)
  from pg_trigger tg
  join pg_class cl2 on cl2.oid = tg.tgrelid
  join pg_namespace n3 on n3.oid = cl2.relnamespace and n3.nspname = 'public'
  where not tg.tgisinternal

  union all

  -- Tipos enumerados, com os valores na ordem declarada. (Sem isto, uma
  -- coluna de enum sem DEFAULT aparece só como "USER-DEFINED" e nem o nome
  -- do tipo se revela — foi o caso de lancamentos.tipo.)
  select 'zzz_enums', 7, 0,
         'ENUM ' || t.typname || ' = ' ||
         string_agg(e.enumlabel, ', ' order by e.enumsortorder)
  from pg_type t
  join pg_enum e on e.enumtypid = t.oid
  join pg_namespace n4 on n4.oid = t.typnamespace and n4.nspname = 'public'
  group by t.typname

) s
order by tab, ord, sub;
