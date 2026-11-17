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

import { useEffect, useRef } from 'react';
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
  /** Rótulo do mês corrente, ex.: "Junho 2026". Ausente = header só com menu
   *  (aba Cartões — cartão vive no ciclo, sem seletor de mês; §5.6). */
  mesAno?: string;
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
  /**
   * COLAPSO DO HERO (§5.3/§5.6). Quando o hero da entidade sai da tela por
   * baixo do header, a identidade não pode sumir junto — ela sobe para cá: o
   * header se PINTA com a cor da entidade (§4.9) e mostra ícone + nome. É o
   * padrão "título grande vira título pequeno" dos apps de iOS, com a cor
   * fazendo o papel de dizer *onde* você está. Falso = header normal
   * (translúcido sobre a página).
   */
  colapsado?: boolean;
  /** Tema da entidade (§4.9). Sem tema, o header colapsado usa o accent. */
  tema?: string | null;
  /** Ícone da entidade (logo do banco, ícone de poupança) ao lado do nome. */
  icone?: React.ReactNode;
};

type Props = DefaultProps | ChuldProps;

export function Header(props: Props) {
  // O header é sticky de forma UNIVERSAL (todas as telas) e publica a própria
  // altura em `--altura-header` no :root, para que blocos que grudam logo
  // abaixo (as tabs da Home, §5.1) se posicionem sem medir nada por conta
  // própria. Publicar via CSS var (em vez de estado React na tela) sobrevive a
  // desmontar/remontar a tela ao navegar (ex.: entrar/sair do drill-down): a
  // cada montagem do header a variável é reescrita.
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const publicar = () =>
      document.documentElement.style.setProperty('--altura-header', `${el.offsetHeight}px`);
    publicar();
    const ro = new ResizeObserver(publicar);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (props.variante === 'chuld') return <HeaderChuld {...props} innerRef={ref} />;
  return <HeaderDefault {...props} innerRef={ref} />;
}

/** Estilo comum do <header> sticky (universal). O fundo NÃO é opaco: quem dá
 *  o efeito é uma camada `headerFade` posicionada atrás do conteúdo, com
 *  desfoque + gradiente de opacidade (estilo iOS). A borda de baixo some junto
 *  com a máscara. */
const headerSticky: React.CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 20,
  // Sem background aqui — a camada headerFade cuida do visual.
  paddingTop: 'env(safe-area-inset-top)',
  isolation: 'isolate',
};

/** Camada de fundo do header: blur + gradiente de opacidade. Fica ATRÁS do
 *  conteúdo (zIndex -1 no contexto isolado do header). A `mask` faz TANTO a cor
 *  QUANTO o blur desvanecerem, indo de pleno no topo a 0 na base — sem isso o
 *  backdrop-filter deixaria uma borda seca na base. Opaco no topo (borda da
 *  tela, onde o conteúdo precisa sumir de vez, já que num web app não há como
 *  "cortar" na borda superior) e transparente na base (encontra a lista). */
const headerFade: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  zIndex: -1,
  pointerEvents: 'none',
  // Cor: opaca no TOPO (borda da tela, onde o conteúdo deve sumir de vez) →
  // transparente na base (onde encontra a lista).
  background:
    'linear-gradient(to bottom, var(--bg-page) 0%, var(--bg-page) 45%, color-mix(in srgb, var(--bg-page) 55%, transparent) 72%, transparent 100%)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  // Máscara: o blur é pleno no topo (100%) e desvanece para baixo (0%).
  maskImage: 'linear-gradient(to bottom, black 0%, black 45%, transparent 92%)',
  WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 45%, transparent 92%)',
};

function HeaderDefault({ mesAno, onMenu, onAnterior, onProximo, innerRef }: DefaultProps & { innerRef: React.Ref<HTMLElement> }) {
  // Sem mesAno = header só com menu (aba Cartões — cartão vive no ciclo, não no
  // mês, então não há seletor de mês; §5.6).
  const semData = !mesAno;
  return (
    <header ref={innerRef} style={headerSticky}>
      <div aria-hidden style={headerFade} />
      <div style={topBar}>
        {/* Menu — pill 40 */}
        <button type="button" aria-label="Menu" onClick={onMenu} style={{ ...botaoPill, width: 40, height: 40 }}>
          <IconeMenu tamanho={22} />
        </button>

        {/* Navegação de mês (omitida quando não há mesAno) */}
        {!semData && (
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
        )}
      </div>
    </header>
  );
}

/** Duração do cross-fade do colapso — curto, é reação à rolagem, não entrada. */
const TRANSICAO = '180ms ease';

