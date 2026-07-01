import { IconeChevronRight, IconeBan } from '../icons';

/**
 * CampoSeletor — campo "dropdown" de escolha de logo (Figma 2248:1378).
 * Label acima; caixa (padding 12/14, radius md, borda default) com
 * [logo · chevron]. Compacto (largura ~100, sem texto — só ícone + chevron),
 * como o design mais recente. Sem logo escolhido, mostra o ícone "ban"
 * (nenhum). Só apresentação + onClick (abre o SeletorDeIcone).
 */

type Props = {
  label: string;
  /** Logo já escolhido (ou null → mostra o ícone "ban"). */
  logo?: React.ReactNode | null;
  onClick: () => void;
};

export function CampoSeletor({ label, logo, onClick }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="type-label" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <button
        type="button"
        onClick={onClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-xs)',
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          cursor: 'pointer',
          width: 100,
        }}
      >
        <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: logo ? 'var(--text-primary)' : 'var(--text-muted)' }}>
          {logo ?? <IconeBan tamanho={22} />}
        </span>
        <span aria-hidden style={{ color: 'var(--text-muted)', display: 'inline-flex' }}>
          <IconeChevronRight tamanho={20} />
        </span>
      </button>
    </div>
  );
}
