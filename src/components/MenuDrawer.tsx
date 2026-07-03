import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { usePresenca, EASE_OVERLAY } from '../lib/usePresenca';
import { useScrollLock } from '../lib/useScrollLock';
import {
  IconeHome,
  IconeWallet,
  IconeCash,
  IconeCreditCard,
  IconeViewList,
  IconeSettings,
  IconeLogout,
} from '../icons';

/**
 * MenuDrawer — gaveta lateral de navegação (§5.8, Figma 2014:100).
 *
 * Desliza da esquerda (largura 310) sobre um scrim. Diferente do BottomSheet
 * (que ancora na base): aqui o painel cola na borda esquerda e ocupa a altura
 * inteira. Fecha ao tocar no scrim ou apertar Esc.
 *
 * Estrutura do Figma: scrim (overlay/scrim) + Drawer (bg/surface) →
 *   header (título + subtítulo) → item "Mês" (ativo, accent/subtle) →
 *   grupo GERENCIAR (Cofre/Poupança · Contas · Cartões) →
 *   grupo GESTÃO (Categorias · Configurações) →
 *   grupo CONTA (Sair). Dividers entre os blocos.
 *
 * Só visual + callbacks; não conhece rotas (os destinos chegam por props).
 * Itens sem handler aparecem como stubs desabilitados (telas de gestão ainda
 * não implementadas — §5.8).
 */

/** Identificador de cada destino do menu. */
export type DestinoMenu =
  | 'mes'
  | 'cofre'
  | 'contas'
  | 'cartoes'
  | 'categorias'
  | 'configuracoes'
  | 'sair';

type Props = {
  aberto: boolean;
  onFechar: () => void;
  /** Destino atual (recebe o realce accent/subtle). Default 'mes'. */
  ativo?: DestinoMenu;
  /** Toca num item. Recebe o destino; cabe à Home rotear. */
  onNavegar?: (destino: DestinoMenu) => void;
  zIndex?: number;
};

export function MenuDrawer({
  aberto,
  onFechar,
  ativo = 'mes',
  onNavegar,
  zIndex = 100,
}: Props) {
  const { montado, visivel, duracao } = usePresenca(aberto);

  // Trava a rolagem do fundo enquanto montado (helper com contador).
  useScrollLock(montado);

  // Esc fecha.
  useEffect(() => {
    if (!montado) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [montado, onFechar]);

  if (!montado) return null;

  const navegar = (destino: DestinoMenu) => {
    onNavegar?.(destino);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      onClick={onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        justifyContent: 'flex-start',
        background: 'var(--overlay-scrim)',
        zIndex,
        // Scrim em fade.
        opacity: visivel ? 1 : 0,
        transition: `opacity ${duracao}ms ${EASE_OVERLAY}`,
      }}
    >
      <nav
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 310,
          maxWidth: '85vw',
          height: '100%',
          background: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          // Entra da esquerda.
          transform: visivel ? 'translateX(0)' : 'translateX(-100%)',
          transition: `transform ${duracao}ms ${EASE_OVERLAY}`,
          willChange: 'transform',
        }}
      >
        {/* ── Cabeçalho ── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            padding: '56px 24px 24px',
          }}
        >
          <span className="type-title" style={{ color: 'var(--text-primary)' }}>
            Meu Livro-Caixa
          </span>
          <span className="type-caption" style={{ color: 'var(--text-secondary)' }}>
            Casal · conta única
          </span>
        </div>

        {/* ── Mês (destino atual) ── */}
        <ItemMenu
          icone={<IconeHome />}
          rotulo="Mês"
          ativo={ativo === 'mes'}
          onClick={() => navegar('mes')}
        />

        <Divisor />

        {/* ── GERENCIAR ── */}
        <Secao titulo="GERENCIAR" />
        <ItemMenu
          icone={<IconeWallet />}
          rotulo="Cofre / Poupança"
          ativo={ativo === 'cofre'}
          onClick={() => navegar('cofre')}
        />
        <ItemMenu
          icone={<IconeCash />}
          rotulo="Contas"
          ativo={ativo === 'contas'}
          onClick={() => navegar('contas')}
        />
        <ItemMenu
          icone={<IconeCreditCard />}
          rotulo="Cartões"
          ativo={ativo === 'cartoes'}
          onClick={() => navegar('cartoes')}
        />

        <Divisor />

        {/* ── GESTÃO ── */}
        <Secao titulo="GESTÃO" />
        <ItemMenu
          icone={<IconeViewList />}
          rotulo="Categorias"
          ativo={ativo === 'categorias'}
          onClick={() => navegar('categorias')}
        />
        <ItemMenu
          icone={<IconeSettings />}
          rotulo="Configurações"
          ativo={ativo === 'configuracoes'}
          onClick={() => navegar('configuracoes')}
        />

        {/* ── CONTA ── */}
        <Secao titulo="CONTA" />
        <ItemMenu
          icone={<IconeLogout />}
          rotulo="Sair"
          ativo={ativo === 'sair'}
          onClick={() => navegar('sair')}
        />
      </nav>
    </div>
  );
}

/* ───────── Subcomponentes internos ───────── */

function ItemMenu({
  icone,
  rotulo,
  ativo = false,
  onClick,
}: {
  icone: ReactNode;
  rotulo: string;
  ativo?: boolean;
  onClick?: () => void;
}) {
  const cor = ativo ? 'var(--accent-default)' : 'var(--text-primary)';
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '14px 24px',
        border: 'none',
        background: ativo ? 'var(--accent-subtle)' : 'transparent',
        color: cor,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span aria-hidden style={{ display: 'flex', color: cor }}>{icone}</span>
      <span
        className="type-body-strong"
        style={{ color: cor }}
      >
        {rotulo}
      </span>
    </button>
  );
}

function Secao({ titulo }: { titulo: string }) {
  return (
    <div style={{ padding: '18px 24px 6px' }}>
      <span className="type-caption" style={{ color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
        {titulo}
      </span>
    </div>
  );
}

function Divisor() {
  return (
    <div style={{ padding: '8px 24px' }}>
      <div style={{ height: 1, background: 'var(--divider)' }} />
    </div>
  );
}