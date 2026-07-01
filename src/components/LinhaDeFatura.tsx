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
  /** Microcópia da legenda (ex.: "fecha dia 28"), abaixo do nome. */
  tagTexto: string;
  tagCor?: TagCor;
  /** Tema do cartão (§4.9) para a cor da bolinha. */
  tagTema?: string | null;
  fase: FaseFatura;
  realizado: number;
  /** Teto previsto; null = sem previsão (sem barra, só o realizado acumulado). */
  previsao: number | null;
  onAbrir: () => void;
};

export function LinhaDeFatura({
  titulo,
  tagTexto,
  tagCor = 'cartao',
  tagTema,
  fase,
  realizado,
  previsao,
  onAbrir,
}: Props) {
  // Sem previsão não há projeção a mostrar: some a barra e o "/previsto", fica
  // só o realizado acumulado (mesma leitura de uma fatura fechada) — §4.4.
  const semPrevisao = previsao == null;
  const comBarra = fase !== 'fechada' && !semPrevisao;
  const soRealizado = fase === 'fechada' || semPrevisao;
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
            gap: 4,
            flex: '1 1 auto',
            minWidth: 0,
          }}
        >
          {/* Nome + bolinha do tema (Tag sem texto), lado a lado. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: '100%', minWidth: 0 }}>
            <span
              className="type-body-strong"
              style={{ color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}
            >
              {titulo}
            </span>
            <Tag cor={tagCor} tema={tagTema} />
          </div>
          {/* "fecha dia X" — legenda cinza abaixo do nome. */}
          {tagTexto && (
            <span className="type-caption" style={{ color: 'var(--text-muted)' }}>
              {tagTexto}
            </span>
          )}
        </div>

        {soRealizado ? (
          <Valor tipo="saida" valor={-Math.abs(realizado)} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-xs)', flex: '0 0 auto' }}>
            <span className="type-numeric" style={{ color: futura ? 'var(--text-muted)' : 'var(--text-primary)' }}>
              {formatarBR(realizado)}
            </span>
            <span className="type-body-strong" style={{ color: 'var(--text-muted)' }}>/</span>
            <span className="type-body-small" style={{ color: 'var(--text-secondary)' }}>
              {formatarBR(previsao ?? 0)}
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

