import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { usePresenca, EASE_OVERLAY } from '../lib/usePresenca';

/**
 * BottomSheet — primitivo de container (§5.2, §5.7).
 * Folha ancorada na base da viewport, com scrim por cima do resto. Estrutura
 * do Figma: scrim (overlay/scrim) + Sheet (bg/sheet, cantos superiores raio 20)
 * → grabber (barrinha) → conteúdo. Usado pelo Lançar, pelo seletor de
 * conta/cartão e, no futuro, pela edição e pelo escopo de série.
 *
 * Fecha ao tocar no scrim ou apertar Esc. O conteúdo decide seu próprio
 * layout interno (header, body rolável, footer fixo) — este primitivo só
 * cuida do enquadramento e do scrim.
 */

type Props = {
  aberto: boolean;
  onFechar: () => void;
  children: ReactNode;
  /** Rótulo acessível do diálogo. */
  'aria-label'?: string;
  /** z-index — sheets empilhados (seletor sobre o Lançar) sobem este valor. */
  zIndex?: number;
};

export function BottomSheet({
  aberto,
  onFechar,
  children,
  'aria-label': ariaLabel,
  zIndex = 100,
}: Props) {
  const { montado, visivel, duracao } = usePresenca(aberto);

  // Esc fecha; trava o scroll do fundo enquanto montado.
  useEffect(() => {
    if (!montado) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onFechar(); };
    document.addEventListener('keydown', onKey);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflowAnterior;
    };
  }, [montado, onFechar]);

  if (!montado) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      onClick={onFechar}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        background: 'var(--overlay-scrim)',
        zIndex,
        // Scrim em fade.
        opacity: visivel ? 1 : 0,
        transition: `opacity ${duracao}ms ${EASE_OVERLAY}`,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg-sheet)',
          borderTopLeftRadius: 'var(--radius-lg)',
          borderTopRightRadius: 'var(--radius-lg)',
          width: '100%',
          maxWidth: 480,
          margin: '0 auto',
          maxHeight: '92dvh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          // Sobe de baixo.
          transform: visivel ? 'translateY(0)' : 'translateY(100%)',
          transition: `transform ${duracao}ms ${EASE_OVERLAY}`,
          willChange: 'transform',
        }}
      >
        {/* grabber (Figma: barrinha 36×4, slate, raio full) */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
          <span
            aria-hidden
            style={{
              width: 36,
              height: 4,
              borderRadius: 'var(--radius-full)',
              background: 'var(--border-default)',
            }}
          />
        </div>
        {children}
      </div>
    </div>
  );
}
