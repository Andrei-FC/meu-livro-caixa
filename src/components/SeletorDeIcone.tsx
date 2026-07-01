import { BottomSheet } from './BottomSheet';
import { IconeBan } from '../icons';

/**
 * SeletorDeIcone — sub-sheet de escolha de logo (§4.9).
 * Figma "Selecionar icone conta" (2246:1243) e "Selecionar icone Bandeira"
 * (2248:1334). Título contextual + linha superior com o `Select Icon` "ban"
 * (= nenhum ícone) + grade dos logos da biblioteca. Cada célula é o componente
 * `Select Icon` (60×60): Default (surface) ou Selected (accent-subtle + borda
 * accent). Guarda a CHAVE do logo — o que `contas.icone` / `cartoes.banco` /
 * `cartoes.bandeira` persistem (§4.9).
 *
 * Genérico por biblioteca: recebe o mapa chave→componente (BANCOS ou BANDEIRAS),
 * então serve banco e bandeira sem duplicar layout — a prova de futuro (posso
 * adicionar bancos/bandeiras à biblioteca sem tocar aqui).
 */

type Biblioteca = Record<string, (p: { tamanho?: number }) => JSX.Element>;

type Props = {
  aberto: boolean;
  titulo: string;
  /** Mapa chave→componente de logo (ex.: BANCOS, BANDEIRAS). */
  biblioteca: Biblioteca;
  /** Chave selecionada, ou null = nenhum (linha "ban" fica marcada). */
  valor: string | null;
  onFechar: () => void;
  /** Seleciona uma chave, ou null para "nenhum". */
  onSelecionar: (chave: string | null) => void;
};

export function SeletorDeIcone({ aberto, titulo, biblioteca, valor, onFechar, onSelecionar }: Props) {
  const chaves = Object.keys(biblioteca);

  return (
    <BottomSheet aberto={aberto} onFechar={onFechar} aria-label={titulo} zIndex={120 /* acima do sheet de criar/editar */}>
      <div style={{ padding: '4px 20px 12px', textAlign: 'center' }}>
        <span className="type-title" style={{ color: 'var(--text-primary)' }}>{titulo}</span>
      </div>

      <div style={{ padding: '0 20px calc(24px + env(safe-area-inset-bottom))' }}>
        {/* Linha "nenhum" (ban) — sozinha no topo */}
        <div style={{ marginBottom: 'var(--space-md)' }}>
          <Celula selecionado={valor === null} onClick={() => onSelecionar(null)}>
            <IconeBan tamanho={26} />
          </Celula>
        </div>

        {/* Grade de logos: células 60, gap 12, quebra em linha */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-md)' }}>
          {chaves.map((chave) => {
            const Logo = biblioteca[chave];
            return (
              <Celula key={chave} selecionado={valor === chave} onClick={() => onSelecionar(chave)}>
                <Logo tamanho={40} />
              </Celula>
            );
          })}
        </div>
      </div>
    </BottomSheet>
  );
}

/** Célula `Select Icon` (Figma 2246:1295): 60×60, radius-sm; Selected = fundo
 *  accent-subtle + borda accent-default; Default = surface elevada. */
function Celula({
  selecionado,
  onClick,
  children,
}: {
  selecionado: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selecionado}
      onClick={onClick}
      style={{
        width: 60,
        height: 60,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-sm)',
        background: selecionado ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
        border: selecionado ? '1px solid var(--accent-default)' : '1px solid var(--border-subtle)',
        color: 'var(--text-primary)',
        cursor: 'pointer',
        padding: 0,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}
