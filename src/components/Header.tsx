/**
 * Header — §5.1, Figma 2221:992.
 * Topo de toda tela principal: botão de menu (abre o drawer, §5.8) à esquerda
 * e navegação de mês (‹ Mês Ano ›) à direita. O seletor de mês controla todas
 * as abas da Home.
 *
 * Estrutura do Figma: wrapper com pt-[12px] → TopBar (px-16 py-12, space-between)
 *   → MenuBtn (pill 40, surface + border) | MonthNav (‹ pill 36 › · título · › pill 36 ›).
 *
 * Só visual + callbacks; não conhece estado de mês (vem por props).
 */

import { IconeMenu, IconeChevronLeft, IconeChevronRight } from '../icons';

type Props = {
  /** Rótulo do mês corrente, ex.: "Junho 2026". */
  mesAno: string;
  /** Toca no menu (abre o drawer de gestão, §5.8). */
  onMenu?: () => void;
  /** Mês anterior. */
  onAnterior?: () => void;
  /** Próximo mês. */
  onProximo?: () => void;
};

const botaoPill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-lg)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  flexShrink: 0,
  padding: 0,
};

export function Header({ mesAno, onMenu, onAnterior, onProximo }: Props) {
  return (
    <header style={{ paddingTop: 'var(--space-md)' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-md) var(--space-lg)',
          width: '100%',
        }}
      >
        {/* Menu — pill 40 */}
        <button
          type="button"
          aria-label="Menu"
          onClick={onMenu}
          style={{ ...botaoPill, width: 40, height: 40 }}
        >
          <IconeMenu tamanho={22} />
        </button>

        {/* Navegação de mês */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          <button
            type="button"
            aria-label="Mês anterior"
            onClick={onAnterior}
            style={{ ...botaoPill, width: 36, height: 36 }}
          >
            <IconeChevronLeft tamanho={18} />
          </button>

          <span
            className="type-title"
            style={{ color: 'var(--text-primary)', padding: '0 var(--space-xs)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}
          >
            {mesAno}
          </span>

          <button
            type="button"
            aria-label="Próximo mês"
            onClick={onProximo}
            style={{ ...botaoPill, width: 36, height: 36 }}
          >
            <IconeChevronRight tamanho={18} />
          </button>
        </div>
      </div>
    </header>
  );
}