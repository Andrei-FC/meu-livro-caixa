import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Conta, Cartao, Lancamento } from '../types/db';
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
  IconeChevronRight,
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

/** Parte uma data YYYY-MM-DD em [ano, mes(0-11), dia] sem fuso. */
function parteData(iso: string): [number, number, number] {
  const [a, m, d] = iso.split('-').map(Number);
  return [a, m - 1, d];
}
function noMes(iso: string, ano: number, mes: number): boolean {
  const [a, m] = parteData(iso);
  return a === ano && m === mes;
}

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

  useEffect(() => {
    let vivo = true;
    setCarregando(true);
    setErro(null);
    Promise.all([
      supabase.from('contas').select('*').is('arquivada_em', null).order('criada_em'),
      supabase.from('cartoes').select('*').order('criado_em'),
      supabase.from('lancamentos').select('*').order('data'),
    ]).then(([rc, rk, rl]) => {
      if (!vivo) return;
      const e = rc.error || rk.error || rl.error;
      if (e) setErro(e.message);
      setContas(rc.data ?? []);
      setCartoes(rk.data ?? []);
      setLancamentos(rl.data ?? []);
      setCarregando(false);
    });
    return () => { vivo = false; };
  }, []);

  const contaPorId = useMemo(() => new Map(contas.map((c) => [c.id, c])), [contas]);

  // Lançamentos do mês exibido, em conta-corrente, fora de cartão (§4.8: compra
  // de cartão não aparece solta; entra pela linha da fatura).
  const lancamentosDoMes = useMemo(
    () => lancamentos.filter((l) => l.cartao_id == null && noMes(l.data, ano, mes)),
    [lancamentos, ano, mes],
  );

  // Realizado por cartão no mês exibido.
  const realizadoPorCartao = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lancamentos) {
      if (l.cartao_id && noMes(l.data, ano, mes)) {
        m.set(l.cartao_id, (m.get(l.cartao_id) ?? 0) + l.valor);
      }
    }
    return m;
  }, [lancamentos, ano, mes]);

  // Totais do mês (§4.7). Herdado virá do saldo contínuo; por ora 0.
  const { entradas, saidas } = useMemo(() => {
    let e = 0, s = 0;
    for (const l of lancamentosDoMes) {
      if (l.tipo === 'entrada') e += l.valor; else s += l.valor;
    }
    return { entradas: e, saidas: s };
  }, [lancamentosDoMes]);
  const herdado = 0; // TODO §4.7: saldo contínuo acumulado dos meses anteriores
  const saldoMes = herdado + entradas - saidas;

  function mudarMes(delta: number) {
    const d = new Date(ano, mes + delta, 1);
    setAno(d.getFullYear());
    setMes(d.getMonth());
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', position: 'relative' }}>
      {/* ── TopBar: menu + navegação de mês (Figma TopBar) ── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--space-md) var(--space-lg)',
        }}
      >
        <button
          type="button"
          aria-label="Menu"
          onClick={() => { /* TODO: abrir drawer (§5.8) */ }}
          style={botaoIcone}
        >
          <span aria-hidden style={{ fontSize: 20, lineHeight: 1 }}>☰</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
          <button type="button" aria-label="Mês anterior" onClick={() => mudarMes(-1)} style={{ ...botaoIcone, transform: 'rotate(180deg)' }}>
            <IconeChevronRight />
          </button>
          <span className="type-body-strong" style={{ minWidth: 130, textAlign: 'center', textTransform: 'capitalize' }}>
            {MESES[mes]} {ano}
          </span>
          <button type="button" aria-label="Próximo mês" onClick={() => mudarMes(1)} style={botaoIcone}>
            <IconeChevronRight />
          </button>
        </div>

        <span style={{ width: 40 }} aria-hidden />
      </header>

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
                lancamentos={lancamentosDoMes}
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

      <FAB onClick={() => { /* TODO: bottom sheet de lançar (§5.2) */ }} />
    </div>
  );
}

const botaoIcone: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--text-secondary)',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 40,
  height: 40,
};

/* ───────── Aba Lançamentos: grupos por dia ───────── */

type ItemDia =
  | { kind: 'lancamento'; l: Lancamento }
  | { kind: 'fatura'; k: Cartao };

function Lancamentos(props: {
  ano: number;
  mes: number;
  lancamentos: Lancamento[];
  cartoes: Cartao[];
  contaPorId: Map<string, Conta>;
  realizadoPorCartao: Map<string, number>;
  fase: (k: Cartao) => FaseFatura;
}) {
  const { ano, mes, lancamentos, cartoes, contaPorId, realizadoPorCartao, fase } = props;

  // Agrupa por dia. A fatura entra no dia do pagamento (fluxo de caixa, §4.8);
  // por ora ancora no dia_pagamento dentro do mês exibido.
  const grupos = useMemo(() => {
    const porDia = new Map<number, ItemDia[]>();
    for (const l of lancamentos) {
      const [, , dia] = parteData(l.data);
      (porDia.get(dia) ?? porDia.set(dia, []).get(dia)!).push({ kind: 'lancamento', l });
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
          if (it.kind === 'lancamento') acc += it.l.tipo === 'entrada' ? it.l.valor : -it.l.valor;
          else acc -= realizadoPorCartao.get(it.k.id) ?? 0; // fatura sai da conta no pagamento
        }
        return { dia, itens, saldoAcumulado: acc };
      });
  }, [lancamentos, cartoes, realizadoPorCartao]);

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
                    key={it.l.id}
                    tipo={it.l.tipo}
                    descricao={it.l.descricao}
                    valor={it.l.tipo === 'saida' ? -it.l.valor : it.l.valor}
                    conta={(() => { const c = contaPorId.get(it.l.conta_id); return c ? { nome: c.nome } : undefined; })()}
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
