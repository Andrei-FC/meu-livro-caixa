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

import type { Lancamento, Transferencia, ExcecaoSerie, Conta, Cartao } from '../types/db';

/** Horizonte de projeção: meses à frente de hoje para recorrência indefinida. */
export const HORIZONTE_MESES = 24;

/**
 * Índice de exceções para consulta O(1) no motor: serie_id → (data_alvo → exceção).
 * Construído uma vez na Home e passado para a expansão.
 */
export type IndiceExcecoes = Map<string, Map<string, ExcecaoSerie>>;

export function indexarExcecoes(excecoes: ExcecaoSerie[]): IndiceExcecoes {
  const idx: IndiceExcecoes = new Map();
  for (const e of excecoes) {
    let porData = idx.get(e.serie_id);
    if (!porData) { porData = new Map(); idx.set(e.serie_id, porData); }
    porData.set(e.data_alvo, e);
  }
  return idx;
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
    const e = excecoes.get(oc.serieId)?.get(oc.data);
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
  /** Exceções a remover: as de data_alvo >= a data de corte (§ decisão). */
  removerExcecoesAPartirDe: string;
}

/** Indica se a regra suporta "esta e as futuras" no modo dado. */
export function suportaFuturas(
  repeticao: Lancamento['repeticao'],
  acao: 'salvar' | 'excluir',
): boolean {
  if (repeticao === 'avista') return false;
  if (repeticao === 'recorrente') return true; // salvar e excluir
  if (repeticao === 'parcelar') return acao === 'excluir'; // só cancelar
  return false;
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

  const plano: PlanoDivisao = { encerrar, removerExcecoesAPartirDe: corteData };

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
 *  Compra antes do dia_fechamento → fecha no mês da compra; a partir dele →
 *  fecha no mês seguinte (§4.8). */
function cicloDeFechamentoAbs(dataISO: string, diaFechamento: number): number {
  const [a, m, d] = parteData(dataISO);
  const base = indiceMes(a, m);
  return d < diaFechamento ? base : base + 1;
}

export type FaseCiclo = 'futura' | 'aberta' | 'fechada';

/** Fase do ciclo que fecha em `cicloAbs`, do ponto de vista de `hoje` (§4.4). */
export function faseDoCiclo(cicloAbs: number, cartao: Cartao, hoje: Date): FaseCiclo {
  const hojeAbs = indiceMes(hoje.getFullYear(), hoje.getMonth());
  if (cicloAbs < hojeAbs) return 'fechada'; // ciclo de mês já passado: consolidado
  if (cicloAbs > hojeAbs) return 'futura'; // ainda vai fechar num mês futuro
  // Mês de fechamento é o corrente: antes do dia_fechamento = aberta; senão fechada.
  return hoje.getDate() >= cartao.dia_fechamento ? 'fechada' : 'aberta';
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
): number {
  let total = 0;
  for (const oc of ocorrenciasDoCiclo(lancamentos, cartao, cicloAbs, hoje, excecoes)) {
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
): OcorrenciaLancamento[] {
  // O ciclo que fecha em cicloAbs abrange compras dos meses (cicloAbs−1) e
  // cicloAbs (a janela cruza a virada de mês no dia_fechamento). Expandimos os
  // dois meses e filtramos pela regra de fechamento.
  const doCartao = lancamentos.filter((l) => l.cartao_id === cartao.id);
  const out: OcorrenciaLancamento[] = [];
  for (const mAbs of [cicloAbs - 1, cicloAbs]) {
    const ano = Math.floor(mAbs / 12);
    const mes = mAbs % 12;
    for (const oc of lancamentosNoMes(doCartao, ano, mes, hoje, excecoes)) {
      if (cicloDeFechamentoAbs(oc.data, cartao.dia_fechamento) === cicloAbs) out.push(oc);
    }
  }
  return out;
}

/** Peso da fatura de um cartão no saldo do mês (alvoAno, alvoMes), aplicando
 *  ciclo + fase + max(previsão, realizado) (§4.4). É a FONTE ÚNICA do débito de
 *  cartão no fluxo de caixa; sempre ≥ 0 (a fatura é uma saída, o sinal é
 *  aplicado por quem consome). Devolve 0 se nenhuma fatura vence nesse mês. */
export function faturaNoMes(
  lancamentos: Lancamento[],
  cartao: Cartao,
  alvoAno: number,
  alvoMes: number,
  hoje: Date,
  excecoes?: IndiceExcecoes,
): number {
  const alvoAbs = indiceMes(alvoAno, alvoMes);
  // Qual ciclo VENCE (pesa) neste mês? Inverte a regra de pagamento (§4.8):
  // vencimento depois do fechamento → fatura do próprio mês; senão → mês anterior.
  const cicloAbs = cartao.dia_pagamento > cartao.dia_fechamento ? alvoAbs : alvoAbs - 1;
  if (cicloAbs < 0) return 0;

  const realizado = realizadoDoCiclo(lancamentos, cartao, cicloAbs, hoje, excecoes);
  const previsao = cartao.previsao_mensal;
  const fase = faseDoCiclo(cicloAbs, cartao, hoje);

  // Sem previsão: só o realizado acumulado, em qualquer fase (§4.4).
  if (previsao == null || previsao <= 0) return realizado;

  if (fase === 'fechada') return realizado; // consolidado: fato é fato
  if (fase === 'aberta') return Math.max(previsao, realizado); // placeholder segura, real estoura
  return Math.max(previsao, realizado); // futura: previsão projeta; se já houver compra maior, ela manda
}

/** Dia do mês em que a fatura de um cartão pesa no saldo (o dia_pagamento,
 *  com clamp no último dia — §4.1). Usado pela lista para posicionar a linha. */
export function diaPagamentoNoMes(cartao: Cartao, ano: number, mes: number): number {
  return diaAncoraNoMes(cartao.dia_pagamento, ano, mes);
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
    total -= faturaNoMes(lancamentos, k, alvoAno, alvoMes, hoje, excecoes);
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
): number {
  const ancora = acharAncora(lancamentos, transferencias);
  if (!ancora) return 0;
  const inicio = mesAbs(ancora.ano, ancora.mes);
  const fim = mesAbs(alvoAno, alvoMes); // exclusivo: herdado é até o mês anterior
  if (fim <= inicio) return 0; // alvo é a âncora ou anterior: nada herdado

  let acc = 0;
  for (let abs = inicio; abs < fim; abs++) {
    acc += liquidoDoMes(lancamentos, transferencias, contas, cartoes, Math.floor(abs / 12), abs % 12, hoje, excecoes);
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
 *  contas). */
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
): void {
  const tipoConta = new Map(contas.map((c) => [c.id, c.tipo]));
  const add = (id: string, v: number) => {
    if (tipoConta.get(id) !== 'corrente') return; // só correntes no mapa de saldo
    acc.set(id, (acc.get(id) ?? 0) + v);
  };

  // Lançamentos de débito (cartão não entra aqui — pesa pela fatura).
  for (const o of lancamentosNoMes(lancamentos, alvoAno, alvoMes, hoje, excecoes)) {
    if (o.cartao_id != null) continue;
    add(o.conta_id, o.tipo === 'entrada' ? o.valor : -o.valor);
  }

  // Faturas de cartão que vencem no mês → debitam a conta pagadora (§4.4/§4.5).
  for (const k of cartoes) {
    const peso = faturaNoMes(lancamentos, k, alvoAno, alvoMes, hoje, excecoes);
    if (peso !== 0) add(k.conta_id, -peso);
  }

  // Transferências: movem entre contas. Corrente↔corrente é neutra no TOTAL,
  // mas cada lado afeta a conta correspondente. Poupança fica fora do mapa
  // (add ignora não-correntes), então depósito some da corrente de origem e a
  // retirada aparece na corrente de destino — coerente com §4.5.
  for (const o of transferenciasNoMes(transferencias, alvoAno, alvoMes, hoje)) {
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
 * Invariante: a soma dos valores deste mapa == saldoHerdado(alvo) +
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
      Math.floor(abs / 12), abs % 12, hoje, excecoes, acc,
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
): PontoFluxo[] {
  const tipoConta = new Map(contas.map((c) => [c.id, c.tipo]));
  const diasNoMes = new Date(alvoAno, alvoMes + 1, 0).getDate();

  // Delta por dia (crédito positivo, débito negativo).
  const delta = new Array<number>(diasNoMes + 1).fill(0); // índice 1..diasNoMes

  // Lançamentos de conta-corrente (cartão fica de fora — §4.8).
  for (const o of lancamentosNoMes(lancamentos, alvoAno, alvoMes, hoje, excecoes)) {
    if (o.cartao_id != null) continue;
    const [, , dia] = parteData(o.data);
    delta[dia] += o.tipo === 'entrada' ? o.valor : -o.valor;
  }

  // Faturas que vencem no mês, no dia do pagamento (§4.4/§4.8).
  for (const k of cartoes) {
    const peso = faturaNoMes(lancamentos, k, alvoAno, alvoMes, hoje, excecoes);
    if (peso <= 0) continue;
    const dia = diaPagamentoNoMes(k, alvoAno, alvoMes);
    delta[dia] -= peso;
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
 * ocorrências desde a âncora até o mês corrente (inclusive). Transferência
 * poupança↔poupança move entre duas poupanças (debita uma, credita outra).
 *
 * Não projeta futuro: o "guardado" é o que já foi movido de fato. Devolve um
 * mapa poupanca_id → saldo, com toda poupança presente (mesmo zerada). O total
 * do Cofre é a soma dos valores deste mapa.
 */
export function saldoPorPoupanca(
  transferencias: Transferencia[],
  contas: Conta[],
  hoje: Date,
): Map<string, number> {
  const tipoConta = new Map(contas.map((c) => [c.id, c.tipo]));
  const acc = new Map<string, number>();
  for (const c of contas) if (c.tipo === 'poupanca') acc.set(c.id, 0);
  if (acc.size === 0) return acc;

  const ancora = acharAncora([], transferencias);
  if (!ancora) return acc;

  const inicio = mesAbs(ancora.ano, ancora.mes);
  const fim = mesAbs(hoje.getFullYear(), hoje.getMonth()); // até o mês corrente
  for (let abs = inicio; abs <= fim; abs++) {
    const ano = Math.floor(abs / 12);
    const mes = abs % 12;
    for (const o of transferenciasNoMes(transferencias, ano, mes, hoje)) {
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
