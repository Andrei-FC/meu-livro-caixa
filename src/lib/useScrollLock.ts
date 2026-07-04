import { useEffect } from 'react';

/**
 * useScrollLock — trava a rolagem do fundo enquanto um overlay está montado.
 *
 * PORQUÊ (bug corrigido): quando dois overlays empilham (ex.: EditarSheet +
 * modal de escopo, ou um sheet + MenuDrawer), o padrão antigo — cada componente
 * salvar `document.body.style.overflow` e restaurar no cleanup — quebra. O
 * segundo overlay salva `'hidden'` (deixado pelo primeiro) como "valor
 * anterior" e restaura `'hidden'` ao fechar, deixando o body PRESO em
 * overflow:hidden. A rolagem trava, mas o app segue funcionando (era exatamente
 * o sintoma reportado).
 *
 * SOLUÇÃO: um contador global de travas. O primeiro lock aplica `hidden`; os
 * demais só incrementam. Só quando o ÚLTIMO solta (contador zera) o valor
 * original é restaurado. Ordem de montagem/desmontagem deixa de importar.
 */

let travas = 0;
let overflowOriginal = '';

function travar() {
  if (travas === 0) {
    overflowOriginal = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  travas += 1;
}

function destravar() {
  travas = Math.max(0, travas - 1);
  if (travas === 0) {
    document.body.style.overflow = overflowOriginal;
  }
}

/** Trava a rolagem do body enquanto `ativo` for true. Reentrante (empilha). */
export function useScrollLock(ativo: boolean) {
  useEffect(() => {
    if (!ativo) return;
    travar();
    return destravar;
  }, [ativo]);
}
