// Agregação do Relatório (§5.5, §4.8) — eixo de CONSUMO.
//
// O relatório lê pela DATA DA COMPRA (§4.8): a compra de cartão NÃO some para
// dentro da fatura aqui — ela conta na sua categoria, no mês da compra, lado a
// lado com o débito da mesma categoria. Cada compra é somada UMA vez; o meio de
// pagamento (cartão × débito) é um RECORTE de leitura dentro da categoria, nunca
// uma linha somada à parte. Isso é o oposto da Home, que lê pela fatura (fluxo
// de caixa). Ver §4.8.
//
// Só SAÍDAS entram no relatório ("para onde foi o dinheiro"). Entradas e o saldo
// vivem no card de resumo do topo (§5.1) — o relatório não repete totais (§5.5).
//
// Funções puras, sem React/Supabase — testáveis isoladamente. Consomem as
// ocorrências JÁ materializadas pelo motor (§4.1), então honram parcelas,
// recorrência, exceções e horizonte sem recalcular nada.

import type { Conta, Cartao } from '../types/db';
import type { OcorrenciaLancamento } from './recorrencia';

// ───────── Cores de categoria (§5.5) ─────────
//
// Paleta fixa de 12 tokens (categoria/01..12). A cor NÃO é armazenada: nasce do
// texto da categoria via hash estável → índice 1..12. Mesmo nome = mesma cor
// sempre. Acima de 12 categorias visíveis, a paleta cicla (§5.5). Escolha
// hash-sobre-ordem: cor estável por nome, trocável depois (§8) — decisão de
// código, não de modelo.

export const TOTAL_CORES_CATEGORIA = 12;

/** Hash estável (djb2) do nome normalizado → índice 1..12. Determinístico entre
 *  sessões e independente de ordem de aparição. */
export function corDaCategoria(nome: string): string {
  const chave = nome.trim().toLowerCase();
  let h = 5381;
  for (let i = 0; i < chave.length; i++) h = ((h << 5) + h + chave.charCodeAt(i)) >>> 0;
  const idx = (h % TOTAL_CORES_CATEGORIA) + 1; // 1..12
  return `var(--categoria-${String(idx).padStart(2, '0')})`;
}

// ───────── Categorias (§4.8) ─────────

/** Uma categoria agregada do mês: total (débito + crédito) e a fatia no cartão. */
export interface CategoriaRelatorio {
  /** Nome de exibição — a forma mais recente vista da descrição (§4.6). */
  nome: string;
  /** Total gasto na categoria no mês (débito + crédito agregados). */
  total: number;
  /** Fatia paga no crédito (compras com cartao_id). 0 = categoria 100% débito. */
  noCartao: number;
  /** Cor derivada do nome via hash (token CSS var). */
  cor: string;
}

/**
 * Agrega as SAÍDAS do mês por categoria emergente (§4.6), pela data da compra
 * (§4.8). Débito e crédito da mesma categoria somam juntos; a fatia no cartão é
 * um recorte (soma das ocorrências com cartao_id), não uma linha à parte.
 *
 * A chave de agrupamento é a descrição normalizada (minúsculas, sem espaços nas
 * pontas — §4.6); o nome de exibição é a forma da última ocorrência vista.
 * Ordenado por total desc (maior gasto primeiro), como no design.
 */
export function categoriasDoMes(ocorrencias: OcorrenciaLancamento[]): CategoriaRelatorio[] {
  const porChave = new Map<string, { nome: string; total: number; noCartao: number }>();

  for (const o of ocorrencias) {
    if (o.tipo !== 'saida') continue; // só despesa entra no relatório (§5.5)
    const chave = o.descricao.trim().toLowerCase();
    if (!chave) continue;
    const acc = porChave.get(chave) ?? { nome: o.descricao.trim(), total: 0, noCartao: 0 };
    acc.nome = o.descricao.trim(); // última forma vista vira o rótulo
    acc.total += o.valor;
    if (o.cartao_id != null) acc.noCartao += o.valor;
    porChave.set(chave, acc);
  }

  return [...porChave.values()]
    .map((c) => ({ nome: c.nome, total: c.total, noCartao: c.noCartao, cor: corDaCategoria(c.nome) }))
    .sort((a, b) => b.total - a.total);
}

/** Maior total de categoria do mês — escala comum das barras (categorias e do
 *  recorte de assinaturas). 0 se não há saídas. */
export function maiorGastoDoMes(categorias: CategoriaRelatorio[]): number {
  return categorias.reduce((max, c) => Math.max(max, c.total), 0);
}

// ───────── Recorte de assinaturas (§5.5) ─────────
//
// LENTE sobre lançamentos já contados nas suas categorias — não adiciona nem
// remove nenhuma linha, não afeta saldo (§5.5). A unidade é a SÉRIE (serie_id):
// Netflix ≠ HBO, cada uma listada individualmente. Marca = flag `assinatura`
// (§3.3), atributo da série. O meio de pagamento é rótulo de leitura derivado do
// lançamento (nome do cartão se houver cartao_id, senão nome da conta) — sem
// campo novo no schema.

/** Uma assinatura individual no recorte (uma série marcada). */
export interface Assinatura {
  /** Chave estável da série (serie_id, ou origemId para série de 1 regra). */
  chave: string;
  nome: string;
  /** Valor/mês da assinatura (a ocorrência do mês exibido). */
  valor: number;
  /** Rótulo do meio de pagamento: nome do cartão, ou nome da conta. */
  meio: string;
}

export interface RecorteAssinaturas {
  assinaturas: Assinatura[];
  /** Soma mensal das assinaturas ativas no mês. */
  total: number;
}

/**
 * Extrai o recorte de assinaturas do mês (§5.5). Cada série marcada com
 * `assinatura` vira uma linha; o total é a soma. Não toca em saldo nem em
 * categoria — as mesmas ocorrências continuam contadas nas suas categorias.
 *
 * Uma série pode ter várias ocorrências no mesmo mês só em casos degenerados;
 * agregamos por série somando, e o nome/meio vêm da última ocorrência vista.
 */
export function recorteAssinaturas(
  ocorrencias: OcorrenciaLancamento[],
  contas: Conta[],
  cartoes: Cartao[],
): RecorteAssinaturas {
  const nomeConta = new Map(contas.map((c) => [c.id, c.nome]));
  const nomeCartao = new Map(cartoes.map((k) => [k.id, k.nome]));

  const porSerie = new Map<string, Assinatura>();
  for (const o of ocorrencias) {
    if (!o.assinatura) continue;
    const chave = o.serieId ?? o.origemId;
    const meio = o.cartao_id != null
      ? (nomeCartao.get(o.cartao_id) ?? 'Cartão')
      : (nomeConta.get(o.conta_id) ?? 'Conta');
    const existente = porSerie.get(chave);
    if (existente) {
      existente.valor += o.valor;
      existente.nome = o.descricao.trim();
      existente.meio = meio;
    } else {
      porSerie.set(chave, { chave, nome: o.descricao.trim(), valor: o.valor, meio });
    }
  }

  const assinaturas = [...porSerie.values()].sort((a, b) => b.valor - a.valor);
  const total = assinaturas.reduce((s, a) => s + a.valor, 0);
  return { assinaturas, total };
}
