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

import type { Lancamento, Transferencia, ExcecaoSerie } from '../types/db';

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
