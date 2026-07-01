export type TagCor = 'neutro' | 'conta' | 'cartao' | 'cofre';

/** Cor do bullet por variante — fallback quando a entidade não tem tema
 *  (Figma set Tag 2005:14). Com tema, o bullet usa a cor do tema (§4.9). */
const bullet: Record<TagCor, string> = {
  neutro: 'var(--p-slate-400)',
  conta: 'var(--p-sky-500)',
  cartao: 'var(--p-violet-500)',
  cofre: 'var(--p-teal-500)',
};

type Props = {
  cor?: TagCor;
  /** Chave do tema da conta/cartão (§4.9). Se presente, o bullet usa a cor do
   *  tema (--theme-bg); senão cai no bullet fixo por tipo (`cor`). */
  tema?: string | null;
  children: React.ReactNode;
};

/** Tag — primitivo. Pill (padding 4/10, gap 6) com bullet colorido + label. */
export function Tag({ cor = 'neutro', tema, children }: Props) {
  return (
    <span
      className="type-label"
      data-card-theme={tema ?? undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 'var(--radius-full)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-secondary)',
      }}
    >
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          // Com tema: cor do tema da entidade (§4.9). Sem tema: fixo por tipo.
          background: tema ? 'var(--theme-bg)' : bullet[cor],
          flex: '0 0 auto',
        }}
      />
      {children}
    </span>
  );
}
