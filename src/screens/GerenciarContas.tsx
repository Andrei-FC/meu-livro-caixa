import { Header, CardDeEntidade } from '../components';
import type { Conta } from '../types/db';

/**
 * Gerenciar Contas — §5.8, Figma 2047:460.
 * Página própria (não é aba da Home). Header chuld com FAB `+` (criar) + lista
 * de contas como Card de entidade. Tocar num card → editar (§5.8). O `+` →
 * criar nova conta. Mostra correntes e poupanças ativas (arquivadas saem, §4.10).
 *
 * Entradas/saídas por conta: como esta tela não tem seletor de mês, mostra
 * sempre o MÊS CORRENTE (mapa vindo da Home). Coerente com o cartão, que
 * também mostra o realizado do mês corrente aqui. Saldo por conta fica 0 até o
 * saldo contínuo por conta (§4.7).
 */

type EntradasSaidas = Map<string, { entradas: number; saidas: number }>;

type Props = {
  contas: Conta[];
  /** Entradas/saídas do mês corrente por conta_id. */
  entradasSaidas: EntradasSaidas;
  onVoltar: () => void;
  onCriar: () => void;
  onEditar: (conta: Conta) => void;
};

export function GerenciarContas({ contas, entradasSaidas, onVoltar, onCriar, onEditar }: Props) {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', background: 'var(--bg-page)' }}>
      <Header variante="chuld" titulo="Contas" fab onVoltar={onVoltar} onFab={onCriar} />

      <main style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {contas.length === 0 ? (
          <p className="type-caption" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-xl) 0' }}>
            Nenhuma conta ativa. Toque em + para criar.
          </p>
        ) : (
          contas.map((c) => {
            const es = entradasSaidas.get(c.id) ?? { entradas: 0, saidas: 0 };
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onEditar(c)}
                style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}
              >
                {c.tipo === 'poupanca' ? (
                  <CardDeEntidade tipo="poupanca" nome={c.nome} valor={0 /* TODO §4.7 */} tema={c.tema ?? undefined} />
                ) : (
                  <CardDeEntidade tipo="conta" nome={c.nome} valor={0 /* TODO §4.7 */} tema={c.tema ?? undefined} banco={c.icone} entradas={es.entradas} saidas={es.saidas} />
                )}
              </button>
            );
          })
        )}
      </main>
    </div>
  );
}
