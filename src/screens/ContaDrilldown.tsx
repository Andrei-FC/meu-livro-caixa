import { useMemo, useState } from 'react';
import { Header, CardDeEntidade, ExtratoDoMes, FAB, espacoParaFAB } from '../components';
import {
  lancamentosNoMes,
  transferenciasNoMes,
  faturaNoMes,
  faturaSaidaPorConta,
  saldoAcumuladoPorConta,
  diaFaturaNoMes,
  type OcorrenciaLancamento,
  type OcorrenciaTransferencia,
  type IndiceExcecoes,
  type IndicePagamentos,
  type IndiceCiclos,
} from '../lib/recorrencia';
import type { Conta, Cartao, Lancamento, Transferencia } from '../types/db';

/**
 * Conta-corrente — drill-down (§5.6, v0.12). O irmão do drill-down do cartão
 * (§5.3): página própria, Header chuld com navegação, hero com os mesmos
 * números do card da aba Contas, extrato corrido por dia e FAB de lançar já
 * apontado para esta conta.
 *
 * NAVEGA POR MÊS, não por ciclo — e aqui está a única diferença real de
 * mecanismo em relação ao cartão. Ciclo é entidade do cartão (fecha, vence,
 * vira fatura); conta-corrente não tem ciclo, tem mês-calendário, que é o eixo
 * de toda a Home (§5.1). Forçar ciclo aqui inventaria uma entidade que não
 * existe no domínio.
 *
 * O QUE ENTRA NO EXTRATO (eixo de CAIXA, §4.8 — mesma régua da aba Contas):
 *  - lançamentos de débito desta conta (compra de cartão NÃO entra solta);
 *  - transferências que tocam a conta, nos dois sentidos;
 *  - a fatura dos cartões DESTA conta, no dia em que vence (é ela que pesa).
 * Com isso o acumulado do extrato fecha com o saldo do hero — o invariante da
 * §4.7 lido por conta.
 */

const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

type Props = {
  conta: Conta;
  /** Todas as contas — o extrato precisa resolver nome/tema do outro lado. */
  contas: Conta[];
  cartoes: Cartao[];
  lancamentos: Lancamento[];
  transferencias: Transferencia[];
  excecoes: IndiceExcecoes;
  pagamentos: IndicePagamentos;
  ciclos: IndiceCiclos;
  hoje: Date;
  /** Mês em que a Home estava — o drill-down abre nele e navega a partir daí. */
  mesInicial: { ano: number; mes: number };
  onVoltar: () => void;
  onEditar: (o: OcorrenciaLancamento) => void;
  onApagarTransf: (t: OcorrenciaTransferencia) => void;
  /** Tocar na linha de fatura abre o drill-down do cartão naquele ciclo (§5.3). */
  onAbrirCartao: (k: Cartao, cicloAbs: number) => void;
  /** Abre o Lançar com esta conta pré-selecionada (§5.2). */
  onLancar: () => void;
};

