import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { formatarBR } from '../lib/formato';
import type { Conta, Cartao, Lancamento, ExcecaoSerie, Transferencia, Pagamento } from '../types/db';
import {
  lancamentosNoMes,
  indexarExcecoes,
  indexarPagamentos,
  saldoHerdado,
  liquidoDoMes,
  faturaNoMes,
  realizadoDoCiclo,
  faseDoCiclo,
  statusCarteiraDoCartao,
  diaPagamentoNoMes,
  posicaoFatura,
  saldoAcumuladoPorConta,
  fluxoDoMes,
  saldoPorPoupanca,
  movimentacoesDaPoupanca,
  transferenciasNoMes,
  parteData,
  type OcorrenciaLancamento,
  type OcorrenciaTransferencia,
  type IndiceExcecoes,
  type IndicePagamentos,
} from '../lib/recorrencia';
import {
  BottomNav,
  type AbaHome,
  CardDeResumo,
  CabecalhoDeDia,
  SaldoDoDia,
  LinhaDeLancamento,
  LinhaDeFatura,
  type FaseFatura,
  LinhaDeTransferencia,
  CardDeEntidade,
  FAB,
  Header,
  MenuDrawer,
  type DestinoMenu,
  LancarSheet,
  EditarSheet,
  ModalDeAlerta,
  Relatorio,
} from '../components';
import { GerenciarContas } from './GerenciarContas';
import { Cofre } from './Cofre';
import { PoupancaDrilldown } from './PoupancaDrilldown';
import { CriarEditarPoupanca } from './CriarEditarPoupanca';
import { categoriasDoMes, maiorGastoDoMes, recorteAssinaturas } from '../lib/relatorio';
import { GerenciarCartoes } from './GerenciarCartoes';
import { CriarEditarConta } from './CriarEditarConta';
import { CriarEditarCartao } from './CriarEditarCartao';
import { CartaoFatura } from './CartaoFatura';

/** Home real (§5.1). Compõe só a biblioteca de componentes.
 *  Nova navegação (Figma "03 - App Screens 1.0", Home bottom nav): Header
 *  (menu + nav de mês) → conteúdo da aba → BottomNav fixo embaixo, 3 abas:
 *  Lançamentos · Carteira (cartões + contas) · Relatório (com card de resumo).
 *  O seletor de mês controla todas as abas; mês-calendário inteiro (§5.1). */

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_SEMANA = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];

