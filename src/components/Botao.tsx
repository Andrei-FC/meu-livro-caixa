import type { ButtonHTMLAttributes, CSSProperties } from 'react';

export type Hierarquia = 'primary' | 'secondary' | 'warning' | 'ghost';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  hierarquia?: Hierarquia;
};

const estilos: Record<Hierarquia, CSSProperties> = {
  primary: { background: 'var(--accent-default)', color: 'var(--text-on-accent)', border: 'none' },
  secondary: { background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-default)' },
  warning: { background: 'var(--bg-surface)', color: 'var(--value-saida)', border: '1px solid var(--border-default)' },
  ghost: { background: 'transparent', color: 'var(--accent-default)', border: 'none' },
};

/** Botão do design system (Figma set Botão). Padding 14/20, raio md, Body Strong. */
export function Botao({ hierarquia = 'primary', style, disabled, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled}
      className="type-body-strong"
      style={{
        boxSizing: 'border-box',
        padding: '14px 20px',
        borderRadius: 'var(--radius-md)',
        width: '100%',
        opacity: disabled ? 0.5 : 1,
        transition: 'opacity 120ms',
        ...estilos[hierarquia],
        ...style,
      }}
    >
      {children}
    </button>
  );
}
