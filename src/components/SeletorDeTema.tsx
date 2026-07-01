/**
 * SeletorDeTema — §4.9, Figma 2048:518 (Conta) / 2046:477 (Cartão).
 *
 * Fileira de 8 swatches de tema, distribuídos com space-between. Cada swatch é
 * um quadrado 36 raio 10 pintado com a cor do tema (resolvida por
 * `data-card-theme` → `--theme-bg`, exatamente como o Card de entidade). O
 * selecionado ganha borda 2.5px border/default (anel de seleção do Figma).
 *
 * Guarda a CHAVE do tema (não a cor) — é o que `contas.tema` / `cartoes.tema`
 * persistem (§4.9). Tema é só visual; não afeta cálculo.
 */

/** As 8 chaves de tema da paleta curada (§4.9), na ordem do design. */
export const TEMAS = [
  'vermelho',
  'laranja',
  'azul',
  'roxo',
  'grafite',
  'onix',
  'petroleo',
  'azul-profundo',
] as const;

export type ChaveTema = (typeof TEMAS)[number];

type Props = {
  /** Tema selecionado (chave) ou null = nenhum. */
  valor: string | null;
  onMudar: (tema: ChaveTema) => void;
};

export function SeletorDeTema({ valor, onMudar }: Props) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%' }}>
      {TEMAS.map((t) => {
        const selecionado = valor === t;
        return (
          <button
            key={t}
            type="button"
            aria-label={`Tema ${t}`}
            aria-pressed={selecionado}
            onClick={() => onMudar(t)}
            data-card-theme={t}
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--theme-bg)',
              border: selecionado ? '2.5px solid var(--border-default)' : 'none',
              cursor: 'pointer',
              padding: 0,
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}
