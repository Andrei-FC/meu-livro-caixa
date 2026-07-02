import { useId, useMemo } from 'react';
import type { PontoFluxo } from '../lib/recorrencia';

/**
 * Gráfico "fluxo do mês" (§5.5) — linha do SALDO EM CONTA ao longo dos dias do
 * mês. Não é gasto: é o dinheiro disponível dia a dia, partindo do herdado
 * (§4.7) e cobrindo o mês inteiro, fato + projeção (§5.1). Picos e vales deixam
 * ver dias com saídas concentradas. Só leitura, como o resto do Relatório.
 *
 * SVG puro (sem lib), curva suavizada (Catmull-Rom → Bézier), área com leve
 * gradiente. Cores/tipografia por token. Figma: 2301:1573.
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
    return { d, dArea, ticks, marcos, x, y, dMin, dMax, zeroY: y(0), zeroVisivel };
  }, [pontos]);

  if (!g) return null;

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-lg)',
        padding: 'var(--space-lg)',
      }}
    >
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="img"
        aria-label="Saldo em conta ao longo dos dias do mês"
        style={{ display: 'block', overflow: 'visible' }}
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

        {/* Pontos marcados nos dias do eixo X */}
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
      </svg>
    </div>
  );
}
