import { useEffect, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { Botao } from './Botao';

/**
 * EscopoSheet — escolha de escopo de série (§4.3, §5.7).
 * Bottom sheet secundário (NÃO modal de alerta): escopo é uma escolha de fluxo
 * de três caminhos. Fiel ao componente "Opção de lista" do Figma (radio +
 * título + descrição, estados Default/Selecionada) e com DUPLA CONFIRMAÇÃO:
 * o usuário seleciona uma opção e confirma no botão — selecionar não aplica
 * sozinho, porque escopo de série mexe em vários meses.
 *
 * O passo de confirmação destrutiva do "excluir todas" é tratado FORA daqui
 * (um ModalDeAlerta de bloqueio, disparado pelo EditarSheet após o Confirmar).
 */

export type EscopoSerie = 'so_esta' | 'esta_e_futuras' | 'todas';

type Props = {
  aberto: boolean;
  /** Verbo da ação em curso, para a microcópia ("salvar"/"excluir"). */
  acao: 'salvar' | 'excluir';
  /** Rótulo do tipo de série, para o título ("Lançamento recorrente"…). */
  rotuloSerie?: string;
  /** Escopos indisponíveis (ex.: 'esta_e_futuras' em parcelamento no salvar). */
  desabilitadas?: EscopoSerie[];
  onFechar: () => void;
  onConfirmar: (escopo: EscopoSerie) => void;
};

const OPCOES: { id: EscopoSerie; titulo: string; descricao: string }[] = [
  { id: 'so_esta', titulo: 'Só esta', descricao: 'Cria uma exceção apenas neste mês' },
  { id: 'esta_e_futuras', titulo: 'Esta e as futuras', descricao: 'Altera daqui pra frente; o passado fica intacto' },
  { id: 'todas', titulo: 'Todas', descricao: 'Altera a série inteira, incluindo o passado' },
];

export function EscopoSheet({
  aberto,
  acao,
  rotuloSerie = 'Lançamento recorrente',
  desabilitadas = [],
  onFechar,
  onConfirmar,
}: Props) {
  // Seleção interna (dupla confirmação): default na primeira disponível.
  const primeiraDisponivel = OPCOES.find((o) => !desabilitadas.includes(o.id))?.id ?? 'so_esta';
  const [selecionada, setSelecionada] = useState<EscopoSerie>(primeiraDisponivel);

  // Ao reabrir, volta para a primeira opção disponível.
  useEffect(() => {
    if (aberto) setSelecionada(primeiraDisponivel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  return (
    <BottomSheet aberto={aberto} onFechar={onFechar} aria-label="Escopo da alteração" zIndex={120}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 16px calc(28px + env(safe-area-inset-bottom))' }}>
        {/* Cabeçalho */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 8px 8px' }}>
          <span className="type-title" style={{ color: 'var(--text-primary)' }}>{rotuloSerie}</span>
          <span className="type-body" style={{ color: 'var(--text-primary)' }}>
            Faz parte de uma série. O que você quer {acao === 'excluir' ? 'excluir' : 'alterar'}?
          </span>
        </div>

        {/* Opções (componente "Opção de lista" do Figma) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {OPCOES.map(({ id, titulo, descricao }) => (
            <OpcaoDeLista
              key={id}
              titulo={titulo}
              descricao={descricao}
              selecionada={id === selecionada}
              desabilitada={desabilitadas.includes(id)}
              onClick={() => setSelecionada(id)}
            />
          ))}
        </div>

        {/* Confirmar (dupla confirmação) */}
        <Botao onClick={() => onConfirmar(selecionada)}>Confirmar</Botao>
      </div>
    </BottomSheet>
  );
}

/**
 * OpcaoDeLista — réplica do componente Figma (radio + título + descrição).
 * Selecionada: fundo accent/subtle + borda accent/default + radio cheio.
 * Default: fundo bg/surface + borda border/default + radio vazio.
 */
function OpcaoDeLista({
  titulo, descricao, selecionada, desabilitada, onClick,
}: {
  titulo: string;
  descricao: string;
  selecionada: boolean;
  desabilitada: boolean;
  onClick: () => void;
}) {
  const corBorda = selecionada ? 'var(--accent-default)' : 'var(--border-default)';
  return (
    <button
      type="button"
      onClick={() => !desabilitada && onClick()}
      disabled={desabilitada}
      role="radio"
      aria-checked={selecionada}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        width: '100%',
        textAlign: 'left',
        borderRadius: 'var(--radius-lg)',
        border: `1px solid ${corBorda}`,
        background: selecionada ? 'var(--accent-subtle)' : 'var(--bg-surface)',
        cursor: desabilitada ? 'not-allowed' : 'pointer',
        opacity: desabilitada ? 0.4 : 1,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 20, height: 20, borderRadius: '50%',
          border: `2px solid ${corBorda}`,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
        }}
      >
        {selecionada && <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-default)' }} />}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span className="type-body-strong" style={{ color: 'var(--text-primary)' }}>
          {titulo}{desabilitada ? ' (em breve)' : ''}
        </span>
        <span className="type-caption" style={{ color: 'var(--text-muted)' }}>{descricao}</span>
      </span>
    </button>
  );
}
