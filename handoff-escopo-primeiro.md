# Handoff — Escopo-primeiro no EditarSheet (régua de 3 níveis)

> **Para a próxima sessão.** Tudo aqui já foi **decidido** (spec v0.8 §4.3/§5.7 +
> conversa de design). Não há nada em aberto para rediscutir — é implementação.
> Ao abrir o chat, diga apenas: *"vamos ao escopo-primeiro do EditarSheet"*.

## Estado do repo quando esta nota foi escrita

- Branch `main` @ `d3b2d16` ("fix: excecoes de serie chaveadas por mes…").
- **Já no remoto (não refazer):** fix de duplicação (`mes_alvo`), fix de data em
  série (dia-âncora), fix da divisão na 1ª ocorrência, scroll-lock com contador
  (`src/lib/useScrollLock.ts`), migration `migrations/002_excecoes_mes_alvo.sql`.
- **Leva do ícone de recorrência (subir junto / já entregue):** `IconeCollection`
  em `src/icons/index.tsx`; prop `recorrente` em `LinhaDeLancamento` e
  `LinhaDeTransferencia`; campo `repeticao` em `OcorrenciaLancamento`
  (`src/lib/recorrencia.ts`, setado em `mapLanc`); `Home.tsx` passa
  `recorrente={it.o.repeticao === 'recorrente'}` (lançamento) e
  `recorrente={it.t.serieId != null}` (transferência).

## Figma (já feito — é contrato, não redesenhar)

- Alert de escopo = **variante `Bloqueio Editar`** do component set
  `Modal de alerta` (id `2180:999`). NÃO é bottom sheet. Textos já reescritos:
  - Título: **"Lançamento recorrente"**
  - Subtítulo: **"Esse lançamento se repete todo mês. O que você quer alterar?"**
  - **Só esta** — "Muda apenas este mês, sem afetar os outros"
  - **Esta e as futuras** — "Muda deste mês em diante; os anteriores ficam como estão"
  - **Todas** — "Muda todos os meses, inclusive os já passados"
  - Botões: **Continuar** / **Cancelar**
- Não existem telas de variação de edição (nem precisa): o editor é o mesmo
  sheet mostrando um subconjunto de campos conforme o escopo.
- A variante `Aviso` foi removida do Modal — **não** há aviso de desvínculo
  separado. A explicação vive na descrição do card de escopo (acima).

## O que implementar

### 1. Inverter o fluxo: escopo é o PRIMEIRO passo (só para série recorrente)

Hoje: o `EditarSheet` (bottom sheet) abre direto; o escopo é perguntado **ao
Salvar/Excluir** (`aoSalvar`/`aoExcluir` → `setEscopoPara(...)`), via
`EscopoSheet` (bottom sheet).

Alvo: ao tocar em editar numa ocorrência de **série recorrente**
(`ocorrencia.repeticao === 'recorrente'` && `serieId != null`), aparece **antes**
o **alert de escopo** (Modal, não bottom sheet). Só depois de escolher e tocar
**Continuar** é que o corpo do editor monta, já com os campos filtrados pelo
escopo. "Cancelar" fecha tudo.

- Arquitetura sugerida: manter a decisão **dentro do `EditarSheet`** como uma
  "fase" (`escopoEscolhido: EscopoSerie | null`). Enquanto `null` numa série
  recorrente, renderiza só o alert; ao escolher, guarda o escopo e monta o corpo.
  `Home` continua só fazendo `setEmEdicao(ocorrencia)` — não muda.
- Avulso e **parcela** NÃO passam pelo alert (abrem direto). Ver item 4.

### 2. Régua de 3 níveis — o escopo define os campos (spec §4.3/§5.7)

- **Grandeza** (valor, descrição, nota) → *override*. Disponível em qualquer
  escopo. Fica na série. (Já implementado no "só esta" sem mudança de data e no
  "todas" via `editarRegraInteira`.)
- **Natureza** (data, conta, cartão) → *desvincula* no escopo **"só esta"**:
  a ocorrência vira lançamento avulso (`serie_id: null`). Sem alerta extra — a
  descrição "Muda apenas este mês…" já cobre. (Data já desvincula hoje; **falta
  fazer conta/cartão desvincular também**, ver item 3.) Em **"todas"/"futuras"**,
  natureza = editar a **regra** (trocar banco p/ todos, dia-âncora, meio à vista);
  nada desvincula.
