import { useMemo, useState } from 'react';
import { Header, CartaoHeroDrillDown, LinhaDeLancamento, CabecalhoDeDia, Botao, FazerPagamentoSheet } from '../components';
import {
  ocorrenciasDoCiclo,
  realizadoDoCiclo,
  faseCarteiraDoCiclo,
  intervaloPagamento,
  posicaoFatura,
  type OcorrenciaLancamento,
  type IndiceExcecoes,
  type IndicePagamentos,
} from '../lib/recorrencia';
import type { Cartao, Lancamento } from '../types/db';

/**
 * Cartão — Fatura (drill-down) — §5.3.
 * Aberta ao tocar no card do cartão na Carteira, ou na Linha de fatura da Home.
 * Página própria (Header chuld + conteúdo), sem FAB.
 *
 * Estrutura:
 *  1. Header chuld: voltar + nome do cartão + seletor de CICLO (‹ Fatura de mmm ›).
 *  2. Hero: CartaoHeroDrillDown — mesmas informações do card compacto da Carteira
 *     (§5.6), layout próprio (largura cheia, altura que abraça o conteúdo).
 *  3. Compras do ciclo: extrato corrido por dia (CabeçalhoDeDia + linhas).
 *
 * NAVEGAÇÃO POR CICLO (não por mês). O drill-down abre no ciclo que a coisa
 * clicada representa (cicloInicial) — o card da Carteira passa o ciclo vivo; a
 * linha de fatura passa o ciclo que vence naquele mês — e navega ciclo-a-ciclo.
 * A fase de cada ciclo (aberta/fechada) espelha a régua da Carteira
 * (faseCarteiraDoCiclo): fechada enquanto obrigação pendente, aberta senão.
 * O rótulo do header é sempre "Fatura de <mês de fechamento>" — identidade
 * estável do ciclo, independente da fase.
 */

const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_SEMANA = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

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
  /** Ciclo (abs) que a coisa clicada representa — o card da Carteira passa o
   *  ciclo vivo; a linha de fatura da Home passa o ciclo que vence naquele mês.
   *  O drill-down abre nele e navega ciclo-a-ciclo a partir daí (§5.3). */
  cicloInicial: number;
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
  cicloInicial,
  onVoltar,
  onEditar,
  onPagar,
}: Props) {
  // Ciclo exibido — começa no ciclo que a coisa clicada representa; navegável
  // ciclo-a-ciclo (§5.3). Não navega mais por mês: fatura é ciclo, não mês.
  const [cicloAbs, setCicloAbs] = useState(cicloInicial);

  function mudarCiclo(delta: number) {
    setCicloAbs((c) => c + delta);
  }

  const realizado = useMemo(
    () => realizadoDoCiclo(lancamentos, cartao, cicloAbs, hoje, excecoes),
    [lancamentos, cartao, cicloAbs, hoje, excecoes],
  );

  // Fase pela régua da Carteira (§5.6): o drill-down espelha o ciclo — fechada
  // se é obrigação pendente, aberta se acumulando/futuro/pago. Devolve também o
  // evento (fecha/vence DD mmm).
  const status = useMemo(
    () => faseCarteiraDoCiclo(cartao, cicloAbs, hoje, pagamentos),
    [cartao, cicloAbs, hoje, pagamentos],
  );
  const fase = status.fase;

  const ocorrencias = useMemo(
    () => ocorrenciasDoCiclo(lancamentos, cartao, cicloAbs, hoje, excecoes),
    [lancamentos, cartao, cicloAbs, hoje, excecoes],
  );

  // Hero: mesmas informações do card da Carteira (§5.6). Valor grande = realizado
  // do ciclo; barra + previsto restante quando há previsão (inclusive fechada,
  // §4.4). Previsão null = sem barra.
  const previsao = cartao.previsao_mensal;

  // Rótulo do header: sempre "Fatura de <mês de fechamento>" (opção A). O mês de
  // fechamento é a identidade estável do ciclo, independente da fase.
  const mesFechamento = ((cicloAbs % 12) + 12) % 12;
  const tituloCiclo = `Fatura de ${MESES_CURTO[mesFechamento]}`;

  // Lista corrida por dia (§5.3, item 2): as compras do ciclo deixam de ser
  // agrupadas por à vista/parcela/assinatura e passam a ser um extrato ordenado
  // por data, com cabeçalho de dia — a mesma gramática da aba Lançamentos
  // ("a data manda", princípio 2). Parcela e recorrência viram detalhe da linha
  // (selo "3/12" / ícone de coleção), não critério de agrupamento. Ordena
  // crescente para ler como extrato; agrupa em Map<dia, ocorrências>.
  const gruposPorDia = useMemo(() => {
    const ordenadas = [...ocorrencias].sort((a, b) => a.data.localeCompare(b.data));
    const porDia = new Map<string, OcorrenciaLancamento[]>();
    for (const o of ordenadas) {
      const arr = porDia.get(o.data) ?? porDia.set(o.data, []).get(o.data)!;
      arr.push(o);
    }
    return [...porDia.entries()].map(([dataISO, itens]) => {
      const [, , dia] = dataISO.split('-').map(Number);
      return { dataISO, dia, itens };
    });
  }, [ocorrencias]);

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
        mesAno={tituloCiclo}
        onAnterior={() => mudarCiclo(-1)}
        onProximo={() => mudarCiclo(1)}
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
        {/* Hero (§5.3): mesmas informações do card da Carteira, layout próprio. */}
        <CartaoHeroDrillDown
          nome={cartao.nome}
          realizado={realizado}
          previsao={previsao}
          fase={fase}
          diaEvento={status.diaEvento}
          mesEvento={status.mesEvento}
          tema={cartao.tema ?? undefined}
          banco={cartao.banco}
          bandeira={cartao.bandeira}
        />

        {gruposPorDia.length === 0 ? (
          <p
            className="type-caption"
            style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-xl) 0' }}
          >
            Nenhuma compra neste ciclo.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
            {gruposPorDia.map(({ dataISO, dia, itens }) => {
              // dia da semana a partir da data ISO (constrói local, sem fuso).
              const [a, m, d] = dataISO.split('-').map(Number);
              const diaSemana = DIAS_SEMANA[new Date(a, m - 1, d).getDay()];
              return (
                <div key={dataISO} style={{ display: 'flex', flexDirection: 'column' }}>
                  <CabecalhoDeDia data={`${dia} ${MESES_CURTO[m - 1]}`} diaSemana={diaSemana} />
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
                        descricao={o.descricao}
                        valor={-o.valor}
                        parcela={o.total != null ? { indice: o.indice, total: o.total } : undefined}
                        recorrente={o.repeticao === 'recorrente'}
                        onEditar={() => onEditar(o)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
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

