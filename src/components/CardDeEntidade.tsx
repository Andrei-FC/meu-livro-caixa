import { BarraDePrevisao } from './BarraDePrevisao';
import { formatarBR, diaMesCurto } from '../lib/formato';
import { IconeImage, LogoBanco, LogoBandeira, ICONES_POUPANCA } from '../icons';

/**
 * Card de entidade — §5.3, §4.9, Figma set 2018:36.
 * 4 tipos:
 *  - Conta    → card surface, testeira temática + body (valor + entradas/saídas)
 *  - Poupança → igual à Conta sem entradas/saídas (só valor)
 *  - Cofre    → igual à Poupança, testeira accent (fixa, não temática)
 *  - Cartão   → card inteiro temático, valor + Barra de previsão + legenda
 * Tema aplicado via data-card-theme (resolve --theme-bg / --theme-text), como a
 * Home já faz. Cartão pinta tudo; Conta/Poupança pintam só a testeira (§4.9).
 */

type Base = { nome: string; valor: number; tema?: string; banco?: string | null };

type ContaProps = Base & {
  tipo: 'conta';
  entradas: number;
  saidas: number;
  /** MODELO CARTEIRA (§5.6): layout compacto horizontal (ícone temático + saldo
   *  atual + entradas/saídas, sobre fundo neutro). Ausente = card cheio com
   *  testeira (Gerenciar Contas). Dívida temporária, como o cartão. */
  compacto?: boolean;
};
type PoupancaProps = Base & { tipo: 'poupanca'; /** Chave do ícone de poupança (§4.9). */ icone?: string | null };
type CofreProps = Base & { tipo: 'cofre' };
type CartaoProps = Base & {
  tipo: 'cartao';
  realizado: number;
  /** Teto previsto; null = sem previsão (sem barra, só acumula — §4.4). */
  previsao: number | null;
  /** Chave da bandeira (§4.9), opcional. */
  bandeira?: string | null;
  /** MODELO CARTEIRA (§5.6): fase do ciclo mostrado + evento. Presente = renderiza
   *  tag ("FATURA ABERTA/FECHADA") + "fecha/vence DD mmm" + Previsto Restante.
   *  Ausente = MODELO LEGENDA (drill-down/gerenciar): usa `legenda` livre.
   *  Dívida temporária: os dois modelos coexistem até o card grande migrar. */
  fase?: 'aberta' | 'fechada';
  /** Dia do evento (fechamento se aberta, vencimento se fechada). Com `fase`. */
  diaEvento?: number;
  /** Mês do evento (0-11). Com `fase`. */
  mesEvento?: number;
  /** MODELO LEGENDA: linha livre (ex.: "Previsão R$ X · fecha dia N"). Usado
   *  quando `fase` está ausente. */
  legenda?: string;
  /** Se presente, o card inteiro abre o drill-down ao tocar (§5.3). */
  onAbrir?: () => void;
};

type Props = ContaProps | PoupancaProps | CofreProps | CartaoProps;

const CARD: React.CSSProperties = {
  borderRadius: 'var(--radius-lg)',
  width: '100%',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

export function CardDeEntidade(props: Props) {
  if (props.tipo === 'cartao') return <Cartao {...props} />;
  if (props.tipo === 'conta' && props.compacto) return <ContaCompacta {...props} />;
  return <ComTesteira {...props} />;
}

/** Conta, Poupança e Cofre: testeira + body. */
function ComTesteira(props: ContaProps | PoupancaProps | CofreProps) {
  const { nome, valor, tema, tipo } = props;
  // Cofre usa accent fixo; Conta/Poupança usam o tema (ou elevated se sem tema).
  const testeiraBg =
    tipo === 'cofre'
      ? 'var(--accent-default)'
      : tema
      ? 'var(--theme-bg)'
      : 'var(--bg-elevated)';
  const testeiraFg = tipo === 'cofre' || tema ? 'var(--theme-text)' : 'var(--text-primary)';

  return (
    <div style={{ ...CARD, background: 'var(--bg-surface)' }} data-card-theme={tipo === 'cofre' ? undefined : tema}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px var(--space-lg)',
          background: testeiraBg,
          color: testeiraFg,
        }}
      >
        {props.tipo === 'poupanca'
          ? <SlotIconePoupanca icone={props.icone} />
          : <SlotLogo banco={props.tipo === 'cofre' ? null : props.banco} />}
        <span className="type-numeric">{nome}</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)', padding: '14px var(--space-lg) var(--space-lg)' }}>
        <span className="type-display" style={{ color: 'var(--text-primary)' }}>
          {formatarBR(valor, { prefixo: true })}
        </span>

        {props.tipo === 'conta' && (
          <div style={{ display: 'flex', gap: 'var(--space-xl)' }}>
            <Mini rotulo="Entradas" cor="var(--value-entrada)" texto={formatarBR(props.entradas, { sinal: '+' })} />
            <Mini rotulo="Saídas" cor="var(--value-saida)" texto={formatarBR(-Math.abs(props.saidas))} />
          </div>
        )}
      </div>
    </div>
  );
}

