// Motor de recorrência (§4.1) — materialização read-time.
//
// Uma recorrência/parcelamento é uma REGRA (uma linha no banco), não N linhas.
// Este módulo expande regras em OCORRÊNCIAS concretas para um mês específico,
// na leitura. Nada é gravado. Funções puras, sem dependência de React/Supabase
// — testáveis isoladamente e ponto único onde as exceções de série (§4.3) vão
// plugar quando a edição existir.
//
// Regras honradas:
//  - À vista: 1 ocorrência no mês da data.
//  - Parcelar (N): N ocorrências mensais, cada uma valendo valor ÷ N. Tem fim.
//  - Recorrente (N vezes | indefinido): repete o valor/mês. Indefinido é
//    cortado no HORIZONTE (hoje + 24 meses); com fim, aparece sempre.
//  - Âncora no dia do mês + clamp 29–31 no último dia, voltando ao dia-âncora
//    nos meses que comportam. Nunca transborda para o mês seguinte (princípio 2).

import type { Lancamento, Transferencia, ExcecaoSerie, Conta, Cartao, Pagamento, CartaoCiclo } from '../types/db';

/** Horizonte de projeção: meses à frente de hoje para recorrência indefinida. */
export const HORIZONTE_MESES = 24;

/** Quantos meses para trás varrer ao montar as compras de um ciclo (§5.3). Num
 *  regime estável, 1 basta; com regime versionado, um ciclo-ponte ("furar o
 *  mês") pode abranger mais. 2 cobre folgadamente qualquer ponte plausível — a
 *  atribuição real é feita por cicloDeFechamentoAbs, isto é só o range de busca. */
const JANELA_CICLO_MESES = 2;

/**
 * Índice de exceções para consulta O(1) no motor: serie_id → (mes_alvo → exceção).
 * Chave = mês (YYYY-MM), não a data completa: a série tem no máximo uma
 * ocorrência por mês, e chavear por mês torna a exceção imune a mudanças de
 * dia-âncora (mudar o dia da regra não órfana as exceções). Construído uma vez
 * na Home e passado para a expansão.
 */
export type IndiceExcecoes = Map<string, Map<string, ExcecaoSerie>>;

/** Mês (YYYY-MM) de uma data ISO YYYY-MM-DD. */
export function mesDe(iso: string): string {
  return iso.slice(0, 7);
}

export function indexarExcecoes(excecoes: ExcecaoSerie[]): IndiceExcecoes {
  const idx: IndiceExcecoes = new Map();
  for (const e of excecoes) {
    let porMes = idx.get(e.serie_id);
    if (!porMes) { porMes = new Map(); idx.set(e.serie_id, porMes); }
    porMes.set(e.mes_alvo, e);
  }
  return idx;
}

/**
 * Índice de pagamentos efetivos por cartão+ciclo: cartao_id → (ciclo_abs →
 * pagamento). A fatura de um ciclo tem no máximo um pagamento efetivo. Quando
 * presente, a `data_paga` sobrepõe o `dia_pagamento` da regra (§4.4): rege em
 * que MÊS e em que DIA a fatura pesa no saldo (princípio 2 — a data manda).
 */
export type IndicePagamentos = Map<string, Map<number, Pagamento>>;

export function indexarPagamentos(pagamentos: Pagamento[]): IndicePagamentos {
  const idx: IndicePagamentos = new Map();
  for (const p of pagamentos) {
    let porCiclo = idx.get(p.cartao_id);
    if (!porCiclo) { porCiclo = new Map(); idx.set(p.cartao_id, porCiclo); }
    porCiclo.set(p.ciclo_abs, p);
  }
  return idx;
}

/**
 * Índice de regimes de ciclo por cartão (Fase 2): cartao_id → lista de mudanças
 * ORDENADA por `desde_ciclo_abs` crescente. Versiona dia_fechamento/dia_pagamento
 * no tempo sem reescrever o passado (§4.3, princípio 3). Um cartão sem mudança
 * não aparece no mapa; o motor cai no regime-base (campos de `cartoes`).
 */
export type IndiceCiclos = Map<string, CartaoCiclo[]>;

export function indexarCiclos(ciclos: CartaoCiclo[]): IndiceCiclos {
  const idx: IndiceCiclos = new Map();
  for (const c of ciclos) {
    let lista = idx.get(c.cartao_id);
    if (!lista) { lista = []; idx.set(c.cartao_id, lista); }
    lista.push(c);
  }
  for (const lista of idx.values()) lista.sort((a, b) => a.desde_ciclo_abs - b.desde_ciclo_abs);
  return idx;
}

/**
 * Regime (par fechamento/pagamento) VIGENTE de um cartão num ciclo de FECHAMENTO
 * `cicloAbs`. Fonte única do par temporal — todo o motor deve passar por aqui em
 * vez de ler `cartao.dia_*` cru.
 *
 * Regra: o regime vigente é a mudança de MAIOR `desde_ciclo_abs ≤ cicloAbs`;
 * não havendo nenhuma, o REGIME-BASE (campos de `cartoes`, que valem desde
 * sempre). `ciclos` omitido/vazio → sempre o regime-base (retrocompatível com
 * todos os cartões atuais).
 */
export function regimeDoCiclo(
  cartao: Cartao,
  cicloAbs: number,
  ciclos?: IndiceCiclos,
): { dia_fechamento: number; dia_pagamento: number } {
  const lista = ciclos?.get(cartao.id);
  if (lista && lista.length > 0) {
    // Lista ordenada asc: o último com desde_ciclo_abs ≤ cicloAbs é o vigente.
    let vigente: CartaoCiclo | null = null;
    for (const c of lista) {
      if (c.desde_ciclo_abs <= cicloAbs) vigente = c;
      else break;
    }
    if (vigente) return { dia_fechamento: vigente.dia_fechamento, dia_pagamento: vigente.dia_pagamento };
  }
  return { dia_fechamento: cartao.dia_fechamento, dia_pagamento: cartao.dia_pagamento };
}

/** Parte uma data YYYY-MM-DD em [ano, mes(0-11), dia], sem fuso. */
export function parteData(iso: string): [number, number, number] {
  const [a, m, d] = iso.split('-').map(Number);
  return [a, m - 1, d];
}

/** Índice de mês absoluto (ano*12 + mes), para aritmética de meses sem fuso. */
function indiceMes(ano: number, mes: number): number {
  return ano * 12 + mes;
}

/** Último dia de um mês (1-based no dia). */
function ultimoDia(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate();
}

/** Dia-âncora aplicado a um mês, com clamp no último dia (29–31 → 28/30…). */
export function diaAncoraNoMes(diaAncora: number, ano: number, mes: number): number {
  return Math.min(diaAncora, ultimoDia(ano, mes));
}

/** Monta YYYY-MM-DD a partir de partes (mes 0-11). */
function montaISO(ano: number, mes: number, dia: number): string {
  const mm = String(mes + 1).padStart(2, '0');
  const dd = String(dia).padStart(2, '0');
  return `${ano}-${mm}-${dd}`;
}

/** Uma ocorrência concreta de um lançamento, já resolvida para um mês. */
export interface OcorrenciaLancamento {
  /** Id sintético estável: regra + índice da ocorrência (1-based). */
  id: string;
  /** Id da regra de origem (a linha no banco). */
  origemId: string;
  serieId: string | null;
  tipo: Lancamento['tipo'];
  /** Repetição da regra de origem — distingue parcela de recorrente (§5.7). */
  repeticao: Lancamento['repeticao'];
  /** Valor já resolvido: total÷parcelas no parcelamento; o valor/mês no resto. */
  valor: number;
  descricao: string;
  data: string; // YYYY-MM-DD calculada para este mês
  conta_id: string;
  cartao_id: string | null;
  assinatura: boolean;
  /** Posição na série (1-based). 1 para à vista. */
  indice: number;
  /** Total de ocorrências da série, quando finita (N parcelas / N vezes). */
  total: number | null;
}

/** Ocorrência concreta de uma transferência, resolvida para um mês. */
export interface OcorrenciaTransferencia {
  id: string;
  origemId: string;
  serieId: string | null;
  valor: number;
  data: string;
  de_conta_id: string;
  para_conta_id: string;
  descricao: string | null;
  indice: number;
  total: number | null;
}

/**
 * Decide se a ocorrência de índice `i` (0-based) de uma regra mensal cai no
 * mês alvo, e devolve a data resolvida — ou null se não cai / extrapola.
 *
 * `inicio` é a data da 1ª ocorrência (a `data` da regra). A i-ésima ocorrência
 * mora `i` meses depois, no mesmo dia-âncora (com clamp).
 */
