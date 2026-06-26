export type TagCor = 'neutro' | 'conta' | 'cartao' | 'cofre';

/** Cor do bullet por variante (Figma set Tag 2005:14). */
const bullet: Record<TagCor, string> = {
  neutro: 'var(--p-slate-400)',
  conta: 'var(--p-sky-500)',
  cartao: 'var(--p-violet-500)',
  cofre: 'var(--p-teal-500)',
};

type Props = {
  cor?: TagCor;
  children: React.ReactNode;
};

/** Tag — primitivo. Pill (padding 4/10, gap 6) com bullet colorido + label. */
export function Tag({ cor = 'neutro', children }: Props) {
  return (
    <span
      className="type-label"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 'var(--radius-full)',
        background: 'var(--bg-surface)',
        color: 'var(--text-secondary)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: bullet[cor],
          flex: '0 0 auto',
        }}
      />
      {children}
    </span>
  );
}
