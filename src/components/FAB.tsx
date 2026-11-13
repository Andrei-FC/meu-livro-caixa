import { IconeAdd } from '../icons';
/**
 * FAB — §5.1, Figma 2006:34.
 * Botão flutuante 56×56, círculo, accent/default, ícone "+" (text/on-accent),
 * drop-shadow. EXCLUSIVO para lançamento (fluxo sagrado, princípio 1) — nunca
 * para criar conta/cartão/poupança.
 */

/** Lado do botão (Figma 2006:34). */
const LADO = 56;

/**
 * Folga do FAB em relação ao que estiver logo abaixo dele — a BottomNav, o
 * footer de ação, ou a base da tela. É o X do ajuste: a MESMA distância em
 * todas as telas, com ou sem menu. A safe-area entra sempre por cima disso,
 * nunca no lugar dela.
 */
const FOLGA = 'var(--space-xl)';

/**
 * Espaço que o FAB reserva na base: a folga de baixo + o botão + a folga de
 * cima. Use no `padding-bottom` da lista — sem isso o botão flutuante cobre a
 * última linha quando se rola até o fim.
 */
export function espacoParaFAB(sobrevoa = 0): string {
  return `calc(${FOLGA} + ${LADO}px + ${FOLGA} + ${sobrevoa}px + env(safe-area-inset-bottom))`;
}

type Props = {
  onClick: () => void;
  'aria-label'?: string;
  /**
   * Altura (px, sem safe-area) do que está embaixo do FAB e ele sobrevoa: a
   * BottomNav na Home (`ALTURA_NAV`) ou o footer de Fazer Pagamento (§5.3).
   * Ausente = nada embaixo, o FAB fica a uma FOLGA da base.
   */
  sobrevoa?: number;
  /**
   * Tema da entidade dona da tela (§4.9): nos drill-downs o botão veste a cor
   * do cartão/conta, porque ali o lançamento já tem dono — a cor diz, antes do
   * sheet abrir, onde a compra vai cair. Na Home não há dono, e ele fica
   * accent. Sem tema (entidade sem cor escolhida), também accent.
   */
  tema?: string | null;
};

export function FAB({ onClick, 'aria-label': ariaLabel = 'Novo lançamento', sobrevoa = 0, tema }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      // data-card-theme resolve --theme-bg/--theme-text, o mesmo mecanismo dos
      // cards e swatches (§4.9) — nada de cor crua aqui.
      data-card-theme={tema ?? undefined}
      style={{
        position: 'fixed',
        right: 'calc(var(--space-lg) + env(safe-area-inset-right))',
        // Uma folga acima do que vier embaixo (nav, footer ou a própria base),
        // sempre por cima da safe-area do iOS.
        bottom: `calc(${FOLGA} + ${sobrevoa}px + env(safe-area-inset-bottom))`,
        width: LADO,
        height: LADO,
        borderRadius: '50%',
        border: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: tema ? 'var(--theme-bg)' : 'var(--accent-default)',
        color: tema ? 'var(--theme-text)' : 'var(--text-on-accent)',
        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.35)',
      }}
    >
      <IconeAdd />
    </button>
  );
}
