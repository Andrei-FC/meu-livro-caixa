import { useMemo, useState } from 'react';
import { Header, CardDeEntidade, LinhaDeLancamento } from '../components';
import {
  ocorrenciasDoCiclo,
  realizadoDoCiclo,
  faseDoCiclo,
  type OcorrenciaLancamento,
  type IndiceExcecoes,
} from '../lib/recorrencia';
import { formatarBR } from '../lib/formato';
import type { Cartao, Lancamento } from '../types/db';

/**
 * Cartão — Fatura (drill-down) — §5.3, Figma 2015:113.
 * Aberta ao tocar na Linha de fatura da Home. Página própria (padrão §5.8:
 * Header chuld + conteúdo), sem FAB, COM seletor de mês (Show Date do Header).
 *
 * Estrutura (do Figma):
 *  1. Header chuld: voltar + nome do cartão + seletor de mês (‹ Mês Ano ›).
 *  2. Hero: INSTÂNCIA do Card de entidade (variante Cartão) — fonte única do
 *     visual do cartão (§4.4/§5.3). Recebe realizado/previsão do ciclo exibido
 *     e herda o tema; a Barra de previsão e a legenda vêm do próprio componente.
 *  3. Compras do ciclo, agrupadas: COMPRAS DO CICLO (à vista) · PARCELAS ·
 *     ASSINATURAS. Cada grupo é um card branco de Linhas de lançamento, sem tag
 *     de conta (todas são deste cartão — §4.8).
 *
 * NAVEGAÇÃO DE MÊS. O drill-down abre no mês em que a linha da fatura foi
 * tocada (anoInicial/mesInicial vindos da Home) e navega mês a mês. O ciclo
 * exibido é o que VENCE no mês selecionado (mesma regra da linha na Home,
 * §4.8): fatura que vence em M fecha em M se dia_pagamento > dia_fechamento,
 * senão em M−1. Assim o que o usuário vê aqui bate exatamente com a linha que
 * ele tocou. Realizado, fase e ocorrências saem todos do motor (fonte única).
 */

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

type Props = {
  cartao: Cartao;
  lancamentos: Lancamento[];
  excecoes: IndiceExcecoes;
  hoje: Date;
  /** Mês/ano em que a linha da fatura foi tocada na Home — ponto de partida. */
  anoInicial: number;
  mesInicial: number;
  onVoltar: () => void;
  /** Abre o Editar da ocorrência tocada (mesmo fluxo da Home, §5.7). */
  onEditar: (o: OcorrenciaLancamento) => void;
};

