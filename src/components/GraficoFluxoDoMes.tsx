import { useId, useMemo, useRef, useState, useCallback } from 'react';
import type { PontoFluxo } from '../lib/recorrencia';
import { formatarBR } from '../lib/formato';

/**
 * Gráfico "fluxo do mês" (§5.5) — linha do SALDO EM CONTA ao longo dos dias do
 * mês. Não é gasto: é o dinheiro disponível dia a dia, partindo do herdado
 * (§4.7) e cobrindo o mês inteiro, fato + projeção (§5.1). Picos e vales deixam
 * ver dias com saídas concentradas. Só leitura, como o resto do Relatório.
 *
 * SVG puro (sem lib), curva suavizada (Catmull-Rom → Bézier), área com leve
 * gradiente. Cores/tipografia por token. Figma: 2301:1573.
 *
 * SCRUBBING (Popover grafico de fluxo, Figma 2366:2945): tocar ou arrastar o
 * dedo sobre o gráfico mostra o saldo do dia sob o dedo. O popover é uma pílula
 * (accent/subtle + borda accent/default) que flutua 40px acima do ponto,
 * ligada a ele por uma linha vertical (o "conector"). Segue o dedo na
 * horizontal, sempre grudando no dia mais próximo (não interpola entre dias —
 * o dado é diário). Some ao soltar. Só leitura; não altera nada.
 */

type Props = {
  /** Um ponto por dia do mês (§fluxoDoMes). */
  pontos: PontoFluxo[];
};

// Geometria (coordenadas internas do viewBox; escala por preserveAspectRatio).
const W = 358;
const H = 240;
const PAD_L = 38; // espaço p/ rótulos R$ compactos à esquerda
const PAD_R = 10;
const PAD_T = 12;
const PAD_B = 24; // espaço p/ dias embaixo
const PLOT_W = W - PAD_L - PAD_R;
const PLOT_H = H - PAD_T - PAD_B;

const DIAS_EIXO = [1, 5, 10, 15, 20, 25, 30];
const LINHAS_Y = 4; // nº de faixas horizontais

// Popover de scrubbing (Figma 2366:2945): o conector tem 40px de altura no
// design; aqui é medida do viewBox (a mesma escala do gráfico).
const CONECTOR = 40;

