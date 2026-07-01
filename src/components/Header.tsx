/**
 * Header — §5.1 / §5.8, Figma component set 2221:949 (Header).
 *
 * Duas variantes (propriedade "Property 1" no Figma):
 *  - Default  → topo das telas da Home: botão de menu (abre o drawer) à esquerda
 *               e navegação de mês (‹ Mês Ano ›) à direita. O seletor de mês
 *               controla todas as abas.
 *  - Chuld    → topo das páginas próprias (drill-down, gerenciar, criar/editar):
 *               seta de voltar + título à esquerda e, opcionalmente, um FAB `+`
 *               à direita (booleano FAB do componente). Usado em: Cartão—Fatura,
 *               Cofre, Poupança, Gerenciar Contas/Cartões, Criar/Editar Conta/Cartão.
 *
 * Estrutura do Figma (ambas): wrapper pt-12 → TopBar (px-16 py-12, space-between).
 *   Default: MenuBtn (pill 40) | MonthNav (‹ pill 36 › · título · › pill 36 ›).
 *   Chuld:   [voltar pill 40 + título] | (FAB pill 40 accent, opcional).
 *
 * Só visual + callbacks; não conhece estado (vem por props).
 */

import { IconeMenu, IconeChevronLeft, IconeChevronRight, IconeAdd, IconeClose } from '../icons';

const botaoPill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-default)',
  borderRadius: 'var(--radius-lg)',
  color: 'var(--text-primary)',
  cursor: 'pointer',
  flexShrink: 0,
  padding: 0,
};

const topBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 'var(--space-md) var(--space-lg)',
  width: '100%',
};

/* ───────── Variante Default (Home) ───────── */

type DefaultProps = {
  variante?: 'default';
  /** Rótulo do mês corrente, ex.: "Junho 2026". */
  mesAno: string;
  /** Toca no menu (abre o drawer de gestão, §5.8). */
  onMenu?: () => void;
  onAnterior?: () => void;
  onProximo?: () => void;
};

/* ───────── Variante Chuld (páginas próprias) ───────── */

type ChuldProps = {
  variante: 'chuld';
  /** Título da página, ex.: "Contas", "Novo Cartão", nome do cartão. */
  titulo: string;
  /** Seta de voltar (ou fechar, ver `fechar`). */
  onVoltar?: () => void;
  /** Botão esquerdo vira X (fechar) e o título é omitido — drill-down do cartão
   *  (§5.3, design atualizado no Figma). Default false (seta + título). */
  fechar?: boolean;
  /** Mostra o FAB `+` à direita (gerenciar: criar nova entidade). Default false. */
  fab?: boolean;
  /** Toca no FAB. */
  onFab?: () => void;
  /** Mostra o seletor de mês (‹ Mês Ano ›) à direita — drill-down do cartão
   *  (§5.3, Figma prop "Show Date"). Requer mesAno. Default false. */
  mostrarData?: boolean;
  /** Rótulo do mês exibido, ex.: "Junho 2026". Só usado com mostrarData. */
  mesAno?: string;
  onAnterior?: () => void;
  onProximo?: () => void;
};

type Props = DefaultProps | ChuldProps;

export function Header(props: Props) {
  if (props.variante === 'chuld') return <HeaderChuld {...props} />;
  return <HeaderDefault {...props} />;
}

function HeaderDefault({ mesAno, onMenu, onAnterior, onProximo }: DefaultProps) {
  return (
    <header style={{ paddingTop: 'var(--space-md)' }}>
      <div style={topBar}>
        {/* Menu — pill 40 */}
        <button type="button" aria-label="Menu" onClick={onMenu} style={{ ...botaoPill, width: 40, height: 40 }}>
          <IconeMenu tamanho={22} />
        </button>

        {/* Navegação de mês */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
          <button type="button" aria-label="Mês anterior" onClick={onAnterior} style={{ ...botaoPill, width: 36, height: 36 }}>
            <IconeChevronLeft tamanho={18} />
          </button>

          <span
            className="type-title"
            style={{ color: 'var(--text-primary)', padding: '0 var(--space-xs)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}
          >
            {mesAno}
          </span>

          <button type="button" aria-label="Próximo mês" onClick={onProximo} style={{ ...botaoPill, width: 36, height: 36 }}>
            <IconeChevronRight tamanho={18} />
          </button>
        </div>
      </div>
    </header>
  );
}

function HeaderChuld({ titulo, onVoltar, fechar = false, fab = false, onFab, mostrarData = false, mesAno, onAnterior, onProximo }: ChuldProps) {
  return (
    <header style={{ paddingTop: 'var(--space-md)' }}>
      <div style={topBar}>
        {/* Voltar (ou fechar) + título */}
        <div style={{ display: 'flex', flex: '1 0 0', alignItems: 'center', gap: 'var(--space-sm)', minWidth: 0 }}>
          <button
            type="button"
            aria-label={fechar ? 'Fechar' : 'Voltar'}
            onClick={onVoltar}
            style={{ ...botaoPill, width: 40, height: 40 }}
          >
            {fechar ? <IconeClose tamanho={20} /> : <IconeChevronLeft tamanho={20} />}
          </button>
          {!fechar && (
            <span
              className="type-title"
              style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {titulo}
            </span>
          )}
        </div>

        {/* Seletor de mês opcional (drill-down do cartão, §5.3) */}
        {mostrarData && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flex: '0 0 auto' }}>
            <button type="button" aria-label="Mês anterior" onClick={onAnterior} style={{ ...botaoPill, width: 36, height: 36 }}>
              <IconeChevronLeft tamanho={18} />
            </button>
            <span
              className="type-title"
              style={{ color: 'var(--text-primary)', padding: '0 var(--space-xs)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}
            >
              {mesAno}
            </span>
            <button type="button" aria-label="Próximo mês" onClick={onProximo} style={{ ...botaoPill, width: 36, height: 36 }}>
              <IconeChevronRight tamanho={18} />
            </button>
          </div>
        )}

        {/* FAB `+` opcional (criar nova entidade nas telas de gerenciar) */}
        {fab && (
          <button
            type="button"
            aria-label="Adicionar"
            onClick={onFab}
            style={{
              ...botaoPill,
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-full)',
              background: 'var(--accent-default)',
              border: 'none',
              color: 'var(--text-on-accent)',
            }}
          >
            <IconeAdd tamanho={24} />
          </button>
        )}
      </div>
    </header>
  );
}
