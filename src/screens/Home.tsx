import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Conta, Cartao, Lancamento, ExcecaoSerie, Transferencia } from '../types/db';
import {
  lancamentosNoMes,
  indexarExcecoes,
  saldoHerdado,
  liquidoDoMes,
  faturaNoMes,
  realizadoDoCiclo,
  diaPagamentoNoMes,
  saldoAcumuladoPorConta,
  parteData,
  type OcorrenciaLancamento,
} from '../lib/recorrencia';
import {
  Tabs,
  type AbaId,
  CardDeResumo,
  CabecalhoDeDia,
  SaldoDoDia,
  LinhaDeLancamento,
  LinhaDeFatura,
  type FaseFatura,
  CardDeEntidade,
  FAB,
  Header,
  MenuDrawer,
  type DestinoMenu,
  LancarSheet,
  EditarSheet,
  Relatorio,
} from '../components';
import { GerenciarContas } from './GerenciarContas';
import { categoriasDoMes, maiorGastoDoMes, recorteAssinaturas } from '../lib/relatorio';
import { GerenciarCartoes } from './GerenciarCartoes';
import { CriarEditarConta } from './CriarEditarConta';
import { CriarEditarCartao } from './CriarEditarCartao';
import { CartaoFatura } from './CartaoFatura';

/** Home real (§5.1). Compõe só a biblioteca de componentes.
 *  Estrutura do Figma (2009:11): TopBar (menu + nav de mês) → Card de resumo
 *  (fixo, acima das tabs) → Tabs → conteúdo. Na aba Lançamentos os itens são
 *  AGRUPADOS POR DIA: card branco com Cabeçalho de dia + linhas + Saldo do dia.
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

/** Fase da fatura pelo dia de fechamento vs. hoje, dentro do mês exibido (§4.4). */
function faseFatura(cartao: Cartao, ano: number, mes: number, hoje: Date): FaseFatura {
  const ref = new Date(ano, mes, 1);
  const mesAtual = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  if (ref < mesAtual) return 'fechada';
  if (ref > mesAtual) return 'futura';
  return hoje.getDate() >= cartao.dia_fechamento ? 'fechada' : 'aberta';
}

