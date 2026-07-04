import { useEffect, useState } from 'react';
import { Botao } from './Botao';

/**
 * Modal de alerta — §4.3, §5.7, Figma set 2180:999.
 * Scrim (overlay/scrim) + card (bg/elevated, raio 20, padding 32): ícone +
 * título (Title) + corpo (Body) + ações. Tipos: Confirmação, Bloqueio, Erro,
 * Escopo.
 *
 * Dois modos de corpo:
 * - **Padrão** (`corpo`): parágrafo de texto + ações Primária/Secundária.
 * - **Escopo** (`opcoes`): lista de opções-radio (título + descrição) com
 *   DUPLA CONFIRMAÇÃO — selecionar não aplica; confirma no botão primário
 *   (Continuar). Usado como PRIMEIRO passo ao editar/excluir uma ocorrência de
 *   série recorrente (§5.7, v0.8: escopo virou modal, não bottom sheet).
 */

export type TipoAlerta = 'confirmacao' | 'bloqueio' | 'erro' | 'escopo';

const ICONE_COR: Record<TipoAlerta, string> = {
  confirmacao: 'var(--value-saida)',
  bloqueio: 'var(--value-saida)',
  erro: 'var(--value-saida)',
  escopo: 'var(--accent-default)',
};

type Acao = { rotulo: string; onClick: () => void };

/** Uma opção de escopo (radio). `id` é opaco ao modal; o dono lê no onConfirmar. */
export type OpcaoAlerta<T extends string = string> = {
  id: T;
  titulo: string;
  descricao: string;
};

type Props<T extends string = string> = {
  tipo: TipoAlerta;
  titulo: string;
  /** Corpo em texto (modo padrão). Omitir quando usar `opcoes`. */
  corpo?: string;
  /** Opções-radio (modo escopo). Quando presente, `corpo` vira subtítulo e as
   *  ações primária/secundária são substituídas por Continuar/Cancelar. */
  opcoes?: OpcaoAlerta<T>[];
  /** Confirmação da opção escolhida (modo escopo). */
  onConfirmarOpcao?: (id: T) => void;
  /** Ação primária (modo padrão / destrutiva nos tipos bloqueio/erro). */
  primaria?: Acao;
  /** Ação secundária (cancelar). */
  secundaria?: Acao;
  onScrim?: () => void;
};

export function ModalDeAlerta<T extends string = string>({
  tipo,
  titulo,
  corpo,
  opcoes,
  onConfirmarOpcao,
  primaria,
  secundaria,
  onScrim,
}: Props<T>) {
  const modoEscopo = !!opcoes && opcoes.length > 0;
  const [selecionada, setSelecionada] = useState<T>(opcoes?.[0]?.id as T);

  // Reancorar a seleção quando o conjunto de opções muda (reabertura).
  useEffect(() => {
    if (opcoes && opcoes.length > 0) setSelecionada(opcoes[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opcoes?.map((o) => o.id).join('|')]);

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
        zIndex: 130,
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
          {corpo && (
            <span className="type-body" style={{ color: 'var(--text-secondary)' }}>{corpo}</span>
          )}
        </div>

        {modoEscopo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} role="radiogroup">
            {opcoes!.map(({ id, titulo: t, descricao }) => (
              <OpcaoDeLista
                key={id}
                titulo={t}
                descricao={descricao}
                selecionada={id === selecionada}
                onClick={() => setSelecionada(id)}
              />
            ))}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {modoEscopo ? (
            <>
              <Botao hierarquia="primary" onClick={() => onConfirmarOpcao?.(selecionada)}>
                Continuar
              </Botao>
              {secundaria && (
                <Botao hierarquia="ghost" onClick={secundaria.onClick}>
                  {secundaria.rotulo}
                </Botao>
              )}
            </>
          ) : (
            <>
              {primaria && (
                <Botao
                  hierarquia={tipo === 'escopo' ? 'primary' : 'warning'}
                  onClick={primaria.onClick}
                >
                  {primaria.rotulo}
                </Botao>
              )}
              {secundaria && (
                <Botao hierarquia="ghost" onClick={secundaria.onClick}>
                  {secundaria.rotulo}
                </Botao>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * OpcaoDeLista — radio + título + descrição (componente "Opção de lista" Figma).
 * Selecionada: fundo accent/subtle + borda accent/default + radio cheio.
 */
function OpcaoDeLista({
  titulo, descricao, selecionada, onClick,
}: {
  titulo: string;
  descricao: string;
  selecionada: boolean;
  onClick: () => void;
}) {
  const corBorda = selecionada ? 'var(--accent-default)' : 'var(--border-default)';
  return (
    <button
      type="button"
      onClick={onClick}
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
        cursor: 'pointer',
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
        <span className="type-body-strong" style={{ color: 'var(--text-primary)' }}>{titulo}</span>
        <span className="type-caption" style={{ color: 'var(--text-muted)' }}>{descricao}</span>
      </span>
    </button>
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