export function CartaoFatura({
  cartao,
  lancamentos,
  excecoes,
  hoje,
  anoInicial,
  mesInicial,
  onVoltar,
  onEditar,
}: Props) {
  // Mês exibido — começa no mês da linha tocada; navegável.
  const [ano, setAno] = useState(anoInicial);
  const [mes, setMes] = useState(mesInicial);

  function mudarMes(delta: number) {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  }

  // Ciclo que VENCE no mês exibido (§4.8): a mesma regra que decide onde a linha
  // pesa na Home. Se o vencimento cai depois do fechamento, a fatura é do
  // próprio mês; senão, do mês anterior.
  const cicloAbs = useMemo(() => {
    const alvoAbs = ano * 12 + mes;
    return cartao.dia_pagamento > cartao.dia_fechamento ? alvoAbs : alvoAbs - 1;
  }, [ano, mes, cartao.dia_pagamento, cartao.dia_fechamento]);

  const realizado = useMemo(
    () => realizadoDoCiclo(lancamentos, cartao, cicloAbs, hoje, excecoes),
    [lancamentos, cartao, cicloAbs, hoje, excecoes],
  );

  const fase = useMemo(() => faseDoCiclo(cicloAbs, cartao, hoje), [cicloAbs, cartao, hoje]);

  const ocorrencias = useMemo(
    () => ocorrenciasDoCiclo(lancamentos, cartao, cicloAbs, hoje, excecoes),
    [lancamentos, cartao, cicloAbs, hoje, excecoes],
  );

  // O valor "grande" do hero é SEMPRE o realizado — o que já foi de fato
  // consumido na fatura (§4.4). O previsto não entra no número grande; ele vive
  // só na legenda/barra abaixo (fixo). Consequência aceita: quando a fatura
  // está aberta com realizado < previsão, o número grande (realizado) é MENOR
  // que o que pesa no saldo do mês (max(previsão, realizado)) — o card mostra o
  // real; o impacto no fluxo de caixa continua sendo a regra do max na Home.
  const previsao = cartao.previsao_mensal;
  const temPrev = previsao != null && previsao > 0;
  const valorHero = realizado;

  // O mês do fechamento é o mês do ciclo (cicloAbs), não o mês exibido.
  const mesFechamento = ((cicloAbs % 12) + 12) % 12;
  const pct = temPrev ? Math.round((realizado / previsao!) * 100) : 0;
  const fechaTxt = `fecha ${cartao.dia_fechamento} ${MESES_CURTO[mesFechamento]}`;
  const legenda =
    fase === 'fechada'
      ? `Fatura fechada · ${fechaTxt}`
      : temPrev
      ? `${formatarBR(realizado, { prefixo: true })} de ${formatarBR(previsao!, { prefixo: true })} previstos · ${pct}% da previsão · ${fechaTxt}`
      : fechaTxt;

  // Particiona as ocorrências do ciclo nos três grupos do design.
  const grupos = useMemo(() => particionar(ocorrencias), [ocorrencias]);

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', background: 'var(--bg-page)' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-page)' }}>
        <Header
          variante="chuld"
          titulo={cartao.nome}
          fechar
          onVoltar={onVoltar}
          mostrarData
          mesAno={`${MESES[mes]} ${ano}`}
          onAnterior={() => mudarMes(-1)}
          onProximo={() => mudarMes(1)}
        />
      </div>

      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-lg)',
          padding: 'var(--space-sm) var(--space-lg) var(--space-xl)',
        }}
      >
        {/* Hero: instância do Card de entidade (Cartão) — fonte única do visual */}
        <CardDeEntidade
          tipo="cartao"
          nome={cartao.nome}
          valor={valorHero}
          tema={cartao.tema ?? undefined}
          banco={cartao.banco}
          bandeira={cartao.bandeira}
          realizado={realizado}
          previsao={fase === 'fechada' ? null : previsao /* fechada: sem barra (§4.4) */}
          legenda={legenda}
        />

        {grupos.avista.length === 0 && grupos.parcelas.length === 0 && grupos.assinaturas.length === 0 ? (
          <p
            className="type-caption"
            style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-xl) 0' }}
          >
            Nenhuma compra neste ciclo.
          </p>
        ) : (
          <>
            <Secao titulo="COMPRAS DO CICLO" itens={grupos.avista} onEditar={onEditar} />
            <Secao titulo="PARCELAS" itens={grupos.parcelas} onEditar={onEditar} comParcela />
            <Secao titulo="ASSINATURAS" itens={grupos.assinaturas} onEditar={onEditar} />
          </>
        )}
      </main>
    </div>
  );
}

/* ───────── Seção: rótulo + card branco de linhas ───────── */

function Secao({
  titulo,
  itens,
  onEditar,
  comParcela = false,
}: {
  titulo: string;
  itens: OcorrenciaLancamento[];
  onEditar: (o: OcorrenciaLancamento) => void;
  comParcela?: boolean;
}) {
  if (itens.length === 0) return null;
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div style={{ padding: '4px var(--space-xs) 2px' }}>
        <span className="type-label" style={{ color: 'var(--text-muted)' }}>
          {titulo}
        </span>
      </div>
      <div
        style={{
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {itens.map((o) => (
          <LinhaDeLancamento
            key={o.id}
            tipo="saida"
            descricao={comParcela && o.total ? `${o.descricao} (${o.indice}/${o.total})` : o.descricao}
            valor={-o.valor}
            onEditar={() => onEditar(o)}
          />
        ))}
      </div>
    </section>
  );
}

/* ───────── Partição em à vista · parcelas · assinaturas ───────── */

function particionar(ocorrencias: OcorrenciaLancamento[]): {
  avista: OcorrenciaLancamento[];
  parcelas: OcorrenciaLancamento[];
  assinaturas: OcorrenciaLancamento[];
} {
  const avista: OcorrenciaLancamento[] = [];
  const parcelas: OcorrenciaLancamento[] = [];
  const assinaturas: OcorrenciaLancamento[] = [];
  for (const o of ocorrencias) {
    // Assinatura é recorte de série (§5.5): recorrente marcada. Tem prioridade
    // de agrupamento sobre "recorrente comum".
    if (o.assinatura) assinaturas.push(o);
    else if (o.total != null) parcelas.push(o); // série finita (parcela) → tem N total
    else avista.push(o); // à vista (e recorrente não-assinatura cai como compra do ciclo)
  }
  return { avista, parcelas, assinaturas };
}
