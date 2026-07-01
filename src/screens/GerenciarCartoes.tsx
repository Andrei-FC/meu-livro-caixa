import { Header, CardDeEntidade } from '../components';
import { formatarBR } from '../lib/formato';
import type { Cartao } from '../types/db';

/**
 * Gerenciar Cartões — §5.8, Figma 2045:424.
 * Página própria. Header chuld com FAB `+` (criar) + lista de cartões como
 * Card de entidade (variante Cartão). Tocar num card → editar; `+` → criar.
 *
 * O card usa o vocabulário de previsão (§4.4). Realizado por mês fica 0 aqui
 * (a gestão é fora do contexto de mês); a barra mostra só a previsão como teto.
 */

type Props = {
  cartoes: Cartao[];
  onVoltar: () => void;
  onCriar: () => void;
  onEditar: (cartao: Cartao) => void;
};

export function GerenciarCartoes({ cartoes, onVoltar, onCriar, onEditar }: Props) {
  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', background: 'var(--bg-page)' }}>
      <Header variante="chuld" titulo="Cartões" fab onVoltar={onVoltar} onFab={onCriar} />

      <main style={{ padding: 'var(--space-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
        {cartoes.length === 0 ? (
          <p className="type-caption" style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 'var(--space-xl) 0' }}>
            Nenhum cartão cadastrado. Toque em + para criar.
          </p>
        ) : (
          cartoes.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => onEditar(k)}
              style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', textAlign: 'left', width: '100%' }}
            >
              <CardDeEntidade
                tipo="cartao"
                nome={k.nome}
                valor={0 /* sem realizado fora do mês */}
                tema={k.tema ?? undefined}
                banco={k.banco}
                bandeira={k.bandeira}
                realizado={0}
                previsao={k.previsao_mensal}
                legenda={
                  k.previsao_mensal != null
                    ? `Previsão ${formatarBR(k.previsao_mensal, { prefixo: true })} · fecha dia ${k.dia_fechamento}`
                    : `fecha dia ${k.dia_fechamento}`
                }
              />
            </button>
          ))
        )}
      </main>
    </div>
  );
}
