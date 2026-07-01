import { useMemo } from 'react';
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
 * Header chuld + conteúdo), sem FAB.
 *
 * Estrutura (do Figma):
 *  1. Header chuld: voltar + nome do cartão.
 *  2. Hero: INSTÂNCIA do Card de entidade (variante Cartão) — fonte única do
 *     visual do cartão (§4.4/§5.3). Recebe realizado/previsão do ciclo corrente
 *     e herda o tema; a Barra de previsão e a legenda vêm do próprio componente.
 *  3. Compras do ciclo, agrupadas: COMPRAS DO CICLO (à vista) · PARCELAS ·
 *     ASSINATURAS. Cada grupo é um card branco de Linhas de lançamento, sem tag
 *     de conta (todas são deste cartão — §4.8).
 *
 * O "ciclo corrente" exibido é o que está aberto/por fechar hoje: o ciclo que
 * fecha no mês de `hoje` (regra de fechamento §4.8). O realizado, a fase e as
 * ocorrências saem todos do motor (fonte única, recorrencia.ts) — a tela não
 * recalcula nada de fatura por conta própria.
 */

const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

type Props = {
  cartao: Cartao;
  lancamentos: Lancamento[];
  excecoes: IndiceExcecoes;
  hoje: Date;
  onVoltar: () => void;
  /** Abre o Editar da ocorrência tocada (mesmo fluxo da Home, §5.7). */
  onEditar: (o: OcorrenciaLancamento) => void;
};

export function CartaoFatura({ cartao, lancamentos, excecoes, hoje, onVoltar, onEditar }: Props) {
  // Ciclo corrente = o que fecha no mês de hoje (§4.8). É o ciclo em foco no
  // drill-down: o que está aberto/por fechar agora.
  const cicloAbs = useMemo(() => hoje.getFullYear() * 12 + hoje.getMonth(), [hoje]);

  const realizado = useMemo(
    () => realizadoDoCiclo(lancamentos, cartao, cicloAbs, hoje, excecoes),
    [lancamentos, cartao, cicloAbs, hoje, excecoes],
  );

  const fase = useMemo(() => faseDoCiclo(cicloAbs, cartao, hoje), [cicloAbs, cartao, hoje]);

  const ocorrencias = useMemo(
    () => ocorrenciasDoCiclo(lancamentos, cartao, cicloAbs, hoje, excecoes),
    [lancamentos, cartao, cicloAbs, hoje, excecoes],
  );

  // O valor "grande" do hero segue a regra da fatura (§4.4): aberta/futura com
  // previsão mostra max(previsão, realizado); fechada ou sem previsão, o
  // realizado. Assim o número bate com o que pesa no saldo.
  const previsao = cartao.previsao_mensal;
  const temPrev = previsao != null && previsao > 0;
  const valorHero = fase === 'fechada' || !temPrev ? realizado : Math.max(previsao!, realizado);

  const pct = temPrev ? Math.round((realizado / previsao!) * 100) : 0;
  const fechaTxt = `fecha ${cartao.dia_fechamento} ${MESES_CURTO[hoje.getMonth()]}`;
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
      <Header variante="chuld" titulo={cartao.nome} onVoltar={onVoltar} />

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
