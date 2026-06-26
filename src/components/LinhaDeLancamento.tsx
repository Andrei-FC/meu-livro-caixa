import { Tag, type TagCor } from './Tag';
import { Valor } from './Valor';

/**
 * Linha de lançamento — §5.1, Figma set 2006:64.
 * [ descrição + Tag(conta) ] … [ Valor ] [ editar ]
 * descrição = categoria emergente (§4.6). Editar só no ícone (evita toque
 * acidental, §5.1). Reusa Tag e Valor da biblioteca.
 */

type Props = {
  tipo: 'entrada' | 'saida';
  descricao: string;
  /** Número já com sinal pela regra de tipo; Valor formata. */
  valor: number;
  conta?: { nome: string; cor?: TagCor };
  onEditar: () => void;
};

export function LinhaDeLancamento({ tipo, descricao, valor, conta, onEditar }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-md)',
        padding: '14px var(--space-lg)',
        width: '100%',
        background: 'var(--bg-surface)',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 6,
          flex: '1 1 auto',
          minWidth: 0,
        }}
      >
        <span
          className="type-body-strong"
          style={{
            color: 'var(--text-primary)',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {descricao}
        </span>
        {conta && <Tag cor={conta.cor ?? 'conta'}>{conta.nome}</Tag>}
      </div>

      <Valor tipo={tipo} valor={valor} />

      <button
        type="button"
        onClick={onEditar}
        aria-label={`Editar ${descricao}`}
        style={{
          flex: '0 0 auto',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 20,
          height: 20,
          padding: 0,
          border: 'none',
          background: 'transparent',
          color: 'var(--text-muted)',
        }}
      >
        {/* ícone de editar — entra no passo de ícones */}
        <IconePlaceholder />
      </button>
    </div>
  );
}

/** Placeholder até o passo de ícones consolidar a estratégia. */
function IconePlaceholder() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
