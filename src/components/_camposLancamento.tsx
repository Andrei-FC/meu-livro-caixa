import { useState } from 'react';
import type { ReactNode } from 'react';
import { IconeChevronRight, IconeMinus, IconePlus, IconeCalendar } from '../icons';
import { formatarBR } from '../lib/formato';
import type { LancamentoTipo, RepeticaoTipo } from '../types/db';

/**
 * Campos compartilhados do fluxo de lançamento (§5.2) — usados tanto pelo
 * LancarSheet (criar) quanto pelo EditarSheet (editar, §5.7). Extraídos para
 * que a edição seja um "clone" real do lançar, sem duplicar markup.
 */

export type ModoLancamento = LancamentoTipo | 'transferencia';
export type RepeteLancamento = RepeticaoTipo;

/* ───────── Subcomponentes internos ───────── */

export function Toggle({ modo, onMudar }: { modo: ModoLancamento; onMudar: (m: ModoLancamento) => void }) {
  const opcoes: { id: ModoLancamento; rotulo: string }[] = [
    { id: 'saida', rotulo: 'Saída' },
    { id: 'entrada', rotulo: 'Entrada' },
    { id: 'transferencia', rotulo: 'Transferência' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 'var(--radius-md)', background: 'var(--bg-page)' }}>
      {opcoes.map(({ id, rotulo }) => {
        const ativo = id === modo;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onMudar(id)}
            className="type-body-small-strong"
            style={{
              flex: '1 1 0',
              padding: '8px 4px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: ativo ? 'var(--accent-default)' : 'transparent',
              color: ativo ? 'var(--text-on-accent)' : 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            {rotulo}
          </button>
        );
      })}
    </div>
  );
}

export function CampoDescricao({
  valor, onMudar, sugestoes, onEscolherSugestao, obrigatorio,
}: {
  valor: string;
  onMudar: (s: string) => void;
  sugestoes: string[];
  onEscolherSugestao: (s: string) => void;
  obrigatorio: boolean;
}) {
  const [focado, setFocado] = useState(false);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative' }}>
      <span className="type-label" style={{ color: 'var(--text-secondary)' }}>
        Descrição{!obrigatorio && ' (opcional)'}
      </span>
      <input
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        onFocus={() => setFocado(true)}
        onBlur={() => setTimeout(() => setFocado(false), 120 /* permite clicar na sugestão */)}
        placeholder="Mercado, aluguel, salário…"
        style={{
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 16,
          outline: 'none',
          width: '100%',
        }}
      />
      {focado && sugestoes.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
            zIndex: 5,
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          }}
        >
          {sugestoes.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onEscolherSugestao(s)}
              className="type-body"
              style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '10px 14px', border: 'none', background: 'transparent',
                color: 'var(--text-primary)', cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </label>
  );
}

export function CampoData({ valor, onMudar }: { valor: string; onMudar: (s: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="type-label" style={{ color: 'var(--text-secondary)' }}>Data</span>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="date"
          value={valor}
          onChange={(e) => onMudar(e.target.value)}
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-default)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 16,
            outline: 'none',
            width: '100%',
          }}
        />
        <span aria-hidden style={{ position: 'absolute', right: 14, color: 'var(--text-muted)', pointerEvents: 'none' }}>
          <IconeCalendar tamanho={20} />
        </span>
      </div>
    </label>
  );
}

export function CampoSeletor({
  label, valor, ehCartao, onAbrir,
}: { label: string; valor: string; ehCartao?: boolean; onAbrir: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="type-label" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <button
        type="button"
        onClick={onAbrir}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          width: '100%', textAlign: 'left', cursor: 'pointer',
        }}
      >
        {ehCartao && (
          <span className="type-label" style={{ padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--accent-subtle)', color: 'var(--accent-default)' }}>
            Cartão
          </span>
        )}
        <span className="type-body" style={{ flex: 1 }}>{valor}</span>
        <span aria-hidden style={{ color: 'var(--text-muted)', display: 'inline-flex' }}>
          <IconeChevronRight tamanho={20} />
        </span>
      </button>
    </div>
  );
}

