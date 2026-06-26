import { useState } from 'react';
import { formatarBR } from '../lib/formato';

/**
 * Card de resumo — §5.1, Figma 2007:17.
 * Fonte única dos totais do mês; cobre o mês-calendário INTEIRO (fato + projeção,
 * §5.1). Toggle do olho cobre todos os valores com tarja (border/default).
 */

type Props = {
  saldoMes: number;
  entradas: number;
  saidas: number;
  herdado: number;
  ocultarValores?: boolean;
  onToggleOcultar?: (oculto: boolean) => void;
};

export function CardDeResumo({
  saldoMes,
  entradas,
  saidas,
  herdado,
  ocultarValores,
  onToggleOcultar,
}: Props) {
  const [interno, setInterno] = useState(false);
  const oculto = ocultarValores ?? interno;

  function alternar() {
    const novo = !oculto;
    if (onToggleOcultar) onToggleOcultar(novo);
    else setInterno(novo);
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
        padding: '16px 18px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-surface)',
        width: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="type-label" style={{ color: 'var(--text-muted)' }}>SALDO DO MÊS</span>
          <Oculto oculto={oculto}>
            <span className="type-display" style={{ color: 'var(--text-primary)' }}>
              {formatarBR(saldoMes, { prefixo: true })}
            </span>
          </Oculto>
        </div>

        <button
          type="button"
          onClick={alternar}
          aria-pressed={oculto}
          aria-label={oculto ? 'Mostrar valores' : 'Ocultar valores'}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 36,
            height: 36,
            border: 'none',
            borderRadius: 18,
            background: 'transparent',
            color: 'var(--text-muted)',
          }}
        >
          {oculto ? <IconeOlhoFechado /> : <IconeOlho />}
        </button>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-default)', margin: 0, width: '100%' }} />

      <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
        <Total rotulo="Entradas" cor="var(--value-entrada)" oculto={oculto}>
          {formatarBR(entradas, { sinal: '+' })}
        </Total>
        <Total rotulo="Saídas" cor="var(--value-saida)" oculto={oculto}>
          {formatarBR(-Math.abs(saidas))}
        </Total>
        <Total rotulo="Herdado" cor="var(--text-secondary)" oculto={oculto}>
          {formatarBR(herdado)}
        </Total>
      </div>
    </div>
  );
}

function Total({
  rotulo,
  cor,
  oculto,
  children,
}: {
  rotulo: string;
  cor: string;
  oculto: boolean;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span className="type-micro" style={{ color: 'var(--text-muted)' }}>{rotulo}</span>
      <Oculto oculto={oculto}>
        <span className="type-body-small-strong" style={{ color: cor }}>{children}</span>
      </Oculto>
    </div>
  );
}

/** Envolve um valor; quando oculto, cobre com tarja (border/default, raio sm). */
function Oculto({ oculto, children }: { oculto: boolean; children: React.ReactNode }) {
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <span style={{ visibility: oculto ? 'hidden' : 'visible' }}>{children}</span>
      {oculto && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--border-default)',
          }}
        />
      )}
    </span>
  );
}

function IconeOlho() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconeOlhoFechado() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 3l18 18M10.6 10.6a3 3 0 004.2 4.2M9.9 5.2A9.8 9.8 0 0112 5c6.5 0 10 7 10 7a17 17 0 01-3.2 4M6.6 6.6A17 17 0 002 12s3.5 7 10 7a9.8 9.8 0 002.1-.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