function HeaderChuld({ titulo, onVoltar, fechar = false, fab = false, onFab, mostrarData = false, mesAno, onAnterior, onProximo, colapsado = false, tema, icone, innerRef }: ChuldProps & { innerRef: React.Ref<HTMLElement> }) {
  // Pintado = colapsado. A cor é a da entidade; sem tema, o accent do app.
  // `tinta` é o par de contraste que o tema já garante (§4.9) — nunca um
  // cinza nosso por cima da cor do banco.
  const tinta = colapsado ? (tema ? 'var(--theme-text)' : 'var(--text-on-accent)') : 'var(--text-primary)';
  // Pills sobre cor: vidro da própria tinta, em vez do surface claro, que
  // viraria um bloco branco no meio do vermelho.
  const pill: React.CSSProperties = colapsado
    ? {
        ...botaoPill,
        color: tinta,
        background: `color-mix(in srgb, ${tinta} 18%, transparent)`,
        borderColor: `color-mix(in srgb, ${tinta} 32%, transparent)`,
      }
    : botaoPill;
  // A identidade (ícone + nome) ocupa o lugar do título. Fica sempre montada
  // para o cross-fade ter o que animar nos dois sentidos.
  const identidade = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--space-sm)',
        minWidth: 0,
        color: tinta,
        opacity: colapsado ? 1 : 0,
        transform: colapsado ? 'translateY(0)' : 'translateY(6px)',
        transition: `opacity ${TRANSICAO}, transform ${TRANSICAO}`,
        pointerEvents: colapsado ? undefined : 'none',
      }}
      aria-hidden={!colapsado}
    >
      {icone && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{icone}</span>}
      {/* 16px (type-numeric, o mesmo peso do nome nos cards) e não 20: aqui o
          nome divide a barra com o seletor de mês, e em 20 "Conta Santander"
          virava "Conta …" num iPhone. É o "título pequeno" do padrão. */}
      <span className="type-numeric" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {titulo}
      </span>
    </span>
  );

  return (
    // O tema vai no <header>, não na camada de fundo: `--theme-bg`/`--theme-text`
    // são herdados, então precisam estar num ANCESTRAL de quem os usa. Com o
    // atributo só na camada, o fundo pintava mas o texto e os botões ficavam
    // com o token vazio — ou seja, texto escuro e pill branca sobre a cor.
    <header ref={innerRef} data-card-theme={tema ?? undefined} style={headerSticky}>
      {/* Duas camadas de fundo em cross-fade: a translúcida de sempre e a cor
          da entidade, que entra quando o hero sai de vista. */}
      <div aria-hidden style={{ ...headerFade, opacity: colapsado ? 0 : 1, transition: `opacity ${TRANSICAO}` }} />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: -1,
          pointerEvents: 'none',
          background: tema ? 'var(--theme-bg)' : 'var(--accent-default)',
          opacity: colapsado ? 1 : 0,
          transition: `opacity ${TRANSICAO}`,
        }}
      />
      <div style={topBar}>
        {/* Voltar (ou fechar) + título */}
        <div style={{ display: 'flex', flex: '1 0 0', alignItems: 'center', gap: 'var(--space-sm)', minWidth: 0 }}>
          <button
            type="button"
            aria-label={fechar ? 'Fechar' : 'Voltar'}
            onClick={onVoltar}
            style={{ ...pill, width: 40, height: 40 }}
          >
            {fechar ? <IconeClose tamanho={20} /> : <IconeChevronLeft tamanho={20} />}
          </button>
          {fechar ? (
            // Drill-down: o título fica escondido até o hero sumir — aí a
            // identidade sobe para cá.
            identidade
          ) : (
            <span
              className="type-title"
              style={{ color: tinta, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transition: `color ${TRANSICAO}` }}
            >
              {titulo}
            </span>
          )}
        </div>

        {/* Seletor de mês opcional (drill-down do cartão, §5.3) */}
        {mostrarData && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-xs)', flex: '0 0 auto' }}>
            <button type="button" aria-label="Mês anterior" onClick={onAnterior} style={{ ...pill, width: 36, height: 36 }}>
              <IconeChevronLeft tamanho={18} />
            </button>
            <span
              className="type-title"
              // Sem `capitalize`: aqui o rótulo é uma frase ("Fatura de nov"),
              // e capitalize maiusculiza CADA palavra ("Fatura De Nov"). A tela
              // entrega o texto já como deve ser lido.
              style={{ color: tinta, padding: '0 var(--space-xs)', whiteSpace: 'nowrap', transition: `color ${TRANSICAO}` }}
            >
              {mesAno}
            </span>
            <button type="button" aria-label="Próximo mês" onClick={onProximo} style={{ ...pill, width: 36, height: 36 }}>
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
