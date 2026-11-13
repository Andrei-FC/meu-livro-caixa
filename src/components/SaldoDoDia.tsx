import { formatarBR } from '../lib/formato';

/**
 * Saldo do dia — §5.1, Figma 2013:19.
 * Rodapé de cada grupo de dia: o saldo acumulado até o fim daquele dia
 * (o saldo é legível linha a linha, §5.1). Layout horizontal,
 * espaço-entre: [ rótulo ] … [ saldo ]. Sem fundo (sobre o fundo da tela).
 *
 * A mesma linha abre a lista com o saldo herdado do mês anterior (§4.7):
 * é o ponto de partida do acumulado, então vale a mesma forma e o mesmo peso
 * visual — só o rótulo muda.
 */

type Props = {
  /** Saldo acumulado até o fim do dia. */
  saldo: number;
  /** Rótulo à esquerda. Padrão: o rodapé de dia. */
  rotulo?: string;
};

export function SaldoDoDia({ saldo, rotulo = 'Saldo do dia' }: Props) {
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
        {rotulo}
      </span>
      <span className="type-body-small-strong" style={{ color: 'var(--text-secondary)' }}>
        {formatarBR(saldo, { prefixo: true })}
      </span>
    </div>
  );
}
