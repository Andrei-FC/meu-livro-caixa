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
        bottom: 'calc(var(--space-lg) + env(safe-area-inset-bottom))',
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
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );
}