function dataDaOcorrencia(
  inicioAno: number,
  inicioMes: number,
  diaAncora: number,
  i: number,
): { ano: number; mes: number; dia: number } {
  const abs = indiceMes(inicioAno, inicioMes) + i;
  const ano = Math.floor(abs / 12);
  const mes = abs % 12;
  return { ano, mes, dia: diaAncoraNoMes(diaAncora, ano, mes) };
}

/**
 * Quantos meses de projeção exibir para uma regra mensal num mês alvo.
 * Devolve o índice (0-based) da ocorrência que cai no mês alvo, ou -1 se a
 * regra não produz ocorrência nesse mês.
 */
function indiceNoMesAlvo(
  inicioAno: number,
  inicioMes: number,
  alvoAno: number,
  alvoMes: number,
): number {
  const i = indiceMes(alvoAno, alvoMes) - indiceMes(inicioAno, inicioMes);
  return i >= 0 ? i : -1;
}

/**
 * Expande os lançamentos (regras) que produzem ocorrência no mês (alvoAno,
 * alvoMes). `hoje` define o horizonte móvel para recorrência indefinida.
 */
export function lancamentosNoMes(
  regras: Lancamento[],
  alvoAno: number,
  alvoMes: number,
  hoje: Date,
  excecoes?: IndiceExcecoes,
): OcorrenciaLancamento[] {
  const horizonteAbs = indiceMes(hoje.getFullYear(), hoje.getMonth()) + HORIZONTE_MESES;
  const alvoAbs = indiceMes(alvoAno, alvoMes);
  const out: OcorrenciaLancamento[] = [];

  /** Aplica a exceção da série naquela data, se houver. Devolve null se a
   *  ocorrência foi excluída ("só esta" excluída); senão a ocorrência (com
   *  overrides de valor/descrição aplicados). */
  function comExcecao(oc: OcorrenciaLancamento): OcorrenciaLancamento | null {
    if (!excecoes || !oc.serieId) return oc;
    const e = excecoes.get(oc.serieId)?.get(mesDe(oc.data));
    if (!e) return oc;
    if (e.excluida) return null;
    return {
      ...oc,
      valor: e.valor ?? oc.valor,
      descricao: e.descricao ?? oc.descricao,
    };
  }

  for (const r of regras) {
    const [ia, im, dia] = parteData(r.data);

    if (r.repeticao === 'avista') {
      if (ia === alvoAno && im === alvoMes) {
        const oc = comExcecao(mapLanc(r, r.valor, r.data, 1, null));
        if (oc) out.push(oc);
      }
      continue;
    }

    const i = indiceNoMesAlvo(ia, im, alvoAno, alvoMes);
    if (i < 0) continue; // mês alvo é anterior ao início

    if (r.repeticao === 'parcelar') {
      const n = r.parcelas ?? 1;
      if (i >= n) continue; // já terminou de parcelar
      const { ano, mes, dia: d } = dataDaOcorrencia(ia, im, dia, i);
      const oc = comExcecao(mapLanc(r, r.valor / n, montaISO(ano, mes, d), i + 1, n));
      if (oc) out.push(oc);
      continue;
    }

    // recorrente
    if (r.repeticao === 'recorrente') {
      const n = r.recorrencia_fim; // nº de vezes; null = indefinida
      if (n != null && i >= n) continue; // série finita já terminou
      // Indefinida: corta no horizonte (só projeção futura além de hoje+24m).
      if (n == null && alvoAbs > horizonteAbs) continue;
      const { ano, mes, dia: d } = dataDaOcorrencia(ia, im, dia, i);
      const oc = comExcecao(mapLanc(r, r.valor, montaISO(ano, mes, d), i + 1, n));
      if (oc) out.push(oc);
    }
  }

  return out;
}

/** Expande transferências (à vista ou recorrente; nunca parcela — §3.4). */
export function transferenciasNoMes(
  regras: Transferencia[],
  alvoAno: number,
  alvoMes: number,
  hoje: Date,
): OcorrenciaTransferencia[] {
  const horizonteAbs = indiceMes(hoje.getFullYear(), hoje.getMonth()) + HORIZONTE_MESES;
  const alvoAbs = indiceMes(alvoAno, alvoMes);
  const out: OcorrenciaTransferencia[] = [];

  for (const r of regras) {
    const [ia, im, dia] = parteData(r.data);

    if (r.repeticao === 'avista') {
      if (ia === alvoAno && im === alvoMes) out.push(mapTransf(r, r.data, 1, null));
      continue;
    }

    const i = indiceNoMesAlvo(ia, im, alvoAno, alvoMes);
    if (i < 0) continue;
    const n = r.recorrencia_fim;
    if (n != null && i >= n) continue;
    if (n == null && alvoAbs > horizonteAbs) continue;
    const { ano, mes, dia: d } = dataDaOcorrencia(ia, im, dia, i);
    out.push(mapTransf(r, montaISO(ano, mes, d), i + 1, n));
  }

  return out;
}

function mapLanc(
  r: Lancamento,
  valor: number,
  data: string,
  indice: number,
  total: number | null,
): OcorrenciaLancamento {
  return {
    id: `${r.serie_id ?? r.id}#${indice}`,
    origemId: r.id,
    serieId: r.serie_id,
    tipo: r.tipo,
    repeticao: r.repeticao,
    valor,
    descricao: r.descricao,
    data,
    conta_id: r.conta_id,
    cartao_id: r.cartao_id,
    assinatura: r.assinatura,
    indice,
    total,
  };
}

function mapTransf(
  r: Transferencia,
  data: string,
  indice: number,
  total: number | null,
): OcorrenciaTransferencia {
  return {
    id: `${r.serie_id ?? r.id}#${indice}`,
    origemId: r.id,
    serieId: r.serie_id,
    valor: r.valor,
    data,
    de_conta_id: r.de_conta_id,
    para_conta_id: r.para_conta_id,
    descricao: r.descricao,
    indice,
    total,
  };
}

// ───────── Divisão de série: "esta e as futuras" (§4.3, Fase 2) ─────────
//
// Funções PURAS que calculam o plano de operações para o EditarSheet executar.
// Isolar a aritmética aqui permite testá-la sem tocar no Supabase.
//
// Recorrente (salvar): encerra a regra antiga no ponto de corte e cria uma
//   regra nova (MESMO serie_id) a partir da ocorrência editada, com o valor
//   novo. Indefinida → nova indefinida; finita (N) → nova com (N − corte).
// Recorrente/Parcelado (excluir, = "cancelar"): só encerra a regra antiga.
// Parcelado (salvar): NÃO suportado nesta fase (ambíguo dividir um total).

/** O "índice de corte" é a posição (0-based) da ocorrência editada na série. */

export interface PlanoEncerrar {
  tipo: 'encerrar';
  /** Quantas ocorrências a regra antiga mantém (jan..corte-1). */
  manter: number;
  /** Campo a setar conforme a natureza da regra. */
  campo: 'recorrencia_fim' | 'parcelas';
}

export interface PlanoNovaRegra {
  /** valor/mês da nova fase. */
  valor: number;
  descricao: string;
  nota: string | null;
  /** data de início da nova regra (1ª ocorrência da nova fase). */
  data: string;
  /** recorrencia_fim da nova regra: null = indefinida; número = vezes restantes. */
  recorrencia_fim: number | null;
}

export interface PlanoDivisao {
  encerrar: PlanoEncerrar;
  /** Presente só no "salvar"; ausente no "excluir" (cancelamento). */
  novaRegra?: PlanoNovaRegra;
  /** Exceções a remover: as de mes_alvo >= o mês de corte (§ decisão). */
  removerExcecoesAPartirDe: string;
}

/**
 * Calcula o plano de "esta e as futuras".
 * @param regra      a linha-regra original (lancamentos)
 * @param corteData  a data resolvida da ocorrência editada (início da nova fase)
 * @param corteIndice posição 0-based da ocorrência editada na série
 * @param acao       'salvar' (dividir) ou 'excluir' (cancelar)
 * @param novos      valores novos da fase futura (só no salvar)
 */
export function planejarDivisao(
  regra: Lancamento,
  corteData: string,
  corteIndice: number,
  acao: 'salvar' | 'excluir',
  novos?: { valor: number; descricao: string; nota: string | null },
): PlanoDivisao {
  const encerrar: PlanoEncerrar = {
    tipo: 'encerrar',
    manter: corteIndice, // mantém ocorrências 0..corteIndice-1
    campo: regra.repeticao === 'parcelar' ? 'parcelas' : 'recorrencia_fim',
  };

  const plano: PlanoDivisao = { encerrar, removerExcecoesAPartirDe: mesDe(corteData) };

  if (acao === 'salvar') {
    if (regra.repeticao !== 'recorrente') {
      throw new Error('Divisão no salvar só é suportada para recorrente.');
    }
    if (!novos) throw new Error('Valores novos ausentes na divisão.');
    // vezes restantes: indefinida continua indefinida; finita perde o que a
    // fase antiga consumiu (corteIndice ocorrências).
    const fimAntigo = regra.recorrencia_fim;
    const fimNovo = fimAntigo == null ? null : Math.max(1, fimAntigo - corteIndice);
    plano.novaRegra = {
      valor: novos.valor,
      descricao: novos.descricao,
      nota: novos.nota,
      data: corteData,
      recorrencia_fim: fimNovo,
    };
  }

  return plano;
}