/** Escolhe um "passo" redondo (1,2,2.5,5×10^n) p/ o eixo Y ficar legível. */
function passoRedondo(bruto: number): number {
  if (bruto <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
  const norm = bruto / mag;
  const passo = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
  return passo * mag;
}

/**
 * Rótulo compacto do eixo Y: sem centavos, com sufixo K/M p/ caber na margem
 * estreita do celular. Ex.: 70000 → "R$ 70K"; 1200000 → "R$ 1,2M"; 340 → "R$ 340".
 * Só o eixo usa isto; valores exatos (com centavos) vivem no card de resumo.
 */
function compactoBR(v: number): string {
  const sinal = v < 0 ? '-' : '';
  const abs = Math.abs(v);
  let num: string;
  let suf = '';
  if (abs >= 1_000_000) { num = fmtCompacto(abs / 1_000_000); suf = 'M'; }
  else if (abs >= 1_000) { num = fmtCompacto(abs / 1_000); suf = 'K'; }
  else { num = String(Math.round(abs)); }
  return `${sinal}R$ ${num}${suf}`;
}

/** 1 casa decimal só quando não é inteiro (1,2M mas 70K), vírgula BR. */
function fmtCompacto(n: number): string {
  const r = Math.round(n * 10) / 10;
  return (Number.isInteger(r) ? String(r) : r.toFixed(1)).replace('.', ',');
}

export function GraficoFluxoDoMes({ pontos }: Props) {
  const gradId = useId();

  // Índice do dia sob o dedo durante o scrubbing; null = sem toque.
  const [ativo, setAtivo] = useState<number | null>(null);
  // Fator viewBox→px (largura renderizada ÷ W), para posicionar o popover HTML.
  const svgRef = useRef<SVGSVGElement>(null);

  const g = useMemo(() => {
    if (pontos.length === 0) return null;

    const valores = pontos.map((p) => p.saldo);
    let min = Math.min(...valores);
    let max = Math.max(...valores);
    if (min === max) { min -= 1; max += 1; } // curva plana: evita divisão por 0

    // Domínio arredondado para valores redondos, incluindo o zero se houver
    // negativos (a linha-base do zero fica visível).
    const passo = passoRedondo((max - min) / LINHAS_Y);
    let dMin = Math.floor(Math.min(min, 0) / passo) * passo;
    let dMax = Math.ceil(max / passo) * passo;
    if (dMin === dMax) dMax = dMin + passo;

    const diasNoMes = pontos.length;
    const x = (dia: number) => PAD_L + ((dia - 1) / (diasNoMes - 1 || 1)) * PLOT_W;
    const y = (v: number) => PAD_T + (1 - (v - dMin) / (dMax - dMin)) * PLOT_H;

    const pts = pontos.map((p) => ({ px: x(p.dia), py: y(p.saldo) }));

    // Suavização Catmull-Rom → Bézier cúbica.
    let d = `M ${pts[0].px.toFixed(2)} ${pts[0].py.toFixed(2)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2] ?? p2;
      const c1x = p1.px + (p2.px - p0.px) / 6;
      const c1y = p1.py + (p2.py - p0.py) / 6;
      const c2x = p2.px - (p3.px - p1.px) / 6;
      const c2y = p2.py - (p3.py - p1.py) / 6;
      d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${p2.px.toFixed(2)} ${p2.py.toFixed(2)}`;
    }
    const dArea = `${d} L ${pts[pts.length - 1].px.toFixed(2)} ${(PAD_T + PLOT_H).toFixed(2)} L ${pts[0].px.toFixed(2)} ${(PAD_T + PLOT_H).toFixed(2)} Z`;

    // Ticks do eixo Y (valores redondos entre dMin e dMax).
    const ticks: { v: number; py: number }[] = [];
    for (let v = dMin; v <= dMax + 1e-6; v += passo) ticks.push({ v, py: y(v) });

    // Marcadores nos dias do eixo X que existem no mês.
    const marcos = DIAS_EIXO.filter((dia) => dia <= diasNoMes).map((dia) => {
      const p = pontos[dia - 1];
      return { dia, px: x(dia), py: y(p.saldo) };
    });

    const zeroVisivel = dMin < 0 && dMax > 0;
    return { d, dArea, ticks, marcos, pts, x, y, dMin, dMax, zeroY: y(0), zeroVisivel };
  }, [pontos]);

  // Mapeia um evento de ponteiro para o índice do dia mais próximo. Converte o
  // clientX em fração da área de plotagem e arredonda para o dia inteiro — o
  // popover gruda no dia (o dado é diário; não há sentido interpolar).
  const scrub = useCallback(
    (clientX: number) => {
      const svg = svgRef.current;
      if (!svg || !g) return;
      const rect = svg.getBoundingClientRect();
      const escala = rect.width / W; // viewBox → px
      const xView = (clientX - rect.left) / escala; // px → viewBox
      const frac = (xView - PAD_L) / PLOT_W;
      const n = pontos.length;
      const idx = Math.max(0, Math.min(n - 1, Math.round(frac * (n - 1))));
      setAtivo(idx);
    },
    [g, pontos.length],
  );

  if (!g) return null;

  // Geometria do popover no ativo (coordenadas viewBox → % do container, para
  // o overlay HTML herdar o estilo tokenizado do design system — igual ao
  // componente do Figma, sem redesenhar em SVG).
  const overlay = ativo != null ? (() => {
    const p = g.pts[ativo];
    const ponto = pontos[ativo];
    // Conector e dot ficam no ponto real (px/py). Só o CARD é limitado a uma
    // faixa central (12%–88%) para a pílula não sangrar nas bordas quando o
    // dedo está nos extremos do mês — o conector continua apontando o valor.
    const leftPontoPct = (p.px / W) * 100;
    const leftCardPct = Math.max(12, Math.min(88, leftPontoPct));
    const topoConectorPct = ((p.py - CONECTOR) / H) * 100;
    return { leftCardPct, topoConectorPct, px: p.px, py: p.py, saldo: ponto.saldo, dia: ponto.dia };
  })() : null;

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-lg)',
      }}
    >
      {/* Wrapper que casa exatamente com a caixa renderizada do SVG (sem padding
          próprio), para o popover HTML se posicionar em % da mesma caixa. */}
      <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="Saldo em conta ao longo dos dias do mês"
        style={{ display: 'block', overflow: 'visible', touchAction: 'none' }}
        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); scrub(e.clientX); }}
        onPointerMove={(e) => { if (ativo != null) scrub(e.clientX); }}
        onPointerUp={() => setAtivo(null)}
        onPointerCancel={() => setAtivo(null)}
        onPointerLeave={() => setAtivo(null)}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent-default)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--accent-default)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grade horizontal + rótulos R$ */}
        {g.ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD_L}
              y1={t.py}
              x2={W - PAD_R}
              y2={t.py}
              stroke="var(--divider)"
              strokeWidth={1}
            />
            <text
              x={PAD_L - 8}
              y={t.py + 4}
              textAnchor="end"
              className="type-micro"
              fill="var(--text-muted)"
            >
              {compactoBR(t.v)}
            </text>
          </g>
        ))}

        {/* Linha-base do zero, quando o saldo cruza o negativo */}
        {g.zeroVisivel && (
          <line
            x1={PAD_L}
            y1={g.zeroY}
            x2={W - PAD_R}
            y2={g.zeroY}
            stroke="var(--text-muted)"
            strokeWidth={1}
            strokeDasharray="2 3"
          />
        )}

        {/* Área sob a curva */}
        <path d={g.dArea} fill={`url(#${gradId})`} />

        {/* Curva */}
        <path
          d={g.d}
          fill="none"
          stroke="var(--accent-default)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pontos marcados nos dias do eixo X (some o do dia ativo — o dot de
            scrubbing o substitui) */}
        {g.marcos.map((m) => (
          <circle
            key={m.dia}
            cx={m.px}
            cy={m.py}
            r={3.5}
            fill="var(--bg-surface)"
            stroke="var(--accent-default)"
            strokeWidth={2}
          />
        ))}

        {/* Rótulos do eixo X (dias) */}
        {g.marcos.map((m) => (
          <text
            key={`x-${m.dia}`}
            x={m.px}
            y={H - 6}
            textAnchor="middle"
            className="type-micro"
            fill="var(--text-muted)"
          >
            {m.dia}
          </text>
        ))}

        {/* ── Scrubbing: conector vertical + dot no ponto ativo. O conector
            (40px) liga o ponto ao popover HTML acima; fica dentro do SVG para
            acompanhar a curva na mesma escala. ── */}
        {overlay && (
          <>
            <line
              x1={overlay.px}
              y1={overlay.py - CONECTOR}
              x2={overlay.px}
              y2={overlay.py}
              stroke="var(--accent-default)"
              strokeWidth={1.5}
            />
            <circle
              cx={overlay.px}
              cy={overlay.py}
              r={4.5}
              fill="var(--accent-default)"
              stroke="var(--bg-surface)"
              strokeWidth={2}
            />
          </>
        )}
      </svg>

      {/* ── Popover HTML sobreposto: pílula com o saldo do dia, ancorada pelo
          seu rodapé no topo do conector (40px acima do ponto). Estilo direto do
          design system (accent/subtle + borda accent/default + radius-lg),
          espelhando o componente do Figma. translateX(-50%) centraliza na
          coluna do dia. ── */}
      {overlay && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: `${overlay.leftCardPct}%`,
            top: `${overlay.topoConectorPct}%`,
            transform: 'translate(-50%, -100%)',
            pointerEvents: 'none',
            zIndex: 2,
            // Não deixa a pílula sangrar nas bordas do gráfico.
            maxWidth: '100%',
          }}
        >
          <div
            className="type-body-small-strong"
            style={{
              background: 'var(--accent-subtle)',
              border: '1.5px solid var(--accent-default)',
              borderRadius: 'var(--radius-lg)',
              padding: '14px 16px',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            {formatarBR(overlay.saldo, { prefixo: true })}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
