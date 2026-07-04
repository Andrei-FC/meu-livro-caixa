import { IconeAdd } from '../icons';
/**
 * FAB — §5.1, Figma 2006:34.
 * Botão flutuante 56×56, círculo, accent/default, ícone "+" (text/on-accent),
 * drop-shadow. EXCLUSIVO para lançamento (fluxo sagrado, princípio 1) — nunca
 * para criar conta/cartão/poupança.
 */

type Props = {
  onClick: () => void;
  'aria-label'?: string;
};

export function FAB({ onClick, 'aria-label': ariaLabel = 'Novo lançamento' }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        position: 'fixed',
        right: 'calc(var(--space-lg) + env(safe-area-inset-right))',
        // Acima do BottomNav (~65px de barra) para não sobrepor a navegação.
        bottom: 'calc(var(--space-lg) + 65px + env(safe-area-inset-bottom))',
        width: 56,
        height: 56,
        borderRadius: '50%',
        border: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--accent-default)',
        color: 'var(--text-on-accent)',
        boxShadow: '0 6px 16px rgba(0, 0, 0, 0.35)',
      }}
    >
      <IconeAdd />
    </button>
  );
}