/** Conta compacta (§5.6, aba Carteira): layout horizontal, sem card de surface —
 *  tudo sobre o fundo neutro. Ícone quadrado temático à esquerda; centro com
 *  nome + saldo atual + rótulo; direita com Entradas/Saídas empilhadas. */
function ContaCompacta({ nome, valor, tema, banco, entradas, saidas }: ContaProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, width: '100%' }}>
      {/* Ícone quadrado temático + identidade (centro) */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flex: '1 1 0', minWidth: 0 }}>
        <span
          data-card-theme={tema}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 68,
            height: 68,
            borderRadius: 16,
            flexShrink: 0,
            background: tema ? 'var(--theme-bg)' : 'var(--bg-elevated)',
            color: tema ? 'var(--theme-text)' : 'var(--text-primary)',
          }}
        >
          {banco ? <LogoBanco chave={banco} tamanho={34} /> : <IconeImage tamanho={30} />}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, color: 'var(--text-primary)' }}>
          <span className="type-numeric" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
          <span className="type-title">{formatarBR(valor, { prefixo: true })}</span>
          <span className="type-micro-strong" style={{ color: 'var(--text-muted)' }}>Saldo Atual</span>
        </div>
      </div>

      {/* Entradas / Saídas empilhadas, alinhadas à direita */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, flexShrink: 0, textAlign: 'right' }}>
        <MiniCarteira rotulo="Entradas" cor="var(--value-entrada)" texto={formatarBR(entradas, { sinal: '+' })} />
        <MiniCarteira rotulo="Saídas" cor="var(--value-saida)" texto={formatarBR(-Math.abs(saidas))} />
      </div>
    </div>
  );
}

/** Bloco Entradas/Saídas da conta compacta: rótulo micro-strong muted + valor
 *  body-small-strong colorido, alinhados à direita. */
function MiniCarteira({ rotulo, cor, texto }: { rotulo: string; cor: string; texto: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
      <span className="type-micro-strong" style={{ color: 'var(--text-muted)' }}>{rotulo}</span>
      <span className="type-body-small-strong" style={{ color: cor }}>{texto}</span>
    </div>
  );
}

