import { IconeImage, LogoBanco, LogoBandeira } from '../icons';
import { BarraDePrevisao } from './BarraDePrevisao';
import { TagFase } from './CardDeEntidade';
import { formatarBR, diaMesCurto } from '../lib/formato';

/**
 * Hero do drill-down do cartão (§5.3). Mesmas informações do card compacto da
 * Carteira (§5.6) — fase, valor realizado, barra de previsão, previsto restante
 * / excedente, evento (fecha/vence) — mas em layout próprio: bloco temático de
 * largura cheia, altura que abraça o conteúdo (cartão com previsão fica mais
 * alto que um sem). Tudo dentro do tema (inclusive a coluna direita e a tag).
 *
 * Não reusa CardDeEntidade de propósito: aquele componente serve Gerenciar/Cofre
 * (card cheio) e a Carteira (compacto); o hero é o terceiro contexto, com sua
 * própria geometria. Compartilha só a TagFase (tag de fase) para consistência.
 */
type Props = {
  nome: string;
  /** Realizado do ciclo — o número grande. */
  realizado: number;
  /** Teto previsto; null = sem previsão (sem barra nem previsto restante). */
  previsao: number | null;
  fase: 'aberta' | 'fechada';
  /** Dia do evento: fechamento (aberta) ou vencimento (fechada). */
  diaEvento: number;
  /** Mês do evento (0-11). */
  mesEvento: number;
  tema?: string;
  banco?: string | null;
  bandeira?: string | null;
};

export function CartaoHeroDrillDown({
  nome,
  realizado,
  previsao,
  fase,
  diaEvento,
  mesEvento,
  tema,
  banco,
  bandeira,
}: Props) {
  const temPrev = previsao != null && previsao > 0;
  const acima = temPrev && realizado > previsao!;
  const restante = temPrev ? Math.abs(realizado - previsao!) : 0;
  const eventoTexto = `${fase === 'fechada' ? 'vence' : 'fecha'} ${diaMesCurto(diaEvento, mesEvento)}`;

  return (
    <div
      data-card-theme={tema}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        width: '100%',
        padding: '18px 20px',
        borderRadius: 20,
        boxSizing: 'border-box',
        background: 'var(--theme-bg)',
        color: 'var(--theme-text)',
        border: '1px solid var(--divider)',
      }}
    >
      {/* Linha 1: logo + nome · bandeira */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <SlotLogo banco={banco} />
          <span className="type-numeric" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nome}</span>
        </span>
        <SlotBandeira bandeira={bandeira} />
      </div>

      {/* Linha 2: valor grande · previsto restante / excedente */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%' }}>
          <span className="type-display">{formatarBR(realizado, { prefixo: true })}</span>
          {temPrev && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center', gap: 2, flex: '1 1 0', minWidth: 0, textAlign: 'right' }}>
              <span className="type-micro-strong" style={{ color: 'var(--text-muted)' }}>
                {acima ? 'Acima da previsão' : 'Previsto Restante'}
              </span>
              <span className="type-body-strong" style={{ color: acima ? 'var(--value-saida)' : 'var(--theme-text)', opacity: acima ? 1 : 0.7 }}>
                {formatarBR(restante, { prefixo: true })}
              </span>
            </div>
          )}
        </div>
        <BarraDePrevisao realizado={realizado} previsao={previsao} />
      </div>

      {/* Linha 3: tag de fase · evento */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <TagFase fase={fase} tema={tema} />
        <span className="type-label" style={{ color: 'var(--theme-text)', opacity: 0.7 }}>{eventoTexto}</span>
      </div>
    </div>
  );
}

/** Slot do logo do banco (28px, fundo translúcido) — igual ao design do hero. */
function SlotLogo({ banco }: { banco?: string | null }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.18)', flexShrink: 0 }}>
      {banco ? <LogoBanco chave={banco} tamanho={18} /> : <IconeImage tamanho={18} />}
    </span>
  );
}

/** Slot da bandeira (36×24, fundo translúcido). */
function SlotBandeira({ bandeira }: { bandeira?: string | null }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 24, borderRadius: 4, background: 'rgba(255,255,255,0.18)', flexShrink: 0 }} aria-hidden>
      {bandeira ? <LogoBandeira chave={bandeira} tamanho={16} /> : <IconeImage tamanho={16} />}
    </span>
  );
}
