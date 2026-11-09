-- =====================================================================
-- Meu Livro-Caixa — schema do Supabase (public)
--
-- RECONSTRUÍDO por introspecção do banco em 09/nov/2026, via
-- db/dump-schema.sql. É o registro fiel do que está no ar — não um
-- histórico de migrations.
--
-- COMO MANTER: ao mudar o schema no painel do Supabase, rode
-- db/dump-schema.sql de novo e atualize este arquivo. Mantenha também
-- src/types/db.ts em sincronia (é o espelho em TypeScript).
--
-- NÃO COBERTO pela introspecção que gerou este arquivo:
--   - valores dos ENUMs (inferidos dos DEFAULTs e de src/types/db.ts;
--     veja a nota em `lancamento_tipo` abaixo)
--   - triggers, functions e grants
--   - o schema `auth` (gerenciado pelo Supabase)
-- A query em db/dump-schema.sql já foi estendida para cobrir enums e
-- triggers — a próxima extração fecha essas lacunas.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Tipos enumerados
-- ---------------------------------------------------------------------

-- Confirmados pelos DEFAULTs das colunas (contas.tipo, *.repeticao).
CREATE TYPE conta_tipo AS ENUM ('corrente', 'poupanca');
CREATE TYPE repeticao_tipo AS ENUM ('avista', 'parcelar', 'recorrente');

-- ⚠️ `lancamentos.tipo` é um enum sem DEFAULT, então a introspecção o
-- reportou só como USER-DEFINED e o NOME do tipo não foi confirmado.
-- Os valores vêm de src/types/db.ts (`LancamentoTipo`) e batem com o uso
-- no código. CONFIRME o nome na próxima extração antes de confiar nesta
-- linha para recriar o banco.
CREATE TYPE lancamento_tipo AS ENUM ('entrada', 'saida');


-- ---------------------------------------------------------------------
-- contas — conta-corrente e poupança (spec §3.1)
-- ---------------------------------------------------------------------
CREATE TABLE contas (
  id           uuid        NOT NULL DEFAULT gen_random_uuid(),
  nome         text        NOT NULL,
  tipo         conta_tipo  NOT NULL DEFAULT 'corrente'::conta_tipo,
  tema         text,
  icone        text,
  arquivada_em timestamptz,              -- null = ativa (§4.10)
  criada_em    timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT contas_pkey PRIMARY KEY (id)
);

ALTER TABLE contas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access" ON contas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------
-- cartoes — cartões de crédito (spec §3.2)
-- A ordem das colunas reflete o histórico de ALTERs no banco.
-- ---------------------------------------------------------------------
CREATE TABLE cartoes (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  nome            text        NOT NULL,
  previsao_mensal numeric,                  -- null = sem previsão (§4.4)
  dia_fechamento  integer     NOT NULL,
  dia_pagamento   integer     NOT NULL,
  tema            text,
  banco           text,                     -- chave da biblioteca de bancos (§4.9)
  criado_em       timestamptz NOT NULL DEFAULT now(),
  bandeira        text,                     -- chave da biblioteca de bandeiras (§4.9)
  conta_id        uuid        NOT NULL,     -- conta que paga a fatura (§4.4/§4.5)
  arquivado_em    timestamptz,              -- null = ativo (§4.10)

  CONSTRAINT cartoes_pkey PRIMARY KEY (id),
  -- RESTRICT sustenta o invariante "soma dos saldos de conta = topo do cartão"
  CONSTRAINT cartoes_conta_id_fkey FOREIGN KEY (conta_id)
    REFERENCES contas(id) ON DELETE RESTRICT,
  CONSTRAINT cartoes_dia_fechamento_check
    CHECK (dia_fechamento >= 1 AND dia_fechamento <= 31),
  CONSTRAINT cartoes_dia_pagamento_check
    CHECK (dia_pagamento >= 1 AND dia_pagamento <= 31)
);

