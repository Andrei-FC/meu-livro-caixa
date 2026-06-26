import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Conta, Cartao, Lancamento } from '../types/db';
import {
  Tabs,
  type AbaId,
  CardDeResumo,
  LinhaDeLancamento,
  LinhaDeFatura,
  type FaseFatura,
  CardDeEntidade,
  FAB,
  IconeChevronRight,
} from '../components';

/** Home real (§5.1). Compõe só a biblioteca de componentes.
 *  O seletor de mês no topo controla todas as abas; o dia atual é só a
 *  fronteira fato/projeção, não um corte no que aparece (mês inteiro). */

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** Recorta o mês [ano, mes(0-11)] de uma data YYYY-MM-DD sem fuso. */
function noMes(dataISO: string, ano: number, mes: number): boolean {
  const [a, m] = dataISO.split('-').map(Number);
  return a === ano && m - 1 === mes;
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

  const contaPorId = useMemo(
    () => new Map(contas.map((c) => [c.id, c])),
    [contas],
  );

  // Lançamentos do mês exibido, em conta-corrente, fora de cartão (§4.8: compra
  // de cartão não aparece solta; entra pela linha da fatura).
  const lancamentosDoMes = useMemo(
    () => lancamentos.filter(
      (l) => l.cartao_id == null && noMes(l.data, ano, mes),
    ),
    [lancamentos, ano, mes],
  );

  // Realizado por cartão no mês exibido (soma das compras com cartao_id).
  const realizadoPorCartao = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of lancamentos) {
      if (l.cartao_id && noMes(l.data, ano, mes)) {
        m.set(l.cartao_id, (m.get(l.cartao_id) ?? 0) + l.valor);
      }
    }
    return m;
  }, [lancamentos, ano, mes]);

  // Totais do mês (§4.7). Saldo herdado virá do acumulado anterior — placeholder
  // até a função de saldo contínuo entrar; por ora soma o mês exibido.
  const { entradas, saidas } = useMemo(() => {
    let e = 0, s = 0;
    for (const l of lancamentosDoMes) {
      if (l.tipo === 'entrada') e += l.valor;
      else s += l.valor;
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
      {/* Seletor de mês — controla todas as abas (§5.1) */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-lg)',
          padding: 'var(--space-lg)',
        }}
      >
        <button
          type="button"
          aria-label="Mês anterior"
          onClick={() => mudarMes(-1)}
          style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', display: 'inline-flex', transform: 'rotate(180deg)' }}
        >
          <IconeChevronRight />
        </button>
        <span className="type-body-strong" style={{ minWidth: 160, textAlign: 'center', textTransform: 'capitalize' }}>
          {MESES[mes]} {ano}
        </span>
        <button
          type="button"
          aria-label="Próximo mês"
          onClick={() => mudarMes(1)}
          style={{ border: 'none', background: 'transparent', color: 'var(--text-secondary)', display: 'inline-flex' }}
        >
          <IconeChevronRight />
        </button>
      </header>

      <div style={{ padding: '0 var(--space-lg)' }}>
        <Tabs ativa={aba} onMudar={setAba} />
      </div>

      <main style={{ padding: 'var(--space-lg)', paddingBottom: 'calc(96px + env(safe-area-inset-bottom))' }}>
        {erro && (
          <p className="type-caption" style={{ color: 'var(--value-saida)' }}>
            Erro ao carregar: {erro}
          </p>
        )}
        {carregando ? (
          <p className="type-caption" style={{ color: 'var(--text-muted)' }}>Carregando…</p>
        ) : (
          <>
            {aba === 'lancamentos' && (
              <Lancamentos
                entradas={entradas}
                saidas={saidas}
                saldoMes={saldoMes}
                herdado={herdado}
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
                    <CardDeEntidade
                      key={c.id}
                      tipo="poupanca"
                      nome={c.nome}
                      valor={0 /* TODO §4.7: saldo da conta */}
                      tema={c.tema ?? undefined}
                    />
                  ) : (
                    <CardDeEntidade
                      key={c.id}
                      tipo="conta"
                      nome={c.nome}
                      valor={0 /* TODO §4.7: saldo da conta */}
                      tema={c.tema ?? undefined}
                      entradas={0}
                      saidas={0}
                    />
                  ),
                )}
              </Entidades>
            )}

            {aba === 'cartoes' && (
              <Entidades vazio="Nenhum cartão cadastrado.">
                {cartoes.map((k) => {
                  const realizado = realizadoPorCartao.get(k.id) ?? 0;
                  const pct = k.previsao_mensal > 0
                    ? Math.round((realizado / k.previsao_mensal) * 100)
                    : 0;
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
              <p className="type-caption" style={{ color: 'var(--text-muted)' }}>
                Relatório — em construção (§5.5).
              </p>
            )}
          </>
        )}
      </main>

      <FAB onClick={() => { /* TODO: abrir bottom sheet de lançar (§5.2) */ }} />
    </div>
  );
}

/* ---------- Aba Lançamentos ---------- */

function Lancamentos(props: {
  entradas: number;
  saidas: number;
  saldoMes: number;
  herdado: number;
  lancamentos: Lancamento[];
  cartoes: Cartao[];
  contaPorId: Map<string, Conta>;
  realizadoPorCartao: Map<string, number>;
  fase: (k: Cartao) => FaseFatura;
}) {
  const { entradas, saidas, saldoMes, herdado, lancamentos, cartoes, contaPorId, realizadoPorCartao, fase } = props;
  const vazio = lancamentos.length === 0 && cartoes.length === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <CardDeResumo entradas={entradas} saidas={saidas} saldoMes={saldoMes} herdado={herdado} />

      {vazio ? (
        <p className="type-caption" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-xl) 0' }}>
          Nada neste mês ainda. Toque em + para lançar.
        </p>
      ) : (
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
          {lancamentos.map((l) => {
            const conta = contaPorId.get(l.conta_id);
            return (
              <LinhaDeLancamento
                key={l.id}
                tipo={l.tipo}
                descricao={l.descricao}
                valor={l.tipo === 'saida' ? -l.valor : l.valor}
                conta={conta ? { nome: conta.nome } : undefined}
                onEditar={() => { /* TODO: editar lançamento (§5.7) */ }}
              />
            );
          })}

          {cartoes.map((k) => (
            <LinhaDeFatura
              key={k.id}
              titulo={k.nome}
              tagTexto={`Cartão · fecha dia ${k.dia_fechamento}`}
              fase={fase(k)}
              realizado={realizadoPorCartao.get(k.id) ?? 0}
              previsao={k.previsao_mensal}
              onAbrir={() => { /* TODO: drill-down do cartão (§5.3) */ }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Abas Contas / Cartões ---------- */

function Entidades({ children, vazio }: { children: React.ReactNode; vazio: string }) {
  const arr = Array.isArray(children) ? children : [children];
  const temItens = arr.some(Boolean) && arr.flat().filter(Boolean).length > 0;
  if (!temItens) {
    return (
      <p className="type-caption" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-xl) 0' }}>
        {vazio}
      </p>
    );
  }
  return <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>{children}</div>;
}