export function Home() {
  const hoje = useMemo(() => new Date(), []);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth()); // 0-11
  const [aba, setAba] = useState<AbaHome>('lancamentos');

  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [excecoes, setExcecoes] = useState<ExcecaoSerie[]>([]);
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sheetAberto, setSheetAberto] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<OcorrenciaLancamento | null>(null);
  // Sheet de depósito/retirada da poupança (§5.4): reusa o LancarSheet em modo
  // transferência fixa. null = fechado.
  const [transfFixa, setTransfFixa] = useState<{ poupanca: Conta; direcao: 'deposito' | 'retirada' } | null>(null);
  // Transferência a apagar (§5.7, simplificado): tocar no editar da linha abre
  // confirmação. Apagar reverte o saldo naturalmente — nada é materializado, o
  // dinheiro volta aos lugares como se nunca tivesse saído (§4.4, princípio 4).
  const [transfApagar, setTransfApagar] = useState<OcorrenciaTransferencia | null>(null);

  // Roteamento por estado para as PÁGINAS PRÓPRIAS (§5.8) — telas cheias fora
  // das abas da Home (gerenciar/criar/editar conta e cartão). null = Home.
  type Pagina =
    | { tela: 'gerenciar-contas' }
    | { tela: 'gerenciar-cartoes' }
    | { tela: 'cofre' }
    | { tela: 'poupanca'; poupanca: Conta }
    | { tela: 'poupanca-edit'; poupanca: Conta | null }
    | { tela: 'conta'; conta: Conta | null }
    | { tela: 'cartao'; cartao: Cartao | null }
    | { tela: 'drill-cartao'; cartao: Cartao; cicloInicial: number };
  const [pagina, setPagina] = useState<Pagina | null>(null);

  // Carrega tudo do Supabase. Robusto a rede intermitente (PWA/iOS): em falha
  // de REDE (Promise rejeitada, ex. "Load failed"), tenta de novo algumas vezes
  // com backoff curto antes de desistir. Erro de DADOS (query retorna .error)
  // não faz retry — não é transitório. Sempre libera o "carregando" no fim.
  const carregar = useCallback((tentativa = 0): Promise<void> => {
    const MAX_TENTATIVAS = 3;
    setErro(null);
    return Promise.all([
      supabase.from('contas').select('*').is('arquivada_em', null).order('criada_em'),
      supabase.from('cartoes').select('*').order('criado_em'),
      supabase.from('lancamentos').select('*').order('data'),
      supabase.from('excecoes_serie').select('*'),
      supabase.from('transferencias').select('*'),
      supabase.from('cartoes_pagamentos').select('*'),
    ]).then(([rc, rk, rl, re, rt, rp]) => {
      const e = rc.error || rk.error || rl.error || re.error || rt.error || rp.error;
      if (e) { setErro(e.message); setCarregando(false); return; }
      setContas(rc.data ?? []);
      setCartoes(rk.data ?? []);
      setLancamentos(rl.data ?? []);
      setExcecoes(re.data ?? []);
      setTransferencias(rt.data ?? []);
      setPagamentos(rp.data ?? []);
      setErro(null);
      setCarregando(false);
    }).catch((err) => {
      // Falha de rede: o Promise rejeita antes de qualquer .error. Sem este
      // catch, ficava preso em "Carregando…". Tenta de novo com backoff.
      if (tentativa < MAX_TENTATIVAS - 1) {
        const espera = 800 * (tentativa + 1); // 0.8s, 1.6s
        return new Promise<void>((res) => setTimeout(res, espera)).then(() => carregar(tentativa + 1));
      }
      setErro(err?.message ?? 'Falha de conexão. Verifique sua internet.');
      setCarregando(false);
    });
  }, []);

  useEffect(() => {
    setCarregando(true);
    carregar();
  }, [carregar]);

  // Recarrega ao voltar o foco (PWA/iOS costuma congelar a aba em 2º plano;
  // ao voltar, os dados podem estar velhos). Silencioso: não pisca "Carregando",
  // atualiza em background. Também cobre o caso de a 1ª carga ter falhado.
  useEffect(() => {
    function aoVoltar() {
      if (document.visibilityState === 'visible') carregar();
    }
    document.addEventListener('visibilitychange', aoVoltar);
    return () => document.removeEventListener('visibilitychange', aoVoltar);
  }, [carregar]);

  const contaPorId = useMemo(() => new Map(contas.map((c) => [c.id, c])), [contas]);

  // Descrições já usadas, para o autocomplete do Lançar (§4.6). Únicas,
  // preservando a forma original mais recente de cada categoria.
  const historicoDescricoes = useMemo(() => {
    // Ranking por FREQUÊNCIA + RECÊNCIA (§4.6): agrega por categoria
    // (case-insensitive), conta os usos e guarda o registro mais recente
    // (criado_em). Ordena por frequência desc, desempata pela recência desc.
    // O rótulo exibido é a grafia da ocorrência mais recente.
    const agg = new Map<string, { rotulo: string; usos: number; recente: string }>();
    for (const l of lancamentos) {
      const rotulo = l.descricao.trim();
      const chave = rotulo.toLowerCase();
      if (!chave) continue;
      const atual = agg.get(chave);
      if (!atual) {
        agg.set(chave, { rotulo, usos: 1, recente: l.criado_em });
      } else {
        atual.usos += 1;
        if (l.criado_em > atual.recente) { atual.recente = l.criado_em; atual.rotulo = rotulo; }
      }
    }
    return [...agg.values()]
      .sort((a, b) => (b.usos - a.usos) || (a.recente < b.recente ? 1 : a.recente > b.recente ? -1 : 0))
      .map((e) => e.rotulo);
  }, [lancamentos]);

  // Ocorrências do mês exibido, materializadas a partir das regras (§4.1).
  // O motor expande parcelas/recorrências; o passado e o futuro (até o
  // horizonte) saem daqui, não de um filtro por data crua.
  const indiceExcecoes = useMemo(() => indexarExcecoes(excecoes), [excecoes]);
  const indicePagamentos = useMemo(() => indexarPagamentos(pagamentos), [pagamentos]);

  const ocorrenciasDoMes = useMemo(
    () => lancamentosNoMes(lancamentos, ano, mes, hoje, indiceExcecoes),
    [lancamentos, ano, mes, hoje, indiceExcecoes],
  );

  // Da lista do mês saem as ocorrências em conta-corrente, fora de cartão
  // (§4.8: compra de cartão não aparece solta; entra pela linha da fatura).
  const ocorrenciasLista = useMemo(
    () => ocorrenciasDoMes.filter((o) => o.cartao_id == null),
    [ocorrenciasDoMes],
  );

  // Transferências do mês (§4.5) — entram na lista do fluxo (correntes) para
  // deixar rastro visível de todo movimento (o saldo nunca muda sem uma linha).
  const transferenciasLista = useMemo(
    () => transferenciasNoMes(transferencias, ano, mes, hoje),
    [transferencias, ano, mes, hoje],
  );

  // Fatura que VENCE no mês exibido, por cartão — o que pesa no saldo (§4.4).
  // Fonte única: faturaNoMes (ciclo + fase + max previsão/realizado). A lista
  // usa isto para posicionar a linha da fatura no dia do pagamento e debitar.
  const faturaDoMes = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of cartoes) {
      m.set(k.id, faturaNoMes(lancamentos, k, ano, mes, hoje, indiceExcecoes, indicePagamentos));
    }
    return m;
  }, [cartoes, lancamentos, ano, mes, hoje, indiceExcecoes, indicePagamentos]);

  // Aba CARTEIRA (§5.6) — a "foto do presente" do ciclo, NÃO o mês exibido. Para
  // cada cartão, o motor decide qual fatura está viva agora: a fechada a pagar
  // (obrigação pendente até o vencimento) ou a aberta acumulando. A virada é
  // governada por hoje-vs-vencimento e honra a antecipação de pagamento
  // (cartoes_pagamentos). Independe da navegação de mês da Home.
  const statusCarteira = useMemo(() => {
    const m = new Map<string, ReturnType<typeof statusCarteiraDoCartao>>();
    for (const k of cartoes) {
      m.set(k.id, statusCarteiraDoCartao(lancamentos, k, hoje, indiceExcecoes, indicePagamentos));
    }
    return m;
  }, [cartoes, lancamentos, hoje, indiceExcecoes, indicePagamentos]);

  // Ordem dos cartões na Carteira: por dia de vencimento (dia_pagamento) crescente
  // — o mais próximo do início do mês no topo. Estável (desempata por nome).
  const cartoesOrdenados = useMemo(
    () => [...cartoes].sort((a, b) => a.dia_pagamento - b.dia_pagamento || a.nome.localeCompare(b.nome)),
    [cartoes],
  );

  // Relatório (§5.5, §4.8) — eixo de CONSUMO, pela data da compra. Usa
  // ocorrenciasDoMes (TODAS, inclusive cartão): a compra de cartão conta na sua
  // categoria no mês da compra, não some para dentro da fatura (o oposto da
  // lista da Home, que é fluxo de caixa). Só saídas entram no relatório.
  const categoriasRelatorio = useMemo(
    () => categoriasDoMes(ocorrenciasDoMes),
    [ocorrenciasDoMes],
  );
  const recorte = useMemo(
    () => recorteAssinaturas(ocorrenciasDoMes, contas, cartoes),
    [ocorrenciasDoMes, contas, cartoes],
  );
  // Régua comum das barras: maior entre as categorias soltas e o bloco da
  // gaveta de assinaturas, para tudo ficar na mesma escala.
  const maiorGasto = useMemo(
    () => maiorGastoDoMes(categoriasRelatorio, recorte.total),
    [categoriasRelatorio, recorte.total],
  );

  // Totais do mês (§4.7). Herdado virá do saldo contínuo; por ora 0.
  const { entradas, saidas } = useMemo(() => {
    let e = 0, s = 0;
    for (const o of ocorrenciasLista) {
      if (o.tipo === 'entrada') e += o.valor; else s += o.valor;
    }
    return { entradas: e, saidas: s };
  }, [ocorrenciasLista]);

  // Entradas/saídas por conta no MÊS EXIBIDO — cards da aba Contas da Home
  // (acompanha a navegação de mês). Débito puro já vem filtrado (§4.8).
  const porConta = useMemo(() => {
    const m = new Map<string, { entradas: number; saidas: number }>();
    for (const o of ocorrenciasLista) {
      const acc = m.get(o.conta_id) ?? { entradas: 0, saidas: 0 };
      if (o.tipo === 'entrada') acc.entradas += o.valor; else acc.saidas += o.valor;
      m.set(o.conta_id, acc);
    }
    return m;
  }, [ocorrenciasLista]);

  // Entradas/saídas por conta no MÊS ATUAL real (não o exibido) — tela de
  // Gerenciar Contas, que não tem seletor de mês: mostra sempre o corrente.
  const porContaMesAtual = useMemo(() => {
    const ocs = lancamentosNoMes(
      lancamentos, hoje.getFullYear(), hoje.getMonth(), hoje, indiceExcecoes,
    ).filter((o) => o.cartao_id == null);
    const m = new Map<string, { entradas: number; saidas: number }>();
    for (const o of ocs) {
      const acc = m.get(o.conta_id) ?? { entradas: 0, saidas: 0 };
      if (o.tipo === 'entrada') acc.entradas += o.valor; else acc.saidas += o.valor;
      m.set(o.conta_id, acc);
    }
    return m;
  }, [lancamentos, hoje, indiceExcecoes]);
  // Saldo acumulado por conta (§4.7) até o mês ATUAL — cards da tela Gerenciar
  // Contas. Invariante: soma das correntes == saldo do topo. A fatura de cada
  // cartão debita a conta pagadora (cartao.conta_id).
  const saldosPorConta = useMemo(
    () => saldoAcumuladoPorConta(
      lancamentos, transferencias, contas, cartoes,
      hoje.getFullYear(), hoje.getMonth(), hoje, indiceExcecoes, indicePagamentos,
    ),
    [lancamentos, transferencias, contas, cartoes, hoje, indiceExcecoes, indicePagamentos],
  );
  // Saldo guardado por poupança (§5.4) — cards do Cofre e hero do drill-down.
  const saldosPorPoupanca = useMemo(
    () => saldoPorPoupanca(transferencias, contas, hoje),
    [transferencias, contas, hoje],
  );
  const poupancas = useMemo(() => contas.filter((c) => c.tipo === 'poupanca'), [contas]);
  // Saldo por conta para a aba CARTEIRA — a "foto de hoje" (§5.6). Passamos
  // sempre o corte = hoje: no mês corrente corta em hoje (só o que já
  // aconteceu; salário do dia 30 não conta até cair); meses passados entram
  // inteiros (tudo já é ≤ hoje, o corte não remove nada); mês futuro sobra só o
  // herdado (todo movimento do mês futuro é > hoje). Um único parâmetro cobre os
  // três casos — o corte só morde o mês alvo, e o alvo é o mês exibido.
  const corteHoje = useMemo(() => {
    const mm = String(hoje.getMonth() + 1).padStart(2, '0');
    const dd = String(hoje.getDate()).padStart(2, '0');
    return `${hoje.getFullYear()}-${mm}-${dd}`;
  }, [hoje]);
  const saldosPorContaMesExibido = useMemo(
    () => saldoAcumuladoPorConta(
      lancamentos, transferencias, contas, cartoes, ano, mes, hoje, indiceExcecoes, indicePagamentos,
      corteHoje,
    ),
    [lancamentos, transferencias, contas, cartoes, ano, mes, hoje, indiceExcecoes, indicePagamentos, corteHoje],
  );
  // Saldo herdado: acumulado desde a âncora (1º registro) até o mês anterior
  // (§4.7). Calculado na leitura e memoizado — barato porque expande regras,
  // não linhas. Projeção futura limitada ao horizonte do motor.
  const herdado = useMemo(
    () => saldoHerdado(lancamentos, transferencias, contas, cartoes, ano, mes, hoje, indiceExcecoes),
    [lancamentos, transferencias, contas, cartoes, ano, mes, hoje, indiceExcecoes],
  );
  // Líquido do mês exibido pela MESMA regra do acúmulo (inclui cartão e
  // poupança), para o saldo do mês bater com o que ele herda ao mês seguinte.
  const liquidoMes = useMemo(
    () => liquidoDoMes(lancamentos, transferencias, contas, cartoes, ano, mes, hoje, indiceExcecoes),
    [lancamentos, transferencias, contas, cartoes, ano, mes, hoje, indiceExcecoes],
  );
  const saldoMes = herdado + liquidoMes;

  // Fluxo do mês (§5.5): saldo em conta dia a dia, partindo do herdado. Último
  // ponto == saldoMes (mesma mecânica do liquidoDoMes). Alimenta o gráfico.
  const fluxo = useMemo(
    () => fluxoDoMes(lancamentos, transferencias, contas, cartoes, ano, mes, herdado, hoje, indiceExcecoes),
    [lancamentos, transferencias, contas, cartoes, ano, mes, herdado, hoje, indiceExcecoes],
  );

  function mudarMes(delta: number) {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  }

  // Navegação do menu drawer (§5.8). 'mes' já é esta tela; 'sair' derruba a
  // sessão (o App reativo volta ao Login). Os destinos de gestão ainda não
  // têm tela (§5.8) — ficam como stub, fechando o drawer por ora.
  async function navegarMenu(destino: DestinoMenu) {
    setMenuAberto(false);
    if (destino === 'sair') {
      await supabase.auth.signOut();
      return;
    }
    if (destino === 'contas') { setPagina({ tela: 'gerenciar-contas' }); return; }
    if (destino === 'cartoes') { setPagina({ tela: 'gerenciar-cartoes' }); return; }
    if (destino === 'cofre') { setPagina({ tela: 'cofre' }); return; }
    // TODO: rotear categorias/configurações (§5.8)
  }

  // Grava a data efetiva de pagamento de uma fatura fechada (§5.3). Upsert por
  // (cartao_id, ciclo_abs): pagar de novo o mesmo ciclo sobrescreve a data
  // (não acumula linhas). A data escolhida passa a reger em que mês/dia a
  // fatura pesa no saldo (§4.4) — recarrega para o motor reposicionar a linha.
  async function registrarPagamento(cartao: Cartao, cicloAbs: number, dataISO: string) {
    await supabase
      .from('cartoes_pagamentos')
      .upsert(
        { cartao_id: cartao.id, ciclo_abs: cicloAbs, data_paga: dataISO },
        { onConflict: 'cartao_id,ciclo_abs' },
      );
    carregar();
  }

  // Renderiza as páginas próprias por cima da Home (§5.8). Recarrega os dados ao
  // salvar; o "voltar" das telas de criar/editar leva à lista correspondente.
  if (pagina?.tela === 'gerenciar-contas') {
    return (
      <GerenciarContas
        contas={contas}
        entradasSaidas={porContaMesAtual}
        saldos={saldosPorConta}
        onVoltar={() => setPagina(null)}
        onCriar={() => setPagina({ tela: 'conta', conta: null })}
        onEditar={(c) => setPagina({ tela: 'conta', conta: c })}
      />
    );
  }
  if (pagina?.tela === 'gerenciar-cartoes') {
    return (
      <GerenciarCartoes
        cartoes={cartoes}
        onVoltar={() => setPagina(null)}
        onCriar={() => setPagina({ tela: 'cartao', cartao: null })}
        onEditar={(k) => setPagina({ tela: 'cartao', cartao: k })}
      />
    );
  }
  if (pagina?.tela === 'conta') {
    return (
      <CriarEditarConta
        conta={pagina.conta}
        onVoltar={() => setPagina({ tela: 'gerenciar-contas' })}
        onSalvou={() => { carregar(); }}
      />
    );
  }
  if (pagina?.tela === 'cartao') {
    return (
      <CriarEditarCartao
        cartao={pagina.cartao}
        contas={contas}
        onVoltar={() => setPagina({ tela: 'gerenciar-cartoes' })}
        onSalvou={() => { carregar(); }}
      />
    );
  }
  if (pagina?.tela === 'drill-cartao') {
    return (
      <CartaoFatura
        cartao={pagina.cartao}
        lancamentos={lancamentos}
        excecoes={indiceExcecoes}
        pagamentos={indicePagamentos}
        hoje={hoje}
        cicloInicial={pagina.cicloInicial}
        onVoltar={() => setPagina(null)}
        onEditar={(o) => { setPagina(null); setEmEdicao(o); }}
        onPagar={(cicloAbs, dataISO) => registrarPagamento(pagina.cartao, cicloAbs, dataISO)}
      />
    );
  }

  if (pagina?.tela === 'cofre') {
    return (
      <Cofre
        poupancas={poupancas}
        saldos={saldosPorPoupanca}
        onVoltar={() => setPagina(null)}
        onCriar={() => setPagina({ tela: 'poupanca-edit', poupanca: null })}
        onAbrir={(p) => setPagina({ tela: 'poupanca', poupanca: p })}
      />
    );
  }
  if (pagina?.tela === 'poupanca') {
    const p = pagina.poupanca;
    return (
      <>
        <PoupancaDrilldown
          poupanca={p}
          saldo={saldosPorPoupanca.get(p.id) ?? 0}
          movimentacoes={movimentacoesDaPoupanca(transferencias, p.id, hoje)}
          onVoltar={() => setPagina({ tela: 'cofre' })}
          onDepositar={() => setTransfFixa({ poupanca: p, direcao: 'deposito' })}
          onRetirar={() => setTransfFixa({ poupanca: p, direcao: 'retirada' })}
          onEditar={() => setPagina({ tela: 'poupanca-edit', poupanca: p })}
        />
        {/* Sheet de depósito/retirada — LancarSheet em transferência fixa (§5.4) */}
        <LancarSheet
          aberto={transfFixa !== null}
          contas={contas}
          cartoes={cartoes}
          historicoDescricoes={historicoDescricoes}
          onFechar={() => setTransfFixa(null)}
          onSalvou={() => { carregar(); }}
          transferenciaFixa={
            transfFixa
              ? {
                  poupanca: transfFixa.poupanca,
                  direcao: transfFixa.direcao,
                  titulo: transfFixa.direcao === 'deposito' ? 'Depositar' : 'Retirar',
                }
              : undefined
          }
        />
      </>
    );
  }
  if (pagina?.tela === 'poupanca-edit') {
    return (
      <CriarEditarPoupanca
        poupanca={pagina.poupanca}
        onVoltar={() =>
          setPagina(pagina.poupanca ? { tela: 'poupanca', poupanca: pagina.poupanca } : { tela: 'cofre' })
        }
        onSalvou={() => { carregar(); }}
      />
    );
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', position: 'relative' }}>
      {/* ── Header: sticky universal vem do próprio componente ── */}
      <Header
        mesAno={`${MESES[mes]} ${ano}`}
        onMenu={() => setMenuAberto(true)}
        onAnterior={() => mudarMes(-1)}
        onProximo={() => mudarMes(1)}
      />

      {/* ── Menu drawer (§5.8) ── */}
      <MenuDrawer
        aberto={menuAberto}
        onFechar={() => setMenuAberto(false)}
        ativo="mes"
        onNavegar={navegarMenu}
      />

      {/* Card de resumo e Tabs saíram do topo (nova navegação): os totais do
          mês vivem só na aba Relatório (§5.1) e a navegação virou BottomNav
          fixo embaixo. Reduz atrito: alcance de polegar + menos peso morto. */}
      <main
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          padding: 'var(--space-lg)',
          paddingBottom: 'calc(96px + env(safe-area-inset-bottom))',
        }}
      >
        {erro && !carregando && contas.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-md)',
              padding: 'var(--space-2xl) var(--space-lg)',
              textAlign: 'center',
            }}
          >
            <p className="type-body" style={{ color: 'var(--text-secondary)' }}>
              Não foi possível carregar. Verifique sua conexão.
            </p>
            <button
              type="button"
              onClick={() => { setCarregando(true); carregar(); }}
              className="type-body-small-strong"
              style={{
                background: 'var(--accent-default)',
                color: 'var(--text-on-accent)',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-sm) var(--space-xl)',
                cursor: 'pointer',
              }}
            >
              Tentar de novo
            </button>
          </div>
        ) : carregando ? (
          <p className="type-caption" style={{ color: 'var(--text-muted)' }}>Carregando…</p>
        ) : (
          <>
            {aba === 'lancamentos' && (
              <Lancamentos
                ano={ano}
                mes={mes}
                ocorrencias={ocorrenciasLista}
                transferencias={transferenciasLista}
                cartoes={cartoes}
                contaPorId={contaPorId}
                faturaDoMes={faturaDoMes}
                lancamentosRaw={lancamentos}
                excecoes={indiceExcecoes}
                pagamentos={indicePagamentos}
                hoje={hoje}
                onEditar={setEmEdicao}
                onApagarTransf={setTransfApagar}
                onAbrirCartao={(k) => {
                  // A linha de fatura representa o ciclo que VENCE no mês exibido
                  // (§4.8): vence depois do fechamento → ciclo do próprio mês; senão
                  // o anterior. É o ciclo que o clique "vivo" carrega (§5.3).
                  const alvoAbs = ano * 12 + mes;
                  const cicloInicial = k.dia_pagamento > k.dia_fechamento ? alvoAbs : alvoAbs - 1;
                  setPagina({ tela: 'drill-cartao', cartao: k, cicloInicial });
                }}
                saldoInicial={herdado}
              />
            )}

            {aba === 'carteira' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                {/* CARTÕES (§5.5 Figma "Home — Cartões": cartões e contas na mesma
                    tela, cada bloco com sua testeira). */}
                <SecaoCarteira titulo="CARTÕES" vazio="Nenhum cartão cadastrado.">
                  {cartoesOrdenados.map((k) => {
                    const st = statusCarteira.get(k.id);
                    if (!st) return null;
                    return (
                      <CardDeEntidade
                        key={k.id}
                        tipo="cartao"
                        nome={k.nome}
                        valor={st.realizado}
                        tema={k.tema ?? undefined}
                        banco={k.banco}
                        bandeira={k.bandeira}
                        realizado={st.realizado}
                        previsao={st.previsao}
                        fase={st.fase}
                        diaEvento={st.diaEvento}
                        mesEvento={st.mesEvento}
                        onAbrir={() => setPagina({ tela: 'drill-cartao', cartao: k, cicloInicial: st.cicloAbs })}
                      />
                    );
                  })}
                </SecaoCarteira>

                {/* CONTAS */}
                <SecaoCarteira titulo="CONTAS" vazio="Nenhuma conta ativa.">
                  {contas.map((c) =>
                    c.tipo === 'poupanca' ? (
                      <CardDeEntidade key={c.id} tipo="poupanca" nome={c.nome} valor={0 /* TODO §4.7 poupança */} tema={c.tema ?? undefined} />
                    ) : (
                      <CardDeEntidade key={c.id} tipo="conta" compacto nome={c.nome} valor={saldosPorContaMesExibido.get(c.id) ?? 0} tema={c.tema ?? undefined} banco={c.icone} entradas={porConta.get(c.id)?.entradas ?? 0} saidas={porConta.get(c.id)?.saidas ?? 0} />
                    ),
                  )}
                </SecaoCarteira>
              </div>
            )}

            {aba === 'relatorio' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
                {/* Card de resumo: agora vive só aqui (§5.1), sempre visível. */}
                <CardDeResumo entradas={entradas} saidas={saidas} saldoMes={saldoMes} herdado={herdado} />
                <Relatorio categorias={categoriasRelatorio} maiorGasto={maiorGasto} recorte={recorte} fluxo={fluxo} />
              </div>
            )}
          </>
        )}

        {/* Rodapé escondido: só aparece ao rolar até a base (o min-height do
            main garante a folga de rolagem). Easter egg discreto. */}
        <p
          className="type-caption"
          style={{
            marginTop: 'auto',
            paddingTop: 'var(--space-xl)',
            textAlign: 'center',
            color: 'var(--text-muted)',
          }}
        >
          nenhum lançamento escondido aqui :)
        </p>
      </main>

      {/* FAB só na aba Lançamentos (§5.2): lançar é o gesto daquela tela; em
          Carteira/Relatório ele era ruído. */}
      {aba === 'lancamentos' && <FAB onClick={() => setSheetAberto(true)} />}

      {/* Navegação principal fixa (§5.1) — 3 abas, alcance de polegar. */}
      <BottomNav ativa={aba} onMudar={setAba} />

      <LancarSheet
        aberto={sheetAberto}
        contas={contas}
        cartoes={cartoes}
        historicoDescricoes={historicoDescricoes}
        onFechar={() => setSheetAberto(false)}
        onSalvou={() => { carregar(); }}
      />

      <EditarSheet
        aberto={emEdicao !== null}
        ocorrencia={emEdicao}
        regra={emEdicao ? lancamentos.find((l) => l.id === emEdicao.origemId) ?? null : null}
        contas={contas}
        cartoes={cartoes}
        historicoDescricoes={historicoDescricoes}
        onFechar={() => setEmEdicao(null)}
        onSalvou={() => { carregar(); }}
      />

      {transfApagar && (
        <ModalDeAlerta
          tipo="confirmacao"
          titulo="Apagar transferência?"
          corpo={`A transferência de ${formatarBR(transfApagar.valor, { prefixo: true })} será removida. O dinheiro volta aos lugares de origem, como se nunca tivesse saído.`}
          primaria={{
            rotulo: 'Apagar',
            onClick: async () => {
              // Apaga a regra em transferencias (§5.7 simplificado). O saldo
              // recalcula sozinho — nada materializado, nenhum "ajuste" (§4.4).
              await supabase.from('transferencias').delete().eq('id', transfApagar.origemId);
              setTransfApagar(null);
              carregar();
            },
          }}
          secundaria={{ rotulo: 'Cancelar', onClick: () => setTransfApagar(null) }}
          onScrim={() => setTransfApagar(null)}
        />
      )}
    </div>
  );
}

