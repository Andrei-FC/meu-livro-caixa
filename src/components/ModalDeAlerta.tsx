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
  bloqueio: 'var(--accent-default)',
  erro: 'var(--text-muted)',
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
          alignItems: 'center',
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

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: '100%' }}>
          <span className="type-title" style={{ color: 'var(--text-primary)', textAlign: 'center' }}>{titulo}</span>
          {corpo && (
            <span className="type-body" style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>{corpo}</span>
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
                  hierarquia={tipo === 'confirmacao' ? 'warning' : 'primary'}
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

/** icon / others / triangle-danger (Figma 2002:251) — triângulo preenchido de
 *  cantos arredondados com exclamação. `currentColor` para herdar a cor do tipo. */
function IconeAlerta() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M14.8 4.61301L21.501 15.774C22.464 17.377 21.991 19.486 20.444 20.484C19.9248 20.8202 19.3196 20.9994 18.701 21H5.298C3.477 21 2 19.47 2 17.581C2 16.942 2.173 16.317 2.498 15.774L9.2 4.61301C10.162 3.01001 12.196 2.51901 13.743 3.51701C14.171 3.79301 14.533 4.16801 14.8 4.61301ZM12 17C12.2652 17 12.5196 16.8947 12.7071 16.7071C12.8946 16.5196 13 16.2652 13 16C13 15.7348 12.8946 15.4804 12.7071 15.2929C12.5196 15.1054 12.2652 15 12 15C11.7348 15 11.4804 15.1054 11.2929 15.2929C11.1054 15.4804 11 15.7348 11 16C11 16.2652 11.1054 16.5196 11.2929 16.7071C11.4804 16.8947 11.7348 17 12 17ZM12 8.00001C11.7348 8.00001 11.4804 8.10537 11.2929 8.2929C11.1054 8.48044 11 8.73479 11 9.00001V13C11 13.2652 11.1054 13.5196 11.2929 13.7071C11.4804 13.8947 11.7348 14 12 14C12.2652 14 12.5196 13.8947 12.7071 13.7071C12.8946 13.5196 13 13.2652 13 13V9.00001C13 8.73479 12.8946 8.48044 12.7071 8.2929C12.5196 8.10537 12.2652 8.00001 12 8.00001Z" fill="currentColor" />
    </svg>
  );
}