export function ContaDrilldown({
  conta,
  contas,
  cartoes,
  lancamentos,
  transferencias,
  excecoes,
  pagamentos,
  ciclos,
  hoje,
  mesInicial,
  onVoltar,
  onEditar,
  onApagarTransf,
  onAbrirCartao,
  onLancar,
}: Props) {
  // Mês exibido, local à tela (como o ciclo é local ao drill-down do cartão).
  const [mesAbs, setMesAbs] = useState(mesInicial.ano * 12 + mesInicial.mes);
  const ano = Math.floor(mesAbs / 12);
  const mes = ((mesAbs % 12) + 12) % 12;

  // Discriminador de mês (Item 2, §5.6): o corte de "hoje" só vale no mês
  // corrente — passado é fato pleno, futuro projeta o mês inteiro.
  const mesCorrenteAbs = hoje.getFullYear() * 12 + hoje.getMonth();
  const ehMesCorrente = mesAbs === mesCorrenteAbs;
  const ehMesFuturo = mesAbs > mesCorrenteAbs;
  const corteHoje = useMemo(() => {
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const dd = String(hoje.getDate()).padStart(2, '0');
    return `${hoje.getFullYear()}-${mm}-${dd}`;
  }, [hoje]);
  const corte = ehMesCorrente ? corteHoje : undefined;

  const contaPorId = useMemo(() => new Map(contas.map((c) => [c.id, c])), [contas]);

  // ── Linhas do extrato ──
  // Débito puro desta conta: a compra de cartão não aparece solta (§4.8) e
  // lançamento de outra conta não é desta.
  const ocorrencias = useMemo(
    () => lancamentosNoMes(lancamentos, ano, mes, hoje, excecoes)
      .filter((o) => o.cartao_id == null && o.conta_id === conta.id),
    [lancamentos, ano, mes, hoje, excecoes, conta.id],
  );

  // Transferências nos dois sentidos — o que chega e o que sai desta conta.
  const transferenciasDaConta = useMemo(
    () => transferenciasNoMes(transferencias, ano, mes, hoje)
      .filter((t) => t.de_conta_id === conta.id || t.para_conta_id === conta.id),
    [transferencias, ano, mes, hoje, conta.id],
  );

  // Só os cartões pagos POR ESTA conta — a fatura deles é que debita aqui.
  const cartoesDaConta = useMemo(
    () => cartoes.filter((k) => k.conta_id === conta.id),
    [cartoes, conta.id],
  );

  const faturaDoMes = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of cartoesDaConta) {
      m.set(k.id, faturaNoMes(lancamentos, k, ano, mes, hoje, excecoes, pagamentos, ciclos));
    }
    return m;
  }, [cartoesDaConta, lancamentos, ano, mes, hoje, excecoes, pagamentos, ciclos]);

  // ── Números do hero (mesma régua dos cards da aba Contas, §5.6) ──
  const saldo = useMemo(
    () => saldoAcumuladoPorConta(
      lancamentos, transferencias, contas, cartoes, ano, mes, hoje, excecoes, pagamentos, corte, ciclos,
    ).get(conta.id) ?? 0,
    [lancamentos, transferencias, contas, cartoes, ano, mes, hoje, excecoes, pagamentos, corte, ciclos, conta.id],
  );

  // Herdado: o acumulado até o FIM do mês anterior, sem corte (mês fechado é
  // fato pleno). É o ponto de partida do extrato — o "Mês anterior" no topo.
  const herdado = useMemo(() => {
    const anterior = mesAbs - 1;
    return saldoAcumuladoPorConta(
      lancamentos, transferencias, contas, cartoes,
      Math.floor(anterior / 12), ((anterior % 12) + 12) % 12,
      hoje, excecoes, pagamentos, undefined, ciclos,
    ).get(conta.id) ?? 0;
  }, [lancamentos, transferencias, contas, cartoes, mesAbs, hoje, excecoes, pagamentos, ciclos]);

  // Entradas/saídas DESTA conta no mês — regra "A" da §5.6: transferência que
  // toca a conta conta como entrada/saída dela (é propriedade da conta, não do
  // casal), e a fatura do cartão é saída da conta pagadora (§4.8).
  const { entradas, saidas } = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    for (const o of ocorrencias) {
      if (o.tipo === 'entrada') entradas += o.valor; else saidas += o.valor;
    }
    for (const t of transferenciasDaConta) {
      if (t.para_conta_id === conta.id) entradas += t.valor;
      if (t.de_conta_id === conta.id) saidas += t.valor;
    }
    const faturaSaida = faturaSaidaPorConta(
      lancamentos, cartoes, ano, mes, hoje, excecoes, pagamentos, corte, ciclos,
    );
    saidas += faturaSaida.get(conta.id) ?? 0;
    return { entradas, saidas };
  }, [ocorrencias, transferenciasDaConta, lancamentos, cartoes, ano, mes, hoje, excecoes, pagamentos, corte, ciclos, conta.id]);

  // Rótulos acompanham o significado do número (Item 2) — o mesmo texto dos
  // cards da aba Contas, para a tela não contradizer a lista de onde veio.
  const rotuloSaldo = ehMesCorrente ? 'Saldo Atual' : ehMesFuturo ? 'Saldo Previsto' : 'Saldo Final';
  const rotuloPos = ehMesFuturo ? 'Entradas Previstas' : 'Entradas';
  const rotuloNeg = ehMesFuturo ? 'Saídas Previstas' : 'Saídas';

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', background: 'var(--bg-page)' }}>
      <Header
        variante="chuld"
        titulo={conta.nome}
        fechar
        onVoltar={onVoltar}
        mostrarData
        mesAno={`${MESES_CURTO[mes]} ${ano}`}
        onAnterior={() => setMesAbs((m) => m - 1)}
        onProximo={() => setMesAbs((m) => m + 1)}
      />

      <main
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-lg)',
          padding: 'var(--space-sm) var(--space-lg) 0',
          // Folga no fim para o FAB não cobrir a última linha do extrato.
          paddingBottom: espacoParaFAB(),
        }}
      >
        {/* Hero: os mesmos números do card da aba Contas, em card cheio. */}
        <CardDeEntidade
          tipo="conta"
          nome={conta.nome}
          valor={saldo}
          tema={conta.tema ?? undefined}
          banco={conta.icone}
          entradas={entradas}
          saidas={saidas}
          rotuloSaldo={rotuloSaldo}
          rotuloPos={rotuloPos}
          rotuloNeg={rotuloNeg}
        />

        {/* Extrato: mesma gramática da aba Lançamentos, recortado nesta conta. */}
        <ExtratoDoMes
          ano={ano}
          mes={mes}
          ocorrencias={ocorrencias}
          transferencias={transferenciasDaConta}
          cartoes={cartoesDaConta}
          contaPorId={contaPorId}
          faturaDoMes={faturaDoMes}
          lancamentosRaw={lancamentos}
          excecoes={excecoes}
          pagamentos={pagamentos}
          ciclos={ciclos}
          hoje={hoje}
          onEditar={onEditar}
          onApagarTransf={onApagarTransf}
          onAbrirCartao={(k) => {
            // Mesmo "clique vivo" da Home (§5.3): abre no ciclo que vence aqui.
            const alvoAbs = ano * 12 + mes;
            const landed = diaFaturaNoMes(k, alvoAbs, pagamentos, ciclos);
            onAbrirCartao(k, landed?.cicloAbs ?? alvoAbs);
          }}
          saldoInicial={herdado}
          contaFoco={conta.id}
        />
      </main>

      {/* Sem BottomNav aqui: o FAB fica à MESMA folga da base que guarda da
          nav na Home (§5.1), sobre a safe-area. */}
      <FAB onClick={onLancar} aria-label={`Novo lançamento em ${conta.nome}`} />
    </div>
  );
}
