import { Header, CardDeEntidade } from '../components';
import { formatarBR } from '../lib/formato';
import type { Conta } from '../types/db';

/**
 * Cofre (§5.4, Figma 2049:506) — contêiner único das poupanças. Página própria
 * (não é aba da Home). Header chuld "Cofres" com FAB `+` (criar poupança) +
 * card hero escuro "TOTAL GUARDADO" (soma de todas, fora do total do mês, §4.5)
 * + lista de poupanças como Card de entidade. Tocar num card → drill-down.
 *
 * O total e cada saldo vêm de `saldoPorPoupanca` (§5.4). Só reusa componentes
 * da biblioteca — nenhum markup de card repetido aqui.
 */

type Props = {
  poupancas: Conta[];
  /** Saldo guardado por poupança (poupanca_id → valor). */
  saldos: Map<string, number>;
  onVoltar: () => void;
  onCriar: () => void;
  onAbrir: (poupanca: Conta) => void;
};

export function Cofre({ poupancas, saldos, onVoltar, onCriar, onAbrir }: Props) {
  const total = poupancas.reduce((s, p) => s + (saldos.get(p.id) ?? 0), 0);
  const n = poupancas.length;

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', background: 'var(--bg-page)' }}>
      <Header variante="chuld" titulo="Cofres" fab onVoltar={onVoltar} onFab={onCriar} />

      <main style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {/* Hero: total guardado — card escuro (tema onix), fora do total do mês */}
        <div
          data-card-theme="onix"
          style={{
            background: 'var(--theme-bg)',
            borderRadius: 'var(--radius-lg)',
            padding: 'var(--space-lg) var(--space-xl)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-xs)',
          }}
        >
          <span className="type-label" style={{ color: 'var(--theme-text)', opacity: 0.7, letterSpacing: '0.04em' }}>
            TOTAL GUARDADO
          </span>
          <span className="type-display" style={{ color: 'var(--theme-text)' }}>
            {formatarBR(total, { prefixo: true })}
          </span>
          <span className="type-caption" style={{ color: 'var(--theme-text)', opacity: 0.7 }}>
            {n === 1 ? '1 cofre' : `${n} cofres`}
          </span>
        </div>

        {/* Lista de poupanças */}
        {n === 0 ? (
          <p className="type-caption" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-xl) 0' }}>
            Nenhum cofre ainda. Toque em + para criar.
          </p>
        ) : (
          poupancas.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onAbrir(p)}
              style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}
            >
              <CardDeEntidade
                tipo="poupanca"
                nome={p.nome}
                valor={saldos.get(p.id) ?? 0}
                tema={p.tema ?? undefined}
                icone={p.icone}
              />
            </button>
          ))
        )}
      </main>
    </div>
  );
}
