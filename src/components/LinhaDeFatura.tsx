import { Tag, type TagCor } from './Tag';
import { Valor } from './Valor';
import { BarraDePrevisao } from './BarraDePrevisao';
import { formatarBR } from '../lib/formato';
import { IconeChevronRight } from '../icons';

/**
 * Linha de fatura — §4.4, §5.1, Figma set 2134:790.
 * Fases (governadas por dia_fechamento, §4.4):
 *  - futura  → realizado 0 (text/muted), barra vazia
 *  - aberta  → realizado/previsto + Barra de previsão (semáforo runtime)
 *  - fechada → consolidado: só o valor, SEM barra
 * A barra é instância da Barra de previsão (não redesenhada).
 */

export type FaseFatura = 'futura' | 'aberta' | 'fechada';

type Props = {
  titulo: string;
  /** Microcópia da tag (ex.: "Cartão · fecha dia 28"). Vocabulário de previsão. */
  tagTexto: string;
  tagCor?: TagCor;
  fase: FaseFatura;
  realizado: number;
  previsao: number;
  onAbrir: () => void;
};

export function LinhaDeFatura({
  titulo,
  tagTexto,
  tagCor = 'cartao',
  fase,
  realizado,
  previsao,
  onAbrir,
}: Props) {
  const comBarra = fase !== 'fechada';
  const futura = fase === 'futura';

  return (
    <button
      type="button"
      onClick={onAbrir}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
        padding: '14px var(--space-lg)',
        width: '100%',
        background: 'var(--bg-surface)',
        border: 'none',
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)', width: '100%' }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            gap: 6,
            flex: '1 1 auto',
            minWidth: 0,
          }}
        >
          <span className="type-body-strong" style={{ color: 'var(--text-primary)' }}>
            {titulo}
          </span>
          <Tag cor={tagCor}>{tagTexto}</Tag>
        </div>

        {fase === 'fechada' ? (
          <Valor tipo="saida" valor={-Math.abs(realizado)} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-xs)', flex: '0 0 auto' }}>
            <span className="type-numeric" style={{ color: futura ? 'var(--text-muted)' : 'var(--text-primary)' }}>
              {formatarBR(realizado)}
            </span>
            <span className="type-body-strong" style={{ color: 'var(--text-muted)' }}>/</span>
            <span className="type-body-small" style={{ color: 'var(--text-secondary)' }}>
              {formatarBR(previsao)}
            </span>
          </div>
        )}

        <span style={{ flex: '0 0 auto', display: 'inline-flex', color: 'var(--text-muted)' }} aria-hidden>
          <IconeChevronRight />
        </span>
      </div>

      {comBarra && (
        <BarraDePrevisao
          realizado={realizado}
          previsao={previsao}
          rotulo={`${formatarBR(realizado)} de ${formatarBR(previsao)} previstos`}
        />
      )}
    </button>
  );
}