function Cartao(props: CartaoProps) {
  const { nome, valor, tema, realizado, previsao, banco, bandeira, onAbrir } = props;
  const modeloCarteira = props.fase != null;

  const abridor = onAbrir
    ? {
        onClick: onAbrir,
        role: 'button' as const,
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); }
        },
        style: { cursor: 'pointer' as const },
      }
    : {};

  const shell: React.CSSProperties = {
    ...CARD,
    padding: '18px 20px',
    gap: 14,
    background: 'var(--theme-bg)',
    color: 'var(--theme-text)',
    ...(abridor.style ?? {}),
  };

  // MODELO LEGENDA (drill-down / gerenciar): layout vertical original.
  if (!modeloCarteira) {
    return (
      <div style={shell} data-card-theme={tema} onClick={abridor.onClick} role={abridor.role} tabIndex={abridor.tabIndex} onKeyDown={abridor.onKeyDown}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <SlotLogo banco={banco} />
            <span className="type-numeric">{nome}</span>
          </span>
          <SlotBandeira bandeira={bandeira} />
        </div>
        <span className="type-display">{formatarBR(valor, { prefixo: true })}</span>
        <BarraDePrevisao
          realizado={realizado}
          previsao={previsao}
          rotulo={previsao != null ? `${formatarBR(realizado)} de ${formatarBR(previsao)} previstos` : undefined}
        />
        <span className="type-label">{props.legenda}</span>
      </div>
    );
  }

  // MODELO CARTEIRA (§5.6): bloco temático CONTIDO à esquerda + coluna de
  // metadados à direita, sobre o fundo NEUTRO da tela (fora do tema).
  const fase = props.fase!;
  const diaEvento = props.diaEvento!;
  const mesEvento = props.mesEvento!;
  const temPrev = previsao != null && previsao > 0;
  const acima = temPrev && realizado > previsao!;
  const restante = temPrev ? Math.abs(realizado - previsao!) : 0;
  const eventoTexto = `${fase === 'fechada' ? 'vence' : 'fecha'} ${diaMesCurto(diaEvento, mesEvento)}`;

  return (
    <div
      style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, width: '100%', ...(abridor.style ?? {}) }}
      onClick={abridor.onClick}
      role={abridor.role}
      tabIndex={abridor.tabIndex}
      onKeyDown={abridor.onKeyDown}
    >
      {/* Bloco temático contido, tamanho FIXO (parece cartão): 231×145. Topo no
          topo, base na base; sem barra, o texto desce ocupando o lugar dela. */}
      <div
        data-card-theme={tema}
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          width: 231,
          height: 145,
          padding: 12,
          borderRadius: 16,
          background: 'var(--theme-bg)',
          color: 'var(--theme-text)',
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <SlotLogo banco={banco} />
          <SlotBandeira bandeira={bandeira} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%', minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span className="type-numeric" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
            <span className="type-title">{formatarBR(valor, { prefixo: true })}</span>
          </div>
          <BarraDePrevisao realizado={realizado} previsao={previsao} />
        </div>
      </div>

      {/* Coluna direita: tag + evento (topo) · previsto restante (base) — fundo
          neutro, largura fixa, tudo alinhado à direita. */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', alignSelf: 'stretch', width: 96, flexShrink: 0, textAlign: 'right' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          <TagFase fase={fase} tema={tema} />
          <span className="type-label" style={{ color: 'var(--text-primary)', opacity: 0.7 }}>{eventoTexto}</span>
        </div>
        {temPrev && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
            <span className="type-micro-strong" style={{ color: 'var(--text-muted)' }}>
              {acima ? 'Acima da previsão' : 'Previsto Restante'}
            </span>
            <span className="type-body-strong" style={{ color: acima ? 'var(--value-saida)' : 'var(--text-primary)', opacity: acima ? 1 : 0.7 }}>
              {formatarBR(restante, { prefixo: true })}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/** Tag de fase da fatura (§5.6). Aberta = chip claro (bg-elevated + text-secondary);
 *  fechada = tema do próprio cartão (theme-bg + theme-text). */
/** Tag de fase da fatura (§5.6). Aberta = chip claro (bg-elevated + text-secondary);
 *  fechada = tema do próprio cartão (theme-bg + theme-text) + border. Compartilhada
 *  entre o card compacto da Carteira e o hero do drill-down. */
export function TagFase({ fase, tema }: { fase: 'aberta' | 'fechada'; tema?: string }) {
  const fechada = fase === 'fechada';
  return (
    <span
      className="type-micro-strong"
      data-card-theme={fechada ? tema : undefined}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 10px',
        borderRadius: 'var(--radius-sm)',
        whiteSpace: 'nowrap',
        background: fechada ? 'var(--theme-bg)' : 'var(--bg-elevated)',
        color: fechada ? 'var(--theme-text)' : 'var(--text-secondary)',
        border: fechada ? '1px solid var(--border-default)' : undefined,
      }}
    >
      {fechada ? 'FECHADA' : 'ABERTA'}
    </span>
  );
}

function Mini({ rotulo, cor, texto }: { rotulo: string; cor: string; texto: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span className="type-micro" style={{ color: 'var(--text-muted)' }}>{rotulo}</span>
      <span className="type-body-small-strong" style={{ color: cor }}>{texto}</span>
    </div>
  );
}

/* Slots de logo/bandeira: renderizam o logo real da biblioteca (§4.9) quando há
   chave; sem chave, caem no placeholder neutro. O logo herda currentColor, então
   sobre fundo temático fica com a cor do texto do tema. */
function SlotLogo({ banco }: { banco?: string | null }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.18)' }}>
      {banco ? <LogoBanco chave={banco} tamanho={20} /> : <IconeImage tamanho={18} />}
    </span>
  );
}
/** Slot do ícone temático de poupança (§4.9). Resolve da biblioteca própria;
 *  sem ícone cai no placeholder, igual ao SlotLogo. */
function SlotIconePoupanca({ icone }: { icone?: string | null }) {
  const Icone = icone ? ICONES_POUPANCA[icone] : null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.18)' }}>
      {Icone ? <Icone tamanho={18} /> : <IconeImage tamanho={18} />}
    </span>
  );
}
function SlotBandeira({ bandeira }: { bandeira?: string | null }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 24, borderRadius: 4, background: 'rgba(255,255,255,0.18)' }} aria-hidden>
      {bandeira ? <LogoBandeira chave={bandeira} tamanho={20} /> : null}
    </span>
  );
}