- **Cardinalidade** (à vista ↔ parcelar) → só no escopo **"só esta"**: remove a
  ocorrência da série (exceção `excluida:true`) + cria N lançamentos parcelados
  novos, no meio escolhido, num único Salvar. **Parcelar NÃO aparece em
  "todas"/"futuras"** (evita explosão). Este é o "atalho automático".

**Campos por escopo (o que o editor mostra):**
- **Só esta** → leque completo: valor, descrição, nota, data, conta/cartão,
  **e o seletor de repetição com opção de parcelar**.
- **Esta e as futuras / Todas** → valor, descrição, nota, data (= dia-âncora),
  conta/cartão (= regra). **SEM** seletor de parcelar.

### 3. Remover o bloqueio de conta/cartão

- Tirar `bloqueioConta` (state, o `if (ehSerie && contaMudou)` em `aoSalvar`, e o
  `<ModalDeAlerta tipo="erro" … "Não dá para trocar a conta de uma série">`).
- Trocar meio de pagamento numa série passa a ser **permitido**: no "só esta"
  desvincula (vira avulso com o novo meio); em "todas/futuras" edita a regra.
- No "só esta" que desvincula por natureza, o INSERT do avulso deve usar o
  **meio de pagamento escolhido** (`contaSel`/`cartaoSel`), não `regra.conta_id`
  fixo. (Hoje o desmembramento por data usa `regra.conta_id` — generalizar para
  "qualquer natureza mudada" e levar o meio novo.)

### 4. Parcela: travada por hora (decisão "c")

- Ao editar uma **parcela** (`ocorrencia.repeticao === 'parcelar'`): abre o sheet
  **direto** (sem alert de escopo), campos em **leitura**, e a **única** ação é
  **Excluir** (que mantém seu próprio fluxo de escopo). Não editar valor/data/
  conta/repetição. É proposital — edição de parcela é "outro debate".

### 5. EscopoSheet → alert

- Hoje `src/components/EscopoSheet.tsx` é um **BottomSheet**. Passar a usar o
  **Modal de alerta** (variante conceitual "Bloqueio Editar"): título + subtítulo
  + 3 opções (radio + descrição) + Continuar/Cancelar. Usar os textos do Figma
  (acima). Manter a dupla confirmação (selecionar ≠ aplicar; confirma no botão).
- `desabilitadas` deixa de existir para "esta_e_futuras" (o `suportaFuturas`
  escondia futuras em parcelamento — mas parcela agora nem chega ao alert).
  Reavaliar: o alert só aparece para recorrente, então as 3 opções ficam sempre
  disponíveis. Conferir se `suportaFuturas` ainda é necessário.

### 6. Exclusão destrutiva (manter)

- Excluir **"todas"** continua com o segundo passo `ModalDeAlerta tipo="bloqueio"`
  ("Excluir a série inteira?"). Não mudar.

### 7. Spec

- §5.7 e §4.3 já descrevem o modelo (v0.8). Um ponto a **corrigir** no §5.7: ainda
  diz "É um bottom sheet (não um modal de alerta)". Agora é **alert/modal**.
  Ajustar essa frase para refletir que o escopo é um Modal (variante do
  `Modal de alerta`), disparado como primeiro passo.

## Arquivos que serão tocados

- `src/components/EditarSheet.tsx` (reescrita do fluxo — o grosso)
- `src/components/EscopoSheet.tsx` (vira alert; ou é absorvido pelo ModalDeAlerta)
- `src/components/ModalDeAlerta.tsx` (conferir se comporta a variante de escopo
  com 3 opções radio + Continuar/Cancelar; pode precisar de um modo novo)
- `meu-livro-caixa-spec.md` (§5.7: "bottom sheet" → "modal/alert")

## Invariantes a não quebrar (aprendidos nesta sessão)

- Exceções chaveadas por **`mes_alvo`** (YYYY-MM), nunca por data completa.
- `recorrencia_fim` tem constraint **>= 1**; dividir na 1ª ocorrência
  (`indice-1 === 0`) cai em `editarRegraInteira`, não em `executarDivisao`.
- "Esta e as futuras" mantém o **mesmo `serie_id`** (identidade contínua).
- Grandeza no "só esta" = **override que persiste** (regra de preservação §4.3);
  natureza/cardinalidade = **desvincula/recria**.
- Todo write sem `.select()` usa `return=minimal` → um UPDATE bloqueado vira
  no-op silencioso (não foi o caso agora, mas fica o alerta).
- `tsc --noEmit` após cada mudança. Entregar arquivos completos.