// ───────── Ciclo do cartão: fatura prevista × realizada (§4.4, §4.8) ─────────
//
// A fatura NÃO é tabela — é derivada. Este bloco é a FONTE ÚNICA que resolve,
// para um cartão num mês do saldo, quanto ela pesa. Home, lista e saldo contínuo
// consomem daqui — nada recalcula por conta própria.
//
// Dois eixos de tempo (§4.8):
//   - FECHAMENTO (dia_fechamento): decide QUAL ciclo de compras compõe a fatura
//     e quando a previsão vira realizado. O ciclo que FECHA no mês M contém
//     compras em [dia_fechamento de M−1, dia_fechamento de M). Compra antes do
//     fechamento entra na fatura que fecha nesse mês; a partir do fechamento,
//     na do mês seguinte.
//   - PAGAMENTO (dia_pagamento): decide EM QUE MÊS a fatura pesa no saldo. A
//     fatura que fecha em M vence em M se dia_pagamento > dia_fechamento, senão
//     em M+1. (Ex.: fecha 15, vence 20 → vence no mesmo mês; fecha 15, vence 05
//     → vence no mês seguinte.)
//
// Fase (§4.4), do ponto de vista de HOJE, no ciclo que fecha em (cicloAno,
// cicloMes):
//   - futura   → o mês de fechamento ainda não chegou. Pesa a PREVISÃO (o
//                placeholder segura o lugar no saldo projetado). Sem realizado
//                ainda (ou parcial); a barra enche em runtime.
//   - aberta   → estamos no mês de fechamento, antes do dia_fechamento. Pesa
//                max(previsão, realizado): o placeholder segura, mas se o gasto
//                já passou, o real manda (a barra estoura).
//   - fechada  → passou o dia_fechamento (ou o mês de fechamento já passou). A
//                previsão morre; pesa só o REALIZADO consolidado. Fato é fato.
//
// Sem previsão (previsao_mensal null): não há placeholder; futura/aberta pesam
// o próprio realizado acumulado (sem barra — o componente já se auto-esconde).

/** Índice de mês absoluto do ciclo que FECHA contendo uma compra na data dada.
 *
 *  Regra única (Fase 2, §4.8 + doc-fase2): a compra pertence à PRIMEIRA fatura
 *  cujo FECHAMENTO ainda não passou na data da compra. Com regime versionado
 *  (`cartoes_ciclos`), o dia de fechamento de cada ciclo candidato pode diferir,
 *  então não basta comparar com um dia fixo: avaliamos o fechamento do ciclo do
 *  mês da compra e, se já passou, o do mês seguinte. A duração do ciclo é
 *  emergente (30 ou ~47 dias); não há entidade "fatura-ponte".
 *
 *  Retrocompatível: sem `ciclos` (ou cartão sem mudança), regimeDoCiclo devolve
 *  o campo-base em todos os candidatos e o resultado é idêntico ao antigo
 *  `d < diaFechamento ? base : base + 1`. */
function cicloDeFechamentoAbs(dataISO: string, cartao: Cartao, ciclos?: IndiceCiclos): number {
  const [a, m, d] = parteData(dataISO);
  const base = indiceMes(a, m);
  // Fechamento do ciclo do próprio mês da compra (com clamp de dia curto).
  const fechBase = diaAncoraNoMes(regimeDoCiclo(cartao, base, ciclos).dia_fechamento, a, m);
  // Compra estritamente antes do fechamento do mês → fecha nesse ciclo; a partir
  // do dia de fechamento (inclusive) → cai no ciclo seguinte.
  return d < fechBase ? base : base + 1;
}

/** PISO de uma mudança de regime (Fase 2b, adendo Mudança 3): o menor
 *  `desde_ciclo_abs` que o usuário pode escolher ao mudar as datas de um cartão.
 *  NÃO é a âncora — a âncora vem da DATA CONCRETA escolhida no date picker
 *  (`ancoraDeVencimento`). O piso só trava o picker.
 *
 *  Regra (dinâmica pelo momento do fechamento): é o PRIMEIRO ciclo cujo
 *  fechamento ainda não ocorreu. `cicloDeFechamentoAbs(hoje, regimeVelho)` já
 *  devolve exatamente isso — o ciclo do próprio mês enquanto hoje está antes do
 *  fechamento, e o do mês seguinte a partir do dia de fechamento (inclusive).
 *  Reflete a regra do banco: enquanto a fatura não fechou dá para remanejá-la;
 *  depois de fechar virou obrigação a pagar e é intocável. (Sem `+1`: o `+1` da
 *  versão derivada anterior empurrava tudo um mês à frente — era o bug que
 *  desencontrava o app do banco.) */
