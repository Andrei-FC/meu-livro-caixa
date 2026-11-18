import { supabase, comTimeout } from './supabase';
import type { Lancamento, ExcecaoSerie, Transferencia } from '../types/db';

/**
 * Desfazer uma edição ou exclusão (§5.7) — por RETRATO, não por operação
 * inversa.
 *
 * O editor tem seis caminhos de escrita (§4.3: override, desvincular, dividir
 * série, apagar regra, apagar série…) e escrever um inverso para cada um seria
 * seis chances de errar. Em vez disso, antes de qualquer escrita o editor tira
 * um RETRATO do que vai mexer — a regra como era e as exceções da série como
 * eram — e desfazer é só repor o retrato:
 *
 *   1. apaga as regras que a operação CRIOU (desvínculo, divisão, relançar);
 *   2. repõe a regra original tal e qual (upsert pelo id, então serve tanto
 *      para "foi alterada" quanto para "foi apagada");
 *   3. zera e repõe as exceções daquela série.
 *
 * Vale para todos os caminhos sem saber qual deles rodou. O preço é que o
 * retrato precisa ser tirado ANTES, e que o id da regra apagada volta igual —
 * o que é bom: ponteiros guardados em outro lugar continuam valendo.
 *
 * Fora do alcance (de propósito): o que uma operação fez em OUTRA série. Hoje
 * nenhum caminho do editor faz isso.
 */
export type Desfazer =
  | {
      tipo: 'lancamento';
      /** A regra como era antes da operação. Reposta inteira, com o mesmo id. */
      regra: Lancamento;
      /** Ids de regras que a operação criou — somem no desfazer. */
      criadas: string[];
      /** Série tocada; null = lançamento avulso, sem exceções a repor. */
      serieId: string | null;
      /** Exceções daquela série como eram antes. */
      excecoes: ExcecaoSerie[];
    }
  | {
      /** Transferência apagada (§5.7): uma linha só, sem série nem exceção. */
      tipo: 'transferencia';
      linha: Transferencia;
    };

/** Executa o desfazer. Lança em erro de rede/RLS — quem chama avisa o usuário. */
export async function aplicarDesfazer(d: Desfazer): Promise<void> {
  if (d.tipo === 'transferencia') {
    const { error } = await comTimeout(supabase.from('transferencias').upsert(d.linha));
    if (error) throw error;
    return;
  }

  if (d.criadas.length > 0) {
    const { error } = await comTimeout(
      supabase.from('lancamentos').delete().in('id', d.criadas),
    );
    if (error) throw error;
  }

  // upsert e não update: a regra pode ter sido APAGADA pela operação, e aí é
  // um insert com o id original.
  const { error: eRegra } = await comTimeout(
    supabase.from('lancamentos').upsert(d.regra),
  );
  if (eRegra) throw eRegra;

  if (d.serieId) {
    // Zera e repõe: a operação pode ter criado, alterado ou apagado exceções —
    // repor o conjunto inteiro cobre os três sem distinguir.
    const { error: eApagar } = await comTimeout(
      supabase.from('excecoes_serie').delete().eq('serie_id', d.serieId),
    );
    if (eApagar) throw eApagar;
    if (d.excecoes.length > 0) {
      const { error: eRepor } = await comTimeout(
        supabase.from('excecoes_serie').insert(d.excecoes),
      );
      if (eRepor) throw eRepor;
    }
  }
}
