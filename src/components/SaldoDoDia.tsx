import { formatarBR } from '../lib/formato';

/**
 * Saldo do dia — §5.1, Figma 2013:19.
 * Rodapé de cada grupo de dia: o saldo acumulado até o fim daquele dia
 * (o saldo é legível linha a linha, §5.1). Layout horizontal,
 * espaço-entre: [ rótulo ] … [ saldo ]. Sem fundo (sobre o fundo da tela).
 */

type Props = {
  /** Saldo acumulado até o fim do dia. */
  saldo: number;
};

export function SaldoDoDia({ saldo }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-sm) var(--space-lg)',
        width: '100%',
      }}
    >
      <span className="type-label" style={{ color: 'var(--text-muted)' }}>
        Saldo do dia
      </span>
      <span className="type-body-small-strong" style={{ color: 'var(--text-secondary)' }}>
        {formatarBR(saldo, { prefixo: true })}
      </span>
    </div>
  );
}
