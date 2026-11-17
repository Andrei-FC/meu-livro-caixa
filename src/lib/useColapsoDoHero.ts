import { useEffect, useRef, useState } from 'react';

/**
 * "O hero ainda está à vista?" — para o header colapsante dos drill-downs
 * (§5.3, §5.6).
 *
 * Observa o hero contra a borda de baixo do header (que já publica a própria
 * altura em `--altura-header`): quando o hero passa inteiro por trás dele, a
 * tela colapsa o header — que se pinta com a cor da entidade e assume o ícone
 * e o nome. A identidade nunca some da tela; ela muda de lugar.
 *
 * IntersectionObserver em vez de ouvir `scroll`: o navegador avisa só na
 * virada, sem recalcular layout a cada frame de rolagem (o alvo é um iPhone).
 *
 * Uso:
 *   const { ref, colapsado } = useColapsoDoHero<HTMLDivElement>();
 *   <Header colapsado={colapsado} … /> … <div ref={ref}><Hero/></div>
 */
export function useColapsoDoHero<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [colapsado, setColapsado] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Altura publicada pelo próprio Header. O efeito do header (filho) roda
    // antes deste (pai), então a variável já existe aqui. Fallback defensivo:
    // sem ela, observa contra o topo da viewport — colapsa um pouco tarde, não
    // quebra.
    const lida = getComputedStyle(document.documentElement).getPropertyValue('--altura-header');
    const alturaHeader = parseFloat(lida) || 0;

    const io = new IntersectionObserver(
      ([entrada]) => setColapsado(!entrada.isIntersecting),
      { root: null, rootMargin: `-${alturaHeader}px 0px 0px 0px`, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return { ref, colapsado };
}