export function pisoMudancaDeRegime(cartao: Cartao, hoje: Date, ciclos?: IndiceCiclos): number {
  const hojeISO = montaISO(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return cicloDeFechamentoAbs(hojeISO, cartao, ciclos);
}

/** Converte a DATA CONCRETA de próximo vencimento (escolhida no date picker) no
 *  `desde_ciclo_abs` a partir do qual o regime novo vale (Fase 2b, Mudança 2).
 *  A data escolhida É a fonte da verdade da âncora — o banco define um fato
 *  ("vence 15/ago"), não uma derivação. O ciclo de FECHAMENTO correspondente ao
 *  vencimento usa a mesma regra de offset do motor (§4.8): vencimento depois do
 *  fechamento → mesmo mês do ciclo; senão → mês seguinte. */
export function ancoraDeVencimento(vencISO: string, diaFechamento: number, diaPagamento: number): number {
  const [a, m] = parteData(vencISO);
  const mesVencAbs = indiceMes(a, m);
  return diaPagamento > diaFechamento ? mesVencAbs : mesVencAbs - 1;
}

/** Prévia da migração de faturas ao mudar o dia de FECHAMENTO (Fase 2b, Mudança
 *  3b). Muda de fechamento reclassifica lançamentos do ciclo corrente que cruzam
 *  a nova fronteira: o motor faz isso automaticamente e corretamente, mas o valor
 *  de uma fatura muda em relação ao que o usuário esperava — então mostramos um
 *  aviso explícito (princípios 3 e 4) antes de confirmar.
 *
 *  Compara, para os lançamentos do cartão que caem no ciclo corrente (o piso —
 *  onde a mudança vai valer), o ciclo atribuído sob o regime VELHO vs. o NOVO.
 *  Os que diferem são os que migram. Retorna quantos entram e quantos saem do
 *  ciclo-alvo. `desdeAbs` é a âncora da mudança (ciclo onde o regime novo passa
 *  a valer). Não altera nada — é só leitura para o aviso. */
export function migracaoAoMudarFechamento(
  lancamentos: Lancamento[],
  cartaoBase: Cartao,
  desdeAbs: number,
  fechNovo: number,
  pagNovo: number,
  hoje: Date,
  excecoes?: IndiceExcecoes,
): { entram: number; saem: number } {
  // Cartões sintéticos: só os campos de dia importam para cicloDeFechamentoAbs,
  // e sem índice de ciclos ambos caem no regime-base (os dias que passamos).
  const velho: Cartao = { ...cartaoBase };
  const novo: Cartao = { ...cartaoBase, dia_fechamento: fechNovo, dia_pagamento: pagNovo };

  // Lançamentos do cartão que, sob o regime NOVO, pertenceriam ao ciclo-alvo
  // (desdeAbs). Varremos uma janela generosa de meses ao redor (o ciclo pode ser
  // ponte). Para cada um, comparamos o ciclo sob velho vs novo.
  const doCartao = lancamentos.filter((l) => l.cartao_id === cartaoBase.id);
  let entram = 0;
  let saem = 0;
  for (let mAbs = desdeAbs - JANELA_CICLO_MESES; mAbs <= desdeAbs + JANELA_CICLO_MESES; mAbs++) {
    if (mAbs < 0) continue;
    const ano = Math.floor(mAbs / 12);
    const mes = mAbs % 12;
    for (const oc of lancamentosNoMes(doCartao, ano, mes, hoje, excecoes)) {
      const cVelho = cicloDeFechamentoAbs(oc.data, velho); // sem ciclos: regime-base = dias velhos
      const cNovo = cicloDeFechamentoAbs(oc.data, novo);
      if (cVelho === cNovo) continue; // não migrou
      // Entra no alvo: sob o novo passa a pertencer ao ciclo-alvo, sob o velho não.
      if (cNovo === desdeAbs && cVelho !== desdeAbs) entram++;
      // Sai do alvo: sob o velho pertencia ao alvo, sob o novo não.
      else if (cVelho === desdeAbs && cNovo !== desdeAbs) saem++;
    }
  }
  return { entram, saem };
}

export type FaseCiclo = 'futura' | 'aberta' | 'fechada';

/** Fase do ciclo que fecha em `cicloAbs`, do ponto de vista de `hoje` (§4.4). */
export function faseDoCiclo(cicloAbs: number, cartao: Cartao, hoje: Date, ciclos?: IndiceCiclos): FaseCiclo {
  const hojeAbs = indiceMes(hoje.getFullYear(), hoje.getMonth());
  if (cicloAbs < hojeAbs) return 'fechada'; // ciclo de mês já passado: consolidado
  if (cicloAbs > hojeAbs) return 'futura'; // ainda vai fechar num mês futuro
  // Mês de fechamento é o corrente: antes do dia_fechamento (do regime vigente
  // deste ciclo) = aberta; senão fechada.
  const diaFech = regimeDoCiclo(cartao, cicloAbs, ciclos).dia_fechamento;
  return hoje.getDate() >= diaFech ? 'fechada' : 'aberta';
}

/** Soma das compras (realizado) do ciclo que FECHA em `cicloAbs`, para um cartão.
 *  Expande as regras de lançamento (à vista/parcela/recorrente) e soma as que
 *  caem na janela [fechamento de M−1, fechamento de M). É o número que a barra
 *  e o drill-down mostram. */
export function realizadoDoCiclo(
  lancamentos: Lancamento[],
  cartao: Cartao,
  cicloAbs: number,
  hoje: Date,
  excecoes?: IndiceExcecoes,
  ciclos?: IndiceCiclos,
): number {
  let total = 0;
  for (const oc of ocorrenciasDoCiclo(lancamentos, cartao, cicloAbs, hoje, excecoes, ciclos)) {
    total += oc.valor;
  }
  return total;
}

/** Ocorrências de cartão que compõem o ciclo que fecha em `cicloAbs` (para o
 *  drill-down, §5.3). Materializa as regras nos meses que a janela do ciclo
 *  toca e filtra pela data de fechamento. */
export function ocorrenciasDoCiclo(
  lancamentos: Lancamento[],
  cartao: Cartao,
  cicloAbs: number,
  hoje: Date,
  excecoes?: IndiceExcecoes,
  ciclos?: IndiceCiclos,
): OcorrenciaLancamento[] {
  // O ciclo que fecha em cicloAbs abrange compras desde o fechamento anterior.
  // Num regime estável isso é 1 mês (janela [cicloAbs−1, cicloAbs]); mas com
  // regime versionado um ciclo-ponte ("furar o mês", ~47d) pode abranger mais de
  // um mês para trás. Expandimos uma janela generosa (JANELA_CICLO_MESES meses)
  // e deixamos a REGRA de atribuição (cicloDeFechamentoAbs) decidir — ela é a
  // fonte da verdade; o range só precisa ser amplo o bastante para não perder
  // compra. Ocorrências fora do ciclo são filtradas de qualquer forma.
  const doCartao = lancamentos.filter((l) => l.cartao_id === cartao.id);
  const out: OcorrenciaLancamento[] = [];
  for (let mAbs = cicloAbs - JANELA_CICLO_MESES; mAbs <= cicloAbs; mAbs++) {
    if (mAbs < 0) continue;
    const ano = Math.floor(mAbs / 12);
    const mes = mAbs % 12;
    for (const oc of lancamentosNoMes(doCartao, ano, mes, hoje, excecoes)) {
      if (cicloDeFechamentoAbs(oc.data, cartao, ciclos) === cicloAbs) out.push(oc);
    }
  }
  return out;
}

/** Peso "bruto" de um ciclo já identificado (max previsão/realizado por fase,
 *  §4.4). Não decide em que mês pesa — só quanto. Sempre ≥ 0. */
function pesoDoCiclo(
  lancamentos: Lancamento[],
  cartao: Cartao,
  cicloAbs: number,
  hoje: Date,
  excecoes?: IndiceExcecoes,
  ciclos?: IndiceCiclos,
): number {
  if (cicloAbs < 0) return 0;
  const realizado = realizadoDoCiclo(lancamentos, cartao, cicloAbs, hoje, excecoes, ciclos);
  const previsao = cartao.previsao_mensal;
  const fase = faseDoCiclo(cicloAbs, cartao, hoje, ciclos);
  if (previsao == null || previsao <= 0) return realizado; // sem previsão: só realizado
  if (fase === 'fechada') return realizado; // consolidado: fato é fato
  return Math.max(previsao, realizado); // aberta/futura: placeholder segura, real estoura
}

/** Mês (abs) em que a fatura de um ciclo VENCE por PADRÃO, pela regra de
 *  pagamento (§4.8): vencimento depois do fechamento → mesmo mês do ciclo;
 *  senão → mês seguinte. Usa o regime vigente do ciclo (Fase 2). */
function mesVencimentoPadraoAbs(cartao: Cartao, cicloAbs: number, ciclos?: IndiceCiclos): number {
  const r = regimeDoCiclo(cartao, cicloAbs, ciclos);
  return r.dia_pagamento > r.dia_fechamento ? cicloAbs : cicloAbs + 1;
}

/**
 * Onde a fatura de um ciclo pesa no saldo: { mesAbs, dia }. Se há pagamento
 * efetivo registrado (§4.4), é a `data_paga` que manda (mês E dia); senão, o
 * padrão pelo `dia_pagamento`. Fonte única para peso-por-mês e posicionamento
 * da linha na lista.
 */
export function posicaoFatura(
  cartao: Cartao,
  cicloAbs: number,
  pagamentos?: IndicePagamentos,
  ciclos?: IndiceCiclos,
): { mesAbs: number; dia: number } {
  const pago = pagamentos?.get(cartao.id)?.get(cicloAbs);
  if (pago) {
    const [a, m, d] = parteData(pago.data_paga);
    return { mesAbs: indiceMes(a, m), dia: d };
  }
  const mesAbs = mesVencimentoPadraoAbs(cartao, cicloAbs, ciclos);
  const diaPag = regimeDoCiclo(cartao, cicloAbs, ciclos).dia_pagamento;
  return { mesAbs, dia: diaAncoraNoMes(diaPag, Math.floor(mesAbs / 12), mesAbs % 12) };
}

/** Ciclos candidatos a VENCER no mês `alvoAbs`, para um cartão. Fonte única do
 *  range de varredura usado por todo consumidor de fatura-por-mês (faturaNoMes,
 *  faturaSaidaPorConta, liquidoDoMesPorConta, fluxoDoMes, e a montagem da linha
 *  na Home). Substitui o cálculo duplicado de `cicloPadrao` + vizinhos ±1.
 *
 *  Centro = o ciclo cujo vencimento-PADRÃO cai no alvo, pela regra de pagamento
 *  do regime vigente (Fase 2). Como um pagamento efetivo pode mover a fatura de
 *  até um mês e um ciclo-ponte pode deslocar o padrão, varremos ±JANELA_CICLO
 *  ao redor. Quem decide de fato é sempre posicaoFatura === alvo no chamador —
 *  este range só precisa CONTER o ciclo certo, sem falso-positivo (o chamador
 *  filtra). */
function ciclosCandidatos(cartao: Cartao, alvoAbs: number, ciclos?: IndiceCiclos): number[] {
  // Centro pela regra do regime do próprio alvo (aproximação — o filtro no
  // chamador corrige qualquer erro de ±1 introduzido por virada de regime).
  const rAlvo = regimeDoCiclo(cartao, alvoAbs, ciclos);
  const centro = rAlvo.dia_pagamento > rAlvo.dia_fechamento ? alvoAbs : alvoAbs - 1;
  const out: number[] = [];
  for (let c = centro - JANELA_CICLO_MESES; c <= centro + JANELA_CICLO_MESES; c++) {
    if (c >= 0) out.push(c);
  }
  return out;
}

/** Peso da fatura de um cartão no saldo do mês (alvoAno, alvoMes), aplicando
 *  ciclo + fase + max(previsão, realizado) (§4.4) e a data de pagamento efetiva
 *  (§4.4, quando houver). É a FONTE ÚNICA do débito de cartão no fluxo de caixa;
 *  sempre ≥ 0. Devolve 0 se nenhuma fatura pesa nesse mês.
 *
 *  Um pagamento efetivo pode MOVER a fatura entre meses (adiantar/atrasar,
 *  dentro do ciclo — §5.3), então somamos aqui TODOS os ciclos cuja posição
 *  (efetiva ou padrão) cai no mês alvo, não só o ciclo do padrão. */
export function faturaNoMes(
  lancamentos: Lancamento[],
  cartao: Cartao,
  alvoAno: number,
  alvoMes: number,
  hoje: Date,
  excecoes?: IndiceExcecoes,
  pagamentos?: IndicePagamentos,
  ciclos?: IndiceCiclos,
): number {
  const alvoAbs = indiceMes(alvoAno, alvoMes);
  let total = 0;
  for (const cicloAbs of ciclosCandidatos(cartao, alvoAbs, ciclos)) {
    if (posicaoFatura(cartao, cicloAbs, pagamentos, ciclos).mesAbs !== alvoAbs) continue;
    total += pesoDoCiclo(lancamentos, cartao, cicloAbs, hoje, excecoes, ciclos);
  }
  return total;
}

/** Fatura por CONTA PAGADORA no mês alvo, como valor de SAÍDA (sempre ≥ 0).
 *
 *  No eixo de fluxo de caixa (§4.8) a fatura É a soma das compras do cartão
 *  saindo da conta pagadora — logo pesa como saída DELA. Os cards da aba Contas
 *  (§5.6) usam isto para que Entradas/Saídas fechem com o saldo (que já debita a
 *  fatura via saldoAcumuladoPorConta). Antes só lançamentos de débito e
 *  transferências entravam nos dois números; a fatura ficava de fora e o card
 *  mentia (saldo −7k, saídas 0).
 *
 *  `corte` (ISO, opcional): só conta a fatura se o dia em que ela PESA (efetivo
 *  ou padrão) for ≤ corte — a mesma régua do saldo no mês corrente (foto de
 *  hoje). Sem corte, conta a fatura inteira do mês (previsão inclusa) — coerente
 *  com o mês futuro projetado. Espelha exatamente liquidoDoMesPorConta. */
/** Dia do mês (alvoAbs) em que a fatura de um cartão pesa, ou null se nenhuma.
 *  Percorre os ciclos candidatos e devolve o dia do primeiro cuja posição cai no
 *  alvo (efetiva/padrão). Fonte única do "que dia a fatura pesa neste mês",
 *  usada pelo corte de foto-de-hoje e pelo posicionamento no fluxo diário. */
export function diaFaturaNoMes(
  cartao: Cartao,
  alvoAbs: number,
  pagamentos?: IndicePagamentos,
  ciclos?: IndiceCiclos,
): { cicloAbs: number; dia: number } | null {
  for (const c of ciclosCandidatos(cartao, alvoAbs, ciclos)) {
    const pos = posicaoFatura(cartao, c, pagamentos, ciclos);
    if (pos.mesAbs === alvoAbs) return { cicloAbs: c, dia: pos.dia };
  }
  return null;
}

export function faturaSaidaPorConta(
  lancamentos: Lancamento[],
  cartoes: Cartao[],
  alvoAno: number,
  alvoMes: number,
  hoje: Date,
  excecoes?: IndiceExcecoes,
  pagamentos?: IndicePagamentos,
  corte?: string,
  ciclos?: IndiceCiclos,
): Map<string, number> {
  const m = new Map<string, number>();
  const alvoAbs = indiceMes(alvoAno, alvoMes);
  for (const k of cartoes) {
    const peso = faturaNoMes(lancamentos, k, alvoAno, alvoMes, hoje, excecoes, pagamentos, ciclos);
    if (peso === 0) continue;
    if (corte != null) {
      const pos = diaFaturaNoMes(k, alvoAbs, pagamentos, ciclos);
      if (pos != null && montaISO(alvoAno, alvoMes, pos.dia) > corte) continue;
    }
    m.set(k.conta_id, (m.get(k.conta_id) ?? 0) + peso);
  }
  return m;
}

/** Dia do mês em que a fatura de um cartão pesa no saldo. Sem pagamento
 *  efetivo, é o `dia_pagamento` com clamp (§4.1); usado pela lista para
 *  posicionar a linha. Mantido por compatibilidade — a lista agora usa
 *  posicaoFatura para honrar a data efetiva. */
export function diaPagamentoNoMes(cartao: Cartao, ano: number, mes: number, ciclos?: IndiceCiclos): number {
  const diaPag = regimeDoCiclo(cartao, indiceMes(ano, mes), ciclos).dia_pagamento;
  return diaAncoraNoMes(diaPag, ano, mes);
}

/** Limites do intervalo válido de data de pagamento de um ciclo (§5.3):
 *  [dia_fechamento do ciclo, dia_fechamento do próximo) — adiantar (a partir do
 *  fechamento) ou atrasar é livre; cruzar o próximo fechamento não (não
 *  encavala dois pagamentos). Devolve as datas ISO min (inclusiva) e max
 *  (exclusiva) para travar o seletor de data. Cada extremo usa o dia de
 *  fechamento do REGIME vigente do respectivo ciclo (Fase 2). */
export function intervaloPagamento(
  cartao: Cartao,
  cicloAbs: number,
  ciclos?: IndiceCiclos,
): { min: string; maxExclusivo: string } {
  const anoC = Math.floor(cicloAbs / 12);
  const mesC = cicloAbs % 12;
  const diaFech = diaAncoraNoMes(regimeDoCiclo(cartao, cicloAbs, ciclos).dia_fechamento, anoC, mesC);
  const min = montaISO(anoC, mesC, diaFech);
  const prox = cicloAbs + 1;
  const anoP = Math.floor(prox / 12);
  const mesP = prox % 12;
  const diaFechProx = diaAncoraNoMes(regimeDoCiclo(cartao, prox, ciclos).dia_fechamento, anoP, mesP);
  const maxExclusivo = montaISO(anoP, mesP, diaFechProx);
  return { min, maxExclusivo };
}

/** Status do cartão na aba CARTEIRA (§5.6) — a "foto do presente" do ciclo, não
 *  do mês exibido. Diferente da lista da Home (eixo fluxo de caixa, pela data de
 *  pagamento): aqui a pergunta é "qual fatura está viva AGORA".
 *
 *  Regra (travada em sessão): duas fases, uma virada governada por hoje-vs-dia
 *  de vencimento (§4.8). Não existe "atrasado" no modelo — o dia de vencimento
 *  (padrão pelo `dia_pagamento`, ou efetivo se há `data_paga` em
 *  `cartoes_pagamentos`) É o pagamento na cabeça do app; passou dele, a fatura
 *  saiu do fluxo:
 *   - FECHADA (obrigação pendente): o ciclo anterior já fechou e hoje ainda não
 *     passou do seu vencimento → mostra o consolidado a pagar ("vence DD mmm").
 *   - ABERTA (acumulando): não há fechada pendente → mostra o ciclo corrente
 *     enchendo ("fecha DD mmm"). Antecipar o pagamento (registrar `data_paga`
 *     anterior) adianta o vencimento efetivo via posicaoFatura, então a virada
 *     fechada→aberta acontece na data registrada, de graça.
 *
 *  `realizado` é sempre o realizado do ciclo mostrado. `previsao` é a mensal do
 *  cartão (null = sem previsão → sem barra, só acumula). */
export type StatusCarteira = {
  cicloAbs: number;
  fase: 'aberta' | 'fechada';
  realizado: number;
  previsao: number | null;
  /** Dia+mês do evento relevante: fechamento (fase aberta) ou vencimento
   *  efetivo/padrão (fase fechada). Para a legenda "fecha/vence DD mmm". */
  diaEvento: number;
  mesEvento: number; // 0-11
};

/** Fase de um ciclo ARBITRÁRIO pela régua da Carteira (§5.6), relativa a hoje —
 *  a mesma que o drill-down usa ao navegar ciclos. Um ciclo é FECHADA (obrigação
 *  pendente) enquanto já fechou e hoje ≤ vencimento (efetivo via pagamentos, ou
 *  padrão); caso contrário é ABERTA (acumulando, se corrente/futuro; ou já pago,
 *  se passou o vencimento). Devolve também o evento (fecha/vence DD mmm). */
export function faseCarteiraDoCiclo(
  cartao: Cartao,
  cicloAbs: number,
  hoje: Date,
  pagamentos?: IndicePagamentos,
  ciclos?: IndiceCiclos,
): { fase: 'aberta' | 'fechada'; diaEvento: number; mesEvento: number } {
  const cicloAberto = cicloDeFechamentoAbs(
    montaISO(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()),
    cartao,
    ciclos,
  );
  const anoF = Math.floor(cicloAbs / 12);
  const mesF = ((cicloAbs % 12) + 12) % 12;
  const diaFecha = diaAncoraNoMes(regimeDoCiclo(cartao, cicloAbs, ciclos).dia_fechamento, anoF, mesF);

  // ABERTA só se o ciclo AINDA NÃO FECHOU: é o corrente (antes do fechamento) ou
  // um ciclo futuro. Mostra o dia de FECHAMENTO ("fecha DD mmm").
  if (cicloAbs >= cicloAberto) {
    return { fase: 'aberta', diaEvento: diaFecha, mesEvento: mesF };
  }

  // FECHADA em todo o resto — todo ciclo que já fechou é fato consolidado,
  // esteja pendente de pagamento ou já pago (inclusive ciclos antigos, pré-app,
  // sem dados). A tela mostra o VENCIMENTO ("vence DD mmm"): dia efetivo se há
  // pagamento registrado, senão o padrão.
  const pos = posicaoFatura(cartao, cicloAbs, pagamentos, ciclos);
  return { fase: 'fechada', diaEvento: pos.dia, mesEvento: pos.mesAbs % 12 };
}

export function statusCarteiraDoCartao(
  lancamentos: Lancamento[],
  cartao: Cartao,
  hoje: Date,
  excecoes?: IndiceExcecoes,
  pagamentos?: IndicePagamentos,
  ciclos?: IndiceCiclos,
): StatusCarteira {
  const cicloAberto = cicloDeFechamentoAbs(
    montaISO(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()),
    cartao,
    ciclos,
  );
  const cicloAnterior = cicloAberto - 1;
  const hojeAbs = indiceMes(hoje.getFullYear(), hoje.getMonth());

  // A Carteira segura a fatura FECHADA-A-PAGAR (o ciclo anterior) enquanto for
  // OBRIGAÇÃO PENDENTE — isto é, enquanto hoje está ANTES do vencimento (efetivo,
  // se pago; ou padrão). No próprio dia do vencimento/pagamento ela sai do radar
  // e a Carteira passa a mostrar o ciclo ABERTO acumulando (§5.6). Esta régua é
  // "ainda devo mostrar isto?", distinta de faseCarteiraDoCiclo ("que fase é?").
  if (cicloAnterior >= 0) {
    const pos = posicaoFatura(cartao, cicloAnterior, pagamentos, ciclos);
    const vencAbs = pos.mesAbs;
    const pendente = hojeAbs < vencAbs || (hojeAbs === vencAbs && hoje.getDate() < pos.dia);
    if (pendente) {
      return {
        cicloAbs: cicloAnterior,
        fase: 'fechada',
        realizado: realizadoDoCiclo(lancamentos, cartao, cicloAnterior, hoje, excecoes, ciclos),
        previsao: cartao.previsao_mensal,
        diaEvento: pos.dia,
        mesEvento: vencAbs % 12,
      };
    }
  }

  // Sem fechada pendente: o ciclo corrente, aberto, acumulando.
  const f = faseCarteiraDoCiclo(cartao, cicloAberto, hoje, pagamentos, ciclos);
  return {
    cicloAbs: cicloAberto,
    fase: f.fase,
    realizado: realizadoDoCiclo(lancamentos, cartao, cicloAberto, hoje, excecoes, ciclos),
    previsao: cartao.previsao_mensal,
    diaEvento: f.diaEvento,
    mesEvento: f.mesEvento,
  };
}

// ───────── Saldo contínuo (§4.7) ─────────
//
// O saldo rola de um mês para o seguinte: saldo(M) = herdado(M) + líquido(M),
// onde herdado(M) = saldo acumulado de todos os meses desde a ÂNCORA até M-1.
// Âncora = primeiro registro (menor data entre lançamentos e transferências);
// antes dela não existe "antes", herdado = 0.
//
// Cálculo na leitura (sem tabela de snapshots): as recorrências são regras,
// não linhas, então somar mês a mês desde a âncora é barato. A Home memoiza o
// resultado em memória. Projeção futura limitada ao HORIZONTE (recorrência
// indefinida não soma além de hoje+24m).


/** Índice de mês absoluto exposto para a Home memoizar/iterar. */
export function mesAbs(ano: number, mes: number): number {
  return ano * 12 + mes;
}

/** Acha a âncora (ano,mes do primeiro registro). null se não há nada. */
export function acharAncora(
  lancamentos: Lancamento[],
  transferencias: Transferencia[],
): { ano: number; mes: number } | null {
  let min: string | null = null;
  for (const l of lancamentos) if (min === null || l.data < min) min = l.data;
  for (const t of transferencias) if (min === null || t.data < min) min = t.data;
  if (min === null) return null;
  const [a, m] = parteData(min);
  return { ano: a, mes: m };
}

/**
 * Líquido de um único mês (o "+200, −300…" daquele mês), em conta-corrente:
 *   + entradas  − saídas (sem cartão)
 *   − faturas de cartão que VENCEM no mês (fonte única: faturaNoMes, §4.4/§4.8)
 *   − depósitos em poupança  + retiradas de poupança
 *   transferência corrente↔corrente é neutra (não entra)
 */
export function liquidoDoMes(
  lancamentos: Lancamento[],
  transferencias: Transferencia[],
  contas: Conta[],
  cartoes: Cartao[],
  alvoAno: number,
  alvoMes: number,
  hoje: Date,
  excecoes?: IndiceExcecoes,
  pagamentos?: IndicePagamentos,
  ciclos?: IndiceCiclos,
): number {
  const tipoConta = new Map(contas.map((c) => [c.id, c.tipo]));
  let total = 0;

  // Lançamentos de conta-corrente (cartão NÃO entra aqui — §4.8: a compra de
  // cartão não pesa na data da compra; pesa pela fatura, na data do pagamento).
  // Entrada soma, saída subtrai.
  for (const o of lancamentosNoMes(lancamentos, alvoAno, alvoMes, hoje, excecoes)) {
    if (o.cartao_id != null) continue; // cartão pesa pela fatura, abaixo
    total += o.tipo === 'entrada' ? o.valor : -o.valor;
  }

  // Faturas de cartão que VENCEM neste mês (§4.4): max(previsão, realizado)
  // enquanto abertas/futuras; realizado depois de fechar. Fonte única.
  for (const k of cartoes) {
    total -= faturaNoMes(lancamentos, k, alvoAno, alvoMes, hoje, excecoes, pagamentos, ciclos);
  }

  // Transferências: só as que envolvem poupança alteram o disponível (§4.5).
  for (const o of transferenciasNoMes(transferencias, alvoAno, alvoMes, hoje)) {
    const destinoPoupanca = tipoConta.get(o.para_conta_id) === 'poupanca';
    const origemPoupanca = tipoConta.get(o.de_conta_id) === 'poupanca';
    if (destinoPoupanca && !origemPoupanca) total -= o.valor; // depósito: sai do disponível
    else if (origemPoupanca && !destinoPoupanca) total += o.valor; // retirada: volta
    // corrente↔corrente ou poupança↔poupança: neutro
  }

  return total;
}

/**
 * Entradas e saídas do mês no eixo de FLUXO DE CAIXA (§4.8) — a decomposição do
 * `liquidoDoMes` em dois baldes, para o card de resumo (§5.1/§5.5). Garante, por
 * construção, que `entradas − saidas === liquidoDoMes`, logo
 * `herdado + entradas − saidas === saldoMes` — a aritmética que o card mostra
 * (com o Herdado visível) FECHA.
 *
 *  entradas = entradas de débito + retiradas de poupança (creditam o disponível)
 *  saidas   = saídas de débito + faturas de cartão (data de pagamento)
 *             + depósitos em poupança (debitam o disponível)
 *
 * NÃO confundir com o eixo de CONSUMO ("Para onde foi o dinheiro", §4.8), que lê
 * pela data da compra e explode a fatura nas categorias — aquela lista não soma
 * o mesmo que estas saídas, e é correto que difira (dois eixos, §4.8). Usa os
 * MESMOS argumentos e primitivas do liquidoDoMes para nunca divergir dele.
 */
export function entradasSaidasDoMes(
  lancamentos: Lancamento[],
  transferencias: Transferencia[],
  contas: Conta[],
  cartoes: Cartao[],
  alvoAno: number,
  alvoMes: number,
  hoje: Date,
  excecoes?: IndiceExcecoes,
  pagamentos?: IndicePagamentos,
  ciclos?: IndiceCiclos,
): { entradas: number; saidas: number } {
  const tipoConta = new Map(contas.map((c) => [c.id, c.tipo]));
  let entradas = 0;
  let saidas = 0;

  // Lançamentos de conta-corrente (cartão pesa pela fatura, abaixo).
  for (const o of lancamentosNoMes(lancamentos, alvoAno, alvoMes, hoje, excecoes)) {
    if (o.cartao_id != null) continue;
    if (o.tipo === 'entrada') entradas += o.valor; else saidas += o.valor;
  }

  // Faturas de cartão que vencem no mês → saída (data de pagamento, §4.8).
  for (const k of cartoes) {
    saidas += faturaNoMes(lancamentos, k, alvoAno, alvoMes, hoje, excecoes, pagamentos, ciclos);
  }

  // Transferências com poupança: depósito é saída, retirada é entrada (§4.5).
  for (const o of transferenciasNoMes(transferencias, alvoAno, alvoMes, hoje)) {
    const destinoPoupanca = tipoConta.get(o.para_conta_id) === 'poupanca';
    const origemPoupanca = tipoConta.get(o.de_conta_id) === 'poupanca';
    if (destinoPoupanca && !origemPoupanca) saidas += o.valor;
    else if (origemPoupanca && !destinoPoupanca) entradas += o.valor;
  }

  return { entradas, saidas };
}

/**
 * Saldo herdado de um mês: acumulado desde a âncora até o mês ANTERIOR ao alvo.
 * Antes da âncora (ou sem âncora) = 0. Itera mês a mês — barato porque são
 * regras, não linhas. A Home memoiza por (ano,mes).
 */
export function saldoHerdado(
  lancamentos: Lancamento[],
  transferencias: Transferencia[],
  contas: Conta[],
  cartoes: Cartao[],
  alvoAno: number,
  alvoMes: number,
  hoje: Date,
  excecoes?: IndiceExcecoes,
  pagamentos?: IndicePagamentos,
  ciclos?: IndiceCiclos,
): number {
  const ancora = acharAncora(lancamentos, transferencias);
  if (!ancora) return 0;
  const inicio = mesAbs(ancora.ano, ancora.mes);
  const fim = mesAbs(alvoAno, alvoMes); // exclusivo: herdado é até o mês anterior
  if (fim <= inicio) return 0; // alvo é a âncora ou anterior: nada herdado

  let acc = 0;
  for (let abs = inicio; abs < fim; abs++) {
    acc += liquidoDoMes(lancamentos, transferencias, contas, cartoes, Math.floor(abs / 12), abs % 12, hoje, excecoes, pagamentos, ciclos);
  }
  return acc;
}

// ───────── Saldo acumulado POR CONTA (§4.7, invariante da aba Contas) ─────────
//
// Espelha saldoHerdado + liquidoDoMes, mas DESAGREGADO por conta_id. O
// invariante travado: a soma dos saldos de todas as correntes == saldo do topo
// (herdado + líquido do mês corrente). Para isso, cada movimento é atribuído à
// sua conta:
//   - lançamento de débito (sem cartão) → conta_id do lançamento
//   - fatura de cartão → conta_id do CARTÃO (a conta que paga, §4.4/§4.5)
//   - transferência com poupança → debita/credita a corrente envolvida
//   - transferência corrente↔corrente → neutra no total, mas MOVE entre contas
//     (sai de uma, entra na outra) — daí aparecer no saldo de cada conta.
//
// Poupança fica de fora deste mapa (o Cofre é visão à parte, §4.5); só contas
// correntes entram, garantindo que a soma bata com o saldo do mês.

/** Líquido de um mês, por conta_id (só correntes). Mesma regra de liquidoDoMes,
 *  mas mantendo a atribuição por conta — inclusive o lado a lado das
 *  transferências entre correntes (que somam zero no total mas movem entre
 *  contas).
 *
 *  `corte` (ISO YYYY-MM-DD, opcional): quando presente, só conta movimentos com
 *  data ≤ corte — a "foto de hoje" da Carteira (§5.6). Fatura entra pela data
 *  em que PESA (efetiva ou padrão): se essa data > corte, ainda não saiu da
 *  conta e é ignorada. Sem corte, o mês inteiro conta (fato + projeção). */
function liquidoDoMesPorConta(
  lancamentos: Lancamento[],
  transferencias: Transferencia[],
  contas: Conta[],
  cartoes: Cartao[],
  alvoAno: number,
  alvoMes: number,
  hoje: Date,
  excecoes: IndiceExcecoes | undefined,
  acc: Map<string, number>,
  pagamentos?: IndicePagamentos,
  corte?: string,
  ciclos?: IndiceCiclos,
): void {
  const tipoConta = new Map(contas.map((c) => [c.id, c.tipo]));
  const add = (id: string, v: number) => {
    if (tipoConta.get(id) !== 'corrente') return; // só correntes no mapa de saldo
    acc.set(id, (acc.get(id) ?? 0) + v);
  };
  const alvoAbs = indiceMes(alvoAno, alvoMes);

  // Lançamentos de débito (cartão não entra aqui — pesa pela fatura).
  for (const o of lancamentosNoMes(lancamentos, alvoAno, alvoMes, hoje, excecoes)) {
    if (o.cartao_id != null) continue;
    if (corte != null && o.data > corte) continue; // ainda não aconteceu (foto de hoje)
    add(o.conta_id, o.tipo === 'entrada' ? o.valor : -o.valor);
  }

  // Faturas de cartão que vencem no mês → debitam a conta pagadora (§4.4/§4.5).
  // Com corte, só se a data em que a fatura PESA (efetiva/padrão) já passou.
  for (const k of cartoes) {
    const peso = faturaNoMes(lancamentos, k, alvoAno, alvoMes, hoje, excecoes, pagamentos, ciclos);
    if (peso === 0) continue;
    if (corte != null) {
      const pos = diaFaturaNoMes(k, alvoAbs, pagamentos, ciclos);
      if (pos != null && montaISO(alvoAno, alvoMes, pos.dia) > corte) continue;
    }
    add(k.conta_id, -peso);
  }

  // Transferências: movem entre contas. Corrente↔corrente é neutra no TOTAL,
  // mas cada lado afeta a conta correspondente. Poupança fica fora do mapa
  // (add ignora não-correntes), então depósito some da corrente de origem e a
  // retirada aparece na corrente de destino — coerente com §4.5.
  for (const o of transferenciasNoMes(transferencias, alvoAno, alvoMes, hoje)) {
    if (corte != null && o.data > corte) continue;
    add(o.de_conta_id, -o.valor);
    add(o.para_conta_id, o.valor);
  }
}

/**
 * Saldo acumulado por conta_id, da âncora até o fim do mês (alvoAno, alvoMes)
 * INCLUSIVE — é o "quanto tem hoje" de cada conta. Diferente de saldoHerdado
 * (que vai até o mês anterior); aqui incluímos o mês alvo porque o card de
 * conta mostra o saldo corrente, não o herdado.
 *
 * `corte` (ISO, opcional): aplicado só ao MÊS ALVO — corta movimentos com data
 * > corte (a foto de "hoje" da Carteira, §5.6). Meses anteriores entram
 * inteiros (já são fato). A Home passa corte = hoje só quando o mês exibido é o
 * corrente; num mês futuro, todo movimento é > corte, então sobra só o herdado.
 *
 * Invariante (sem corte): a soma dos valores deste mapa == saldoHerdado(alvo) +
 * liquidoDoMes(alvo) == saldo do topo. Garantido porque toda atribuição usa a
 * mesma expansão de regras e as mesmas faturas.
 */
export function saldoAcumuladoPorConta(
  lancamentos: Lancamento[],
  transferencias: Transferencia[],
  contas: Conta[],
  cartoes: Cartao[],
  alvoAno: number,
  alvoMes: number,
  hoje: Date,
  excecoes?: IndiceExcecoes,
  pagamentos?: IndicePagamentos,
  corte?: string,
  ciclos?: IndiceCiclos,
): Map<string, number> {
  const acc = new Map<string, number>();
  for (const c of contas) if (c.tipo === 'corrente') acc.set(c.id, 0); // toda corrente presente, mesmo zerada

  const ancora = acharAncora(lancamentos, transferencias);
  if (!ancora) return acc;

  const inicio = mesAbs(ancora.ano, ancora.mes);
  const fim = mesAbs(alvoAno, alvoMes); // inclusivo: acumula ATÉ o mês alvo
  for (let abs = inicio; abs <= fim; abs++) {
    liquidoDoMesPorConta(
      lancamentos, transferencias, contas, cartoes,
      Math.floor(abs / 12), abs % 12, hoje, excecoes, acc, pagamentos,
      // corte só no mês alvo — meses anteriores são fato pleno.
      abs === fim ? corte : undefined,
      ciclos,
    );
  }
  return acc;
}

/**
 * Fluxo do mês (§5.5, gráfico) — saldo em conta ao longo dos dias do mês.
 *
 * Um ponto por dia (1..N do mês), com o saldo em conta acumulado até aquele
 * dia inclusive. Começa do `herdado` (§4.7) e aplica, na ordem do calendário,
 * os MESMOS deltas que compõem `liquidoDoMes`:
 *  - lançamentos de conta-corrente (cartão não pesa na data da compra, §4.8);
 *  - faturas de cartão que vencem no mês, no dia do pagamento (§4.4/§4.8);
 *  - transferências que envolvem poupança (depósito debita, retirada credita,
 *    §4.5); corrente↔corrente é neutro.
 *
 * Entre dias sem movimento o saldo é constante (degraus horizontais na curva).
 * Cobre o MÊS INTEIRO — fato + projeção — coerente com o card de resumo (§5.1):
 * o último ponto é exatamente `herdado + liquidoDoMes` = saldo do mês. Função
 * pura, sem materializar linhas.
 */
export interface PontoFluxo {
  dia: number;
  saldo: number;
}

export function fluxoDoMes(
  lancamentos: Lancamento[],
  transferencias: Transferencia[],
  contas: Conta[],
  cartoes: Cartao[],
  alvoAno: number,
  alvoMes: number,
  herdado: number,
  hoje: Date,
  excecoes?: IndiceExcecoes,
  pagamentos?: IndicePagamentos,
  ciclos?: IndiceCiclos,
): PontoFluxo[] {
  const tipoConta = new Map(contas.map((c) => [c.id, c.tipo]));
  const diasNoMes = new Date(alvoAno, alvoMes + 1, 0).getDate();
  const alvoAbs = mesAbs(alvoAno, alvoMes);

  // Delta por dia (crédito positivo, débito negativo).
  const delta = new Array<number>(diasNoMes + 1).fill(0); // índice 1..diasNoMes

  // Lançamentos de conta-corrente (cartão fica de fora — §4.8).
  for (const o of lancamentosNoMes(lancamentos, alvoAno, alvoMes, hoje, excecoes)) {
    if (o.cartao_id != null) continue;
    const [, , dia] = parteData(o.data);
    delta[dia] += o.tipo === 'entrada' ? o.valor : -o.valor;
  }

  // Faturas que vencem no mês, no dia em que PESAM (efetivo/padrão — §4.4/§4.8).
  for (const k of cartoes) {
    const peso = faturaNoMes(lancamentos, k, alvoAno, alvoMes, hoje, excecoes, pagamentos, ciclos);
    if (peso <= 0) continue;
    const pos = diaFaturaNoMes(k, alvoAbs, pagamentos, ciclos);
    const dia = pos != null ? pos.dia : diaPagamentoNoMes(k, alvoAno, alvoMes, ciclos);
    delta[Math.min(Math.max(dia, 1), diasNoMes)] -= peso;
  }

  // Transferências com poupança (§4.5).
  for (const o of transferenciasNoMes(transferencias, alvoAno, alvoMes, hoje)) {
    const destinoPoupanca = tipoConta.get(o.para_conta_id) === 'poupanca';
    const origemPoupanca = tipoConta.get(o.de_conta_id) === 'poupanca';
    const [, , dia] = parteData(o.data);
    if (destinoPoupanca && !origemPoupanca) delta[dia] -= o.valor;      // depósito
    else if (origemPoupanca && !destinoPoupanca) delta[dia] += o.valor; // retirada
  }

  // Acumula do herdado, um ponto por dia.
  const pontos: PontoFluxo[] = [];
  let acc = herdado;
  for (let dia = 1; dia <= diasNoMes; dia++) {
    acc += delta[dia];
    pontos.push({ dia, saldo: acc });
  }
  return pontos;
}

/**
 * Saldo de cada poupança (§5.4) — quanto está guardado em cada `conta` de
 * tipo poupança. É patrimônio real acumulado: soma dos DEPÓSITOS (transferência
 * que chega na poupança) menos as RETIRADAS (que saem dela), sobre todas as
 * ocorrências desde a âncora até o mês alvo (inclusive). Transferência
 * poupança↔poupança move entre duas poupanças (debita uma, credita outra).
 *
 * Devolve um mapa poupanca_id → saldo, com toda poupança presente (mesmo
 * zerada). O total do Cofre é a soma dos valores deste mapa.
 *
 * `alvoAno`/`alvoMes` (opcionais): mês até o qual acumular. Default = mês
 * corrente — a "foto do presente" da tela de gestão do Cofre (§5.4), que não
 * navega. A aba Contas → Cofre (§5.6, Item 2) passa o mês exibido para o saldo
 * seguir a navegação, igual às contas-corrente.
 *
 * `corte` (ISO, opcional): aplicado só ao mês alvo — corta movimentos com data
 * > corte (saldo vivo do mês corrente). Meses passados entram inteiros (fato);
 * mês futuro sem corte projeta o mês inteiro (herdado + transferências
 * programadas, §4.1). A aba Contas passa corte só quando o mês exibido é o
 * corrente. Sem corte (default), acumula o mês alvo inteiro.
 */
export function saldoPorPoupanca(
  transferencias: Transferencia[],
  contas: Conta[],
  hoje: Date,
  alvoAno?: number,
  alvoMes?: number,
  corte?: string,
): Map<string, number> {
  const tipoConta = new Map(contas.map((c) => [c.id, c.tipo]));
  const acc = new Map<string, number>();
  for (const c of contas) if (c.tipo === 'poupanca') acc.set(c.id, 0);
  if (acc.size === 0) return acc;

  const ancora = acharAncora([], transferencias);
  if (!ancora) return acc;

  const anoFim = alvoAno ?? hoje.getFullYear();
  const mesFim = alvoMes ?? hoje.getMonth();
  const inicio = mesAbs(ancora.ano, ancora.mes);
  const fim = mesAbs(anoFim, mesFim); // inclusivo: acumula ATÉ o mês alvo
  if (fim < inicio) return acc; // mês alvo anterior à âncora → nada guardado ainda
  for (let abs = inicio; abs <= fim; abs++) {
    const ano = Math.floor(abs / 12);
    const mes = abs % 12;
    const corteAqui = abs === fim ? corte : undefined; // corte só no mês alvo
    for (const o of transferenciasNoMes(transferencias, ano, mes, hoje)) {
      if (corteAqui != null && o.data > corteAqui) continue; // ainda não aconteceu
      const destinoPoup = tipoConta.get(o.para_conta_id) === 'poupanca';
      const origemPoup = tipoConta.get(o.de_conta_id) === 'poupanca';
      if (destinoPoup) acc.set(o.para_conta_id, (acc.get(o.para_conta_id) ?? 0) + o.valor);
      if (origemPoup) acc.set(o.de_conta_id, (acc.get(o.de_conta_id) ?? 0) - o.valor);
    }
  }
  return acc;
}

/**
 * Movimentações de uma poupança (§5.4, drill-down) — histórico de depósitos e
 * retiradas, mais recente primeiro. Materializa as ocorrências de transferência
 * que tocam esta poupança, da âncora até o mês corrente (não projeta futuro; o
 * histórico é fato). Cada item traz o sinal (+depósito / −retirada) e o rótulo
 * (a outra ponta ou a descrição). Poupança↔poupança conta em ambas.
 */
export interface MovimentacaoPoupanca {
  id: string;
  data: string;
  /** Valor com sinal: positivo = entrou na poupança; negativo = saiu. */
  delta: number;
  tipo: 'deposito' | 'retirada';
  descricao: string | null;
}

export function movimentacoesDaPoupanca(
  transferencias: Transferencia[],
  poupancaId: string,
  hoje: Date,
): MovimentacaoPoupanca[] {
  const ancora = acharAncora([], transferencias);
  if (!ancora) return [];

  const inicio = mesAbs(ancora.ano, ancora.mes);
  const fim = mesAbs(hoje.getFullYear(), hoje.getMonth());
  const out: MovimentacaoPoupanca[] = [];
  for (let abs = inicio; abs <= fim; abs++) {
    const ano = Math.floor(abs / 12);
    const mes = abs % 12;
    for (const o of transferenciasNoMes(transferencias, ano, mes, hoje)) {
      const entra = o.para_conta_id === poupancaId;
      const sai = o.de_conta_id === poupancaId;
      if (!entra && !sai) continue;
      out.push({
        id: o.id,
        data: o.data,
        delta: entra ? o.valor : -o.valor,
        tipo: entra ? 'deposito' : 'retirada',
        descricao: o.descricao,
      });
    }
  }
  // Mais recente primeiro.
  out.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  return out;
}
