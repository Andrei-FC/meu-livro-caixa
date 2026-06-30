import { useMemo, useRef, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { Botao } from './Botao';
import {
  SeletorContaCartao,
  type ContextoSeletor,
  type Selecao,
} from './SeletorContaCartao';
import { IconeClose, IconeChevronRight, IconeMinus, IconePlus, IconeCalendar } from '../icons';
import { formatarBR } from '../lib/formato';
import { supabase } from '../lib/supabase';
import type { Conta, Cartao, LancamentoTipo, RepeticaoTipo } from '../types/db';

/**
 * LancarSheet — o fluxo sagrado (§5.2, Figma section "Lançar").
 * Grava UMA linha-regra (à vista, parcelar ou recorrente) em `lancamentos`,
 * ou uma linha em `transferencias`. A materialização das ocorrências de série
 * é read-time (motor §4.1) — fora deste componente.
 *
 * Estrutura visual 1:1 com o Figma: grabber (no BottomSheet) → header
 * (título + ✕) → VALOR → toggle ternário Saída/Entrada/Transferência → campos
 * → "Como se repete" (chips + subcampo) → footer fixo Salvar.
 *
 * Preparado para reuso na Edição (§5.7): a forma dos campos e o submit por
 * modo já isolam o que a edição vai estender (valores iniciais, Excluir,
 * escopo de série).
 */

type Modo = LancamentoTipo | 'transferencia';
type Repete = RepeticaoTipo;

type Props = {
  aberto: boolean;
  contas: Conta[];
  cartoes: Cartao[];
  /** Descrições já usadas, para o autocomplete (§4.6). */
  historicoDescricoes: string[];
  onFechar: () => void;
  /** Chamado após gravar com sucesso — a Home recarrega os dados. */
  onSalvou: () => void;
};

/** Converte o valor digitado (centavos como string) em número em reais. */
function centavosParaReais(digitos: string): number {
  return Number(digitos || '0') / 100;
}

export function LancarSheet({
  aberto,
  contas,
  cartoes,
  historicoDescricoes,
  onFechar,
  onSalvou,
}: Props) {
  // ── Estado do formulário ──
  const [modo, setModo] = useState<Modo>('saida');
  const [digitos, setDigitos] = useState(''); // valor em centavos, só dígitos
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(() => hojeISO());
  const [repete, setRepete] = useState<Repete>('avista');
  const [parcelas, setParcelas] = useState(12);
  const [recIndefinida, setRecIndefinida] = useState(true);
  const [recVezes, setRecVezes] = useState(12);
  const [assinatura, setAssinatura] = useState(false);
  const [nota, setNota] = useState('');

  // Gasto/receita: conta OU cartão. Transferência: origem + destino.
  const [contaSel, setContaSel] = useState<Conta | null>(null);
  const [cartaoSel, setCartaoSel] = useState<Cartao | null>(null);
  const [origemSel, setOrigemSel] = useState<Conta | null>(null);
  const [destinoSel, setDestinoSel] = useState<Conta | null>(null);

  const [seletor, setSeletor] = useState<ContextoSeletor | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const valorInputRef = useRef<HTMLInputElement>(null);
  const valor = centavosParaReais(digitos);

  // Default de conta na principal (primeira corrente) quando ainda não escolheu.
  const contaPadrao = useMemo(
    () => contas.find((c) => c.tipo === 'corrente') ?? null,
    [contas],
  );
  const contaEfetiva = contaSel ?? (cartaoSel ? null : contaPadrao);

  // Sugestões de descrição: prefixo, normalizado (§4.6 — versão simples).
  const sugestoes = useMemo(() => {
    const q = descricao.trim().toLowerCase();
    if (!q) return [];
    return historicoDescricoes
      .filter((d) => d.toLowerCase().startsWith(q) && d.toLowerCase() !== q)
      .slice(0, 4);
  }, [descricao, historicoDescricoes]);

  function resetar() {
    setModo('saida');
    setDigitos('');
    setDescricao('');
    setData(hojeISO());
    setRepete('avista');
    setParcelas(12);
    setRecIndefinida(true);
    setRecVezes(12);
    setAssinatura(false);
    setNota('');
    setContaSel(null);
    setCartaoSel(null);
    setOrigemSel(null);
    setDestinoSel(null);
    setErro(null);
  }

  function fechar() {
    resetar();
    onFechar();
  }

  const ehTransferencia = modo === 'transferencia';

  // Validação mínima de habilitação do Salvar.
  const podeSalvar =
    valor > 0 &&
    !salvando &&
    (ehTransferencia
      ? origemSel != null && destinoSel != null && origemSel.id !== destinoSel.id
      : descricao.trim().length > 0 && (contaEfetiva != null || cartaoSel != null));

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      if (ehTransferencia) {
        const payload = {
          valor,
          data,
          de_conta_id: origemSel!.id,
          para_conta_id: destinoSel!.id,
          descricao: descricao.trim() || null,
          repeticao: (repete === 'recorrente' ? 'recorrente' : 'avista') as 'avista' | 'recorrente',
          recorrencia_fim: repete === 'recorrente' && !recIndefinida ? recVezes : null,
        };
        const { error } = await supabase.from('transferencias').insert(payload);
        if (error) throw error;
      } else {
        const payload = {
          tipo: modo as LancamentoTipo,
          valor, // total na parcela; por mês na recorrente; único à vista (§3.3)
          descricao: descricao.trim(),
          nota: nota.trim() || null,
          data,
          conta_id: cartaoSel ? contaPadrao?.id ?? null : contaEfetiva?.id ?? null,
          cartao_id: cartaoSel?.id ?? null,
          repeticao: repete,
          parcelas: repete === 'parcelar' ? parcelas : null,
          recorrencia_fim: repete === 'recorrente' && !recIndefinida ? recVezes : null,
          assinatura: repete === 'recorrente' ? assinatura : false,
        };
        const { error } = await supabase.from('lancamentos').insert(payload);
        if (error) throw error;
      }
      resetar();
      onSalvou();
      onFechar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  function aoSelecionar(sel: Selecao) {
    if (!seletor) return;
    if (seletor === 'transf-saida' && sel.kind === 'conta') setOrigemSel(sel.conta);
    else if (seletor === 'transf-destino' && sel.kind === 'conta') setDestinoSel(sel.conta);
    else if (sel.kind === 'conta') { setContaSel(sel.conta); setCartaoSel(null); }
    else if (sel.kind === 'cartao') { setCartaoSel(sel.cartao); setContaSel(null); }
    setSeletor(null);
  }

  return (
    <>
      <BottomSheet aberto={aberto} onFechar={fechar} aria-label="Novo lançamento">
        {/* ── Header: spacer · título centralizado · ✕ (Figma 3 colunas) ── */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 16px 8px 20px' }}>
          <span style={{ width: 22, flex: '0 0 auto' }} aria-hidden />
          <span className="type-title" style={{ color: 'var(--text-primary)', flex: 1, textAlign: 'center' }}>
            Novo lançamento
          </span>
          <button
            type="button"
            onClick={fechar}
            aria-label="Fechar"
            style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', display: 'inline-flex', padding: 0, flex: '0 0 auto' }}
          >
            <IconeClose />
          </button>
        </div>

        {/* ── VALOR ── */}
        <button
          type="button"
          onClick={() => valorInputRef.current?.focus()}
          style={{ border: 'none', background: 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '16px 0 24px', width: '100%', cursor: 'text' }}
        >
          <span className="type-label" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Valor</span>
          <span className="type-display" style={{ color: 'var(--text-primary)' }}>
            R$ {formatarBR(valor)}
          </span>
          {/* input numérico invisível: teclado numérico no mobile */}
          <input
            ref={valorInputRef}
            value={digitos}
            onChange={(e) => setDigitos(e.target.value.replace(/\D/g, '').slice(0, 12))}
            inputMode="numeric"
            autoFocus
            aria-label="Valor em reais"
            style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
          />
        </button>

        {/* ── Body rolável ── */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 20px 20px' }}>
          {/* Toggle ternário */}
          <Toggle modo={modo} onMudar={(m) => { setModo(m); if (m === 'transferencia') setRepete(repete === 'parcelar' ? 'avista' : repete); }} />

          {/* Descrição (gasto/receita e, opcional, transferência) */}
          <CampoDescricao
            valor={descricao}
            onMudar={setDescricao}
            sugestoes={sugestoes}
            onEscolherSugestao={(s) => setDescricao(s)}
            obrigatorio={!ehTransferencia}
          />

          {!ehTransferencia && (
            <>
              {/* Data */}
              <CampoData valor={data} onMudar={setData} />

              {/* Conta/cartão */}
              <CampoSeletor
                label="Conta"
                valor={cartaoSel ? cartaoSel.nome : contaEfetiva?.nome ?? 'Selecionar'}
                ehCartao={!!cartaoSel}
                onAbrir={() => setSeletor(modo === 'entrada' ? 'entrada' : 'saida')}
              />

              {/* Como se repete */}
              <ComoSeRepete
                repete={repete}
                onMudar={setRepete}
                valor={valor}
                parcelas={parcelas}
                setParcelas={setParcelas}
                recIndefinida={recIndefinida}
                setRecIndefinida={setRecIndefinida}
                recVezes={recVezes}
                setRecVezes={setRecVezes}
                assinatura={assinatura}
                setAssinatura={setAssinatura}
              />

              {/* Nota livre */}
              <CampoNota valor={nota} onMudar={setNota} />
            </>
          )}

          {ehTransferencia && (
            <>
              <CampoSeletor
                label="Conta Saída"
                valor={origemSel?.nome ?? 'Selecionar'}
                onAbrir={() => setSeletor('transf-saida')}
              />
              <CampoSeletor
                label="Conta Destino"
                valor={destinoSel?.nome ?? 'Selecionar'}
                onAbrir={() => setSeletor('transf-destino')}
              />
              {/* Transferência pode ser recorrente, nunca parcelada (§3.4) */}
              <ComoSeRepete
                repete={repete}
                onMudar={setRepete}
                valor={valor}
                parcelas={parcelas}
                setParcelas={setParcelas}
                recIndefinida={recIndefinida}
                setRecIndefinida={setRecIndefinida}
                recVezes={recVezes}
                setRecVezes={setRecVezes}
                assinatura={assinatura}
                setAssinatura={setAssinatura}
                semParcelar
                semAssinatura
              />
            </>
          )}

          {erro && <span className="type-caption" style={{ color: 'var(--value-saida)' }}>{erro}</span>}
        </div>

        {/* ── Footer fixo ── */}
        <div style={{ padding: '12px 20px calc(24px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border-subtle)' }}>
          <Botao onClick={salvar} disabled={!podeSalvar}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Botao>
        </div>
      </BottomSheet>

      {/* Sub-sheet de seleção */}
      {seletor && (
        <SeletorContaCartao
          aberto={!!seletor}
          contexto={seletor}
          contas={contas}
          cartoes={cartoes}
          onFechar={() => setSeletor(null)}
          onSelecionar={aoSelecionar}
        />
      )}
    </>
  );
}

/* ───────── Subcomponentes internos ───────── */

function Toggle({ modo, onMudar }: { modo: Modo; onMudar: (m: Modo) => void }) {
  const opcoes: { id: Modo; rotulo: string }[] = [
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

function CampoDescricao({
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

function CampoData({ valor, onMudar }: { valor: string; onMudar: (s: string) => void }) {
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

function CampoSeletor({
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

function CampoNota({ valor, onMudar }: { valor: string; onMudar: (s: string) => void }) {
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

function ComoSeRepete(props: {
  repete: Repete;
  onMudar: (r: Repete) => void;
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

  const chips: { id: Repete; rotulo: string }[] = [
    { id: 'avista', rotulo: 'À vista' },
    ...(semParcelar ? [] : [{ id: 'parcelar' as Repete, rotulo: 'Parcelar' }]),
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

function SubCaixa({ children }: { children: React.ReactNode }) {
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

function Stepper({ valor, min, onMudar }: { valor: number; min: number; onMudar: (n: number) => void }) {
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

function MiniChip({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
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

function Switch({ ligado, onMudar }: { ligado: boolean; onMudar: (b: boolean) => void }) {
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

function hojeISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}
