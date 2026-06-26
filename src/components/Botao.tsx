import type { ButtonHTMLAttributes } from 'react';

type Hierarquia = 'primary' | 'secondary' | 'ghost';
type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  hierarquia?: Hierarquia;
};

const estilos: Record<Hierarquia, React.CSSProperties> = {
  primary: { background: 'var(--accent-default)', color: 'var(--text-on-accent)', border: 'none' },
  secondary: { background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' },
  ghost: { background: 'transparent', color: 'var(--accent-default)', border: 'none' }
};

/** Botão do design system. Padding 14/20, raio md, peso Body Strong. */
export function Botao({ hierarquia = 'primary', style, disabled, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className="type-body-strong"
      style={{
        padding: '14px 20px',
        borderRadius: 'var(--radius-md)',
        width: '100%',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 120ms',
        ...estilos[hierarquia],
        ...style
      }}
    >
      {children}
    </button>
  );
}