export function Home() {
  const hoje = useMemo(() => new Date(), []);
  const [ano, setAno] = useState(hoje.getFullYear());
  const [mes, setMes] = useState(hoje.getMonth()); // 0-11
  const [aba, setAba] = useState<AbaId>('lancamentos');

  const [contas, setContas] = useState<Conta[]>([]);
  const [cartoes, setCartoes] = useState<Cartao[]>([]);
  const [lancamentos, setLancamentos] = useState<Lancamento[]>([]);
  const [excecoes, setExcecoes] = useState<ExcecaoSerie[]>([]);
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sheetAberto, setSheetAberto] = useState(false);
  const [menuAberto, setMenuAberto] = useState(false);
  const [emEdicao, setEmEdicao] = useState<OcorrenciaLancamento | null>(null);

  // Roteamento por estado para as PÁGINAS PRÓPRIAS (§5.8) — telas cheias fora
  // das abas da Home (gerenciar/criar/editar conta e cartão). null = Home.
  type Pagina =
    | { tela: 'gerenciar-contas' }
    | { tela: 'gerenciar-cartoes' }
    | { tela: 'conta'; conta: Conta | null }
    | { tela: 'cartao'; cartao: Cartao | null }
    | { tela: 'drill-cartao'; cartao: Cartao };
  const [pagina, setPagina] = useState<Pagina | null>(null);

  const carregar = useCallback(() => {
    setErro(null);
    return Promise.all([
      supabase.from('contas').select('*').is('arquivada_em', null).order('criada_em'),
      supabase.from('cartoes').select('*').order('criado_em'),
      supabase.from('lancamentos').select('*').order('data'),
      supabase.from('excecoes_serie').select('*'),
      supabase.from('transferencias').select('*'),
    ]).then(([rc, rk, rl, re, rt]) => {
      const e = rc.error || rk.error || rl.error || re.error || rt.error;
      if (e) setErro(e.message);
      setContas(rc.data ?? []);
      setCartoes(rk.data ?? []);
      setLancamentos(rl.data ?? []);
      setExcecoes(re.data ?? []);
      setTransferencias(rt.data ?? []);
      setCarregando(false);
    });
  }, []);

  useEffect(() => {
    setCarregando(true);
    carregar();
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

  // Fatura que VENCE no mês exibido, por cartão — o que pesa no saldo (§4.4).
  // Fonte única: faturaNoMes (ciclo + fase + max previsão/realizado). A lista
  // usa isto para posicionar a linha da fatura no dia do pagamento e debitar.
  const faturaDoMes = useMemo(() => {
    const m = new Map<string, number>();
    for (const k of cartoes) {
      m.set(k.id, faturaNoMes(lancamentos, k, ano, mes, hoje, indiceExcecoes));
    }
    return m;
  }, [cartoes, lancamentos, ano, mes, hoje, indiceExcecoes]);

  // Realizado do ciclo que VENCE no mês exibido, por cartão — para o display da
  // linha de fatura (o "R$ X / previsão"). Deve seguir o mesmo ciclo que
  // faturaNoMes usa (o que vence neste mês), senão a linha de um mês futuro
  // mostraria o realizado de outro ciclo. Regra de qual ciclo vence: §4.8.
  const realizadoPorCartao = useMemo(() => {
    const alvoAbs = ano * 12 + mes;
    const m = new Map<string, number>();
    for (const k of cartoes) {
      const cicloAbs = k.dia_pagamento > k.dia_fechamento ? alvoAbs : alvoAbs - 1;
      m.set(k.id, cicloAbs < 0 ? 0 : realizadoDoCiclo(lancamentos, k, cicloAbs, hoje, indiceExcecoes));
    }
    return m;
  }, [cartoes, lancamentos, ano, mes, hoje, indiceExcecoes]);

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
      hoje.getFullYear(), hoje.getMonth(), hoje, indiceExcecoes,
    ),
    [lancamentos, transferencias, contas, cartoes, hoje, indiceExcecoes],
  );
  // Saldo acumulado por conta no MÊS EXIBIDO — cards da aba Contas da Home
  // (acompanha a navegação de mês).
  const saldosPorContaMesExibido = useMemo(
    () => saldoAcumuladoPorConta(
      lancamentos, transferencias, contas, cartoes, ano, mes, hoje, indiceExcecoes,
    ),
    [lancamentos, transferencias, contas, cartoes, ano, mes, hoje, indiceExcecoes],
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
    // TODO: rotear cofre/categorias/configurações (§5.8)
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
        hoje={hoje}
        anoInicial={ano}
        mesInicial={mes}
        onVoltar={() => setPagina(null)}
        onEditar={(o) => { setPagina(null); setEmEdicao(o); }}
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

      {/* ── Card de resumo: rola normal; some por baixo do header (§5.1) ── */}
      <div style={{ padding: '0 var(--space-lg)' }}>
        <CardDeResumo entradas={entradas} saidas={saidas} saldoMes={saldoMes} herdado={herdado} />
      </div>

      {/* ── Tabs: grudam logo abaixo do header quando o card sai de vista.
             `top` = altura publicada pelo Header em --altura-header. ── */}
      <div
        style={{
          position: 'sticky',
          top: 'var(--altura-header, 0px)',
          zIndex: 10,
          background: 'var(--bg-page)',
          padding: 'var(--space-md) var(--space-lg) 0',
        }}
      >
        <Tabs ativa={aba} onMudar={setAba} />
      </div>

      {/* min-height garante folga de rolagem suficiente para esconder o card
          de resumo em QUALQUER aba — assim as tabs, uma vez docadas abaixo do
          header, não "descem" ao trocar para uma aba curta (relatório vazio,
          poucas contas). O card sempre pode sair de vista; a posição das tabs
          fica estável entre abas. */}
      <main
        style={{
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          padding: 'var(--space-lg)',
          paddingBottom: 'calc(96px + env(safe-area-inset-bottom))',
        }}
      >
        {erro && (
          <p className="type-caption" style={{ color: 'var(--value-saida)' }}>Erro ao carregar: {erro}</p>
        )}
        {carregando ? (
          <p className="type-caption" style={{ color: 'var(--text-muted)' }}>Carregando…</p>
        ) : (
          <>
            {aba === 'lancamentos' && (
              <Lancamentos
                ano={ano}
                mes={mes}
                ocorrencias={ocorrenciasLista}
                cartoes={cartoes}
                contaPorId={contaPorId}
                faturaDoMes={faturaDoMes}
                realizadoPorCartao={realizadoPorCartao}
                fase={(k) => faseFatura(k, ano, mes, hoje)}
                onEditar={setEmEdicao}
                onAbrirCartao={(k) => setPagina({ tela: 'drill-cartao', cartao: k })}
                saldoInicial={herdado}
              />
            )}

            {aba === 'contas' && (
              <Entidades vazio="Nenhuma conta ativa.">
                {contas.map((c) =>
                  c.tipo === 'poupanca' ? (
                    <CardDeEntidade key={c.id} tipo="poupanca" nome={c.nome} valor={0 /* TODO §4.7 poupança */} tema={c.tema ?? undefined} />
                  ) : (
                    <CardDeEntidade key={c.id} tipo="conta" nome={c.nome} valor={saldosPorContaMesExibido.get(c.id) ?? 0} tema={c.tema ?? undefined} banco={c.icone} entradas={porConta.get(c.id)?.entradas ?? 0} saidas={porConta.get(c.id)?.saidas ?? 0} />
                  ),
                )}
              </Entidades>
            )}

            {aba === 'cartoes' && (
              <Entidades vazio="Nenhum cartão cadastrado.">
                {cartoes.map((k) => {
                  const realizado = realizadoPorCartao.get(k.id) ?? 0;
                  const temPrev = k.previsao_mensal != null && k.previsao_mensal > 0;
                  const pct = temPrev ? Math.round((realizado / k.previsao_mensal!) * 100) : 0;
                  const legenda = temPrev
                    ? `${pct}% da previsão · fecha dia ${k.dia_fechamento}`
                    : `fecha dia ${k.dia_fechamento}`;
                  return (
                    <CardDeEntidade
                      key={k.id}
                      tipo="cartao"
                      nome={k.nome}
                      valor={realizado}
                      tema={k.tema ?? undefined}
                      banco={k.banco}
                      bandeira={k.bandeira}
                      realizado={realizado}
                      previsao={k.previsao_mensal}
                      legenda={legenda}
                      onAbrir={() => setPagina({ tela: 'drill-cartao', cartao: k })}
                    />
                  );
                })}
              </Entidades>
            )}

            {aba === 'relatorio' && (
              <Relatorio categorias={categoriasRelatorio} maiorGasto={maiorGasto} recorte={recorte} />
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

      <FAB onClick={() => setSheetAberto(true)} />

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
    </div>
  );
}

/* ───────── Aba Lançamentos: grupos por dia ───────── */

type ItemDia =
  | { kind: 'lancamento'; o: OcorrenciaLancamento }
  | { kind: 'fatura'; k: Cartao };

function Lancamentos(props: {
  ano: number;
  mes: number;
  ocorrencias: OcorrenciaLancamento[];
  cartoes: Cartao[];
  contaPorId: Map<string, Conta>;
  /** Fatura que VENCE no mês exibido, por cartão (o que pesa no saldo, §4.4). */
  faturaDoMes: Map<string, number>;
  /** Realizado do ciclo corrente, por cartão (para o display da linha). */
  realizadoPorCartao: Map<string, number>;
  fase: (k: Cartao) => FaseFatura;
  onEditar: (o: OcorrenciaLancamento) => void;
  onAbrirCartao: (k: Cartao) => void;
  saldoInicial: number;
}) {
  const { ano, mes, ocorrencias, cartoes, contaPorId, faturaDoMes, realizadoPorCartao, fase, onEditar, onAbrirCartao, saldoInicial } = props;

  // Agrupa por dia. A data de cada ocorrência já vem resolvida pelo motor
  // (§4.1: âncora no dia + clamp). A fatura de cada cartão entra no DIA DO
  // PAGAMENTO (fluxo de caixa, §4.8) e só nos meses em que uma fatura vence
  // (faturaDoMes > 0). O valor que pesa é a fatura (max previsão/realizado, ou
  // realizado se fechada) — fonte única do motor.
  const grupos = useMemo(() => {
    const porDia = new Map<number, ItemDia[]>();
    for (const o of ocorrencias) {
      const [, , dia] = parteData(o.data);
      (porDia.get(dia) ?? porDia.set(dia, []).get(dia)!).push({ kind: 'lancamento', o });
    }
    for (const k of cartoes) {
      const peso = faturaDoMes.get(k.id) ?? 0;
      if (peso <= 0) continue; // nenhuma fatura vence neste mês para este cartão
      const dia = diaPagamentoNoMes(k, ano, mes);
      (porDia.get(dia) ?? porDia.set(dia, []).get(dia)!).push({ kind: 'fatura', k });
    }
    // Saldo acumulado dia a dia, partindo do herdado do mês (§4.7).
    let acc = saldoInicial;
    return [...porDia.keys()]
      .sort((a, b) => a - b)
      .map((dia) => {
        const itens = porDia.get(dia)!;
        for (const it of itens) {
          if (it.kind === 'lancamento') acc += it.o.tipo === 'entrada' ? it.o.valor : -it.o.valor;
          else acc -= faturaDoMes.get(it.k.id) ?? 0; // fatura sai da conta no pagamento
        }
        return { dia, itens, saldoAcumulado: acc };
      });
  }, [ocorrencias, cartoes, faturaDoMes, saldoInicial, ano, mes]);

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
                    onEditar={() => onEditar(it.o)}
                  />
                ) : (
                  <LinhaDeFatura
                    key={`fat-${it.k.id}-${i}`}
                    titulo={it.k.nome}
                    tagTexto={`fecha dia ${it.k.dia_fechamento}`}
                    tagTema={contaPorId.get(it.k.conta_id)?.tema}
                    fase={fase(it.k)}
                    realizado={realizadoPorCartao.get(it.k.id) ?? 0}
                    previsao={it.k.previsao_mensal}
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

/* ───────── Abas Contas / Cartões ───────── */

function Entidades({ children, vazio }: { children: React.ReactNode; vazio: string }) {
  const arr = (Array.isArray(children) ? children : [children]).flat().filter(Boolean);
  if (arr.length === 0) {
    return (
      <p className="type-caption" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-xl) 0' }}>
        {vazio}
      </p>
    );
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>{children}</div>;
}