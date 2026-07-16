import { IconeNavLancamentos, IconeNavRelatorio, IconeCreditCard, IconeCash } from '../icons';

/**
 * BottomNav — navegação principal (§5.1). Barra fixa embaixo, alcance de polegar.
 * 4 abas: Lançamentos · Cartões · Contas · Relatório.
 *
 * Cartões e Contas foram SEPARADOS (antes uma aba "Carteira" só): cartão vive no
 * ciclo (foto do presente, sem mês) e conta vive no mês — naturezas temporais
 * distintas que não cabiam numa tela só. A aba Contas tem sub-tabs internas
 * (Conta corrente / Cofre); a aba Cartões não tem seletor de mês.
 *
 * A aba ativa usa accent/default; as inativas text/muted.
 */

export type AbaHome = 'lancamentos' | 'cartoes' | 'contas' | 'relatorio';

const ABAS: {
  id: AbaHome;
  rotulo: string;
  Icone: (p: { tamanho?: number; preenchido?: boolean }) => React.ReactElement;
}[] = [
  { id: 'lancamentos', rotulo: 'Lançamentos', Icone: IconeNavLancamentos },
  { id: 'cartoes', rotulo: 'Cartões', Icone: ({ tamanho }) => <IconeCreditCard tamanho={tamanho} /> },
  { id: 'contas', rotulo: 'Contas', Icone: ({ tamanho }) => <IconeCash tamanho={tamanho} /> },
  { id: 'relatorio', rotulo: 'Relatório', Icone: IconeNavRelatorio },
];

type Props = {
  ativa: AbaHome;
  onMudar: (aba: AbaHome) => void;
};

export function BottomNav({ ativa, onMudar }: Props) {
  return (
    <nav
      aria-label="Navegação principal"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 40,
        display: 'flex',
        justifyContent: 'center',
        background: 'var(--bg-elevated)',
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      {/* Trilho interno com a mesma largura máxima do app (480), centralizado.
          Espaçamento reduzido (Figma 2343:4706, v2): sem folga vertical própria —
          cada aba traz seu pb-4; a barra só reserva a safe-area do iOS. */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          alignItems: 'stretch',
          width: '100%',
          maxWidth: 480,
          padding: '0 20px env(safe-area-inset-bottom)',
        }}
      >
        {ABAS.map(({ id, rotulo, Icone }) => {
          const ativo = id === ativa;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={ativo}
              onClick={() => onMudar(id)}
              className={ativo ? 'type-micro-strong' : 'type-micro'}
              style={{
                flex: '1 1 0',
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0,
                padding: '0 0 4px',
                border: 'none',
                background: 'transparent',
                color: ativo ? 'var(--accent-default)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              <span
                aria-hidden
                style={{ display: 'inline-flex', height: 30, alignItems: 'center' }}
              >
                <Icone tamanho={30} preenchido={ativo} />
              </span>
              <span style={{ whiteSpace: 'nowrap' }}>{rotulo}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