/* ───────── Aba Lançamentos: grupos por dia ───────── */

type ItemDia =
  | { kind: 'lancamento'; o: OcorrenciaLancamento }
  | { kind: 'fatura'; k: Cartao; cicloAbs: number; realizado: number; fase: FaseFatura }
  | { kind: 'transferencia'; t: OcorrenciaTransferencia };

function Lancamentos(props: {
  ano: number;
  mes: number;
  ocorrencias: OcorrenciaLancamento[];
  transferencias: OcorrenciaTransferencia[];
  cartoes: Cartao[];
  contaPorId: Map<string, Conta>;
  /** Fatura que VENCE no mês exibido, por cartão (o que pesa no saldo, §4.4). */
  faturaDoMes: Map<string, number>;
  // Cru + índices: para posicionar a fatura no ciclo que REALMENTE cai neste mês
  // quando há pagamento efetivo (§5.3) — a data paga pode mover a linha de mês
  // e de dia, então o dia/realizado/fase são derivados do ciclo que aterrissa
  // aqui, não do ciclo-padrão.
  lancamentosRaw: Lancamento[];
  excecoes: IndiceExcecoes;
  pagamentos: IndicePagamentos;
  hoje: Date;
  onEditar: (o: OcorrenciaLancamento) => void;
  onApagarTransf: (t: OcorrenciaTransferencia) => void;
  onAbrirCartao: (k: Cartao) => void;
  saldoInicial: number;
}) {
  const { ano, mes, ocorrencias, transferencias, cartoes, contaPorId, faturaDoMes, lancamentosRaw, excecoes, pagamentos, hoje, onEditar, onApagarTransf, onAbrirCartao, saldoInicial } = props;

  // Agrupa por dia. A data de cada ocorrência já vem resolvida pelo motor
  // (§4.1: âncora no dia + clamp). A fatura de cada cartão entra no DIA DO
  // PAGAMENTO (fluxo de caixa, §4.8) e só nos meses em que uma fatura vence
  // (faturaDoMes > 0). O valor que pesa é a fatura (max previsão/realizado, ou
  // realizado se fechada) — fonte única do motor.
  // Classifica uma transferência pelo tipo das contas (§4.5): destino poupança
  // = depósito (debita); origem poupança = retirada (credita); senão neutra.
  const classificar = (t: OcorrenciaTransferencia): { variante: 'neutra' | 'deposito' | 'retirada'; delta: number } => {
    const destinoPoup = contaPorId.get(t.para_conta_id)?.tipo === 'poupanca';
    const origemPoup = contaPorId.get(t.de_conta_id)?.tipo === 'poupanca';
    if (destinoPoup && !origemPoup) return { variante: 'deposito', delta: -t.valor };
    if (origemPoup && !destinoPoup) return { variante: 'retirada', delta: t.valor };
    return { variante: 'neutra', delta: 0 };
  };

  const grupos = useMemo(() => {
    const porDia = new Map<number, ItemDia[]>();
    const doCartao = (id: string) => lancamentosRaw.filter((l) => l.cartao_id === id);
    const faseMap = (f: string): FaseFatura => f as FaseFatura;
    for (const o of ocorrencias) {
      const [, , dia] = parteData(o.data);
      (porDia.get(dia) ?? porDia.set(dia, []).get(dia)!).push({ kind: 'lancamento', o });
    }
    for (const t of transferencias) {
      const [, , dia] = parteData(t.data);
      (porDia.get(dia) ?? porDia.set(dia, []).get(dia)!).push({ kind: 'transferencia', t });
    }
    // Fatura: descobre o ciclo que REALMENTE cai neste mês (§5.3 — a data
    // efetiva de pagamento pode ter movido a linha de ±1 mês). O dia, o
    // realizado e a fase são derivados desse ciclo, não do ciclo-padrão.
    const alvoAbs = ano * 12 + mes;
    for (const k of cartoes) {
      const peso = faturaDoMes.get(k.id) ?? 0;
      if (peso <= 0) continue; // nenhuma fatura pesa neste mês para este cartão
      const cicloPadrao = k.dia_pagamento > k.dia_fechamento ? alvoAbs : alvoAbs - 1;
      let cicloAbs: number | null = null;
      let dia = diaPagamentoNoMes(k, ano, mes);
      for (const c of [cicloPadrao - 1, cicloPadrao, cicloPadrao + 1]) {
        if (c < 0) continue;
        const pos = posicaoFatura(k, c, pagamentos);
        if (pos.mesAbs === alvoAbs) { cicloAbs = c; dia = pos.dia; break; }
      }
      if (cicloAbs == null) continue;
      const realizado = realizadoDoCiclo(doCartao(k.id), k, cicloAbs, hoje, excecoes);
      const fase = faseMap(faseDoCiclo(cicloAbs, k, hoje));
      const diaClamp = Math.min(Math.max(dia, 1), new Date(ano, mes + 1, 0).getDate());
      (porDia.get(diaClamp) ?? porDia.set(diaClamp, []).get(diaClamp)!).push({ kind: 'fatura', k, cicloAbs, realizado, fase });
    }
    // Saldo acumulado dia a dia, partindo do herdado do mês (§4.7).
    let acc = saldoInicial;
    return [...porDia.keys()]
      .sort((a, b) => a - b)
      .map((dia) => {
        const itens = porDia.get(dia)!;
        for (const it of itens) {
          if (it.kind === 'lancamento') acc += it.o.tipo === 'entrada' ? it.o.valor : -it.o.valor;
          else if (it.kind === 'transferencia') acc += classificar(it.t).delta;
          else acc -= faturaDoMes.get(it.k.id) ?? 0; // fatura sai da conta no pagamento
        }
        return { dia, itens, saldoAcumulado: acc };
      });
  }, [ocorrencias, transferencias, cartoes, faturaDoMes, saldoInicial, ano, mes, contaPorId, lancamentosRaw, excecoes, pagamentos, hoje]);

  if (grupos.length === 0) {
    return (
      <p className="type-caption" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-xl) 0' }}>
        Nada neste mês ainda. Toque em + para lançar.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {grupos.map(({ dia, itens, saldoAcumulado }) => {
        const d = new Date(ano, mes, dia);
        return (
          <div key={dia} style={{ display: 'flex', flexDirection: 'column' }}>
            <CabecalhoDeDia data={`${dia} ${MESES_CURTO[mes]}`} diaSemana={DIAS_SEMANA[d.getDay()]} />

            <div
              style={{
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                background: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {itens.map((it, i) =>
                it.kind === 'lancamento' ? (
                  <LinhaDeLancamento
                    key={it.o.id}
                    tipo={it.o.tipo}
                    descricao={it.o.descricao}
                    valor={it.o.tipo === 'saida' ? -it.o.valor : it.o.valor}
                    conta={(() => { const c = contaPorId.get(it.o.conta_id); return c ? { nome: c.nome, tema: c.tema } : undefined; })()}
                    parcela={it.o.total != null ? { indice: it.o.indice, total: it.o.total } : undefined}
                    recorrente={it.o.repeticao === 'recorrente'}
                    onEditar={() => onEditar(it.o)}
                  />
                ) : it.kind === 'transferencia' ? (
                  <LinhaDeTransferencia
                    key={it.t.id}
                    variante={classificar(it.t).variante}
                    valor={it.t.valor}
                    origem={(() => { const c = contaPorId.get(it.t.de_conta_id); return { nome: c?.nome ?? '—', tema: c?.tema }; })()}
                    destino={(() => { const c = contaPorId.get(it.t.para_conta_id); return { nome: c?.nome ?? '—', tema: c?.tema }; })()}
                    recorrente={it.t.serieId != null}
                    onEditar={() => onApagarTransf(it.t)}
                  />
                ) : (
                  <LinhaDeFatura
                    key={`fat-${it.k.id}-${i}`}
                    titulo={it.k.nome}
                    tagTexto={`fecha dia ${it.k.dia_fechamento}`}
                    tagTema={contaPorId.get(it.k.conta_id)?.tema}
                    fase={it.fase}
                    realizado={it.realizado}
                    previsao={it.fase === 'fechada' ? null : it.k.previsao_mensal}
                    onAbrir={() => onAbrirCartao(it.k)}
                  />
                ),
              )}
            </div>

            <SaldoDoDia saldo={saldoAcumulado} />
          </div>
        );
      })}
    </div>
  );
}

/* ───────── Aba Carteira: seção titulada (Cartões / Contas) ───────── */

function SecaoCarteira({ titulo, children, vazio }: { titulo: string; children: React.ReactNode; vazio: string }) {
  const arr = (Array.isArray(children) ? children : [children]).flat().filter(Boolean);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
      <div style={{ padding: '4px 0 0 4px' }}>
        <span className="type-label" style={{ color: 'var(--text-muted)', letterSpacing: '0.02em' }}>
          {titulo}
        </span>
      </div>
      {arr.length === 0 ? (
        <p className="type-caption" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-lg) 0' }}>
          {vazio}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {arr.map((filho, i) => (
            <div key={i}>
              {i > 0 && <div style={{ height: 1, background: 'var(--border-default)', margin: 'var(--space-md) 0' }} />}
              {filho}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}