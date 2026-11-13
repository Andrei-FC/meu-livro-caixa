import { useEffect, useRef } from 'react';
import { usePresenca, EASE_OVERLAY } from '../lib/usePresenca';
import { IconeImage, LogoBanco, ICONES_POUPANCA } from '../icons';
import { formatarBR } from '../lib/formato';

/**
 * BannerTemporario — confirmação efêmera no topo (§5.2).
 * Aparece depois de gravar um lançamento dizendo O QUÊ, QUANTO e ONDE, e some
 * sozinho. Existe por causa do default esperto do meio de pagamento (§5.2,
 * passo 5): o campo Conta vem preenchido sem o usuário tocar nele, então o app
 * deve PROVAR onde lançou — ninguém precisa abrir o extrato pra conferir se o
 * gasto caiu no cartão certo. "Ver, não controlar" (princípio 5): ele informa,
 * não pede confirmação, não tem botão de desfazer e nunca bloqueia o caminho.
 *
 * Mesma gramática de presença dos overlays (usePresenca): desce do topo, some
 * em fade. Toque fecha antes da hora. Não tem scrim e não trava a rolagem —
 * não é diálogo.
 */

export type Aviso = {
  /** Linha de cima: a descrição do lançamento (ou "Transferência"). */
  titulo: string;
  valor: number;
  /** Cor do valor: entrada (+), saída (−) ou neutro (transferência). */
  variante: 'entrada' | 'saida' | 'neutro';
  /** Onde caiu: nome da conta/cartão, ou "Origem → Destino". */
  meio: string;
  /** Tema do swatch (§4.9) — da conta/cartão de destino do dinheiro. */
  tema?: string | null;
  /** Logo do banco (conta/cartão) ou chave de ícone (poupança). */
  icone?: string | null;
  ehPoupanca?: boolean;
};

type Props = {
  /** O aviso a mostrar; null = nada na tela. */
  aviso: Aviso | null;
  /** Chamado quando o banner termina (tempo esgotado ou toque). */
  onFim: () => void;
  /** Quanto tempo fica (ms). */
  duracaoMs?: number;
};

const COR: Record<Aviso['variante'], string> = {
  entrada: 'var(--value-entrada)',
  saida: 'var(--value-saida)',
  neutro: 'var(--value-neutro)',
};

export function BannerTemporario({ aviso, onFim, duracaoMs = 3600 }: Props) {
  const { montado, visivel, duracao } = usePresenca(aviso !== null);

  // Guarda o último conteúdo para a animação de SAÍDA ter o que desenhar —
  // quando `aviso` vira null o componente ainda fica montado por `duracao`.
  const ultimo = useRef<Aviso | null>(null);
  if (aviso) ultimo.current = aviso;
  const dado = aviso ?? ultimo.current;

  // Relógio: reinicia a cada aviso novo (dois lançamentos seguidos não
  // encurtam o segundo banner).
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(onFim, duracaoMs);
    return () => clearTimeout(t);
  }, [aviso, duracaoMs, onFim]);

  if (!montado || !dado) return null;

  const semTema = !dado.tema;
  const IconePoup = dado.ehPoupanca && dado.icone ? ICONES_POUPANCA[dado.icone] : null;
  const sinal = dado.variante === 'entrada' ? '+' : dado.variante === 'saida' ? '−' : '';

  return (
    <div
      role="status"
      aria-live="polite"
      onClick={onFim}
      style={{
        position: 'fixed',
        top: 'calc(var(--space-sm) + env(safe-area-inset-top))',
        left: 'var(--space-md)',
        right: 'var(--space-md)',
        zIndex: 90, // acima do FAB (40), abaixo dos sheets (100+)
        margin: '0 auto',
        maxWidth: 440,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)',
        cursor: 'pointer',
        // Desce do topo e some em fade — mesma curva dos overlays.
        opacity: visivel ? 1 : 0,
        transform: visivel ? 'translateY(0)' : 'translateY(-12px)',
        transition: `opacity ${duracao}ms ${EASE_OVERLAY}, transform ${duracao}ms ${EASE_OVERLAY}`,
        willChange: 'transform, opacity',
      }}
    >
      {/* Swatch do meio — mesmo contrato visual do seletor (§4.9). */}
      <span
        aria-hidden
        data-card-theme={dado.tema ?? undefined}
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
        {dado.ehPoupanca
          ? (IconePoup ? <IconePoup tamanho={20} /> : <IconeImage tamanho={20} />)
          : (dado.icone ? <LogoBanco chave={dado.icone} tamanho={20} /> : <IconeImage tamanho={20} />)}
      </span>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
        <span
          className="type-body-strong"
          style={{
            color: 'var(--text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {dado.titulo}
        </span>
        <span
          className="type-caption"
          style={{
            color: 'var(--text-muted)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {dado.meio}
        </span>
      </div>

      <span className="type-body-small-strong" style={{ color: COR[dado.variante], flex: '0 0 auto' }}>
        {sinal}{formatarBR(dado.valor, { prefixo: true })}
      </span>
    </div>
  );
}
