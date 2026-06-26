import { Botao } from './Botao';

/**
 * Modal de alerta — §4.3, §5.7, Figma set 2180:999.
 * Scrim (overlay/scrim) + card (bg/elevated, raio 20, padding 32): ícone +
 * título (Title) + corpo (Body) + ações. 4 tipos no design — Confirmação,
 * Bloqueio, Erro, Escopo.
 *
 * Nota: na arquitetura de fluxo (§5.7) a escolha de escopo de série virou um
 * bottom sheet secundário, não um modal; a confirmação de "excluir todas"
 * (destrutivo) usa o tipo Bloqueio. A variante Escopo segue existindo no design.
 */

export type TipoAlerta = 'confirmacao' | 'bloqueio' | 'erro' | 'escopo';

const ICONE_COR: Record<TipoAlerta, string> = {
  confirmacao: 'var(--value-saida)',
  bloqueio: 'var(--value-saida)',
  erro: 'var(--value-saida)',
  escopo: 'var(--accent-default)',
};

type Acao = { rotulo: string; onClick: () => void };

type Props = {
  tipo: TipoAlerta;
  titulo: string;
  corpo: string;
  /** Ação primária (destrutiva nos tipos de bloqueio/erro). */
  primaria: Acao;
  /** Ação secundária (cancelar). Omitir em alertas de só-ciência. */
  secundaria?: Acao;
  onScrim?: () => void;
};

export function ModalDeAlerta({ tipo, titulo, corpo, primaria, secundaria, onScrim }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onScrim}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 var(--space-xl)',
        background: 'var(--overlay-scrim)',
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-lg)',
          padding: 'var(--space-2xl)',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-elevated)',
          width: '100%',
          maxWidth: 360,
        }}
      >
        <span style={{ color: ICONE_COR[tipo], display: 'inline-flex' }} aria-hidden>
          <IconeAlerta />
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="type-title" style={{ color: 'var(--text-primary)' }}>{titulo}</span>
          <span className="type-body" style={{ color: 'var(--text-secondary)' }}>{corpo}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Botao
            hierarquia={tipo === 'escopo' ? 'primary' : 'warning'}
            onClick={primaria.onClick}
          >
            {primaria.rotulo}
          </Botao>
          {secundaria && (
            <Botao hierarquia="ghost" onClick={secundaria.onClick}>
              {secundaria.rotulo}
            </Botao>
          )}
        </div>
      </div>
    </div>
  );
}

function IconeAlerta() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3l9 16H3l9-16z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 10v4M12 17h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
