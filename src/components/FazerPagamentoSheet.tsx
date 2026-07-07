import { useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { Botao } from './Botao';
import { IconeClose, IconeCalendarPlus } from '../icons';
import { formatarBR } from '../lib/formato';

/**
 * Fazer Pagamento da Fatura — bottom sheet (§5.3, Figma 2359:2426).
 *
 * Registra a DATA EFETIVA de pagamento de uma fatura FECHADA (§4.4). A data
 * escolhida sobrepõe o `dia_pagamento` da regra e rege em que mês/dia a fatura
 * pesa no saldo (princípio 2 — a data manda). Só existe com fatura fechada:
 * antecipar/atrasar é livre DENTRO do ciclo — a data fica travada em
 * [dia_fechamento, próximo dia_fechamento), o intervalo calculado pelo motor
 * (intervaloPagamento) e passado aqui como min/maxExclusivo — não encavala dois
 * pagamentos.
 *
 * Estrutura do Figma: título + fechar · rótulo "VALOR DA FATURA FECHADA" +
 * valor grande · campo "Data do pagamento" (input date com ícone calendar-plus)
 * · caption "Vencimento desse cartão DD/MM" · footer com botão Pagar.
 *
 * O componente é puro de UI: recebe o valor e o intervalo já resolvidos, e
 * devolve a data escolhida (ISO) no onPagar. Persistência e recálculo ficam com
 * a tela (Home grava em cartoes_pagamentos e recarrega).
 */

type Props = {
  aberto: boolean;
  onFechar: () => void;
  /** Valor da fatura fechada (realizado consolidado). */
  valor: number;
  /** Data default do campo — normalmente hoje (ISO YYYY-MM-DD). */
  dataInicial: string;
  /** Limites do intervalo válido (§5.3): min inclusivo, max EXCLUSIVO (ISO). */
  min: string;
  maxExclusivo: string;
  /** Caption "Vencimento desse cartão DD/MM" — dia_pagamento/dia_fechamento. */
  vencimentoTexto: string;
  /** Grava a data escolhida. A tela persiste e recarrega. */
  onPagar: (dataISO: string) => void;
};

/** Subtrai um dia de uma data ISO (para o max INCLUSIVO do input, já que o
 *  intervalo do motor é exclusivo no topo). Sem fuso. */
function diaAnterior(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d - 1);
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

export function FazerPagamentoSheet({
  aberto,
  onFechar,
  valor,
  dataInicial,
  min,
  maxExclusivo,
  vencimentoTexto,
  onPagar,
}: Props) {
  const [data, setData] = useState(dataInicial);

  // Reancora a data ao reabrir (dataInicial muda com o ciclo exibido).
  const [ancora, setAncora] = useState(dataInicial);
  if (ancora !== dataInicial) {
    setAncora(dataInicial);
    setData(dataInicial);
  }

  const maxInclusivo = diaAnterior(maxExclusivo);

  return (
    <BottomSheet aberto={aberto} onFechar={onFechar} aria-label="Fazer pagamento da fatura">
      {/* Header: título + fechar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px var(--space-md) 8px var(--space-lg)',
        }}
      >
        <span style={{ width: 32, flex: '0 0 auto' }} aria-hidden />
        <span className="type-title" style={{ color: 'var(--text-primary)' }}>
          Fazer Pagamento da Fatura
        </span>
        <button
          type="button"
          onClick={onFechar}
          aria-label="Fechar"
          style={{
            width: 32,
            height: 32,
            flex: '0 0 auto',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            background: 'transparent',
            color: 'var(--text-primary)',
            borderRadius: 'var(--radius-full)',
          }}
        >
          <IconeClose tamanho={22} />
        </button>
      </div>

      {/* Valor da fatura fechada */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          padding: 'var(--space-md) var(--space-lg) var(--space-lg)',
        }}
      >
        <span className="type-label" style={{ color: 'var(--text-secondary)' }}>
          VALOR DA FATURA FECHADA
        </span>
        <span className="type-display" style={{ color: 'var(--text-primary)' }}>
          {formatarBR(valor, { prefixo: true })}
        </span>
      </div>

      {/* Body: campo data + caption de vencimento */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 18,
          padding: '4px var(--space-lg) var(--space-lg)',
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="type-label" style={{ color: 'var(--text-secondary)' }}>
            Data do pagamento
          </span>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="date"
              value={data}
              min={min}
              max={maxInclusivo}
              onChange={(e) => { if (e.target.value) setData(e.target.value); }}
              style={{
                padding: '12px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontSize: 16,
                outline: 'none',
                width: '100%',
              }}
            />
            <span
              aria-hidden
              style={{ position: 'absolute', right: 14, color: 'var(--text-muted)', pointerEvents: 'none' }}
            >
              <IconeCalendarPlus tamanho={22} />
            </span>
          </div>
        </label>

        <span className="type-caption" style={{ color: 'var(--text-secondary)' }}>
          {vencimentoTexto}
        </span>
      </div>

      {/* Footer: botão Pagar (borda superior, mesmo padrão do Figma) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px var(--space-lg) calc(24px + env(safe-area-inset-bottom))',
          borderTop: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
        }}
      >
        <Botao hierarquia="primary" onClick={() => onPagar(data)}>
          Pagar
        </Botao>
      </div>
    </BottomSheet>
  );
}
