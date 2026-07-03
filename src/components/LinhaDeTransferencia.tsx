import { Tag } from './Tag';
import { Valor } from './Valor';
import { IconePencil, IconeChevronRight, IconeSwapHorizontal, IconeArrowSmDown, IconeArrowSmUp } from '../icons';

/**
 * Linha de transferência — §5.1, §4.5, Figma set 2319:1867.
 * Layout de 2 linhas (diferente da Linha de lançamento/fatura, que são de 1),
 * o que a distingue à primeira vista; mesma família (bg surface, divider,
 * Body Strong / Numeric / Label, ícone edit).
 *
 *  [ lead · título ] ……………… [ Valor · editar ]
 *  [ Tag(origem) → Tag(destino) ]
 *
 * Três variantes pelo efeito no saldo do FLUXO (correntes, §4.5):
 *  - neutra  (corrente→corrente): ícone swap ↔, valor sem sinal (text/primary)
 *  - deposito (corrente→poupança): ícone ↓, valor − (value/saida)
 *  - retirada (poupança→corrente): ícone ↑, valor + (value/entrada)
 *
 * Aparece só na lista de lançamentos (fluxo). NÃO entra no drill-down da
 * poupança, onde todo movimento já é depósito/retirada (redundante).
 */

type Variante = 'neutra' | 'deposito' | 'retirada';

type Ponta = { nome: string; tema?: string | null };

type Props = {
  variante: Variante;
  /** Valor sem sinal; o componente aplica o sinal conforme a variante. */
  valor: number;
  origem: Ponta;
  destino: Ponta;
  onEditar: () => void;
};

const TITULO: Record<Variante, string> = {
  neutra: 'Transferência',
  deposito: 'Depósito',
  retirada: 'Retirada',
};

function LeadIcone({ variante }: { variante: Variante }) {
  if (variante === 'deposito') return <IconeArrowSmDown tamanho={18} />;
  if (variante === 'retirada') return <IconeArrowSmUp tamanho={18} />;
  return <IconeSwapHorizontal tamanho={18} />;
}

export function LinhaDeTransferencia({ variante, valor, origem, destino, onEditar }: Props) {
  // Valor: neutra sem sinal (text/primary via Valor tipo 'neutro'); depósito
  // debita (saida, −); retirada credita (entrada, +). §4.5.
  const valorTipo = variante === 'deposito' ? 'saida' : variante === 'retirada' ? 'entrada' : 'neutro';
  const valorNum =
    variante === 'deposito' ? -Math.abs(valor) : variante === 'retirada' ? Math.abs(valor) : Math.abs(valor);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '14px var(--space-lg)',
        width: '100%',
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--divider)',
      }}
    >
      {/* Linha 1: lead + título … valor + editar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '1 1 auto', minWidth: 0 }}>
          <span style={{ display: 'inline-flex', color: 'var(--text-primary)', flex: '0 0 auto' }}>
            <LeadIcone variante={variante} />
          </span>
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
            {TITULO[variante]}
          </span>
        </div>

        <Valor tipo={valorTipo} valor={valorNum} />

        <button
          type="button"
          onClick={onEditar}
          aria-label={`Editar ${TITULO[variante].toLowerCase()}`}
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
          <IconePencil tamanho={14} />
        </button>
      </div>

      {/* Linha 2: origem → destino */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <PontaTag ponta={origem} />
        <span style={{ display: 'inline-flex', color: 'var(--text-muted)', flex: '0 0 auto' }}>
          <IconeChevronRight tamanho={16} />
        </span>
        <PontaTag ponta={destino} />
      </div>
    </div>
  );
}

/** Nome da ponta com a bolinha do tema (mesma Tag das outras linhas, §4.9). */
function PontaTag({ ponta }: { ponta: Ponta }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <Tag cor="conta" tema={ponta.tema} />
      <span
        className="type-label"
        style={{
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0,
        }}
      >
        {ponta.nome}
      </span>
    </span>
  );
}
