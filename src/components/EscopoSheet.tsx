import { BottomSheet } from './BottomSheet';
import { IconeChevronRight } from '../icons';

/**
 * EscopoSheet — escolha de escopo de série (§4.3, §5.7).
 * Bottom sheet secundário (NÃO modal de alerta): escopo é uma escolha de fluxo
 * de três caminhos, parte normal de mexer numa recorrência — não uma
 * interrupção de erro. Dispara ao Salvar e ao Excluir, nunca ao abrir o editor.
 *
 * O passo de confirmação destrutiva do "excluir todas" é tratado FORA daqui
 * (um ModalDeAlerta de bloqueio, disparado pelo EditarSheet após a escolha).
 */

export type EscopoSerie = 'so_esta' | 'esta_e_futuras' | 'todas';

type Props = {
  aberto: boolean;
  /** Verbo da ação em curso, para a microcópia ("salvar"/"excluir"). */
  acao: 'salvar' | 'excluir';
  /** Escopos temporariamente indisponíveis (ex.: 'esta_e_futuras' na Fase 1). */
  desabilitadas?: EscopoSerie[];
  onFechar: () => void;
  onEscolher: (escopo: EscopoSerie) => void;
};

const OPCOES: { id: EscopoSerie; rotulo: string; ajuda: string }[] = [
  { id: 'so_esta', rotulo: 'Só esta ocorrência', ajuda: 'Afeta apenas este mês.' },
  { id: 'esta_e_futuras', rotulo: 'Esta e as futuras', ajuda: 'Daqui em diante; o passado fica intacto.' },
  { id: 'todas', rotulo: 'Todas', ajuda: 'A série inteira, incluindo o passado.' },
];

export function EscopoSheet({ aberto, acao, desabilitadas = [], onFechar, onEscolher }: Props) {
  return (
    <BottomSheet aberto={aberto} onFechar={onFechar} aria-label="Escopo da alteração" zIndex={120}>
      <div style={{ padding: '4px 20px 4px' }}>
        <span className="type-title" style={{ color: 'var(--text-primary)' }}>
          {acao === 'excluir' ? 'Excluir o quê?' : 'Aplicar a quê?'}
        </span>
      </div>

      <div style={{ padding: '8px 12px calc(24px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column' }}>
        {OPCOES.map(({ id, rotulo, ajuda }) => {
          const off = desabilitadas.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => !off && onEscolher(id)}
              disabled={off}
              aria-disabled={off}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '14px 12px',
                width: '100%',
                border: 'none',
                background: 'transparent',
                textAlign: 'left',
                cursor: off ? 'not-allowed' : 'pointer',
                opacity: off ? 0.4 : 1,
              }}
            >
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="type-body-strong" style={{ color: 'var(--text-primary)' }}>
                  {rotulo}{off ? ' (em breve)' : ''}
                </span>
                <span className="type-caption" style={{ color: 'var(--text-muted)' }}>{ajuda}</span>
              </span>
              {!off && (
                <span aria-hidden style={{ color: 'var(--text-muted)', display: 'inline-flex' }}>
                  <IconeChevronRight tamanho={20} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
