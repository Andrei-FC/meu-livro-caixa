import { Header, CardDeEntidade, Botao } from '../components';
import { IconeMinus, IconePlus } from '../icons';
import { formatarBR, dataCurta } from '../lib/formato';
import type { MovimentacaoPoupanca } from '../lib/recorrencia';
import type { Conta } from '../types/db';

/**
 * Poupança — drill-down (§5.4, Figma 2021:273). Hero (Card de entidade
 * poupança) + Depositar/Retirar + histórico de movimentações + Apagar. As
 * ações abrem o sheet de transferência com a poupança fixada num lado (§5.2):
 * o pai (Home) decide o modo e passa ao LancarSheet. Depósito debita o mês,
 * retirada credita (§4.5) — regra no cálculo, não aqui.
 */

type Props = {
  poupanca: Conta;
  saldo: number;
  movimentacoes: MovimentacaoPoupanca[];
  onVoltar: () => void;
  onDepositar: () => void;
  onRetirar: () => void;
  onEditar: () => void;
};

export function PoupancaDrilldown({ poupanca, saldo, movimentacoes, onVoltar, onDepositar, onRetirar, onEditar }: Props) {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <Header variante="chuld" titulo={poupanca.nome} onVoltar={onVoltar} />

      <main style={{ flex: 1, padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        {/* Hero */}
        <CardDeEntidade
          tipo="poupanca"
          nome={poupanca.nome}
          valor={saldo}
          tema={poupanca.tema ?? undefined}
          icone={poupanca.icone}
        />

        {/* Ações: Depositar / Retirar */}
        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <Botao hierarquia="secondary" onClick={onDepositar} style={{ flex: 1 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <IconePlus tamanho={18} /> Depositar
            </span>
          </Botao>
          <Botao hierarquia="secondary" onClick={onRetirar} style={{ flex: 1 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-xs)' }}>
              <IconeMinus tamanho={18} /> Retirar
            </span>
          </Botao>
        </div>

        {/* Movimentações */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <span className="type-label" style={{ color: 'var(--text-muted)', letterSpacing: '0.02em', paddingLeft: 4 }}>
            MOVIMENTAÇÕES
          </span>
          {movimentacoes.length === 0 ? (
            <p className="type-caption" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-lg) 0' }}>
              Nenhuma movimentação ainda.
            </p>
          ) : (
            <div style={{ background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
              {movimentacoes.map((m, i) => (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px var(--space-lg)',
                    borderBottom: i < movimentacoes.length - 1 ? '1px solid var(--divider)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span className="type-body" style={{ color: 'var(--text-primary)' }}>
                      {m.tipo === 'deposito' ? 'Depósito' : 'Retirada'}
                      {m.descricao ? ` · ${m.descricao}` : ''}
                    </span>
                    <span className="type-caption" style={{ color: 'var(--text-muted)' }}>
                      {dataCurta(m.data)}
                    </span>
                  </div>
                  <span
                    className="type-numeric"
                    style={{ color: m.delta >= 0 ? 'var(--value-entrada)' : 'var(--value-saida)' }}
                  >
                    {formatarBR(m.delta, { sinal: '+' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Apagar poupança (§4.10) — leva à edição, onde a regra de apagar mora */}
      <div style={{ padding: 'var(--space-md) var(--space-xl) calc(var(--space-xl) + env(safe-area-inset-bottom))' }}>
        <Botao hierarquia="secondary" onClick={onEditar} style={{ color: 'var(--value-saida)' }}>
          Apagar poupança
        </Botao>
      </div>
    </div>
  );
}
