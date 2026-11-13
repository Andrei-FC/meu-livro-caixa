# Meu Livro-Caixa

PWA de finanças de um casal — livro-razão contínuo. React 18 + Vite + TypeScript +
Supabase. Mobile-first (iPhone), interface em português.

## A fonte de verdade é o spec

**`meu-livro-caixa-spec.md`** (v0.12) é o contrato do produto: visão, modelo de
dados, regras de negócio, telas. O código referencia suas seções nos comentários
(`§4.1`, `§4.3`...). **Leia a seção relevante antes de mexer na regra
correspondente** — e, se a mudança revogar uma decisão, registre a revogação no
bloco de "Mudanças" do topo do spec, como as versões anteriores fizeram. Esse
histórico é o que impede refazer algo já descartado.

Mapa rápido: §3 modelo de dados (§3.7 regime de ciclo versionado) · §4.1 motor de
recorrência · §4.3 edição de série (régua de 3 níveis) · §4.4 cartões e faturas
(fases, regime, "N dias antes") · §4.5 contas/transferências/Cofre · §4.7 saldo
contínuo · §4.8 os dois eixos de tempo da despesa de cartão · §4.10 arquivar
conta e cartão · §5.1 Home (eixo de caixa) · §5.2 Lançar · §5.3 drill-down do
cartão · §5.5 Relatório · §5.6 abas Cartões/Contas · §5.7 editar lançamento ·
§6 auth/RLS · §8 decisões em aberto.

### Os 5 princípios (régua de julgamento, §1)

1. **Lançar é instantâneo.** Atrito no lançamento = falha.
2. **A data manda em tudo.** O mês vem da data. Não existe "pago/não pago" —
   pagou em outra data, muda a data.
3. **O passado registra, o futuro projeta.** Passado imutável por padrão.
4. **Nunca precisar de um "ajuste".** Se o usuário tem que inventar um
   lançamento pra bater o saldo, o fluxo falhou.
5. **Ver, não controlar.** Sem orçamento, sem meta.

Deliberadamente fora de escopo: orçamento/meta por categoria, export CSV/Excel,
estado pago/não-pago, multiusuário com permissões.

## Comandos

```bash
npm run dev       # http://localhost:5173
npm run build     # tsc -b && vite build
npm run preview   # testa o build
npm run tokens    # regenera tokens.css + tokens.ts a partir de tokens.json
npx tsc --noEmit  # rode a CADA mudança — não há testes nem linter
```

Não há suíte de testes nem ESLint. `tsc --noEmit` é a única rede de proteção:
rode depois de cada alteração, sem exceção.

## Arquitetura

- **Sem router.** `App.tsx` decide entre `Login` e `Home` pela sessão.
  `Home.tsx` (~1000 linhas) é o shell: navegação por estado local
  (`aba`, `tabContas`, telas de gestão como overlays). Ela também é quem
  **carrega todos os dados do Supabase** e passa pra baixo — os componentes são
  praticamente puros.
- **O motor: `src/lib/recorrencia.ts`** (~1400 linhas, o coração). Recorrência e
  parcelamento são **uma REGRA no banco, não N linhas** — o motor expande regras
  em ocorrências concretas **na leitura** (`lancamentosNoMes`,
  `transferenciasNoMes`). Nada é gravado. Funções puras, sem React nem Supabase.
  Toda regra de ciclo de cartão, saldo herdado, fatura e fluxo vive aqui.
- **Supabase direto do cliente**, sem backend. `src/lib/supabase.ts` exporta o
  client e `comTimeout()`.
- **Componentes** em `src/components/`, exportados pelo barrel
  `src/components/index.ts` — telas importam `from '../components'`. Traduzidos
  do Figma (file `2h3h8G4YWPLxmbYC4tQ3TD`); o Figma é contrato de design.

### Tabelas (7)