ALTER TABLE cartoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access" ON cartoes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------
-- lancamentos — entradas e saídas (spec §3.3)
-- Recorrência/parcelamento é UMA REGRA aqui, expandida na leitura pelo
-- motor (src/lib/recorrencia.ts) — nunca N linhas gravadas.
-- ---------------------------------------------------------------------
CREATE TABLE lancamentos (
  id              uuid            NOT NULL DEFAULT gen_random_uuid(),
  tipo            lancamento_tipo NOT NULL,
  valor           numeric         NOT NULL,
  descricao       text            NOT NULL,   -- é também a categoria (§4.6)
  nota            text,
  data            date            NOT NULL,   -- define o mês (princípio 2)
  conta_id        uuid            NOT NULL,
  cartao_id       uuid,
  repeticao       repeticao_tipo  NOT NULL DEFAULT 'avista'::repeticao_tipo,
  parcelas        integer,
  recorrencia_fim integer,                    -- nº de ocorrências; null = indefinido
  assinatura      boolean         NOT NULL DEFAULT false,  -- recorte (§5.5)
  serie_id        uuid,                       -- agrupador lógico, SEM FK (ver nota)
  criado_em       timestamptz     NOT NULL DEFAULT now(),

  CONSTRAINT lancamentos_pkey PRIMARY KEY (id),
  CONSTRAINT lancamentos_conta_id_fkey FOREIGN KEY (conta_id)
    REFERENCES contas(id) ON DELETE RESTRICT,
  CONSTRAINT lancamentos_cartao_id_fkey FOREIGN KEY (cartao_id)
    REFERENCES cartoes(id) ON DELETE RESTRICT,

  -- As CHECKs abaixo gravam no banco as regras do spec: cada campo
  -- condicional só existe no tipo de repetição que o comporta.
  CONSTRAINT parcelas_so_em_parcelar
    CHECK (repeticao = 'parcelar'::repeticao_tipo OR parcelas IS NULL),
  CONSTRAINT recfim_so_em_recorrente
    CHECK (repeticao = 'recorrente'::repeticao_tipo OR recorrencia_fim IS NULL),
  CONSTRAINT assinatura_so_em_recorrente
    CHECK (assinatura = false OR repeticao = 'recorrente'::repeticao_tipo),
  -- Parcelar em 1 não é parcelar: o mínimo é 2.
  CONSTRAINT lancamentos_parcelas_check
    CHECK (parcelas IS NULL OR parcelas > 1),
  CONSTRAINT lancamentos_recorrencia_fim_check
    CHECK (recorrencia_fim IS NULL OR recorrencia_fim > 0)
);

CREATE INDEX lancamentos_data_idx      ON lancamentos USING btree (data);
CREATE INDEX lancamentos_conta_id_idx  ON lancamentos USING btree (conta_id);
CREATE INDEX lancamentos_cartao_id_idx ON lancamentos USING btree (cartao_id);
CREATE INDEX lancamentos_serie_id_idx  ON lancamentos USING btree (serie_id);

ALTER TABLE lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access" ON lancamentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------
-- transferencias — entre contas (spec §3.4)
-- Neutra entre correntes; debita/credita quando envolve poupança (§4.5).
-- ---------------------------------------------------------------------
CREATE TABLE transferencias (
  id              uuid           NOT NULL DEFAULT gen_random_uuid(),
  valor           numeric        NOT NULL,
  data            date           NOT NULL,
  de_conta_id     uuid           NOT NULL,
  para_conta_id   uuid           NOT NULL,
  descricao       text,
  repeticao       repeticao_tipo NOT NULL DEFAULT 'avista'::repeticao_tipo,
  recorrencia_fim integer,
  serie_id        uuid,                      -- agrupador lógico, SEM FK (ver nota)
  criada_em       timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT transferencias_pkey PRIMARY KEY (id),
  CONSTRAINT transferencias_de_conta_id_fkey FOREIGN KEY (de_conta_id)
    REFERENCES contas(id) ON DELETE RESTRICT,
  CONSTRAINT transferencias_para_conta_id_fkey FOREIGN KEY (para_conta_id)
    REFERENCES contas(id) ON DELETE RESTRICT,

  CONSTRAINT transferencia_contas_distintas
    CHECK (de_conta_id <> para_conta_id),
  -- Transferência nunca é parcelada (§3.4).
  CONSTRAINT transferencia_nao_parcela
    CHECK (repeticao = ANY (ARRAY['avista'::repeticao_tipo,
                                  'recorrente'::repeticao_tipo])),
  CONSTRAINT transferencias_recorrencia_fim_check
    CHECK (recorrencia_fim IS NULL OR recorrencia_fim > 0)
);

CREATE INDEX transferencias_data_idx ON transferencias USING btree (data);

