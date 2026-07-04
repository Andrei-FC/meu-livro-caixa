import { formatarBR } from '../lib/formato';

/**
 * Card de resumo — §5.1, Figma 2007:17.
 * Fonte única dos totais do mês; cobre o mês-calendário INTEIRO (fato + projeção,
 * §5.1). Aparece só na aba Relatório na nova navegação (antes vivia acima das
 * tabs em todas as telas — peso morto). Valores SEMPRE visíveis: o toggle de
 * ocultar (que abria oculto por default) foi removido a pedido.
 */

type Props = {
  saldoMes: number;
  entradas: number;
  saidas: number;
  herdado: number;
};

export function CardDeResumo({ saldoMes, entradas, saidas, herdado }: Props) {
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="type-label" style={{ color: 'var(--text-muted)' }}>SALDO DO MÊS</span>
        <span className="type-display" style={{ color: 'var(--text-primary)' }}>
          {formatarBR(saldoMes, { prefixo: true })}
        </span>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid var(--border-default)', margin: 0, width: '100%' }} />

      <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
        <Total rotulo="Entradas" cor="var(--value-entrada)">
          {formatarBR(entradas, { sinal: '+' })}
        </Total>
        <Total rotulo="Saídas" cor="var(--value-saida)">
          {formatarBR(-Math.abs(saidas))}
        </Total>
        <Total rotulo="Herdado" cor="var(--text-secondary)">
          {formatarBR(herdado)}
        </Total>
      </div>
    </div>
  );
}

function Total({ rotulo, cor, children }: { rotulo: string; cor: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <span className="type-micro" style={{ color: 'var(--text-muted)' }}>{rotulo}</span>
      <span className="type-body-small-strong" style={{ color: cor }}>{children}</span>
    </div>
  );
}