`contas` (corrente + poupança) · `cartoes` · `lancamentos` · `transferencias` ·
`excecoes_serie` · `cartoes_pagamentos` (override pontual e retroativo de UM
ciclo) · `cartoes_ciclos` (versionamento prospectivo do regime de
fechamento/vencimento).

- **`db/schema.sql`** — o DDL real (colunas, CHECKs, FKs, índices, policies),
  reconstruído por introspecção. **Consulte-o antes de mexer em coluna,
  constraint ou RLS** — `db.ts` não carrega `DEFAULT`, `CHECK` nem `ON DELETE`.
- **`db/dump-schema.sql`** — a query que re-extrai tudo. Rode no SQL Editor do
  Supabase e atualize o `schema.sql` sempre que o schema mudar.
- **`src/types/db.ts`** — o espelho em TypeScript, com comentário em cada campo
  não-óbvio. Mantenha em sincronia com os dois acima.

O schema vive no painel do Supabase, não em migrations versionadas: o
`schema.sql` é um retrato, não um histórico. Se divergir do banco, o banco manda.

## Convenções

- **Tudo em português**: nomes de arquivo, componentes, funções, variáveis,
  comentários (`LinhaDeLancamento`, `faturaNoMes`, `saldoHerdado`). Mantenha.
- **Estilo inline com CSS vars**, não classes utilitárias nem CSS-in-JS:
  `style={{ background: 'var(--bg-surface)' }}`. Tipografia por classe
  (`className="type-body-strong"`). **Nunca hex cru** — sempre token.
- **`tokens.css` e `tokens.ts` são GERADOS.** Edite `src/design/tokens.json` e
  rode `npm run tokens`. Editar os gerados na mão perde na próxima geração.
- **Formatação monetária e de data só por `src/lib/formato.ts`**
  (`formatarBR`, `dataCurta`, `diaMesCurto`). Não reimplemente `Intl` local.
- **Cor de categoria nasce do texto**, por hash estável (`categoriaToken()` em
  `src/design/tokens.ts`) — não há campo de cor no schema (§5.5).
- Entregue arquivos completos quando o arquivo for reescrito; o projeto foi
  construído assim.

## Invariantes — quebrar isso gera bug silencioso

- **Exceções de série são chaveadas por `mes_alvo` (YYYY-MM)**, nunca por data
  completa. A série tem no máximo uma ocorrência por mês; chavear por mês torna
  a exceção imune a mudança de dia-âncora. Chavear por data já causou duplicação.
  O banco reforça: `UNIQUE (serie_id, mes_alvo)` + `CHECK (mes_alvo ~
  '^\d{4}-\d{2}$')`.
- **`excecoes_serie.serie_id` não tem FK** (de propósito: `serie_id` vive em duas
  tabelas, não há alvo único). Logo **apagar as linhas de uma série não limpa as
  exceções em cascata** — órfãs ficam. Limpe explicitamente.
- **"Esta e as futuras" mantém o mesmo `serie_id`** — identidade contínua. Um
  aluguel reajustado é o mesmo item com valor novo, não dois itens (senão o
  relatório fragmenta a mesma assinatura em duas linhas).
- **`CHECK (recorrencia_fim IS NULL OR recorrencia_fim > 0)`.** Dividir série na
  1ª ocorrência (`indice-1 === 0`) cai em edição da regra inteira, não em divisão.
- **Campos condicionais são travados por CHECK no banco** — um INSERT que os
  misture falha, não passa silenciosamente: `parcelas` só com
  `repeticao='parcelar'` (e `> 1`, parcelar em 1 não existe); `recorrencia_fim`
  e `assinatura=true` só com `repeticao='recorrente'`; transferência nunca
  `'parcelar'`; `de_conta_id <> para_conta_id`; `dia_fechamento` e
  `dia_pagamento` entre 1 e 31.
- **Write sem `.select()` usa `return=minimal`** → um UPDATE bloqueado por RLS
  vira **no-op silencioso**. Se o resultado importa, peça o retorno.
