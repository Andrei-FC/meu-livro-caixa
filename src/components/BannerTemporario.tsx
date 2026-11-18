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
 * em fade. Não tem scrim e não trava a rolagem — não é diálogo.
 *
 * TOCAR NELE ABRE A EDIÇÃO do que acabou de ser lançado. O banner é a última
 * coisa na tela que ainda fala daquele lançamento, e errar o valor ou a conta e
 * ir atrás dele na lista é o caminho longo — o curto é tocar onde você já está
 * olhando. Por isso ele é um <button>, não um aviso decorativo.
 */

export type Aviso = {
  /** Linha de cima: a descrição do lançamento (ou "Transferência"). */
  titulo: string;
  valor: number;
  /** Cor do valor: entrada (+), saída (−) ou neutro (transferência). */
  variante: 'entrada' | 'saida' | 'neutro';
  /** Onde caiu: nome da conta/cartão, ou "Origem → Destino". */
  meio: string;
  /**
   * O que acabou de acontecer, quando não é "lançado": "Alterado", "Excluído",
   * "Desfeito" (§5.7). Vira prefixo da linha de baixo. Campo próprio, e não
   * texto já concatenado no `meio`, porque quem reage ao banner precisa saber
   * O QUE houve sem ler string.
   */
  estado?: string;
  /** Tema do swatch (§4.9) — da conta/cartão de destino do dinheiro. */
  tema?: string | null;
  /** Logo do banco (conta/cartão) ou chave de ícone (poupança). */
  icone?: string | null;
  ehPoupanca?: boolean;
  /**
   * Ação à direita, no lugar do valor — hoje só "Desfazer" (§5.7). Existe
   * porque editar e excluir precisam de volta, e o lugar natural dela é o
   * mesmo aviso que conta o que acabou de acontecer. O valor, quando há ação,
   * desce para a linha de baixo: o botão é o que se procura ali.
   */
  acao?: { rotulo: string; onClick: () => void };
};

type Props = {
  /** O aviso a mostrar; null = nada na tela. */
  aviso: Aviso | null;
  /** Chamado quando o tempo acaba. */
  onFim: () => void;
  /**
   * Toque no banner. Ausente = o toque apenas fecha (o banner vira só aviso).
   * Presente = abre a edição do lançamento que ele anuncia.
   */
  onAbrir?: () => void;
  /** Quanto tempo fica (ms). */
  duracaoMs?: number;
};

const COR: Record<Aviso['variante'], string> = {
  entrada: 'var(--value-entrada)',
  saida: 'var(--value-saida)',
  neutro: 'var(--value-neutro)',
};

export function BannerTemporario({ aviso, onFim, onAbrir, duracaoMs = 3600 }: Props) {
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
    // O wrapper só posiciona e anuncia (role=status); quem recebe o toque é o
    // botão, para teclado e leitor de tela tratarem isto como a ação que é.
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 'calc(var(--space-sm) + env(safe-area-inset-top))',
        left: 'var(--space-md)',
        right: 'var(--space-md)',
        zIndex: 90, // acima do FAB (40), abaixo dos sheets (100+)
        margin: '0 auto',
        maxWidth: 440,
        // Desce do topo e some em fade — mesma curva dos overlays.
        opacity: visivel ? 1 : 0,
        transform: visivel ? 'translateY(0)' : 'translateY(-12px)',
        transition: `opacity ${duracao}ms ${EASE_OVERLAY}, transform ${duracao}ms ${EASE_OVERLAY}`,
        willChange: 'transform, opacity',
      }}
    >
    <button
      type="button"
      onClick={onAbrir ?? onFim}
      aria-label={onAbrir ? `Editar ${dado.titulo}` : undefined}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        textAlign: 'left',
        padding: '12px 14px',
        borderRadius: 'var(--radius-lg)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)',
        cursor: 'pointer',
        font: 'inherit',
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
          {/* Com ação, a linha de baixo troca o ONDE pelo QUANTO: o botão come
              a largura, e a cor do swatch já diz de qual conta/cartão se
              trata. Sem ação (o "lançado"), o valor fica grande à direita e
              aqui mora o meio de pagamento. */}
          {dado.acao
            ? `${dado.estado ?? ''}${dado.estado ? ' · ' : ''}${sinal}${formatarBR(dado.valor, { prefixo: true })}`
            : dado.estado
            ? `${dado.estado} · ${dado.meio}`
            : dado.meio}
        </span>
      </div>

      {dado.acao ? (
        <span
          role="button"
          tabIndex={0}
          // Dentro de um <button>, outro <button> é HTML inválido — então a
          // ação é um span com papel de botão. onPointerDown para o toque não
          // escorregar para o banner inteiro (que abre a edição).
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); dado.acao!.onClick(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); dado.acao!.onClick(); } }}
          className="type-body-small-strong"
          style={{
            flex: '0 0 auto',
            color: 'var(--accent-default)',
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--accent-subtle)',
            cursor: 'pointer',
          }}
        >
          {dado.acao.rotulo}
        </span>
      ) : (
        <span className="type-body-small-strong" style={{ color: COR[dado.variante], flex: '0 0 auto' }}>
          {sinal}{formatarBR(dado.valor, { prefixo: true })}
        </span>
      )}
    </button>
    </div>
  );
}
