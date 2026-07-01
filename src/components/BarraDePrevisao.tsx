/**
 * Barra de previsão — §4.4
 * Figma set `barra` (2190:1052). 4 variantes no design (ok·Warm·Over·Empty);
 * aqui a cor é RUNTIME pela razão realizado÷previsão — estouro não é estado
 * separado, é consequência visual. Trilho bar/track único (slate/500-a20),
 * imune a tema e light/dark. Altura 6px, pill.
 * Limiares: verde até 75% · amarelo 75–100% · vermelho acima de 100%.
 */

export type FaseBarra = 'ok' | 'warn' | 'over';

const corPreenchimento: Record<FaseBarra, string> = {
  ok: 'var(--bar-ok)',
  warn: 'var(--bar-warn)',
  over: 'var(--bar-over)',
};

function resolverFase(razao: number): FaseBarra {
  if (razao > 1) return 'over';
  if (razao >= 0.75) return 'warn';
  return 'ok';
}

type Props = {
  realizado: number;
  /** Teto previsto; null/≤0 = sem previsão → a barra não é renderizada. */
  previsao: number | null;
  rotulo?: string;
};

export function BarraDePrevisao({ realizado, previsao, rotulo }: Props) {
  // Sem previsão não há o que preencher: o cartão só acumula o realizado (§4.4).
  if (previsao == null || previsao <= 0) return null;

  const razao = realizado / previsao;
  const fase = resolverFase(razao);
  const pct = Math.max(0, Math.min(razao, 1)) * 100; // satura em 100%; cor já diz "estourou"

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={Math.max(previsao, 0)}
      aria-valuenow={Math.max(realizado, 0)}
      aria-label={rotulo}
      style={{
        width: '100%',
        height: 6,
        borderRadius: 'var(--radius-full)',
        background: 'var(--bar-track)',
        overflow: 'hidden',
      }}
    >
      {pct > 0 && (
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            borderRadius: 'var(--radius-full)',
            background: corPreenchimento[fase],
            transition: 'width 200ms ease-out',
          }}
        />
      )}
    </div>
  );
}
