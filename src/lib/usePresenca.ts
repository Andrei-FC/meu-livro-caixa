import { useEffect, useState } from 'react';

/**
 * Presença animada para overlays (BottomSheet, MenuDrawer).
 *
 * O padrão `if (!aberto) return null` desmonta na hora — mata a animação de
 * SAÍDA. Este hook mantém o componente montado durante a transição de fechar e
 * só o remove depois de `duracao`. Também expõe um flag `entrando` para disparar
 * o estado final da transição no frame seguinte à montagem (senão o navegador
 * não anima, pois monta já no estado final).
 *
 * Uso:
 *   const { montado, visivel } = usePresenca(aberto);
 *   if (!montado) return null;
 *   // aplique estilos condicionados a `visivel` (true = estado aberto).
 */
export function usePresenca(aberto: boolean, duracao = 260) {
  const [montado, setMontado] = useState(aberto);
  const [visivel, setVisivel] = useState(false);

  // Respeita "reduzir movimento" do sistema: sem espera de saída (a11y).
  const semMovimento =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const dur = semMovimento ? 0 : duracao;

  useEffect(() => {
    if (aberto) {
      setMontado(true);
      const raf = requestAnimationFrame(() => setVisivel(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setVisivel(false);
      const t = setTimeout(() => setMontado(false), dur);
      return () => clearTimeout(t);
    }
  }, [aberto, dur]);

  return { montado, visivel, duracao: dur };
}

/** Curva de easing padrão dos overlays. */
export const EASE_OVERLAY = 'cubic-bezier(0.32, 0.72, 0, 1)';
