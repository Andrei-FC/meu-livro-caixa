import { useMemo } from 'react';
import {
  parteData,
  diaFaturaNoMes,
  realizadoDoCiclo,
  faseDoCiclo,
  regimeDoCiclo,
  type OcorrenciaLancamento,
  type OcorrenciaTransferencia,
  type IndiceExcecoes,
  type IndicePagamentos,
  type IndiceCiclos,
} from '../lib/recorrencia';
import type { Conta, Cartao, Lancamento } from '../types/db';
import { CabecalhoDeDia } from './CabecalhoDeDia';
import { LinhaDeLancamento } from './LinhaDeLancamento';
import { LinhaDeFatura, type FaseFatura } from './LinhaDeFatura';
import { LinhaDeTransferencia } from './LinhaDeTransferencia';
import { SaldoDoDia } from './SaldoDoDia';

/**
 * ExtratoDoMes — a lista corrida por dia (§5.1, §5.3, §5.6).
 * Era a função `Lancamentos` dentro da Home; virou componente para o
 * drill-down da conta (§5.6) usar a MESMA gramática da aba Lançamentos —
 * cabeçalho de dia, linhas de lançamento/transferência/fatura e o saldo
 * acumulado ao pé de cada dia. Uma lista só, duas telas.
 *
 * O componente não filtra nada: recebe as ocorrências que deve desenhar. Quem
 * chama decide o recorte (o mês do casal, ou só o que toca uma conta). A única
 * regra que muda com o recorte é o delta da transferência — ver `contaFoco`.
 */

const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const DIAS_SEMANA = [
  'Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira',
  'Quinta-feira', 'Sexta-feira', 'Sábado',
];


type ItemDia =
  | { kind: 'lancamento'; o: OcorrenciaLancamento }
  | { kind: 'fatura'; k: Cartao; cicloAbs: number; realizado: number; fase: FaseFatura }
  | { kind: 'transferencia'; t: OcorrenciaTransferencia };

export function ExtratoDoMes(props: {
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
  ciclos: IndiceCiclos;
  hoje: Date;
  onEditar: (o: OcorrenciaLancamento) => void;
  onApagarTransf: (t: OcorrenciaTransferencia) => void;
  onAbrirCartao: (k: Cartao) => void;
  saldoInicial: number;
  /**
   * Quando presente, o extrato é o de UMA conta (§5.6 drill-down) e não o do
   * casal. Muda só a regra de DELTA da transferência: para o casal, corrente↔
   * corrente é neutra (o dinheiro não saiu de casa, §4.7); para a conta, o que
   * chega é entrada dela e o que sai é saída dela — senão o acumulado não bate
   * com o saldo do card. A filtragem das linhas é do chamador.
   */
  contaFoco?: string;
}) {
  const { ano, mes, ocorrencias, transferencias, cartoes, contaPorId, faturaDoMes, lancamentosRaw, excecoes, pagamentos, ciclos, hoje, onEditar, onApagarTransf, onAbrirCartao, saldoInicial, contaFoco } = props;

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
    const variante = destinoPoup && !origemPoup ? 'deposito' : origemPoup && !destinoPoup ? 'retirada' : 'neutra';
    // Extrato de UMA conta: o delta é o do ponto de vista dela (chegou/saiu),
    // qualquer que seja o outro lado. Extrato do casal: só o que cruza a
    // fronteira do Cofre move o saldo; corrente↔corrente é neutra (§4.5).
    if (contaFoco) {
      const delta = t.para_conta_id === contaFoco ? t.valor : t.de_conta_id === contaFoco ? -t.valor : 0;
      return { variante, delta };
    }
    if (variante === 'deposito') return { variante, delta: -t.valor };
    if (variante === 'retirada') return { variante, delta: t.valor };
    return { variante, delta: 0 };
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
    // efetiva de pagamento pode ter movido a linha de ±1 mês, e o regime pode
    // variar por ciclo). Fonte única: diaFaturaNoMes (motor). O dia, o realizado
    // e a fase são derivados desse ciclo, não do ciclo-padrão.
    const alvoAbs = ano * 12 + mes;
    for (const k of cartoes) {
      const peso = faturaDoMes.get(k.id) ?? 0;
      if (peso <= 0) continue; // nenhuma fatura pesa neste mês para este cartão
      const landed = diaFaturaNoMes(k, alvoAbs, pagamentos, ciclos);
      if (landed == null) continue;
      const { cicloAbs, dia } = landed;
      const realizado = realizadoDoCiclo(doCartao(k.id), k, cicloAbs, hoje, excecoes, ciclos);
      const fase = faseMap(faseDoCiclo(cicloAbs, k, hoje, ciclos));
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
  }, [ocorrencias, transferencias, cartoes, faturaDoMes, saldoInicial, ano, mes, contaPorId, lancamentosRaw, excecoes, pagamentos, ciclos, hoje, contaFoco]);

  if (grupos.length === 0) {
    return (
      <p className="type-caption" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-xl) 0' }}>
        Nada neste mês ainda. Toque em + para lançar.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Ponto de partida do acumulado: o saldo herdado do mês anterior (§4.7).
          Mesma linha do rodapé de dia — só o rótulo muda. */}
      <SaldoDoDia rotulo="Mês anterior" saldo={saldoInicial} />

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
                    sinal={contaFoco ? (classificar(it.t).delta > 0 ? '+' : '-') : undefined}
                    origem={(() => { const c = contaPorId.get(it.t.de_conta_id); return { nome: c?.nome ?? '—', tema: c?.tema }; })()}
                    destino={(() => { const c = contaPorId.get(it.t.para_conta_id); return { nome: c?.nome ?? '—', tema: c?.tema }; })()}
                    recorrente={it.t.serieId != null}
                    onEditar={() => onApagarTransf(it.t)}
                  />
                ) : (
                  <LinhaDeFatura
                    key={`fat-${it.k.id}-${i}`}
                    titulo={it.k.nome}
                    tagTexto={`fecha dia ${regimeDoCiclo(it.k, it.cicloAbs, ciclos).dia_fechamento}`}
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
