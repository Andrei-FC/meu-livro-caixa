import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: boolean; // borda em value/saida (§ estado de erro do design)
};

/** Input do design system: label (Label) acima, gap 6; caixa com padding
 *  12/14, raio md, borda border/default (ou value/saida em erro). */
export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, error, ...rest }, ref) => {
    return (
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span className="type-label" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <input
          ref={ref}
          {...rest}
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            border: `1px solid ${error ? 'var(--value-saida)' : 'var(--border-default)'}`,
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 16, // 16px evita zoom automático do iOS ao focar
            outline: 'none',
            width: '100%'
          }}
        />
      </label>
    );
  }
);
Input.displayName = 'Input';