export function CampoNota({ valor, onMudar }: { valor: string; onMudar: (s: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="type-label" style={{ color: 'var(--text-secondary)' }}>Nota (opcional)</span>
      <textarea
        value={valor}
        onChange={(e) => onMudar(e.target.value)}
        rows={2}
        style={{
          padding: '12px 14px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-default)',
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 16,
          outline: 'none',
          width: '100%',
          resize: 'vertical',
        }}
      />
    </label>
  );
}

export function ComoSeRepete(props: {
  repete: RepeteLancamento;
  onMudar: (r: RepeteLancamento) => void;
  valor: number;
  parcelas: number;
  setParcelas: (n: number) => void;
  recIndefinida: boolean;
  setRecIndefinida: (b: boolean) => void;
  recVezes: number;
  setRecVezes: (n: number) => void;
  assinatura: boolean;
  setAssinatura: (b: boolean) => void;
  semParcelar?: boolean;
  semAssinatura?: boolean;
}) {
  const {
    repete, onMudar, valor, parcelas, setParcelas,
    recIndefinida, setRecIndefinida, recVezes, setRecVezes,
    assinatura, setAssinatura, semParcelar, semAssinatura,
  } = props;

  const chips: { id: RepeteLancamento; rotulo: string }[] = [
    { id: 'avista', rotulo: 'À vista' },
    ...(semParcelar ? [] : [{ id: 'parcelar' as RepeteLancamento, rotulo: 'Parcelar' }]),
    { id: 'recorrente', rotulo: 'Recorrente' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="type-label" style={{ color: 'var(--text-secondary)' }}>Como se repete</span>
      <div style={{ display: 'flex', gap: 8 }}>
        {chips.map(({ id, rotulo }) => {
          const ativo = id === repete;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onMudar(id)}
              className="type-body-small-strong"
              style={{
                padding: '8px 14px',
                borderRadius: 'var(--radius-sm)',
                background: ativo ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                color: ativo ? 'var(--accent-default)' : 'var(--text-secondary)',
                border: `1px solid ${ativo ? 'var(--accent-default)' : 'var(--border-default)'}`,
                cursor: 'pointer',
              }}
            >
              {rotulo}
            </button>
          );
        })}
      </div>

      {repete === 'avista' && (
        <span className="type-caption" style={{ color: 'var(--text-muted)' }}>Pagamento único na data.</span>
      )}

      {repete === 'parcelar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SubCaixa>
            <span className="type-body" style={{ color: 'var(--text-primary)', flex: 1 }}>Número de parcelas</span>
            <Stepper valor={parcelas} min={2} onMudar={setParcelas} />
          </SubCaixa>
          <span className="type-caption" style={{ color: 'var(--text-secondary)' }}>
            {formatarBR(valor / parcelas, { prefixo: true })} × {parcelas} = {formatarBR(valor, { prefixo: true })}
          </span>
        </div>
      )}

      {repete === 'recorrente' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SubCaixa>
            <span className="type-body" style={{ color: 'var(--text-primary)', flex: 1 }}>Repetir</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <MiniChip ativo={recIndefinida} onClick={() => setRecIndefinida(true)}>Sempre</MiniChip>
              <MiniChip ativo={!recIndefinida} onClick={() => setRecIndefinida(false)}>X vezes</MiniChip>
            </div>
          </SubCaixa>
          {!recIndefinida && (
            <SubCaixa>
              <span className="type-body" style={{ color: 'var(--text-primary)', flex: 1 }}>Quantas vezes</span>
              <Stepper valor={recVezes} min={2} onMudar={setRecVezes} />
            </SubCaixa>
          )}
          <span className="type-caption" style={{ color: 'var(--text-secondary)' }}>
            {formatarBR(valor, { prefixo: true })}/mês{recIndefinida ? ', sempre' : `, ${recVezes} vezes`}
          </span>

          {!semAssinatura && (
            <SubCaixa>
              <span className="type-body" style={{ color: 'var(--text-primary)', flex: 1 }}>É assinatura</span>
              <Switch ligado={assinatura} onMudar={setAssinatura} />
            </SubCaixa>
          )}
        </div>
      )}
    </div>
  );
}

export function SubCaixa({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 14px',
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
      }}
    >
      {children}
    </div>
  );
}

export function Stepper({ valor, min, onMudar }: { valor: number; min: number; onMudar: (n: number) => void }) {
  const btn = {
    width: 36, height: 36, borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--border-default)', background: 'var(--bg-surface)',
    color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', cursor: 'pointer',
  } as const;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
      <button type="button" aria-label="Diminuir" style={btn} onClick={() => onMudar(Math.max(min, valor - 1))}>
        <IconeMinus tamanho={18} />
      </button>
      <span className="type-body-strong" style={{ color: 'var(--text-primary)', minWidth: 24, textAlign: 'center' }}>{valor}</span>
      <button type="button" aria-label="Aumentar" style={btn} onClick={() => onMudar(valor + 1)}>
        <IconePlus tamanho={18} />
      </button>
    </div>
  );
}

export function MiniChip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="type-body-small-strong"
      style={{
        padding: '6px 12px',
        borderRadius: 'var(--radius-sm)',
        background: ativo ? 'var(--accent-subtle)' : 'transparent',
        color: ativo ? 'var(--accent-default)' : 'var(--text-secondary)',
        border: `1px solid ${ativo ? 'var(--accent-default)' : 'var(--border-default)'}`,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

export function Switch({ ligado, onMudar }: { ligado: boolean; onMudar: (b: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      onClick={() => onMudar(!ligado)}
      style={{
        width: 48, height: 28, borderRadius: 'var(--radius-full)', border: 'none',
        background: ligado ? 'var(--control-on)' : 'var(--border-default)',
        position: 'relative', cursor: 'pointer', flex: '0 0 auto', transition: 'background 140ms',
      }}
    >
      <span
        aria-hidden
        style={{
          position: 'absolute', top: 2, left: ligado ? 22 : 2,
          width: 24, height: 24, borderRadius: '50%', background: 'var(--p-white)',
          transition: 'left 140ms',
        }}
      />
    </button>
  );
}

export function hojeISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