- **Régua de edição de série por nível (§4.3):** grandeza (valor, descrição,
  nota) = *override que persiste*; natureza (data, conta, cartão) no escopo "só
  esta" = *desvincula* (`serie_id: null`); cardinalidade (à vista ↔ parcelar) =
  *desvincular + recriar*, e **só existe no escopo "só esta"**.
- **O escopo é o PRIMEIRO passo** ao editar ocorrência de série recorrente (um
  Modal, não bottom sheet), e ele **define quais campos o editor oferece**. O
  usuário nunca configura algo pra no fim ouvir "não pode".
- **Duas leituras de ciclo, deliberadamente separadas** (§4.4) — fundi-las já
  causou bug de ciclo passado aparecendo "aberto":
  - `faseCarteiraDoCiclo` → "que fase *é* este ciclo?" (não fechou = aberta;
    fechou = fechada **sempre**, inclusive ciclos passados).
  - `statusCarteiraDoCartao` → "que ciclo mostrar *agora*?" (segura o anterior
    enquanto for obrigação pendente, senão o corrente).
- **A fase vira NO DIA do vencimento, não no dia seguinte.** Fatura fechada é
  obrigação pendente *estritamente antes* do vencimento.
- **Fatura identificada por `ciclo_abs`** (`ano*12 + mês 0-11` do ciclo que
  fecha) — imune a fuso horário.
- `cartoes_pagamentos` (pontual, retroativo, um ciclo) e `cartoes_ciclos`
  (prospectivo, permanente, do ciclo X em diante) são **ortogonais**. Cartão sem
  mudança de regime não tem linha em `cartoes_ciclos` e cai no campo-base de
  `cartoes.dia_*` — retrocompatível.
- **`cartoes.conta_id` é NOT NULL** (`ON DELETE RESTRICT`): criar cartão exige
  conta-corrente. Sustenta o invariante "soma dos saldos de conta = topo do
  cartão".
- **Nenhum indicador de "saúde do mês" pode se basear em entrada vs. saída
  isoladas** — por causa do saldo herdado (§4.7). Regra anti-retrabalho.
- Apagar conta exige conta vazia; **arquivar** (`arquivada_em` /
  `arquivado_em`) exige saldo zero e preserva o histórico (§4.10).

## Segurança e acesso (§6)

Usuário único compartilhado no Supabase Auth (email + senha), criado à mão no
painel. **Sem signup e sem recuperação de senha in-app.** **RLS deliberadamente
permissiva** (`auth.role() = 'authenticated'`, sem filtro por `user_id`) — é o
oposto do padrão Supabase e está assim de propósito, porque é conta única de um
casal. Não "corrija" isso sem conversar.

`.env.local` (não versionada) precisa de `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY` — veja `.env.example`.

## Dívidas conhecidas

- **O nome do enum de `lancamentos.tipo` não está confirmado.** A introspecção
  reportou só `USER-DEFINED` (enum sem DEFAULT não revela o tipo); o
  `schema.sql` usa `lancamento_tipo` com base no `db.ts`. A query de extração já
  cobre enums — a próxima rodada confirma.
- **Índices redundantes:** `cartoes_ciclos_cartao_idx` duplica as colunas do
  índice único ao lado, e `idx_cartoes_pagamentos_cartao` é prefixo do único.
  Dá pra dropar os dois sem perda.
- **Nomes de policy inconsistentes** entre tabelas (`auth full access`,
  `cartoes_ciclos_all`, `cartoes_pagamentos_authenticated_all`,
  `excecoes_serie_all_authenticated`). Cosmético.
- **Dívidas de implementação registradas no spec §8**, não resolvidas: a checagem
  de **saldo zero ao arquivar conta** (§4.10 trava a regra, o código arquiva
  direto), não há **desarquivar**, não há **área de arquivados** e a **edição de
  parcela** está travada em leitura.
- **Zero testes** num motor puro de ~1400 linhas. As regras de ciclo de cartão já
  renderam três commits de `fix:` — é o candidato óbvio a teste unitário.
