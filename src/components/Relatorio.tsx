import { useState } from 'react';
import { formatarBR } from '../lib/formato';
import type { CategoriaRelatorio, RecorteAssinaturas } from '../lib/relatorio';
import type { PontoFluxo } from '../lib/recorrencia';
import { GraficoFluxoDoMes } from './GraficoFluxoDoMes';

/**
 * Relatório (§5.5) — aba da Home, tela de VER, não de administrar. Só leitura:
 * sem editar, fundir ou agrupar categoria. Compõe dois blocos:
 *
 *  1. "Para onde foi o dinheiro" — despesas por categoria emergente (§4.6),
 *     débito + crédito agregados (§4.8). Cada linha: nome + total, barra na cor
 *     da categoria (hash do nome → categoria/01..12), e um rótulo discreto
 *     "R$ X no cartão" quando há fatia no crédito. Categoria 100% débito não
 *     mostra o recorte. Barras na mesma escala (maior gasto = cheia).
 *  2. Recorte de assinaturas — card expansível (fechado/aberto). Fechado:
 *     cabeçalho + total + barra proporcional (recorte/assinatura). Aberto:
 *     revela cada série (nome + meio de pagamento + valor), sem barra.
 *
 * NÃO repete os totais do mês — vivem no card de resumo do topo (§5.1). Sem
 * indicador de entrada×saída (§5.5). Figma: 2037:398 / 2163:748.
 */

type Props = {
  categorias: CategoriaRelatorio[];
  /** Escala comum das barras: maior gasto do mês (categorias e assinaturas). */
  maiorGasto: number;
  recorte: RecorteAssinaturas;
  /** Saldo em conta dia a dia, p/ o gráfico de fluxo do mês (§5.5). */
  fluxo: PontoFluxo[];
};

export function Relatorio({ categorias, maiorGasto, recorte, fluxo }: Props) {
  const semDados = categorias.length === 0 && recorte.assinaturas.length === 0;
  // O gráfico só informa quando o saldo varia no mês; plano/vazio não agrega.
  const temFluxo = fluxo.length > 1 && fluxo.some((p) => p.saldo !== fluxo[0].saldo);

  if (semDados && !temFluxo) {
    return (
      <p
        className="type-caption"
        style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-xl) 0' }}
      >
        Nada gasto neste mês ainda.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {categorias.length > 0 && (
        <>
          <div style={{ padding: '4px 0 0 4px' }}>
            <span className="type-label" style={{ color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
              PARA ONDE FOI O DINHEIRO
            </span>
          </div>

          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            {categorias.map((c) => (
              <LinhaCategoria key={c.nome} categoria={c} maiorGasto={maiorGasto} />
            ))}
          </div>
        </>
      )}

      {recorte.assinaturas.length > 0 && (
        <CardAssinaturas recorte={recorte} maiorGasto={maiorGasto} />
      )}

      {temFluxo && (
        <>
          <div style={{ padding: '4px 0 0 4px' }}>
            <span className="type-label" style={{ color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
              FLUXO DO MÊS
            </span>
          </div>
          <GraficoFluxoDoMes pontos={fluxo} />
        </>
      )}
    </div>
  );
}

/* ───────── Linha de categoria ───────── */

function LinhaCategoria({ categoria, maiorGasto }: { categoria: CategoriaRelatorio; maiorGasto: number }) {
  const pct = maiorGasto > 0 ? Math.max(0, Math.min(1, categoria.total / maiorGasto)) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="type-body-small" style={{ color: 'var(--text-primary)' }}>{categoria.nome}</span>
        <span className="type-body-small-strong" style={{ color: 'var(--text-primary)' }}>
          {formatarBR(categoria.total, { prefixo: true })}
        </span>
      </div>
      <Barra pct={pct} cor={categoria.cor} />
      {categoria.noCartao > 0 && (
        <span className="type-caption" style={{ color: 'var(--text-secondary)' }}>
          {formatarBR(categoria.noCartao, { prefixo: true })} no cartão
        </span>
      )}
    </div>
  );
}

/** Barra proporcional na escala do mês. Trilho = divider; preenchimento = cor
 *  passada. Não usa BarraDePrevisao (aquela é semáforo de fatura). */
function Barra({ pct, cor }: { pct: number; cor: string }) {
  return (
    <div style={{ height: 8, borderRadius: 4, background: 'var(--divider)', overflow: 'hidden' }}>
      <div style={{ width: `${pct * 100}%`, height: '100%', borderRadius: 4, background: cor }} />
    </div>
  );
}

/* ───────── Card de assinaturas (recorte expansível, §5.5) ───────── */

function CardAssinaturas({ recorte, maiorGasto }: { recorte: RecorteAssinaturas; maiorGasto: number }) {
  const [aberto, setAberto] = useState(false);
  const n = recorte.assinaturas.length;
  const pct = maiorGasto > 0 ? Math.max(0, Math.min(1, recorte.total / maiorGasto)) : 0;

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
      }}
    >
      <button
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-md)',
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          width: '100%',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 0', minWidth: 0 }}>
          <IconeRepeat />
          <span className="type-body-small" style={{ color: 'var(--text-primary)' }}>
            Assinaturas · {n} {n === 1 ? 'ativa' : 'ativas'}
          </span>
        </div>
        <span className="type-body-small-strong" style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
          {formatarBR(recorte.total, { prefixo: true })}/mês
        </span>
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            transition: 'transform 150ms ease',
            transform: aberto ? 'rotate(180deg)' : 'none',
            color: 'var(--text-secondary)',
          }}
        >
          <IconeChevronBaixo />
        </span>
      </button>

      <Barra pct={pct} cor="var(--recorte-assinatura)" />

      {aberto && (
        <div style={{ display: 'flex', flexDirection: 'column', paddingTop: 4 }}>
          <div style={{ height: 1, background: 'var(--divider)' }} />
          {recorte.assinaturas.map((a) => (
            <div
              key={a.chave}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-sm)',
                padding: '10px 0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-sm)', flex: '1 1 0', minWidth: 0 }}>
                <span className="type-body-small" style={{ color: 'var(--text-primary)' }}>{a.nome}</span>
                <span className="type-caption" style={{ color: 'var(--text-muted)' }}>{a.meio}</span>
              </div>
              <span className="type-body-small" style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                {formatarBR(a.valor, { prefixo: true })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ───────── Ícones locais (do component set do Figma) ───────── */

/** Ícone "repeat" do cabeçalho de assinaturas (Figma icon/others/repeat). */
function IconeRepeat() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path
        d="M4 6a2 2 0 0 1 2-2h8l-1.5-1.5M16 14a2 2 0 0 1-2 2H6l1.5 1.5"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: 'var(--text-primary)' }}
      />
    </svg>
  );
}

/** Chevron para baixo (expandir/recolher). */
function IconeChevronBaixo() {
  return (
    <svg width={20} height={20} viewBox="0 0 20 20" fill="none" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M6 8l4 4 4-4" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
