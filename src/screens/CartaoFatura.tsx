import { useMemo, useState } from 'react';
import { Header, CardDeEntidade, LinhaDeLancamento, Botao, FazerPagamentoSheet } from '../components';
import {
  ocorrenciasDoCiclo,
  realizadoDoCiclo,
  faseDoCiclo,
  intervaloPagamento,
  posicaoFatura,
  type OcorrenciaLancamento,
  type IndiceExcecoes,
  type IndicePagamentos,
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

/** Date local → ISO YYYY-MM-DD, sem fuso (evita o -1 dia do toISOString). */
function montaISOLocal(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Um dia antes de uma data ISO (para o topo inclusivo a partir do exclusivo). */
function diaAnteriorISO(iso: string): string {
  const [a, m, d] = iso.split('-').map(Number);
  return montaISOLocal(new Date(a, m - 1, d - 1));
}

type Props = {
  cartao: Cartao;
  lancamentos: Lancamento[];
  excecoes: IndiceExcecoes;
  /** Pagamentos efetivos por cartão+ciclo (§4.4) — data efetiva sobrepõe o dia_pagamento. */
  pagamentos: IndicePagamentos;
  hoje: Date;
  /** Mês/ano em que a linha da fatura foi tocada na Home — ponto de partida. */
  anoInicial: number;
  mesInicial: number;
  onVoltar: () => void;
  /** Abre o Editar da ocorrência tocada (mesmo fluxo da Home, §5.7). */
  onEditar: (o: OcorrenciaLancamento) => void;
  /** Grava a data efetiva de pagamento do ciclo (§5.3). A Home persiste e recarrega. */
  onPagar: (cicloAbs: number, dataISO: string) => void;
};

export function CartaoFatura({
  cartao,
  lancamentos,
  excecoes,
  pagamentos,
  hoje,
  anoInicial,
  mesInicial,
  onVoltar,
  onEditar,
  onPagar,
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

  // Sheet "Fazer Pagamento" (§5.3): só disponível na fase FECHADA.
  const [sheetPagamento, setSheetPagamento] = useState(false);

  // Intervalo válido de data de pagamento (§5.3): [fechamento, próximo fechamento).
  const intervalo = useMemo(() => intervaloPagamento(cartao, cicloAbs), [cartao, cicloAbs]);

  // Data default do campo: pagamento já registrado (edição), senão hoje —
  // clampada dentro do intervalo válido (não pode antes do fechamento nem
  // cruzar o próximo ciclo).
  const dataDefault = useMemo(() => {
    const pagoISO = pagamentos.get(cartao.id)?.get(cicloAbs)?.data_paga;
    if (pagoISO) return pagoISO;
    const hojeISO = montaISOLocal(hoje);
    if (hojeISO < intervalo.min) return intervalo.min;
    // max é exclusivo → o último dia válido é o anterior; se hoje for ≥ max, usa esse.
    const ultimo = diaAnteriorISO(intervalo.maxExclusivo);
    return hojeISO > ultimo ? ultimo : hojeISO;
  }, [pagamentos, cartao.id, cicloAbs, hoje, intervalo]);

  // Caption "Vencimento desse cartão DD/MM" (dia_pagamento sobre dia_fechamento,
  // como no Figma "10/06"). O mês é o do vencimento-padrão do ciclo.
  const posPadrao = useMemo(() => posicaoFatura(cartao, cicloAbs), [cartao, cicloAbs]);
  const vencimentoTexto = `Vencimento desse cartão ${String(cartao.dia_pagamento).padStart(2, '0')}/${String(
    (posPadrao.mesAbs % 12) + 1,
  ).padStart(2, '0')}`;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', background: 'var(--bg-page)' }}>
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

      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-lg)',
          // Espaço extra no fim para a área do botão flutuante não cobrir a última linha.
          padding: `var(--space-sm) var(--space-lg) ${fase === 'fechada' ? 'calc(var(--space-xl) + 88px)' : 'var(--space-xl)'}`,
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

      {/* Botão flutuante "Fazer Pagamento" — só na fase FECHADA (§5.3). Área
          ancorada na base, com fundo/borda como o Footer do Figma. */}
      {fase === 'fechada' && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 40,
            display: 'flex',
            justifyContent: 'center',
            padding: '12px var(--space-lg) calc(24px + env(safe-area-inset-bottom))',
            background: 'var(--bg-surface)',
            borderTop: '1px solid var(--border-default)',
          }}
        >
          <div style={{ width: '100%', maxWidth: 480 }}>
            <Botao hierarquia="primary" onClick={() => setSheetPagamento(true)}>
              Fazer Pagamento
            </Botao>
          </div>
        </div>
      )}

      <FazerPagamentoSheet
        aberto={sheetPagamento}
        onFechar={() => setSheetPagamento(false)}
        valor={realizado}
        dataInicial={dataDefault}
        min={intervalo.min}
        maxExclusivo={intervalo.maxExclusivo}
        vencimentoTexto={vencimentoTexto}
        onPagar={(dataISO) => {
          setSheetPagamento(false);
          onPagar(cicloAbs, dataISO);
        }}
      />
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
