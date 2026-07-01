import { BottomSheet } from './BottomSheet';
import { IconeImage } from '../icons';
import type { Conta, Cartao } from '../types/db';

/**
 * SeletorContaCartao — sub-sheet de seleção (§5.2, Figma 2043:408).
 * Título contextual por origem (decisão de produto):
 *   - saída         → "Onde saiu o gasto?"
 *   - entrada       → "Para onde vai a receita?"
 *   - transf-saida  → "Selecione a conta de saída"
 *   - transf-destino→ "Selecione a conta de destino"
 *
 * Lista CONTAS (correntes) e, só quando faz sentido (gasto/receita), CARTÕES.
 * Em transferência o seletor mostra apenas contas — cartão não participa.
 * Linha = swatch (tema/ícone) + nome. Toca → seleciona e fecha.
 */

export type ContextoSeletor = 'saida' | 'entrada' | 'transf-saida' | 'transf-destino' | 'cartao-conta';

const TITULO: Record<ContextoSeletor, string> = {
  saida: 'Onde saiu o gasto?',
  entrada: 'Para onde vai a receita?',
  'transf-saida': 'Selecione a conta de saída',
  'transf-destino': 'Selecione a conta de destino',
  'cartao-conta': 'Qual a conta desse cartão?',
};

/** Linha de seleção: swatch temático (data-card-theme → --theme-bg/--theme-text,
 *  mesmo mecanismo do CardDeEntidade, §4.9) + nome. */

export type SelecaoConta = { kind: 'conta'; conta: Conta };
export type SelecaoCartao = { kind: 'cartao'; cartao: Cartao };
export type Selecao = SelecaoConta | SelecaoCartao;

type Props = {
  aberto: boolean;
  contexto: ContextoSeletor;
  contas: Conta[];
  cartoes: Cartao[];
  onFechar: () => void;
  onSelecionar: (sel: Selecao) => void;
};

export function SeletorContaCartao({
  aberto,
  contexto,
  contas,
  cartoes,
  onFechar,
  onSelecionar,
}: Props) {
  const ehTransferencia = contexto === 'transf-saida' || contexto === 'transf-destino';
  const ehCartaoConta = contexto === 'cartao-conta';
  // Transferência lista correntes + poupanças. cartao-conta lista só correntes
  // (a conta pagadora do cartão, §4.5). Gasto/receita: correntes (+ cartões).
  const correntes = contas.filter((c) =>
    ehTransferencia ? true : c.tipo === 'corrente',
  );
  const mostrarCartoes = !ehTransferencia && !ehCartaoConta && cartoes.length > 0;

  return (
    <BottomSheet
      aberto={aberto}
      onFechar={onFechar}
      aria-label={TITULO[contexto]}
      zIndex={110 /* acima do Lançar */}
    >
      <div style={{ padding: '4px 20px 12px' }}>
        <span className="type-title" style={{ color: 'var(--text-primary)' }}>
          {TITULO[contexto]}
        </span>
      </div>

      <div style={{ overflowY: 'auto', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
        <Secao titulo="Contas" />
        {correntes.map((c) => (
          <Linha
            key={c.id}
            nome={c.nome}
            tema={c.tema}
            onClick={() => onSelecionar({ kind: 'conta', conta: c })}
          />
        ))}

        {mostrarCartoes && (
          <>
            <Secao titulo="Cartões" />
            {cartoes.map((k) => (
              <Linha
                key={k.id}
                nome={k.nome}
                tema={k.tema}
                onClick={() => onSelecionar({ kind: 'cartao', cartao: k })}
              />
            ))}
          </>
        )}
      </div>
    </BottomSheet>
  );
}

function Secao({ titulo }: { titulo: string }) {
  return (
    <div style={{ padding: '10px 20px 4px' }}>
      <span
        className="type-label"
        style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}
      >
        {titulo}
      </span>
    </div>
  );
}

function Linha({ nome, tema, onClick }: { nome: string; tema: string | null; onClick: () => void }) {
  // Swatch temático: data-card-theme resolve --theme-bg/--theme-text (§4.9);
  // sem tema, cai no slate neutro. Mesmo contrato visual do CardDeEntidade.
  const semTema = !tema;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        width: '100%',
        border: 'none',
        background: 'transparent',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <span
        aria-hidden
        data-card-theme={tema ?? undefined}
        style={{
          width: 36,
          height: 36,
          borderRadius: 'var(--radius-sm)',
          background: semTema ? 'var(--p-slate-400)' : 'var(--theme-bg)',
          color: semTema ? 'var(--p-white)' : 'var(--theme-text)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: '0 0 auto',
        }}
      >
        <IconeImage tamanho={20} />
      </span>
      <span className="type-body" style={{ color: 'var(--text-primary)' }}>
        {nome}
      </span>
    </button>
  );
}