ALTER TABLE transferencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access" ON transferencias
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------
-- excecoes_serie — exceções de ocorrência de série (spec §4.3)
--
-- NOTA SOBRE `serie_id`: não tem FK, de propósito. `serie_id` é um
-- agrupador lógico que vive tanto em `lancamentos` quanto em
-- `transferencias` — não é id de linha de uma tabela só, então não há
-- alvo único para referenciar. Consequência: apagar todas as linhas de
-- uma série NÃO limpa suas exceções em cascata.
-- ---------------------------------------------------------------------
CREATE TABLE excecoes_serie (
  id        uuid        NOT NULL DEFAULT gen_random_uuid(),
  serie_id  uuid        NOT NULL,
  mes_alvo  text        NOT NULL,   -- YYYY-MM, nunca data completa
  excluida  boolean     NOT NULL DEFAULT false,
  valor     numeric,                -- override; null = herda da regra
  descricao text,                   -- override; null = herda
  nota      text,                   -- override; null = herda
  criada_em timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT excecoes_serie_pkey PRIMARY KEY (id),
  -- Uma exceção por série por mês. Chavear por mês (e não por data
  -- completa) torna a exceção imune a mudança de dia-âncora.
  CONSTRAINT excecoes_serie_serie_id_mes_alvo_key UNIQUE (serie_id, mes_alvo),
  CONSTRAINT excecoes_serie_mes_alvo_check
    CHECK (mes_alvo ~ '^\d{4}-\d{2}$'::text)
);

ALTER TABLE excecoes_serie ENABLE ROW LEVEL SECURITY;
CREATE POLICY excecoes_serie_all_authenticated ON excecoes_serie
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------
-- cartoes_pagamentos — override PONTUAL e retroativo de UM ciclo (§4.4)
-- Ortogonal a cartoes_ciclos: aqui é "esta fatura foi paga neste dia".
-- ---------------------------------------------------------------------
CREATE TABLE cartoes_pagamentos (
  id        uuid        NOT NULL DEFAULT gen_random_uuid(),
  cartao_id uuid        NOT NULL,
  ciclo_abs integer     NOT NULL,   -- ano*12 + mês(0-11) do ciclo que FECHA
  data_paga date        NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cartoes_pagamentos_pkey PRIMARY KEY (id),
  CONSTRAINT cartoes_pagamentos_cartao_id_fkey FOREIGN KEY (cartao_id)
    REFERENCES cartoes(id) ON DELETE CASCADE,
  CONSTRAINT cartoes_pagamentos_cartao_id_ciclo_abs_key
    UNIQUE (cartao_id, ciclo_abs)
);

-- Redundante: prefixo do índice único acima. Candidato a remoção.
CREATE INDEX idx_cartoes_pagamentos_cartao
  ON cartoes_pagamentos USING btree (cartao_id);

ALTER TABLE cartoes_pagamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY cartoes_pagamentos_authenticated_all ON cartoes_pagamentos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------
-- cartoes_ciclos — regime de ciclo versionado no tempo (§4.4)
-- Ortogonal a cartoes_pagamentos: aqui é "do ciclo X em diante, o
-- fechamento/vencimento passa a ser este". Prospectivo e permanente.
-- Cartão sem mudança não tem linha aqui e cai no campo-base de cartoes.
-- ---------------------------------------------------------------------
CREATE TABLE cartoes_ciclos (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  cartao_id       uuid        NOT NULL,
  desde_ciclo_abs integer     NOT NULL,   -- 1º ciclo de fechamento que governa
  dia_fechamento  integer     NOT NULL,
  dia_pagamento   integer     NOT NULL,
  criado_em       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT cartoes_ciclos_pkey PRIMARY KEY (id),
  CONSTRAINT cartoes_ciclos_cartao_id_fkey FOREIGN KEY (cartao_id)
    REFERENCES cartoes(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX cartoes_ciclos_cartao_desde_uq
  ON cartoes_ciclos USING btree (cartao_id, desde_ciclo_abs);

-- Redundante: mesmas colunas do índice único acima. Candidato a remoção.
CREATE INDEX cartoes_ciclos_cartao_idx
  ON cartoes_ciclos USING btree (cartao_id, desde_ciclo_abs);

ALTER TABLE cartoes_ciclos ENABLE ROW LEVEL SECURITY;
CREATE POLICY cartoes_ciclos_all ON cartoes_ciclos
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =====================================================================
-- Observações sobre RLS (spec §6)
--
-- Todas as policies são `FOR ALL TO authenticated USING (true)`, sem
-- filtro por user_id. Isso é DELIBERADO e é o oposto do padrão Supabase:
-- o app é de um casal com login único compartilhado, então não há
-- autoria a separar. Não "corrija" isso sem conversar.
--
-- Efeito prático: o anon key não lê nem escreve nada (role `anon` não
-- casa com `authenticated`) — só a sessão logada enxerga os dados.
--
-- Os nomes das policies estão inconsistentes entre tabelas
-- ("auth full access", "cartoes_ciclos_all",
-- "cartoes_pagamentos_authenticated_all",
-- "excecoes_serie_all_authenticated"). Cosmético, mas vale uniformizar
-- numa próxima faxina.
-- =====================================================================
