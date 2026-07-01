import { BarraDePrevisao } from './BarraDePrevisao';
import { formatarBR } from '../lib/formato';
import { IconeImage, LogoBanco, LogoBandeira } from '../icons';

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
};
type PoupancaProps = Base & { tipo: 'poupanca' };
type CofreProps = Base & { tipo: 'cofre' };
type CartaoProps = Base & {
  tipo: 'cartao';
  realizado: number;
  previsao: number;
  /** Chave da bandeira (§4.9), opcional. */
  bandeira?: string | null;
  /** Legenda já montada (ex.: "29% da previsão · fecha 30 jun"). */
  legenda: string;
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
        <SlotLogo banco={props.tipo === 'cofre' ? null : props.banco} />
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

function Cartao({ nome, valor, tema, realizado, previsao, legenda, banco, bandeira }: CartaoProps) {
  return (
    <div
      style={{ ...CARD, padding: '18px 20px', gap: 14, background: 'var(--theme-bg)', color: 'var(--theme-text)' }}
      data-card-theme={tema}
    >
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
        rotulo={`${formatarBR(realizado)} de ${formatarBR(previsao)} previstos`}
      />

      <span className="type-label">{legenda}</span>
    </div>
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
function SlotBandeira({ bandeira }: { bandeira?: string | null }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 24, borderRadius: 4, background: 'rgba(255,255,255,0.18)' }} aria-hidden>
      {bandeira ? <LogoBandeira chave={bandeira} tamanho={20} /> : null}
    </span>
  );
}
