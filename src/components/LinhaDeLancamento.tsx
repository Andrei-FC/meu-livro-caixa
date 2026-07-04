import { Tag, type TagCor } from './Tag';
import { Valor } from './Valor';
import { IconePencil, IconeCollection } from '../icons';

/**
 * Linha de lançamento — §5.1, Figma set 2006:64.
 * [ descrição · ícone recorrência · bolinha(tema) ] … [ Valor ] [ editar ]
 * A bolinha (Tag sem texto) marca a conta/cartão pela cor do tema (§4.9),
 * ao lado do nome — não mais um pill com o nome repetido embaixo.
 * O ícone de coleção (recorrência) aparece quando o lançamento faz parte de
 * uma série recorrente (§5.7). Parcela NÃO usa o ícone — já se identifica pelo
 * "(X/N)" no rótulo (§4.2).
 * descrição = categoria emergente (§4.6). Editar só no ícone (§5.1).
 */

type Props = {
  tipo: 'entrada' | 'saida';
  descricao: string;
  /** Número já com sinal pela regra de tipo; Valor formata. */
  valor: number;
  conta?: { nome: string; cor?: TagCor; tema?: string | null };
  /** Indicador de parcela (X/N) — só em série finita (parcelamento), §4.2. */
  parcela?: { indice: number; total: number };
  /** Faz parte de uma série recorrente → mostra o ícone de coleção (§5.7). */
  recorrente?: boolean;
  onEditar: () => void;
};

export function LinhaDeLancamento({ tipo, descricao, valor, conta, parcela, recorrente, onEditar }: Props) {
  const rotulo = parcela ? `${descricao} (${parcela.indice}/${parcela.total})` : descricao;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-md)',
        padding: '14px var(--space-lg)',
        width: '100%',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--divider)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flex: '1 1 auto',
          minWidth: 0,
        }}
      >
        <span
          className="type-body-strong"
          style={{
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            minWidth: 0,
          }}
        >
          {rotulo}
        </span>
        {recorrente && (
          <span style={{ flex: '0 0 auto', display: 'inline-flex', color: 'var(--text-muted)' }} aria-label="Recorrente">
            <IconeCollection tamanho={16} />
          </span>
        )}
        {conta && <Tag cor={conta.cor ?? 'conta'} tema={conta.tema} />}
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
        <IconePencil tamanho={14} />
      </button>
    </div>
  );
}

