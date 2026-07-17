# Meu Livro-Caixa — Documentação do Produto

> Documento vivo. Registra as decisões já tomadas; o que ainda está em
> aberto está listado na seção final. Serve em três fases: referência ao
> desenhar no Figma, contrato do que o banco (Supabase) precisa suportar, e
> spec de implementação.

**Versão:** 0.10 (rascunho de decisões) · **Última atualização:** jul/2026

> **Mudanças na v0.10** (sessão de implementação — costura de ajustes; reconcilia
> trabalho feito em paralelo à separação Cartões/Contas da v0.9):
>
> - **Lista do drill-down do cartão vira extrato corrido por dia** (§5.3). A lista
>   que compõe o realizado do ciclo deixa de ser agrupada por à vista / parcelas /
>   assinaturas e passa a ser um **extrato ordenado por data, com cabeçalho de
>   dia** — a mesma gramática da aba Lançamentos (§5.1), coerente com o princípio 2
>   ("a data manda"). Parcela e recorrência viram **detalhe da linha** (selo
>   "3/12", ícone de coleção), não critério de agrupamento — a distinção
>   estrutural que o app valoriza é parcelar-vs-recorrente no *lançamento*, não no
>   *extrato*. Sem subtotais por grupo (o total do ciclo já vive no hero, §5.3).
>   **Revoga** a divisão em três grupos (COMPRAS DO CICLO · PARCELAS ·
>   ASSINATURAS) que vinha do design do cartão. Motivador: com muitas compras a
>   lista agrupada ficava longa e difícil de ler, com datas repetindo entre
>   grupos; o extrato por dia agrupa o que aconteceu junto e reduz a carga.
> - **Campo de data explícito no modo Transferência** (§5.2). O estado
>   Transferência do sheet de Lançar passa a ter o **campo Data** (como os modos
>   Saída/Entrada), governando o mês em que a transferência pesa no saldo (§4.5).
>   Vale também no fluxo fixo **Depositar/Retirar** da poupança (§5.4), com default
>   hoje. Formaliza o que o princípio 2 já exigia; antes o campo não aparecia no
>   estado Transferência.
>
> **Mudanças na v0.9** (sessão de implementação — Carteira vira Cartões + Contas;
> cartão passa a viver no ciclo, não no mês):
>
> - **A antiga aba Carteira some; nascem duas abas — Cartões e Contas** (nova
>   §5.6; navegação §5.1). A navegação inferior passa de **3 para 4 abas**:
>   **Lançamentos · Cartões · Contas · Relatório**. A raiz da mudança é
>   conceitual: **cartão e conta têm naturezas temporais opostas** e não cabiam na
>   mesma tela. Conta-corrente vive no **mês** (tem entradas/saídas de um mês
>   específico); cartão vive no **ciclo** (fatura é atemporal em relação ao
>   calendário — cada cartão está num ponto diferente do seu próprio ciclo,
>   porque cada um tem seu `dia_fechamento`). Forçar um seletor de mês sobre os
>   cartões produzia um controle que mexia em alguns cartões e não em outros
>   (assimetria confusa). A separação resolve o nó: **o seletor de mês só existe
>   onde tem significado (Contas); a aba Cartões não tem seletor de mês.**
> - **Aba Contas com sub-navegação Conta Corrente | Cofre** (§5.6). Sub-tabs
>   internas (não mexem na navegação inferior). Header **com** mês. O Cofre aqui é
>   **visualização** — lista as poupanças com valor individual, **sem totalizar**
>   (o "TOTAL GUARDADO" continua só na tela de gestão do Cofre, §5.4). Tocar numa
>   poupança abre o drill-down (§5.4).
> - **Card do cartão na aba Cartões segue o CICLO VIVO, não o mês** (§4.4, §5.6).
>   Cada cartão mostra o ciclo em que está *agora* (a "foto do presente"): a
>   **fatura fechada-a-pagar** enquanto for obrigação pendente, ou a **fatura
>   aberta acumulando** caso contrário. A régua da fase (aberta/fechada) é
>   governada por **hoje vs. vencimento efetivo** (§4.4).
> - **A fase vira no DIA do pagamento/vencimento, não no dia seguinte** (§4.4).
>   Uma fatura fechada é obrigação pendente **estritamente antes** do vencimento;
>   no próprio dia do vencimento (padrão, ou o dia efetivo se há pagamento
>   registrado em `cartoes_pagamentos`) ela sai do radar e o cartão passa a
>   mostrar o ciclo aberto. Pagar hoje vira a fase hoje. Coerente com o modelo sem
>   "atraso" — o vencimento **é** o pagamento no modelo do app.
> - **"Previsto Restante" substitui o percentual** (§4.4, §5.3, §5.6). Onde antes
>   se lia "Z% da previsão", passa a mostrar **`previsão − realizado`** ("Previsto
>   Restante"). Se o realizado passa a previsão, o rótulo vira **"Acima da
>   previsão"** com o excedente em vermelho (`value/saida`). A barra continua
>   lendo `realizado ÷ previsão` internamente; só o texto mudou. Sem previsão, não
>   há barra nem bloco de restante. **Restrito às telas de "foto do cartão"**
>   (Cartões e drill-down); a **lista de lançamentos** (§4.8) mantém a régua de
>   sempre (`max(previsão, realizado)`).
> - **Drill-down do cartão navega por CICLO, não por mês** (§5.3, reescrita). O
>   seletor do header vira **"Fatura de \<mês de fechamento\>"** (identidade
>   estável do ciclo, independente da fase); as setas navegam ciclo ± 1. O
>   drill-down **abre no ciclo que o clique representa** ("clique vivo"): tocar no
>   card da Carteira abre no ciclo vivo; tocar na Linha de fatura da Home abre no
>   ciclo que vence naquele mês. A fase de cada ciclo espelha a régua da Carteira.
>   **Revoga** a navegação por mês da v0.6.
> - **Hero do drill-down é componente próprio, não mais instância do `Card de
>   entidade`** (§5.3). O hero (`CartaoHeroDrillDown`) mostra **as mesmas
>   informações** do card compacto de Cartões, em layout próprio (largura cheia,
>   altura que abraça o conteúdo — com previsão fica mais alto). **Revoga** a
>   decisão da v0.6 ("hero = instância do `Card de entidade`"): o `Card de
>   entidade` serve Gestão/Cofre; a Carteira usa um card compacto; o drill-down
>   usa o hero — três contextos, mesma fonte de dados no motor. A barra + Previsto
>   Restante aparecem **nas duas fases** sempre que há previsão.
> - **Card compacto de conta e de poupança** (§5.6). Conta e poupança
>   compartilham o mesmo layout compacto (ícone temático + saldo + dois números);
>   mudam só as **legendas**: conta = **Saldo Atual / Entradas / Saídas**;
>   poupança = **Guardado / Depositos / Retiradas**. O nome passa a usar o estilo
>   semibold (`type-numeric`), e a **tag fechada ganha borda** (`border/default`)
>   para se destacar sobre o fundo temático.
> - **Ícones das abas Cartões e Contas** (navegação, §5.1/§5.6). Cartões usa um
>   ícone de **carteira/wallet** (novo, com modos contorno e preenchido). Contas
>   **reaproveita** o ícone de bolsa/purse que já era o da antiga aba Carteira
>   (`IconeNavCarteira`) — mesmo desenho, sem duplicata.
> - **Motor** (§4.4): duas funções de leitura do ciclo com semânticas distintas
>   e deliberadamente separadas — `faseCarteiraDoCiclo` ("que fase *é* este
>   ciclo?": não fechou = aberta; fechou = fechada sempre, inclusive ciclos
>   passados/pré-app) e `statusCarteiraDoCartao` ("que ciclo mostrar na Carteira
>   *agora*?": segura o anterior enquanto obrigação pendente, senão o corrente).
>   Fundir as duas causou o bug de ciclos passados aparecerem "abertos" no
>   drill-down.
>
> **Mudanças na v0.8** (sessão de implementação — modelo de edição de série):
>
> - **Régua dos três níveis de edição** (§4.3): editar uma ocorrência de série
>   agora se classifica por *o que* muda, e cada nível tem um efeito estrutural
>   próprio — decisão que emergiu de estressar casos reais (mudar data, trocar
>   meio de pagamento, parcelar um mês):
>   - **Grandeza** (valor, descrição, nota) → *override*. A ocorrência **fica na
>     série**; a exceção guarda o ajuste e sobrevive a edições "todas"/"futuras"
>     posteriores (regra de preservação, inalterada).
>   - **Natureza** (data, conta, cartão) → *desvincula*. A ocorrência deixa de ser
>     instância fiel da regra e vira **um** lançamento avulso (`serie_id: null`).
>     Substitui o antigo bloqueio de troca de conta/cartão em série (que dizia "não
>     pode" só ao salvar) — agora troca-se o meio de pagamento e o mês vira avulso.
>   - **Cardinalidade** (à vista ↔ parcelar) → não é edição de linha; é
>     *desvincular + relançar*. Parcelar é intrinsecamente "só esta"; nunca existe
>     em escopo múltiplo (evita o problema exponencial de parcelar N meses).
> - **Inversão do fluxo de escopo** (§4.3, §5.7): o escopo passa a ser o
>   **primeiro passo** ao editar uma ocorrência de série, **não** mais perguntado
>   ao salvar. O escopo escolhido **define quais campos o editor oferece** ("só
>   esta" abre o leque completo, incluindo parcelar; "todas"/"futuras" mostram só
>   o que a série inteira comporta, sem parcelar). **Revoga** a decisão da v0.7
>   ("escopo ao salvar, nunca ao abrir") — que era correta quando só se editava
>   valor, e cai agora que natureza e cardinalidade existem. Princípio que passa a
>   reger: **a pergunta de escopo obedece à experiência, não o contrário** — o
>   usuário nunca configura algo para no fim ouvir "não pode".
> - **Chave de exceção por mês** (§3, motor): `excecoes_serie.data_alvo`
>   (YYYY-MM-DD) → **`mes_alvo`** (YYYY-MM). A série tem no máximo uma ocorrência
>   por mês; chavear por mês torna a exceção **imune a mudança de dia-âncora**
>   (mudar o dia da série em "todas" não órfã mais as exceções). Corrige
>   duplicação observada em teste.
> - **"Esta e as futuras" mantém o `serie_id`** (§4.3): dividir a série em duas
>   fases preserva a **identidade contínua** (mesmo `serie_id`) — reajustar o
>   valor de um aluguel/assinatura "daqui pra frente" é *o mesmo item, novo
>   valor*, não dois itens. O passado já fica intacto como fase encerrada; não se
>   quebra o vínculo além disso (senão o relatório fragmentaria a mesma
>   assinatura em duas linhas).
> - **Cartão exige conta** (§3.2): **revoga** "sem vínculo obrigatório com conta".
>   `cartoes.conta_id` é **NOT NULL** com FK `ON DELETE RESTRICT` — criar cartão
>   exige uma conta-corrente existente. Onboarding: ao tentar criar cartão sem
>   conta, o app **alerta que é preciso ter uma conta antes** (microcópia; não
>   implementado ainda). Coerente com o invariante "soma dos saldos de conta =
>   topo do cartão" e com a `Linha de fatura` usar o tema da conta pagadora.

> **Mudanças na v0.7.1** (sessão de design — trilho da barra):
>
> - **Trilho da barra vira cinza translúcido único** (§4.4): `bar/track` passa a
>   aliasar uma primitiva nova `slate/500-a20` (`slate/500` @ 20% alpha), **igual
>   nos modos Light e Dark**. Substitui a regra anterior de trocar o trilho por
>   superfície (`bar/track` neutro em surface vs. `black` @ 20% em fundo
>   temático) — o translúcido único funciona sobre qualquer fundo. A barra foi
>   **extraída para um componente `Barra de previsão`** (instanciado nos três
>   lugares: `Linha de fatura`, `Card de entidade` Cartão, hero do drill-down)
>   que **herda a própria cor do trilho**, imune ao tema do cartão e ao modo
>   light/dark. Preenchimento `bar/ok·warn·over` segue runtime (override por mock
>   no Figma), sem variante de cor.
>
> **Mudanças na v0.7** (sessão de design — escopo de série + acesso/auth +
> fechamento de pendências):
>
> - **§4.8 sai de "a refinar"**: a exibição dos dois números no relatório está
>   resolvida e desenhada. O **total da categoria** vive na linha principal; a
>   **fatia no cartão** é um **rótulo discreto** abaixo da barra ("R$ 740 no
>   cartão"), cinza, sem barra própria. Categorias 100% débito não mostram o
>   recorte. Regra inalterada (soma uma vez pela compra; cartão é recorte); só o
>   layout foi fixado (§4.8, §5.5).
> - **Fluxo de escopo de série unificado** (§4.3, §5.7): editar e excluir uma
>   ocorrência de série usam **o mesmo** disparo de escopo (excluir é um caso de
>   edição). A escolha (só esta · esta e as futuras · todas) aparece **ao Salvar
>   e ao Excluir**, nunca ao abrir o editor — o escopo qualifica uma alteração
>   que já foi feita. É um **bottom sheet** secundário, não um modal de alerta:
>   escopo é escolha de fluxo de três caminhos, não uma interrupção. **Exceção:**
>   "excluir todas" destrói passado consolidado (§4.3) → ganha um **segundo
>   passo** de confirmação de bloqueio (modal), depois da escolha de escopo. "Só
>   esta" e "esta e as futuras" não. Sai a variante `Escopo` do `Modal de alerta`.
> - **Modelo de acesso/autenticação travado** (§6): **usuário único compartilhado**
>   no Supabase Auth (coerente com conta única — o casal compartilha um login, sem
>   distinção de autoria na v1). Credencial = **email + senha**; o email é
>   identificador de login a definir no provisionamento (não precisa ser endereço
>   ativo). **RLS deliberadamente permissiva** (`auth.role() = 'authenticated'`,
>   sem filtro por `user_id`) — registrada explicitamente por ser o oposto do
>   padrão Supabase. **Sem signup e sem recuperação de senha in-app**: usuário
>   criado manualmente no painel; troca de senha = alteração direta na base. Reset
>   in-app por email **adiado** (§8). A §6 anterior (login uma vez por aparelho,
>   sessão persistente, abre direto na Home) permanece igual.
> - **Saldo do mês = mês-calendário inteiro** (§5.1): explicitado que o card de
>   resumo e a lista cobrem **junho inteiro** (fato + projeção), não "até hoje". O
>   dia atual é só a fronteira fato/projeção, não um corte no que aparece. Sem
>   mudança de comportamento — trava contra regressão.
>
> **Mudanças na v0.6** (sessão de design — relatório + linha/card de cartão +
> ciclo de vida de contas):
>
> - **Barra da fatura ganha semáforo** (§4.4): a cor lê `realizado ÷ previsão`
>   (verde até 75%, amarelo 75–100%, vermelho acima de 100%). Decisão de produto
>   travada — sai de "a refinar". O componente `Linha de fatura` vira **variant
>   set** com a propriedade `Fase` (Futura · Aberta · Fechada). Regra de cor da
>   barra por superfície e **4 tokens novos** (`bar/track`, `bar/ok`, `bar/warn`,
>   `bar/over`) — §4.4, §5.1, §5.3. Microcópia do cartão passa a falar
>   **"previsão"**, nunca "limite/usado" (§4.4, §5.8). O hero do drill-down do
>   cartão vira **instância** do `Card de entidade` (§5.3).
> - **Recorrência mensal é ancorada no dia do mês** (§4.1): dia 15 repete todo
>   dia 15 (não "a cada 30 dias"); borda 29–31 faz **clamp no último dia do mês**.
> - **Relatório perde o bloco "Entradas × Saídas"** (§5.5): os totais vivem só no
>   card de resumo do topo (§5.1). Regra estrutural anti-retrabalho gravada: nenhum
>   indicador de "saúde do mês" pode se basear em entrada vs. saída isoladas (por
>   causa do saldo herdado, §4.7). **Cores das categorias** no relatório passam a
>   ser uma paleta fixa de 12 tokens (`categoria/01..12`), atribuídas por hash
>   estável do nome — sem campo novo no schema (§5.5).
> - **Identidade da assinatura corrigida** (glossário, §3.3, §5.5): some a
>   condição "vinculada a cartão" (meio de pagamento é ortogonal). Nova flag
>   **`assinatura`** (booleano, nível série) marcada no sub-fluxo de recorrente; o
>   relatório mostra um **recorte só-leitura** que soma o total e lista cada série
>   individual (`serie_id`). Não é categoria-mãe, não reabre agrupamento, não afeta
>   o saldo. O recorte é um **card expansível** (fechado/aberto) com barra
>   proporcional em runtime e cor própria — novo token **`recorte/assinatura`**
>   (`fuchsia/500`/`fuchsia/400`), distinta das `categoria/*` (§5.5).
> - **Ciclo de vida de contas** (§3.1, §4.10, §5.8): separados **apagar** (exige
>   conta vazia — sem lançamentos/transferências) e **arquivar** (`arquivada_em`;
>   exige saldo zero; some do seletor e da gestão ativa, preserva histórico).
>   Onboarding **obriga criar ≥1 conta** — não há conta default invisível.
>
> **Mudanças na v0.5** (sessão de design): **simplificada a categorização.**
> Removido o **agrupamento** (grupo › categoria) — adiado para versão futura:
> saem a tabela `grupos_categoria` (§3.5), o item "Agrupar" (§4.6) e a visão
> agrupada do relatório (§5.5). Removido também o **fundir** do relatório — a
> consistência de categoria passa a ser **prevenção no lançar** (autocomplete +
> pill) e **correção via edição do lançamento** (§4.6, §5.7); o **relatório vira
> só leitura** (§5.5), sem ações de manutenção. Permanece a agregação débito +
> crédito na mesma categoria (§4.6, §4.8).
>
> **Mudanças na v0.4** (sessão de design): **fatura prevista × realizada** — o
> cartão deixa de ser só "soma das compras" e passa a ter um **valor previsto**
> (placeholder) que projeta os meses futuros e é corrigido pelo realizado;
> regra `max(previsão, realizado)` antes do fechamento, `realizado` depois —
> §4.4 reescrita, campo `limite` → `previsao_mensal` em `cartoes` (§3.2),
> linha especial com barra de progresso na Home (§5.1, §5.3); costura
> fechamento × pagamento explicitada (§4.4 + §4.8). **Transferência** vira o
> 3º modo do Lançar (Saída · Entrada · Transferência), pode ser recorrente
> (nunca parcelada), e é **neutra entre correntes mas debita/credita quando
> envolve poupança** — regra governada pelo tipo da conta de destino (§4.5
> reescrita, §5.2). **Cofre × Poupança** separados: Cofre = contêiner único
> (soma, fora do mês); Poupança = várias, cada uma com drill-down (glossário,
> §4.5, §5.4). Gestão de poupança junto de conta/cartão (§5.8); poupança
> personalizável por herdar de `contas` (§4.9).
>
> **Mudanças na v0.3** (sessão de design): personalização visual de contas e
> cartões via **tema** (chave que resolve fundo + texto no design system, não
> cor crua) e **ícone** de uma biblioteca fixa curada; campos `tema` e `icone`
> em `contas` (§3.1) e `cartoes` (§3.2); personalização é **só visual**, não
> afeta nenhuma regra de cálculo (§4.9).
>
> **Mudanças na v0.2** (sessão de design): resolvida a dualidade de datas das
> despesas de cartão (saldo lê pelo pagamento da fatura; relatório lê pela data
> da compra) — nova §4.8; o relatório passa a **explodir** a fatura nas
> categorias reais das compras em vez de tratar o cartão como categoria-balde
> (§4.8, §5.5); categorias agora agregam **débito + crédito** na mesma
> categoria, independentemente do meio de pagamento (§4.6); assinatura
> **rebaixada** de destaque para um recorte do relatório (§5.5); adicionada a
> tela de **Edição** (§5.7); adicionado **agrupamento de categorias** opcional e
> emergente (grupo › categoria, um nível), distinto de fundir — nova tabela
> `grupos_categoria` (§3.5), regras em §4.6, visão no §5.5. *(Tanto o
> agrupamento quanto o fundir foram posteriormente removidos na v0.5.)*

---

## 1. Visão & Princípios

### O que é

Um gerenciador de finanças pessoais para um casal, usado no celular como um
app instalado na tela inicial. O coração do app é **registrar gastos e
receitas em segundos** e **enxergar o saldo do mês atual e dos próximos
meses**, com o saldo rolando continuamente de um mês para o outro.

A filosofia é de **livro-razão contínuo**: o app é um registro fiel do que
entrou e saiu, e uma projeção honesta do que ainda vai acontecer — não uma
ferramenta de controle por metas.

### Os 5 princípios (a constituição)

1. **Lançar é instantâneo.** Se houver atrito, o app falhou. O lançamento é
   o fluxo sagrado; tudo se subordina a ele.
2. **A data manda em tudo.** O mês de um lançamento é definido pela sua data.
   Mudou a data, mudou de mês. Não existe estado "pago/não pago" — pagou em
   outra data, muda a data.
3. **O passado registra o que foi; o futuro projeta o que será.** O passado é
   imutável por padrão; você edita o futuro. Mexer no passado é a exceção
   rara (corrigir um cadastro errado), não a regra.
4. **Nunca precisar de um "ajuste".** Anti-objetivo e régua de julgamento: se
   um fluxo leva o usuário a inventar um lançamento "ajuste" para bater o
   saldo, esse fluxo falhou.
5. **Ver, não controlar.** Sem orçamento e sem meta. O app mostra a realidade
   e projeta o que vem; não cobra de um teto inventado.

### O que explicitamente NÃO é

- **Não tem orçamento/meta por categoria.** Decisão de produto deliberada.
- **Não exporta** (Excel/CSV) — pelo menos por enquanto.
- **Não tem "pago/não pago"** nem dualidade consolidado × projetado.
- **Não é multiusuário com permissões.** É um app de um casal, conta única,
  todos veem e editam tudo.

---

## 2. Glossário

Vocabulário travado. Usar estes termos no Figma e no código.

| Termo | Significado |
|---|---|
| **Lançamento** | Uma entrada ou saída de dinheiro. A unidade básica do app. |
| **Entrada / Saída** | Receita (entra) ou despesa (sai). |
| **Conta** | Conta-corrente (ex: a minha, a da esposa). Entra na lista principal. |
| **Cofre** | Contêiner único que agrega todas as poupanças. Mostra o total guardado; fica fora do total do mês. |
| **Poupança** | Conta especial (`tipo=poupanca`). Existem várias; cada uma com seu drill-down. Só recebe depósito/retirada (transferências). |
| **Transferência** | Movimento de dinheiro entre contas. Neutra entre correntes; debita/credita quando envolve poupança (ver §4.5). |
| **Cartão** | Cartão de crédito. Gera uma **fatura**. |
| **Fatura** | Valor do cartão num ciclo. **Prevista** (placeholder) até fechar, **realizada** (soma das compras) depois. Uma linha no mês (ver §4.4). |
| **Previsão mensal** | Valor placeholder do cartão (`previsao_mensal`); projeta o gasto nos meses futuros e é corrigido pelo realizado. Não é o limite do banco. |
| **Parcelar** | Dividir um **total** em N vezes. (Carro R$24.000 em 12x = R$2.000/mês.) Tem fim. |
| **Recorrente** | Repetir um **valor por mês**. X vezes ou indefinido. (Aluguel, salário, assinatura.) Ancorada no **dia do mês** (ver §4.1). |
| **Assinatura** | Um **recorte do relatório**, não um tipo de lançamento. É a série recorrente marcada com a flag `assinatura` (ver §3.3, §5.5). Independe do meio de pagamento (débito, cartão próprio ou de terceiro). |
| **Categoria** | Emergente: nasce do texto da descrição, não de uma lista imposta. |
| **Saldo herdado** | O saldo acumulado que passa de um mês para o seguinte. |
| **Horizonte** | Janela móvel de 24 meses (a partir de hoje) em que recorrências são projetadas. |
| **Conta arquivada** | Conta desativada (`arquivada_em` preenchido) que sai do uso ativo mas preserva o histórico (ver §4.10). |

---

## 3. Modelo de dados

Entidades, campos e relações. Formatado para virar tabelas no Supabase
(Postgres). Tipos são indicativos; ajustar na implementação.

### 3.1 `contas` (conta-corrente e poupança)

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `nome` | text | "Minha conta", "Conta da esposa", "Poupança" |
| `tipo` | enum | `corrente` \| `poupanca` |
| `tema` | text? | chave do tema visual (resolve fundo + texto no design system) — ver §4.9 |
| `icone` | text? | chave do ícone/logo na biblioteca fixa — ver §4.9 |
| `arquivada_em` | timestamp? | `null` = ativa; preenchido = arquivada (ver §4.10) |
| `criada_em` | timestamp | |

- Conta `corrente` entra na lista principal do mês.
- Conta `poupanca` fica à parte (o Cofre); não recebe lançamentos diretos, só
  transferências (depósito/retirada).
- **Onboarding exige ao menos uma conta** antes do primeiro lançamento. Não há
  conta default invisível (ver §4.10).

### 3.2 `cartoes`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `nome` | text | "Nubank", "Inter" |
| `conta_id` | uuid | **FK → contas, NOT NULL, ON DELETE RESTRICT.** Conta-corrente que paga a fatura (§4.4/§4.5). Criar cartão exige conta existente. |
| `previsao_mensal` | numeric? | **teto de previsão/gasto** mensal (placeholder), não o limite do banco — ver §4.4; `null` = sem previsão (só acumula realizado) |
| `dia_fechamento` | int | dia do mês em que a fatura fecha (gatilho previsto→realizado) |
| `dia_pagamento` | int | dia do mês de vencimento (define em que mês a fatura pesa no saldo) |
| `tema` | text? | chave do tema visual (resolve fundo + texto no design system) — ver §4.9 |
| `banco` | text? | chave do banco na biblioteca fixa — ver §4.9 |
| `bandeira` | text? | chave da bandeira na biblioteca fixa — ver §4.9 |
| `criado_em` | timestamp | |

- **Vínculo obrigatório com conta** (decisão revista na v0.8; **revoga** o "sem
  vínculo" anterior). `conta_id` é NOT NULL com FK `ON DELETE RESTRICT`: todo
  cartão nasce ligado a uma conta-corrente pagadora. Onboarding: tentar criar
  cartão **sem nenhuma conta** dispara um alerta pedindo criar a conta primeiro.
  Sustenta o invariante "soma dos saldos das contas = total no topo do cartão" e
  a `Linha de fatura` herdar o tema da conta pagadora (§5.5/§4.4).
- A **fatura não é uma tabela** — é derivada: a **previsão** vem de
  `previsao_mensal` (com possíveis exceções por mês, via motor de recorrência),
  e o **realizado** é a soma dos lançamentos com aquele `cartao_id` cujo ciclo
  (definido por `dia_fechamento`) cai no período. Qual dos dois vale depende da
  fase — ver §4.4.

### 3.3 `lancamentos`

A entidade central. Cobre entradas e saídas, à vista, parceladas e recorrentes.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `tipo` | enum | `entrada` \| `saida` |
| `valor` | numeric | ver regra de interpretação abaixo |
| `descricao` | text | é também a **categoria** (ver §4.6) |
| `nota` | text | campo livre opcional |
| `data` | date | **define o mês** (princípio 2). Para compra de cartão, é a **data da compra** — ver §4.8. |
| `conta_id` | uuid | FK → contas |
| `cartao_id` | uuid? | FK → cartoes, opcional. Se preenchido, mora na fatura. |
| `repeticao` | enum | `avista` \| `parcelar` \| `recorrente` |
| `parcelas` | int? | se `parcelar`: número de parcelas (total ÷ parcelas) |
| `recorrencia_fim` | int? | se `recorrente`: número de ocorrências; `null` = indefinido |
| `assinatura` | bool | flag de **recorte** (ver §5.5). Só faz sentido em `recorrente`; vale para a série inteira. Default `false`. Não é categoria, não agrupa, não afeta saldo. |
| `serie_id` | uuid? | agrupa ocorrências de uma mesma regra (ver §4.1) |
| `criado_em` | timestamp | |

**Interpretação de `valor` conforme `repeticao`:**
- `avista` → o valor é único, naquela data.
- `parcelar` → o valor é o **total**; cada ocorrência vale `valor ÷ parcelas`.
- `recorrente` → o valor é **por mês**; repete igual a cada ocorrência.

**Sobre `assinatura`:** é um atributo da **série** (todas as ocorrências de um
`serie_id` compartilham o mesmo valor da flag — não pode variar mês a mês). Marca
"esta série entra no recorte de assinaturas do relatório". Não muda o `tipo`, não
muda a categoria, não cria hierarquia. Ver §5.5.

### 3.4 `transferencias`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | PK |
| `valor` | numeric | |
| `data` | date | |
| `de_conta_id` | uuid | FK → contas |
| `para_conta_id` | uuid | FK → contas |
| `descricao` | text? | opcional (rastreio, ex.: "guardei na poupança Viagem") |
| `repeticao` | enum | `avista` \| `recorrente` (transferência **nunca** parcela) |
| `recorrencia_fim` | int? | se `recorrente`: número de ocorrências; `null` = indefinido |
| `serie_id` | uuid? | agrupa ocorrências de uma transferência recorrente |

- **Neutra ao total do mês** quando entre correntes; **debita/credita** quando
  envolve poupança (ver §4.5 — a regra é governada pelo tipo da conta destino).
- Depósito/retirada da poupança são transferências entre uma `corrente` e a
  `poupanca`.
- **Pode ser recorrente** (ex.: "todo mês guardo R$500"): usa o mesmo motor de
  recorrência dos lançamentos (§4.1), com os 3 modos de edição/exclusão (§4.3).
  **Nunca** é parcelada — não existe dividir um total numa transferência.

---

## 4. Regras de negócio

As decisões difíceis, escritas sem ambiguidade. Esta é a seção que o código
precisa honrar exatamente.

### 4.1 O motor de recorrência (regras, não transações)

Uma recorrência é uma **regra**, não um monte de linhas no banco. O app
**materializa** ("desenha") as ocorrências apenas dentro do **horizonte**:
uma janela móvel de **24 meses a partir de hoje**.

- **Navegação no tempo é ilimitada.** Você pode ir para qualquer mês, passado
  ou futuro.
- **Projeção é limitada ao horizonte.** Além de 24 meses, recorrências
  simplesmente não aparecem projetadas; o mês mostra só o que for concreto
  (uma parcela que alcance lá, um lançamento único futuro) ou fica vazio.
- **O horizonte é móvel e automático.** É sempre "hoje + 24 meses"; a cada mês
  que passa, o teto anda sozinho e revela mais um mês de projeção. O usuário
  nunca precisa fazer nada.
- Ocorrências de uma mesma regra compartilham um `serie_id`.

**Recorrência mensal é ancorada no dia do mês.** Uma recorrência mensal repete
**no mesmo dia do mês** — dia 15 cai todo dia 15 — e **não** "a cada 30 dias".
Ancorar no dia do mês mantém o alinhamento com o calendário (o app inteiro pensa
em meses: saldo do mês, navegação mês a mês) e com o princípio 2 (a data manda no
mês). Repetir por intervalo de 30 dias derivaria (jan/15 → fev/14 → mar/16…) e
faria a "conta do dia 15" cair em qualquer dia.

- **Borda — dia-âncora 29, 30 ou 31 em mês curto:** **clamp no último dia do
  mês**. Uma recorrência no dia 31 cai em 28/29 de fevereiro, 30 de abril etc., e
  **volta ao dia-âncora** nos meses que o comportam. **Nunca transborda** para o
  dia 1º do mês seguinte — transbordar mudaria o mês da ocorrência e violaria o
  princípio 2.
- Vale para toda recorrência mensal: assinatura, aluguel, salário, previsão de
  cartão (§4.4).

### 4.2 Os dois eixos de "se estende no tempo"

Todo lançamento que dura mais de um mês responde a duas perguntas:

1. **O valor é total ou por mês?**
   - Total → **parcelar** (o sistema divide). Ex: carro R$24.000 em 12x = R$2.000/mês.
   - Por mês → **recorrente** (o sistema repete). Ex: aluguel R$2.000/mês.
2. **Tem fim?**
   - Sim → expresso **sempre como "X vezes"** (contagem de ocorrências),
     **nunca** como data de expiração.
   - Não → indefinido (válido só para recorrente).

**Parcelar e recorrente são o mesmo motor**, separados apenas pela pergunta 1.
O **cartão não é condição** para parcelar — pode-se parcelar em conta
(financiamento) ou em cartão (compra parcelada).

Palavra-chave anti-confusão: **"parcelar" = dividir um total; "recorrente" =
repetir um valor.** Nunca o mesmo campo faz as duas coisas.

### 4.3 Edição e exclusão de séries (escopo + régua de 3 níveis)

Ao editar **ou** excluir uma ocorrência de série, o app pergunta o escopo — e,
desde a v0.8, **essa é a primeira coisa**, antes de mexer nos campos (ver §5.7):

- **Só esta** → afeta apenas a ocorrência selecionada.
- **Esta e as futuras** → afeta da ocorrência em diante; o passado fica intacto.
  Divide a série em duas fases que **compartilham o `serie_id`** (mesma
  identidade contínua — é *o mesmo item com valor novo*, não dois itens).
- **Todas** → afeta toda a série, incluindo o passado (uso raro, correção de
  cadastro).

**O escopo define o que se pode editar.** O escopo não é uma pergunta no fim —
é o **contexto** que determina quais campos e quais mudanças fazem sentido. Isso
porque nem toda edição é do mesmo tipo. A **régua dos três níveis**:

- **Grandeza — valor, descrição, nota → *override*.** A ocorrência **continua na
  série**; grava-se uma exceção (`excecoes_serie`) com o ajuste daquele mês (ex:
  a luz de junho veio R$200 em vez dos R$150 da regra). É "o mesmo evento, número
  diferente". Disponível em qualquer escopo.
- **Natureza — data, conta, cartão → *desvincula*.** Mudar *quando* ou *como* se
  paga faz a ocorrência deixar de ser uma instância fiel da regra. No escopo **só
  esta**, ela **sai da série e vira um lançamento avulso** (`serie_id: null`), um
  só. Ex.: "a luz de agosto, esse mês, paguei no cartão" → agosto descola e vai
  para a fatura. No escopo **todas/futuras**, "natureza" vale no sentido de
  *regra* (trocar o banco A→B para todos os meses, mudar o dia-âncora — §4.1 —,
  jogar tudo para o cartão à vista); nada desvincula, edita-se a própria regra.
- **Cardinalidade — à vista ↔ parcelar → *desvincular + relançar*.** Transformar
  uma ocorrência em parcelamento **não é editar uma linha**: é destruir a
  ocorrência e criar N lançamentos novos, com datas próprias, no meio escolhido.
  Por isso **parcelar é intrinsecamente "só esta"** — não existe em escopo
  múltiplo (parcelar todos os meses de uma série seria um contrassenso). O app
  oferece isso como um **atalho**: remove a ocorrência da série e abre o
  lançamento parcelado já no mesmo fluxo, um único Salvar (§5.7).

**Por que naturezas diferentes têm efeitos diferentes.** Não é inconsistência:
é o princípio 2 (a data manda) revelando que **data e meio de pagamento são
identidade da ocorrência, não atributos dela**, enquanto o valor é atributo.
Mudar um atributo mantém a ocorrência na série; mudar a identidade a expulsa
(vira evento próprio); mudar a cardinalidade a recria. Uma frase: **grandeza faz
override, natureza desvincula, cardinalidade recria.**

**Regra de preservação:** edições "esta e futuras" / "todas" **preservam as
exceções manuais** (overrides de grandeza) já feitas. Cada mês editado é um
*fato real* (a conta veio aquele valor); apagar isso seria perda de dado.
Difere do Google Calendar de propósito. As exceções são chaveadas por **mês**
(`mes_alvo`, YYYY-MM), então mudar o dia-âncora da série em "todas" **não** as
órfã.

**Cancelamento** (ex: cancelar assinatura) = excluir **"esta e as futuras"**.
Tira da frente, preserva o passado já consolidado.

**Confirmação no excluir destrutivo.** Excluir **"todas"** apaga ocorrências
passadas — fato real consolidado. Por isso, e só nesse caso, a escolha de escopo
é seguida de uma **confirmação de bloqueio** (segundo passo), avisando que apaga
N meses de histórico. "Só esta" e "esta e as futuras" não disparam confirmação —
não tocam (ou só tiram da frente) o passado. Apresentação do fluxo em §5.7.

### 4.4 Cartões e faturas (fatura prevista × realizada)

A fatura **não** é só a soma das compras. Ela tem um **valor previsto** (um
placeholder que o usuário define) e um **valor realizado** (a soma real das
compras do ciclo). Isso recupera, sem virar orçamento, o hábito de prever o
gasto do cartão e corrigir pelo real — é **projeção com placeholder**, o mesmo
mecanismo que o app usa para luz/gás (lança previsto, ajusta pelo real).

**As duas fases, separadas pela data de fechamento:**

- **Fase prevista (antes do `dia_fechamento`):** a fatura conta
  **`max(previsão, realizado)`**.
  - Compras ainda somam **menos** que a previsão → conta a **previsão** (o
    placeholder segura o lugar; meses futuros já nascem com esse valor
    projetado no saldo).
  - Compras **passam** da previsão → conta o **realizado** (a barra estoura e o
    saldo do mês reflete o valor real, mesmo antes de fechar).
- **Fase consolidada (a partir do `dia_fechamento`):** a previsão **morre**; a
  fatura conta **só o realizado**, seja maior ou menor que a previsão. Fato é
  fato.

**Resumo travado:** *antes de fechar, fatura = `max(previsão, realizado)`;
depois de fechar, fatura = `realizado`.* A data de fechamento é o gatilho
automático da transição. Coerente com o princípio 3 (fatura aberta = projeção;
fatura fechada = fato).

**De onde vem a previsão.** É `cartoes.previsao_mensal`, tratada como uma regra
recorrente: vale todo mês e pode ter **exceção por mês** (editar "só esta" muda
a previsão de um mês específico sem mexer nos outros — §4.3). Usa o motor de
recorrência (§4.1).

**Exibição.** A fatura é **uma linha especial** na lista do mês, com **barra de
progresso** mostrando o realizado consumindo a previsão (mês futuro = barra
vazia; mês corrente = enchendo; estouro = cheia, valor sobe pro real). O
drill-down (§5.3) mostra as compras que compõem o realizado.

**A "foto do presente" na aba Cartões — ciclo vivo, não mês (v0.9).** Na aba
Cartões (§5.6) o card de cada cartão não segue o mês do topo (não há seletor de
mês lá); segue o **ciclo vivo** do próprio cartão. Duas situações, decididas por
**hoje vs. vencimento**:

- **FECHADA (obrigação pendente):** o ciclo já fechou e **hoje ainda está antes
  do vencimento**. Mostra "vence DD mmm" e o realizado consolidado do ciclo.
- **ABERTA (acumulando):** não há fechada pendente — mostra o ciclo corrente
  ainda acumulando (ou, navegando no drill-down, um ciclo futuro que ainda vai
  fechar). Mostra "fecha DD mmm".

**A virada acontece no DIA do vencimento/pagamento, não no seguinte (v0.9).** A
fatura é obrigação pendente **estritamente antes** do vencimento. O "vencimento"
é o dia efetivo (`cartoes_pagamentos.data_paga`, se houver pagamento registrado)
ou o `dia_pagamento` padrão. No próprio dia, a fatura sai do radar e o card já
mostra o ciclo aberto — pagar hoje vira a fase hoje. Coerente com o modelo sem
"atraso": no app, o vencimento **é** o pagamento (não há estado "atrasado").

**Previsto Restante (v0.9 — substitui o percentual).** Nas telas de "foto do
cartão" (aba Cartões e hero do drill-down), o número ao lado do valor deixa de
ser "Z% da previsão" e passa a ser **Previsto Restante = `previsão −
realizado`**. Se o realizado ultrapassa a previsão, o rótulo vira **"Acima da
previsão"** e mostra o **excedente** em vermelho (`value/saida`). A barra
continua lendo `realizado ÷ previsão` por baixo (semáforo inalterado); só o
texto mudou. Sem previsão (`previsao_mensal` nulo), não há barra nem bloco de
restante. **A lista de lançamentos da Home (§4.8) não muda** — lá a fatura é uma
linha no fluxo de caixa com a régua `max(previsão, realizado)` de sempre.

> **Motor (v0.9).** Duas leituras de ciclo, separadas de propósito:
> `faseCarteiraDoCiclo(cartão, ciclo, hoje, pagamentos)` responde "que fase *é*
> este ciclo?" — não fechou = aberta; **fechou = fechada sempre** (inclusive
> ciclos antigos/pré-app, pagos ou não), usada pelo drill-down ao navegar.
> `statusCarteiraDoCartao(...)` responde "que ciclo a Carteira mostra *agora*?" —
> segura a fechada-a-pagar enquanto pendente (hoje < vencimento), senão o ciclo
> aberto. São perguntas diferentes: um ciclo passado já pago **não** é obrigação
> pendente, mas **é** uma fatura fechada. Fundi-las causou o bug de ciclos
> passados aparecerem "abertos" no drill-down.

**Barra com semáforo (decisão de produto travada).** A barra de progresso da
fatura tem **cor semáforo** lendo o progresso da previsão — `realizado ÷
previsão`. É **informação, não cobrança de meta** (coerente com o princípio 5:
ver, não controlar; o semáforo só mostra onde você está em relação ao que *você*
mesmo previu). Limiares:

- **Verde** — até 75%. Folga.
- **Amarelo** — 75% a 100%. Atenção, chegando no previsto.
- **Vermelho** — acima de 100% (estourou). Barra cheia, realizado em vermelho, e
  o valor que conta passa a ser o realizado (já é a regra do `max`).

O **estouro não é um estado/variante separado** — é consequência visual da razão
`realizado/previsão`, dirigida pelo dado em runtime.

**Regra de cor da barra.** As cores do semáforo **não mudam por tema** — são
informação funcional, idênticas em todos os lugares (não há tokens de cor de
semáforo por tema). O **trilho** também é único: um **cinza translúcido**
(`bar/track` → `slate/500-a20`, `slate/500` a 20% de opacidade) que funciona
sobre **qualquer fundo** — branco/surface ou temático, light ou dark. Por ser
translúcido sobre um cinza médio, tem contraste suficiente tanto sobre claro
quanto sobre escuro, sem precisar trocar por superfície.

- A barra vive num **componente `Barra de previsão`** (extraído para matar o
  hardcode triplicado — antes desenhada à mão na `Linha de fatura`, no `Card de
  entidade` Cartão e no hero do drill-down). O componente **herda a própria cor
  do trilho**, não sendo afetado pelo tema do cartão nem pelo modo light/dark do
  app. As três superfícies passam a ser **instâncias** dele.
- O **preenchimento** (`bar/ok` · `bar/warn` · `bar/over`) é definido em runtime
  pela razão `realizado ÷ previsão` (§4.4); no Figma é override de instância por
  mock, não propriedade de variante. **Nunca** usar `theme/text` no preenchimento
  (vira branco-sobre-branco em fundo temático).

> A regra anterior (trilho `bar/track` neutro em surface vs. `black` @ ~20% em
> fundo temático) **sai**: o trilho translúcido único cobre os dois casos, então
> não há mais troca por superfície. Validado nos temas vermelho e onix.

**Tokens da barra** (coleção `Color`, modos Light/Dark; escopo `SHAPE_FILL` +
`FRAME_FILL`; aliasam primitivas, não hex cru):

| Token | Light | Dark |
|---|---|---|
| `bar/track` | `slate/500-a20` | `slate/500-a20` |
| `bar/ok` | `emerald/500` | `emerald/400` |
| `bar/warn` | `amber/500` | `amber/400` |
| `bar/over` | `rose/500` | `rose/400` |

> `slate/500-a20` é uma **primitiva nova** (coleção `Primitives`, modo único):
> `slate/500` a 20% de alpha. `bar/track` aliasa ela **igual nos dois modos** —
> trilho único, sem variação light/dark, coerente com o componente que herda a
> própria cor.

**Microcópia — vocabulário "previsão", nunca "limite/usado".** Reflete que
`previsao_mensal` é teto de gasto estipulado pelo usuário, não o limite do banco
(§3.2). Em três telas:

- **Criar/Editar Cartão:** campo `Limite` → **`Previsão mensal de gasto`** + hint
  "Quanto você planeja gastar — não é o limite do banco".
- **Drill-down do Cartão (hero) e `Card de entidade` (Cartão):** "Previsto
  Restante R$ X" (= previsão − realizado), ou "Acima da previsão R$ X" (excedente
  em vermelho) quando estoura, mais "fecha/vence DD mmm" (v0.9 — substitui o "Z%
  da previsão").

**Anti-dupla-contagem.** Um lançamento com `cartao_id` **não aparece solto** na
lista do mês — ele compõe o realizado do cartão e só conta no mês através da
linha da fatura. **Nada é contado duas vezes.**

**Costura fechamento × pagamento (a sutileza).** São duas datas com papéis
distintos, e elas **não** competem:
- **`dia_fechamento`** decide *quando a previsão vira realizado* e *qual ciclo
  de compras* compõe a fatura.
- **`dia_pagamento`** decide *em que mês a fatura pesa no saldo* (fluxo de
  caixa). A fatura pesa no mês do **pagamento**, não no do fechamento.

Exemplo: compras do ciclo que **fecha 30/jun** e **vence 10/jul** aparecem como
**linha no saldo de julho**. O valor dessa linha segue `max(previsão,
realizado)` enquanto o ciclo está aberto e consolida no realizado quando fecha
(30/jun); o mês em que ela impacta o saldo é julho (pagamento). Ver também §4.8
(o eixo de consumo, no relatório, lê pela data da compra — junho).

### 4.5 Contas, transferências, Cofre e poupança

**Contas.** Todo lançamento pertence a uma **conta** (tag). A lista principal do
mês mostra **tudo somado** (todas as correntes); a tag indica de qual conta
saiu/entrou.

**Transferência — neutra ou não, conforme o destino.** O que decide se uma
transferência afeta o saldo do mês **não** é o ato de transferir, e sim o
**`tipo` da conta de destino**:

- **Corrente → corrente:** **neutra**. Aparece na lista para rastreio, mas não
  altera o total do mês (o dinheiro mudou de bolso, continua disponível). É a
  "cola" entre contas — ex.: transferir para a conta da esposa para ela pagar
  algo.
- **Corrente → poupança (depósito):** **debita**. Aparece como uma **linha na
  lista do mês** ("guardei na poupança") que **reduz o saldo** — o dinheiro saiu
  do radar do mês (embora continue no patrimônio).
- **Poupança → corrente (retirada):** **credita**. Linha que **aumenta** o saldo;
  volta ao disponível.

A linha aparece sempre na Home para nunca cair no pesadelo do "ajuste" (o saldo
nunca muda sem uma linha explicando o porquê). Nota de implementação: o depósito
continua sendo um registro em `transferencias` (não vira `saida` em
`lancamentos`); o cálculo do saldo é que trata transferência com destino
poupança como débito e as demais como zero.

**Cofre × Poupança (hierarquia).**

- **Cofre = contêiner único.** Agrega todas as poupanças: mostra o **total
  guardado** (soma de todas) e fica **fora do total do mês**. É visão agregada
  pura — nenhuma poupança toca o saldo mensal.
- **Poupança = várias.** Cada uma é uma `conta` com `tipo=poupanca`, com seu
  **drill-down** próprio (saldo + histórico de depósitos/retiradas).
- **Depositar/retirar é ação da poupança**, nunca do Cofre. Os botões abrem o
  bottom sheet de transferência com a poupança já fixada num dos lados (§5.2).

### 4.6 Categorias emergentes

Não há lista fixa de categorias. **A descrição é a categoria.**

- **Autocomplete por histórico:** ao digitar, o app sugere descrições já
  usadas, por frequência/recência. Tocar na sugestão vira uma **pill** na linha
  de texto (que é a categoria). É a **prevenção na origem**: tocar na sugestão é
  o que mantém a consistência (quase nunca se digita do zero).
- **Categoria nova nasce ao salvar.** Quando o usuário digita um nome que não
  existe no histórico (sem sugestão para tocar), a categoria nova só passa a
  existir — e a entrar no histórico de sugestões — **quando o lançamento é
  salvo**, nunca enquanto se digita. Isso evita poluir o histórico com termos
  digitados e abandonados (começou "Pet shop", desistiu, fechou o sheet → não
  vira categoria).
- **Normalização leve:** ao casar com o histórico, ignora maiúsculas/minúsculas
  e espaços nas pontas ("mercado" = "Mercado").
- **Variação é corrigida no lançamento, não no relatório.** Se o usuário ignorar
  a sugestão e forçar um nome novo ("Supermercado" em vez de "Mercado"), nasce
  uma segunda categoria. A correção é **editar o(s) lançamento(s)** (§5.7) e
  trocar o nome — respeitando o escopo de série (só esta / futuras / todas, §4.3)
  quando for o caso. **Não há** ação de "fundir" no relatório: o relatório é
  **só leitura** (§5.5). (Consequência aceita: não existe correção em lote; é
  uma edição por lançamento. Para uso pessoal, com o autocomplete prevenindo a
  maioria dos casos, o resíduo é raro.)
- **A categoria independe do meio de pagamento.** "Mercado" é "mercado", tanto
  faz se foi pago em **débito** (conta) ou **crédito** (cartão). No relatório,
  débito e crédito da mesma categoria são **agregados juntos** — a categoria
  pertence à **despesa**, nunca ao meio de pagamento. (Consequência operacional
  detalhada em §4.8.)

Filosofia: **a categoria é emergente, não imposta.**

### 4.7 Saldo contínuo

- Cada mês começa com o **saldo herdado** do mês anterior.
- O app é um livro-razão contínuo: o saldo rola indefinidamente.
- O saldo do mês considera apenas contas-corrente (poupança fora).
- **Consequência importante (gravada em §5.5):** o saldo do mês é `herdado +
  entradas − saídas`. Um mês com saídas maiores que entradas pode estar
  **positivo** por causa do herdado. Por isso, nenhum indicador de "saúde do mês"
  pode se basear em entradas vs. saídas isoladas.

### 4.8 Os dois eixos de tempo da despesa de cartão

Esta é a regra mais sutil do app. Uma despesa de cartão existe em **dois
momentos diferentes**, e cada tela do app lê o que lhe interessa do **mesmo
registro** (a compra). O princípio 2 ("a data manda") segue intacto: a compra
guarda a **data da compra**; o que muda é *por qual caminho* cada tela lê esse
dado.

| Eixo | Pergunta que responde | Data que usa | Onde aparece |
|---|---|---|---|
| **Fluxo de caixa** | "Quanto saiu da conta neste mês?" | **pagamento da fatura** | Home (§5.1), saldo |
| **Consumo** | "Com o que eu gastei neste mês?" | **data da compra** | Relatório (§5.5) |

**Exemplo.** Mercado no crédito em 15/jun, fatura paga em 10/jul:
- Na **Home de junho**: a compra **não** aparece solta; ela está dentro da
  fatura, que só impacta o saldo em **julho** (quando é paga).
- Na **Home de julho**: aparece a **linha da fatura** (o consolidado que saiu da
  conta).
- No **Relatório de junho**: a compra conta como gasto de **mercado em junho**
  (mês da compra), somada junto com qualquer mercado pago em débito.

**Regra do relatório (anti-dupla-contagem).** O relatório soma cada compra
**uma única vez, pela data da compra**. A fatura **não** é uma segunda parcela
somada por cima — ela é apenas a forma como o fluxo de caixa enxerga as mesmas
compras. Concretamente:

- A fatura é **explodida** (decomposta) nas categorias reais das compras que a
  compõem. **Não** existe categoria-balde "Cartão Nubank" no relatório.
- Cada categoria mostra o **total da despesa** (débito + crédito agregados).
- "Quanto desse total está no cartão" é um **recorte/lente dentro da
  categoria** (ex.: "dos R$ 800 em mercado, R$ 300 foram no crédito"), **não**
  uma linha adicional somada. Assim a soma do mês fecha — cada compra contada
  uma vez.

**Resumo travado:** *Home = fluxo de caixa (fatura na data de pagamento);
Relatório = consumo (compra na data da compra, somada uma vez, com o meio de
pagamento como recorte).* Duas telas, dois eixos, uma base de dados, zero
contagem dobrada.

**Exibição dos dois números (resolvida).** Na linha de categoria do relatório, o
**total da categoria** (débito + crédito agregados) vive na **linha principal**,
alinhado ao nome e à barra. A **fatia no cartão** aparece como **rótulo discreto
na linha de baixo**, abaixo da barra ("R$ 740 no cartão") — cinza, **sem barra
própria**, porque é um recorte de leitura, não uma parcela somada à parte.
Categorias **100% débito** (sem `cartao_id` em nenhuma compra) **não exibem** o
rótulo de recorte. Materializa a regra acima: uma soma só, pela compra; o cartão
é uma lente dentro da categoria.

### 4.9 Personalização visual de contas, cartões e poupanças

Cada **conta**, **cartão** e **poupança** pode ter um **tema** e um **ícone**. É
**puramente visual** — não afeta nenhum cálculo, fatura, saldo, projeção ou
relatório. O dado guarda apenas referências; o visual vive no design system.
(Poupança herda os campos `tema`/`icone` por ser uma `conta` com
`tipo=poupanca`; sem mudança de schema.)

- **Tema (`tema`):** uma **chave** (ex.: `nubank`, `platinum`, `black`), não uma
  cor crua. O tema é um pacote coeso — cor de fundo + cor(es) de texto que
  garantem contraste — definido no design system. Guardar a chave (e não o
  hexadecimal) significa que reajustar um tema no design atualiza todos os itens
  que o usam, sem tocar no dado. Os temas saem de uma **paleta curada** (cores
  dos principais bancos), não de um color picker livre.
- **Ícone (`icone`):** uma **chave** de uma **biblioteca fixa** de logos de
  banco/bandeira (curada, restrita aos bancos do usuário). Não é upload de
  imagem livre — logo não há storage de arquivos a manter.
- **Mesmo dado, tratamento visual diferente por tipo:** conta e cartão usam o
  **mesmo** campo `tema`. *Como* o tema é aplicado é decisão de design (ex.:
  cartão pinta o card inteiro; conta pinta só a testeira). O spec só garante que
  o dado é o mesmo nos dois; a diferenciação visual cartão × conta fica no Figma.

### 4.10 Ciclo de vida de contas (apagar × arquivar)

Onboarding e desativação de contas. Vale para conta-corrente e poupança, com
uma exigência a mais para corrente (detalhada abaixo).

**Onboarding — não há conta default invisível.** O app **obriga criar ao menos
uma conta** antes do primeiro lançamento. Não existe uma conta "Geral"/"Carteira"
oculta que absorveria lançamentos órfãos — isso mutaria silenciosamente a tag de
lançamentos passados, exatamente o tipo de mudança de estado sem rastro que o
spec combate (princípios 4 e 3).

**Dois conceitos distintos — apagar e arquivar:**

- **Apagar = destruir o registro.** Caso **raro** (corrigir um cadastro errado).
  Só é permitido se a conta estiver **vazia** — sem nenhum `lancamento` nem
  `transferencia` associado. Garante zero dado órfão e nenhuma FK quebrada.
- **Arquivar/aposentar = "não uso mais daqui pra frente, mas o passado continua
  verdadeiro".** É o **caminho normal** para desativar uma conta com histórico.
  - **Exige saldo zero** (transferir/sacar tudo antes de arquivar). Assim o
    dinheiro nunca fica preso numa conta morta, e o total do Cofre nunca conta o
    saldo de uma poupança aposentada.
  - **Não toca em nenhum lançamento passado** — é apenas a flag `arquivada_em`
    na conta, não uma edição em massa. Coerente com o princípio 3 (o passado é
    fato) e com o padrão "cancelar = esta e as futuras" (§4.3): tira da frente,
    preserva o consolidado.

**Efeitos de arquivar:**
- Some do **seletor de conta** no Lançar (§5.2) e do estado "ativo" na gestão
  (§5.8).
- **Continua existindo** para o saldo histórico e para manter a tag dos
  lançamentos antigos.
- Vale igual para **corrente e poupança** — ambas exigem saldo zero para
  arquivar.

**Por que não esvaziar mês a mês.** Sem o arquivar, aposentar uma conta com 5
meses de histórico forçaria editar lançamento por lançamento para "esvaziar" —
atrito proibido (princípio 1) e, pior, mexer no passado em massa (viola o
princípio 3). Arquivar resolve sem tocar no histórico.

---

## 5. Telas & fluxos

Inventário das telas, com propósito, conteúdo e estados.

### 5.1 Mês (Home)

**Abre aqui.** Mostra a situação do mês atual.

- **Card de resumo** — receita total e despesa total do mês; saldo do mês; saldo
  herdado do mês anterior. É a **fonte única de verdade** desses totais e vive
  **só no Relatório** (§5.5) — não se repete na Home nem nas abas Cartões/Contas
  (que são foto do presente, §5.6). *(v0.9: revoga o "aparece em todas as abas" —
  o resumo mensal é do Relatório.)*
  - **Cobre o mês-calendário inteiro, não "até hoje".** O saldo, as entradas e as
    saídas do card somam **o mês inteiro** (fato + projeção) — em 15 de junho, o
    aluguel que vence dia 20 e o salário que cai dia 30 **já contam**. O dia atual
    é apenas a fronteira entre o que já é fato (§princípio 3) e o que ainda é
    projeção dentro do mês (§4.1), **não** um corte no que aparece. Coerente com o
    saldo contínuo (§4.7) e com a navegação para meses futuros (que mostra o mês
    inteiro projetado). Mostrar "até hoje" omitiria compromissos já assumidos e
    levaria ao "ajuste" que o princípio 4 combate. (O saldo de um dia específico
    já é legível **na lista**, linha a linha, após cada transação — não precisa de
    resumo parcial.)
- **Navegação:** entre meses (anteriores e próximos), ilimitada. A **navegação
  principal** é a barra inferior de **4 abas** — Lançamentos · Cartões · Contas ·
  Relatório (v0.9; §5.6). O seletor de mês do topo vale para Lançamentos, Contas
  e Relatório; a aba **Cartões não tem seletor de mês** (§4.4, §5.6).
- **Lista:** todos os lançamentos do mês selecionado (entradas e saídas das
  contas-corrente) + **uma linha especial por cartão** (fatura prevista/realizada
  com barra de progresso semáforo — §4.4) + transferências (neutras entre
  correntes; depósito/retirada de poupança que debitam/creditam — §4.5).
- **Cada linha:** ícone discreto de **editar** (não clicar na linha inteira,
  para evitar toque acidental).
- **FAB:** botão flutuante **+** no canto inferior direito → abre o bottom
  sheet de lançar.
- **Estados:** vazio (mês sem lançamentos), carregando, erro de rede.

### 5.2 Lançar (bottom sheet) — o fluxo sagrado

Bottom sheet com **botão Salvar flutuante** (sempre visível ao rolar).
Hierarquia do topo (essencial, sem rolar) para o fim (opcional, rolando):

1. **Valor** — foco automático, teclado numérico já aberto.
2. **Saída / Entrada / Transferência** — toggle ternário, default **Saída**.
   Em **Transferência**, o sheet muda de estado (ver abaixo).
3. **Descrição/categoria** — com autocomplete inteligente (§4.6).
4. **Data** — default hoje.
5. **Conta** — default na principal; aqui também se indica se caiu num **cartão**.
   Contas **arquivadas** não aparecem no seletor (§4.10).
   — *daqui para baixo, opcional, exige rolar* —
6. **Como se repete:** à vista (default) · parcelar em Nx · recorrente (X vezes
   ou sempre). Ao escolher, abre o subcampo e mostra um **eco** do resultado:
   *"R$2.000 × 12 = R$24.000"* ou *"R$200/mês, 12 vezes"*. O eco é o antídoto
   contra a confusão dividir-vs-repetir. **No modo recorrente**, aparece também o
   **checkbox opcional `É assinatura`** (§5.5) — marca a série para o recorte de
   assinaturas do relatório; não muda nada no cálculo.
7. **Nota livre** — text area, no fundo.
8. **Salvar** — flutuante.

Meta de design: nos 5 primeiros campos resolve-se ~90% dos lançamentos sem
rolar. Defaults espertos = menos toques. O checkbox de assinatura mora no
sub-fluxo de recorrente (passo 6), fora da rota comum à vista — o fluxo sagrado
do lançamento rápido permanece intacto (princípio 1).

**Estado Transferência (mesmo sheet, campos diferentes).** Ao escolher
Transferência, somem os campos de despesa (categoria, cartão, parcelar) e
aparecem **Conta Saída** (origem) e **Conta Destino** — qualquer uma podendo ser
corrente ou poupança. Mantém **Descrição** (opcional, rastreio) e o campo
**Data** (default hoje) — que governa o mês em que a transferência pesa no saldo
(§4.5), coerente com o princípio 2. Permite **recorrência** (nunca parcelamento —
§3.4). Os botões **Depositar/Retirar** da poupança (§5.4) abrem este mesmo estado
com um lado já fixado (e também trazem o campo Data). O efeito no saldo segue
§4.5 (neutra entre correntes; debita/credita com poupança).

### 5.3 Cartão (drill-down)

Página própria (Header chuld + conteúdo), sem FAB. Abre ao tocar no card do
cartão (aba Cartões, §5.6) ou na Linha de fatura da Home (§4.8).

- **Navega por CICLO, não por mês (v0.9 — revoga a v0.6).** O seletor do header é
  **"Fatura de \<mês de fechamento\>"** — o mês de fechamento é a identidade
  estável do ciclo, não muda com a fase. As setas navegam **ciclo ± 1**.
- **"Clique vivo" — abre no ciclo que a coisa clicada representa.** Uma porta só,
  âncora explícita: tocar no card da aba Cartões abre no **ciclo vivo** (o que o
  card mostra); tocar na Linha de fatura da Home abre no **ciclo que vence naquele
  mês**. A fase de cada ciclo (aberta/fechada) segue a régua da Carteira (§4.4):
  espelha exatamente o que a aba Cartões mostraria para aquele ciclo.
- **Hero = componente próprio (`CartaoHeroDrillDown`), não instância do `Card de
  entidade` (v0.9 — revoga a v0.6).** Mostra **as mesmas informações** do card
  compacto de Cartões (§5.6) — fase, valor realizado, barra, Previsto Restante /
  excedente, evento (fecha/vence) — mas em **layout próprio**: largura cheia,
  altura que abraça o conteúdo (um cartão com previsão fica mais alto que um sem).
  O `Card de entidade` continua servindo Gestão/Cofre; a aba Cartões usa um card
  compacto; o drill-down usa o hero. Três contextos, **mesma fonte de dados** no
  motor.
- **Barra + Previsto Restante nas duas fases**, sempre que houver previsão
  (inclusive fatura fechada). Sem previsão, some a barra e o bloco de restante.
- A **lista** que compõe o realizado é um **extrato corrido por data**, com
  **cabeçalho de dia** (mesma gramática da aba Lançamentos, §5.1). Reúne todas as
  compras do ciclo — à vista, parcelas e assinaturas — numa só lista ordenada por
  data, **sem** agrupar por tipo. Parcela e recorrência aparecem como **detalhe
  da linha** (selo "3/12", ícone de coleção), não como seção. Sem subtotais por
  grupo — o total do ciclo já vive no hero. *(v0.10 — revoga a divisão em três
  grupos COMPRAS DO CICLO · PARCELAS · ASSINATURAS.)*
- **Fazer Pagamento** (footer): disponível quando o ciclo olhado é a
  fechada-a-pagar (§4.4); registra o pagamento efetivo em `cartoes_pagamentos`.

> **Limites de navegação de ciclo** — ainda não implementados (§8): as setas
> navegam indefinidamente; ciclos vazios mostram estado vazio. A definir:
> trava para trás no primeiro ciclo com compra, para frente no horizonte de 24
> meses (§4.1).

### 5.4 Cofre e poupanças

- **Cofre (contêiner):** topo com o **total guardado** (soma de todas as
  poupanças, fora do total do mês) + **lista de poupanças**, cada uma um card
  (distinguível por tema/ícone — §4.9).
- **Poupança (drill-down):** ao entrar numa poupança, vê-se seu saldo e o
  **histórico de depósitos/retiradas**.
- **Ações** (na poupança, não no Cofre): **depositar** e **retirar** — abrem o
  sheet de transferência com a poupança fixada num dos lados (§5.2). Depósito
  debita o disponível do mês; retirada credita (§4.5).

### 5.5 Relatório

- Para onde foi o dinheiro: **despesas agrupadas por categoria emergente**,
  agregando débito + crédito (§4.6, §4.8).
- **Card de resumo (aqui é a casa dele).** Entradas, saídas, saldo do mês e
  herdado vivem no **card de resumo no topo do Relatório** (§5.1 descreve seu
  conteúdo). É a fonte única desses totais — a Home e as abas Cartões/Contas
  **não** os repetem. O relatório **não** tem bloco "Entradas × Saídas" separado
  — seria redundância com o próprio card de resumo.
- **Regra estrutural (anti-retrabalho):** nenhum indicador de "proporção" ou
  "saúde do mês" no relatório pode se basear em entradas vs. saídas isoladas. O
  saldo é `herdado + entradas − saídas` (§4.7); um mês com saídas > entradas pode
  estar positivo por causa do herdado. Uma barra entrada/saída acusaria falso
  "estouro" — incoerente com o princípio 5 (ver, não controlar).
- **Cores das categorias.** As barras de categoria ("Para onde foi o dinheiro")
  recebem cor categórica automática:
  - **Paleta fixa de 12 cores**, tokens `categoria/01`..`categoria/12` (camada
    semântica → primitivas Tailwind /500). Não se geram cores únicas por
    categoria; acima de 12, a paleta **cicla** (a 13ª repete a 1ª). Intencional:
    o olho não distingue mais que ~12 matizes, e as categorias não competem
    (ordenadas por valor e identificadas pelo texto).
  - **Atribuição determinística pelo texto:** a cor é derivada do nome da
    categoria via **hash estável** → índice 1–12 → token `categoria/N`. Mesmo
    nome = mesma cor sempre, **sem armazenar cor no banco**. Coerente com
    categoria emergente (§4.6): a cor nasce do texto. **Nenhum campo novo no
    schema** — cor puramente derivada em runtime.
  - **Fonte da paleta = design system do Figma.** O spec referencia os tokens
    (`categoria/01..12`), não os hexadecimais. Reajustar a paleta = mexer no
    design system, sem tocar no código ou no spec.
  - **Tokens evitados de propósito:** a barra de categoria **não** usa
    `value/entrada` (verde) nem `value/saida` (vermelho) — esses têm significado
    fixo (entrou/saiu dinheiro). Uma despesa pintada de verde-entrada seria
    semanticamente enganosa.
- A fatura de cartão é **explodida** nas categorias das compras — nunca tratada
  como uma categoria-balde "Cartão X" (§4.8). Dentro de cada categoria, o quanto
  está no cartão é um **recorte**, não uma parcela somada à parte.
- **Assinaturas (recorte, não tipo de lançamento).** Assinatura **não** é um meio
  de pagamento nem está vinculada a cartão — há assinatura no débito (Netflix),
  em cartão próprio (Apple) e em cartão de terceiro (Amazon no cartão da esposa).
  O recorte é dirigido pela flag `assinatura` (§3.3), marcada no Lançar (§5.2):
  - É um **recorte só-leitura** que **soma o total** das séries marcadas e
    **lista cada uma individualmente** — a unidade de exibição é a **série**
    (`serie_id`), identificada pela sua própria categoria/descrição (Netflix ≠
    HBO). **Não** é uma categoria-mãe, **não** cria hierarquia, **não** reabre o
    agrupamento removido na v0.5.
  - **Não afeta entrada/saída/saldo** — é uma **lente** sobre lançamentos já
    contados nas suas categorias reais; não adiciona nem remove linha (mesma
    mecânica do recorte do cartão, §4.8). Zero dupla contagem.
  - Peso visual **proporcional** — é *um dos números*, não o herói da tela.
  - *Futuro previsto (fora de escopo agora):* o checkbox booleano pode virar um
    dropdown/tag com outros tipos de recorte (imposto, doação…) sem quebrar o
    modelo — troca o tipo do campo, não a mecânica.

  **Design do card de assinaturas (recorte expansível).** Na lista do relatório,
  o recorte é um **card expansível** com dois estados:

  - **Fechado (padrão):** cabeçalho com ícone + "Assinaturas · N ativas" + total
    mensal + chevron de expandir, mais uma **barra proporcional ao mês** (mesma
    escala das barras de categoria). Vive fechado; o usuário expande quando quer o
    detalhe. Peso visual contido — coerente com "recorte, não herói".
  - **Aberto:** revela a lista dos serviços individuais, **um por linha**. Cada
    linha mostra **nome + meio de pagamento + valor**, **sem barra** (valores
    individuais pequenos demais para a barra significar algo). É onde a identidade
    individual se materializa: Netflix, Apple, Amazon aparecem separados, cada um
    com seu `serie_id`, nunca fundidos.

  **Barra do card (nos dois estados).** Proporcional ao mês, na mesma escala das
  categorias (total das assinaturas contra o maior gasto do mês), calculada em
  **runtime** (`total assinaturas ÷ maior gasto do mês`) — não é largura fixa de
  design. Comunica honestamente que assinaturas costumam pesar pouco no total: a
  barra fica curta, e isso é **informação, não defeito**. Cor própria de recorte,
  token **`recorte/assinatura`** (→ `fuchsia/500` light, `fuchsia/400` dark).
  Distinta das 12 cores `categoria/*` de propósito: sinaliza que assinatura é uma
  **lente** sobre despesas já contadas, não mais uma categoria competindo na lista
  (mesmo princípio que afasta a barra de categoria de `value/entrada`/`value/saida`
  — cada cor com significado próprio).

  **Meio de pagamento na lista.** Cada assinatura mostra seu meio como **rótulo
  discreto**, derivado do lançamento (sem campo novo): o **nome do cartão** quando
  há `cartao_id`, senão o **nome da conta** (`conta_id`). Materializa a regra de
  que assinatura independe do meio (não é mais "vinculada a cartão") e dá contexto
  cobrindo os casos reais (débito, cartão próprio, cartão de terceiro). O meio é
  **informação de leitura, não classificador**.
- **Só leitura.** O relatório não tem ações de manutenção (não funde, não
  agrupa, não edita categoria). Para corrigir uma variação de nome de categoria,
  edita-se o lançamento (§4.6, §5.7). É uma tela de **ver**, não de administrar.
- Sem exportar. Sem orçamento.

> **Handoff (Figma).** Os dois estados do card de assinaturas (fechado/aberto)
> estão desenhados em telas duplicadas em contexto ("Relatório — assinaturas
> fechadas" e "abertas"), não como amostras soltas. A barra é proporcional em
> runtime (total das assinaturas ÷ maior gasto do mês), igual às barras de
> categoria — não largura fixa.

### 5.6 Cartões e Contas (abas) — a foto do presente

Duas abas separadas (v0.9 — substituem a antiga aba Carteira), pela razão
estrutural registrada no changelog: **cartão vive no ciclo, conta vive no mês**.
Ambas são "foto do presente" (o saldo/estado *agora*), distintas da projeção
mensal da Home.

**Aba Cartões.**

- **Sem seletor de mês** no header (só o menu). Cartão não tem mês — cada um está
  num ponto diferente do próprio ciclo (§4.4). Colocar um seletor de mês aqui
  mexeria em uns cartões e não em outros; a ausência é a decisão.
- Lista de **cards compactos** de cartão, um por cartão, **ordenados por dia de
  vencimento** (o mais próximo no topo), com divisória entre eles.
- Cada card mostra o **ciclo vivo** (§4.4): tag de fase (ABERTA/FECHADA), valor
  realizado, barra + Previsto Restante (quando há previsão), e "fecha/vence DD
  mmm". Tocar abre o drill-down (§5.3) no ciclo vivo.

**Aba Contas — sub-navegação Conta Corrente | Cofre.**

- **Header com mês** (contas têm mês — aqui o seletor faz sentido pleno, todas as
  contas compartilham o mesmo calendário).
- **Sub-tabs internas** (Conta Corrente | Cofre) — estado local da aba, **não**
  mexem na navegação inferior.
- **Conta Corrente:** cards compactos de conta (ícone temático + nome + **Saldo
  Atual** + **Entradas/Saídas** do mês exibido). Saldo Atual é a foto do presente
  (corte = hoje, §4.7); Entradas/Saídas acompanham o mês navegado.
- **Cofre:** cards compactos de poupança, **mesmo layout** da conta, legendas
  próprias — **Guardado** (saldo, foto do presente) / **Depositos** / **Retiradas**
  (do mês exibido). **Sem totalização** aqui (o "TOTAL GUARDADO" continua só na
  tela de gestão do Cofre, §5.4). Tocar numa poupança abre o drill-down (§5.4).

> A tela de Cofre com "TOTAL GUARDADO" (§5.4) **não** é substituída — ela é a área
> de **gestão**; a aba Contas → Cofre é **visualização**. A separação
> gestão × dados é intencional e ainda será organizada no design (§8).

### 5.7 Editar lançamento (bottom sheet)

Acionada pelo ícone discreto de editar na linha (§5.1). Para um lançamento
**avulso**, é um clone do sheet de Lançar (§5.2) com os campos pré-preenchidos,
mais o botão **Excluir** (mora aqui dentro, não na lista — evita toque
acidental).

Para uma ocorrência de **série** (parcela/recorrência), o fluxo muda na v0.8:

- Botão **Excluir** presente, como no avulso.
- A flag `assinatura` é da **série** (§3.3): alterá-la afeta a série conforme o
  escopo, não uma ocorrência isolada.

**Escopo é o primeiro passo (v0.8 — inverte a v0.7).** Ao abrir a edição de uma
ocorrência de série, a **primeira** escolha é o escopo — **só esta · esta e as
futuras · todas** — e ela **define quais campos e mudanças o editor oferece**:

- **Só esta** → leque completo. Além de grandeza (valor/descrição/nota), permite
  **natureza** (data, conta, cartão) e **cardinalidade** (à vista ↔ parcelar).
  Qualquer mudança de natureza/cardinalidade **desvincula** a ocorrência (§4.3):
  vira um lançamento avulso — e, no caso de parcelar, o editor abre as opções de
  parcelamento no próprio sheet e salva de uma vez (remove da série + cria o
  parcelado). Um aviso claro sinaliza que a ocorrência sairá da série.
- **Esta e as futuras / Todas** → só o que a série inteira comporta: grandeza e
  natureza-de-regra (trocar banco para todos, mudar dia-âncora, mudar meio à
  vista). **Parcelar não aparece** (não faz sentido em múltiplos meses). Nada
  desvincula: edita-se a regra (mantendo o `serie_id` no "futuras", §4.3).

**Por que o escopo vem antes (revoga a v0.7).** Na v0.7 o escopo era perguntado
*ao salvar* — correto quando só se editava valor. Com natureza e cardinalidade
(§4.3), *o que é possível editar depende do escopo*; perguntar depois levaria o
usuário a configurar algo (ex.: parcelar) para no fim ouvir "não pode" — atrito e
frustração, contra o princípio 1 e o princípio 4. **A pergunta de escopo obedece
à experiência, não o contrário.** Some, portanto, o antigo bloqueio de troca de
conta/cartão que só avisava ao salvar.

- **É um bottom sheet** (não um modal de alerta): escolha de fluxo de três
  caminhos, parte normal de mexer numa recorrência, e melhor para uso de uma mão
  (princípio 1). A variante `Escopo` **não** vive no component set `Modal de
  alerta`.
- **Exceção destrutiva — excluir "todas":** após a escolha de escopo, vem um
  **segundo passo** de **confirmação de bloqueio** (aí sim um modal), porque apaga
  passado consolidado (§4.3). "Só esta" e "esta e as futuras" **não** disparam
  essa confirmação.
- **Aviso de desvínculo** (natureza/cardinalidade no "só esta"): sinalização
  clara de que a ocorrência deixará a série e virará avulso — via `Modal de
  alerta` variante Aviso. É a "junta" que torna o desvínculo explícito, nunca
  silencioso (microcópia a definir; não implementado ainda).

### 5.8 Gestão (implícito)

- Criar/editar **contas**, **cartões** e **poupanças** — todas pelo mesmo padrão
  de gestão (não dentro do Cofre). Cada uma com seletor de **tema** + **ícone**
  (§4.9).
- **Apagar** e **arquivar** seguem §4.10: apagar exige conta vazia; arquivar
  exige saldo zero. Contas arquivadas saem da gestão ativa (podem ter uma área
  "arquivadas" separada, a definir no design).
- **Cartão:** o campo de valor usa o vocabulário de **previsão** (§4.4), não
  "limite".

---

## 6. Segurança & acesso

### Modelo de acesso (auth)

- **Usuário único compartilhado** no Supabase Auth. Coerente com o princípio de
  conta única (§1): o casal compartilha **um** login; todos veem e editam tudo,
  **sem distinção de autoria** na v1. Não há multiusuário com permissões.
- **Credencial = email + senha.** O email é um **identificador de login**, a
  definir no provisionamento — **não precisa ser um endereço em uso ativo**.
  Decisão deixada deliberadamente em aberto neste nível: não afeta nenhuma regra
  de produto nem as telas.
- **RLS deliberadamente permissiva.** As policies liberam para **qualquer usuário
  autenticado** (`auth.role() = 'authenticated'`) e **não** filtram por
  `user_id`. Registrado explicitamente por ser o **oposto** do padrão sugerido
  pelo Supabase — é **decisão, não descuido**. Com usuário único é quase trivial;
  fica gravado para não quebrar caso um dia vire dois usuários.
- **Sem signup e sem recuperação de senha in-app.** O usuário é criado
  **manualmente** no painel do Supabase. Troca/reset de senha = **alteração
  direta na base**. Não há tela de cadastro nem de "esqueci a senha". Reset in-app
  por email fica **adiado** (§8) — reconsiderar só se o app ganhar mais usuários
  ou perder o acesso direto ao backend. Decisão consciente, não omissão.

### Sessão

- **Login Supabase com sessão persistente.** O usuário digita a senha **uma
  vez por aparelho** (no primeiro acesso / ao instalar na tela inicial) e fica
  logado por longos períodos. Não há login repetido no dia a dia.
- Justificativa: o app fica numa URL pública; sem parede, a renda (dado
  sensível) ficaria exposta e qualquer um poderia editar/apagar dados. A sessão
  persistente concilia o princípio 1 (zero fricção) com a proteção mínima
  necessária.
- O app abre direto na Home; o atrito de segurança é sentido uma única vez.

---

## 7. Stack & deploy (proposto)

- **Front-end:** React.
- **Banco/Auth:** Supabase (Postgres + Auth, plano grátis).
- **Hospedagem:** Vercel conectada ao repositório no GitHub (build automático,
  URL acessível pelo celular, instalável na tela inicial como PWA).
- **Fluxo:** desenhar no Figma → implementar a partir do design → plugar
  Supabase (schema desta doc) → subir no GitHub → deploy na Vercel.

---

## 8. Decisões em aberto / a refinar no Figma

Honestamente ainda **não** decidido — fica para a fase de design:

- **Microcópia** (textos de botões, rótulos, mensagens de estado vazio/erro) —
  exceto o vocabulário de cartão ("previsão", não "limite"), já travado em §4.4.
- **Paleta e tipografia finais** (o protótipo usou estética de livro-razão como
  ponto de partida, não como decisão final).
- **Elemento exato** da escolha conta/cartão e do seletor de repetição (toggle,
  segmented control, chips) — incluindo o **toggle ternário** Saída/Entrada/
  Transferência (§5.2) — a spec só fixa que a escolha existe e como se comporta.
- **Atribuição de cor de categoria — hash × ordem de aparição** (§5.5): hash dá
  cor estável por nome (risco mínimo de colisão entre as categorias visíveis);
  ordem de aparição dá zero colisão entre visíveis, mas a cor muda se uma
  categoria é renomeada/removida. **Começar no hash; trocável depois.** É decisão
  de código, não de modelo.
- **Reset de senha in-app por email** (§6) — **adiado**. Hoje o usuário é criado
  e tem a senha trocada direto no painel do Supabase. Reconsiderar só se o app
  ganhar mais usuários ou se perder o acesso direto ao backend.
- **Área de contas arquivadas** na gestão (§5.8) — onde e como listar contas
  arquivadas (se é que se listam).
- **Animação/transição** do bottom sheet.
- **Comportamento fino do autocomplete** (quantas sugestões, ordenação exata).
- **Horizonte de 24 meses:** confirmado como ponto de partida; ajustável se na
  prática ficar curto ou longo.
- **Ícone e identidade** do app na tela inicial.
- **Limites de navegação de ciclo no drill-down** (§5.3) — hoje as setas navegam
  indefinidamente. A definir: trava para trás no primeiro ciclo com compra, para
  frente no horizonte de 24 meses.
- **Organização da área de gestão (gestão × dados)** — o app hoje mistura telas
  de gestão (criar/editar conta, cartão, poupança; Cofre com TOTAL GUARDADO) com
  as de visualização (§5.6). A separação Cartões/Contas foi o primeiro passo; o
  layout definitivo da área gerencial ainda será desenhado (§5.4, §5.8).
