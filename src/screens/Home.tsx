import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Conta, Cartao, Lancamento } from '../types/db';
import {
  lancamentosNoMes,
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
  LancarSheet,
} from '../components';

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
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [sheetAberto, setSheetAberto] = useState(false);

  const carregar = useCallback(() => {
    setErro(null);
    return Promise.all([
      supabase.from('contas').select('*').is('arquivada_em', null).order('criada_em'),
      supabase.from('cartoes').select('*').order('criado_em'),
      supabase.from('lancamentos').select('*').order('data'),
    ]).then(([rc, rk, rl]) => {
      const e = rc.error || rk.error || rl.error;
      if (e) setErro(e.message);
      setContas(rc.data ?? []);
      setCartoes(rk.data ?? []);
      setLancamentos(rl.data ?? []);
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
    const vistas = new Set<string>();
    const lista: string[] = [];
    for (const l of lancamentos) {
      const chave = l.descricao.trim().toLowerCase();
      if (chave && !vistas.has(chave)) { vistas.add(chave); lista.push(l.descricao.trim()); }
    }
    return lista;
  }, [lancamentos]);

  // Ocorrências do mês exibido, materializadas a partir das regras (§4.1).
  // O motor expande parcelas/recorrências; o passado e o futuro (até o
  // horizonte) saem daqui, não de um filtro por data crua.
  const ocorrenciasDoMes = useMemo(
    () => lancamentosNoMes(lancamentos, ano, mes, hoje),
    [lancamentos, ano, mes, hoje],
  );

  // Da lista do mês saem as ocorrências em conta-corrente, fora de cartão
  // (§4.8: compra de cartão não aparece solta; entra pela linha da fatura).
  const ocorrenciasLista = useMemo(
    () => ocorrenciasDoMes.filter((o) => o.cartao_id == null),
    [ocorrenciasDoMes],
  );

  // Realizado por cartão no mês exibido (soma das ocorrências com cartao_id).
  const realizadoPorCartao = useMemo(() => {
    const m = new Map<string, number>();
    for (const o of ocorrenciasDoMes) {
      if (o.cartao_id) m.set(o.cartao_id, (m.get(o.cartao_id) ?? 0) + o.valor);
    }
    return m;
  }, [ocorrenciasDoMes]);

  // Totais do mês (§4.7). Herdado virá do saldo contínuo; por ora 0.
  const { entradas, saidas } = useMemo(() => {
    let e = 0, s = 0;
    for (const o of ocorrenciasLista) {
      if (o.tipo === 'entrada') e += o.valor; else s += o.valor;
    }
    return { entradas: e, saidas: s };
  }, [ocorrenciasLista]);
  const herdado = 0; // TODO §4.7: saldo contínuo acumulado dos meses anteriores
  const saldoMes = herdado + entradas - saidas;

  function mudarMes(delta: number) {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', position: 'relative' }}>
      {/* ── Header: menu + navegação de mês (§5.1, Figma 2221:992) ── */}
      <Header
        mesAno={`${MESES[mes]} ${ano}`}
        onMenu={() => { /* TODO: abrir drawer (§5.8) */ }}
        onAnterior={() => mudarMes(-1)}
        onProximo={() => mudarMes(1)}
      />

      {/* ── Card de resumo: FIXO no topo, acima das tabs (§5.1) ── */}
      <div style={{ padding: '0 var(--space-lg)' }}>
        <CardDeResumo entradas={entradas} saidas={saidas} saldoMes={saldoMes} herdado={herdado} />
      </div>

      {/* ── Tabs ── */}
      <div style={{ padding: 'var(--space-md) var(--space-lg) 0' }}>
        <Tabs ativa={aba} onMudar={setAba} />
      </div>

      <main style={{ padding: 'var(--space-lg)', paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
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
                realizadoPorCartao={realizadoPorCartao}
                fase={(k) => faseFatura(k, ano, mes, hoje)}
              />
            )}

            {aba === 'contas' && (
              <Entidades vazio="Nenhuma conta ativa.">
                {contas.map((c) =>
                  c.tipo === 'poupanca' ? (
                    <CardDeEntidade key={c.id} tipo="poupanca" nome={c.nome} valor={0 /* TODO §4.7 */} tema={c.tema ?? undefined} />
                  ) : (
                    <CardDeEntidade key={c.id} tipo="conta" nome={c.nome} valor={0 /* TODO §4.7 */} tema={c.tema ?? undefined} entradas={0} saidas={0} />
                  ),
                )}
              </Entidades>
            )}

            {aba === 'cartoes' && (
              <Entidades vazio="Nenhum cartão cadastrado.">
                {cartoes.map((k) => {
                  const realizado = realizadoPorCartao.get(k.id) ?? 0;
                  const pct = k.previsao_mensal > 0 ? Math.round((realizado / k.previsao_mensal) * 100) : 0;
                  return (
                    <CardDeEntidade
                      key={k.id}
                      tipo="cartao"
                      nome={k.nome}
                      valor={realizado}
                      tema={k.tema ?? undefined}
                      realizado={realizado}
                      previsao={k.previsao_mensal}
                      legenda={`${pct}% da previsão · fecha dia ${k.dia_fechamento}`}
                    />
                  );
                })}
              </Entidades>
            )}

            {aba === 'relatorio' && (
              <p className="type-caption" style={{ color: 'var(--text-muted)' }}>Relatório — em construção (§5.5).</p>
            )}
          </>
        )}
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
  realizadoPorCartao: Map<string, number>;
  fase: (k: Cartao) => FaseFatura;
}) {
  const { ano, mes, ocorrencias, cartoes, contaPorId, realizadoPorCartao, fase } = props;

  // Agrupa por dia. A data de cada ocorrência já vem resolvida pelo motor
  // (§4.1: âncora no dia + clamp). A fatura entra no dia do pagamento (fluxo de
  // caixa, §4.8); por ora ancora no dia_pagamento dentro do mês exibido.
  const grupos = useMemo(() => {
    const porDia = new Map<number, ItemDia[]>();
    for (const o of ocorrencias) {
      const [, , dia] = parteData(o.data);
      (porDia.get(dia) ?? porDia.set(dia, []).get(dia)!).push({ kind: 'lancamento', o });
    }
    for (const k of cartoes) {
      const dia = Math.min(k.dia_pagamento, 28); // clamp defensivo; §4.1 trata borda
      (porDia.get(dia) ?? porDia.set(dia, []).get(dia)!).push({ kind: 'fatura', k });
    }
    // Saldo acumulado dia a dia (dentro do mês; herdado=0 por ora, §4.7).
    let acc = 0;
    return [...porDia.keys()]
      .sort((a, b) => a - b)
      .map((dia) => {
        const itens = porDia.get(dia)!;
        for (const it of itens) {
          if (it.kind === 'lancamento') acc += it.o.tipo === 'entrada' ? it.o.valor : -it.o.valor;
          else acc -= realizadoPorCartao.get(it.k.id) ?? 0; // fatura sai da conta no pagamento
        }
        return { dia, itens, saldoAcumulado: acc };
      });
  }, [ocorrencias, cartoes, realizadoPorCartao]);

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
                borderRadius: 'var(--radius-md)',
                overflow: 'hidden',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
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
                    conta={(() => { const c = contaPorId.get(it.o.conta_id); return c ? { nome: c.nome } : undefined; })()}
                    onEditar={() => { /* TODO: editar (§5.7) */ }}
                  />
                ) : (
                  <LinhaDeFatura
                    key={`fat-${it.k.id}-${i}`}
                    titulo={it.k.nome}
                    tagTexto={`Cartão · fecha dia ${it.k.dia_fechamento}`}
                    fase={fase(it.k)}
                    realizado={realizadoPorCartao.get(it.k.id) ?? 0}
                    previsao={it.k.previsao_mensal}
                    onAbrir={() => { /* TODO: drill-down (§5.3) */ }}
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