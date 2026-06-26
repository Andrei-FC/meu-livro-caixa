/**
 * Cabeçalho de dia — §5.1, Figma 2013:16.
 * Topo de cada grupo de lançamentos de um dia. Layout horizontal,
 * espaço-entre: [ data ] … [ dia da semana ]. Sem fundo (vive sobre o
 * fundo da tela, fora do card branco do grupo).
 */

type Props = {
  /** Ex.: "23 jun". */
  data: string;
  /** Ex.: "Segunda-feira". */
  diaSemana: string;
};

export function CabecalhoDeDia({ data, diaSemana }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px var(--space-lg)',
        width: '100%',
      }}
    >
      <span className="type-body-small-strong" style={{ color: 'var(--text-primary)' }}>
        {data}
      </span>
      <span className="type-label" style={{ color: 'var(--text-muted)' }}>
        {diaSemana}
      </span>
    </div>
  );
}
