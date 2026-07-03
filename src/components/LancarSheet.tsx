import { useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { Botao } from './Botao';
import {
  SeletorContaCartao,
  type ContextoSeletor,
  type Selecao,
} from './SeletorContaCartao';
import {
  Toggle,
  CampoDescricao,
  CampoData,
  CampoSeletor,
  CampoNota,
  ComoSeRepete,
  hojeISO,
  type ModoLancamento,
  type RepeteLancamento,
} from './_camposLancamento';
import { IconeClose } from '../icons';
import { formatarBR } from '../lib/formato';
import { supabase, comTimeout } from '../lib/supabase';
import type { Conta, Cartao, LancamentoTipo } from '../types/db';

/**
 * LancarSheet — o fluxo sagrado (§5.2, Figma section "Lançar").
 * Grava UMA linha-regra (à vista, parcelar ou recorrente) em `lancamentos`,
 * ou uma linha em `transferencias`. A materialização das ocorrências de série
 * é read-time (motor §4.1) — fora deste componente.
 *
 * Os campos do formulário moram em `_camposLancamento` e são compartilhados
 * com o EditarSheet (§5.7) — a edição é um clone real, sem markup duplicado.
 */

type Modo = ModoLancamento;
type Repete = RepeteLancamento;

type Props = {
  aberto: boolean;
  contas: Conta[];
  cartoes: Cartao[];
  /** Descrições já usadas, para o autocomplete (§4.6). */
  historicoDescricoes: string[];
  onFechar: () => void;
  /** Chamado após gravar com sucesso — a Home recarrega os dados. */
  onSalvou: () => void;
  /**
   * Modo transferência FIXO (§5.4): usado por Depositar/Retirar da poupança.
   * Trava o sheet em transferência (sem toggle Saída/Entrada), fixa a poupança
   * num dos lados e ajusta o título. Ausente = sheet normal (fluxo sagrado).
   */
  transferenciaFixa?: {
    /** A poupança fixada. */
    poupanca: Conta;
    /** 'deposito' fixa a poupança no DESTINO; 'retirada' na ORIGEM. */
    direcao: 'deposito' | 'retirada';
    titulo: string;
  };
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
  transferenciaFixa,
}: Props) {
  // ── Estado do formulário ──
  const [modo, setModo] = useState<Modo>(transferenciaFixa ? 'transferencia' : 'saida');
  const [digitos, setDigitos] = useState(''); // valor em centavos, só dígitos
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState(() => hojeISO());
  const [repete, setRepete] = useState<Repete>('avista');
  const [parcelas, setParcelas] = useState(2);
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
    // historicoDescricoes já vem ordenado por frequência+recência (§4.6);
    // aqui só filtramos por "contém" e mantemos essa ordem.
    return historicoDescricoes
      .filter((d) => { const dl = d.toLowerCase(); return dl.includes(q) && dl !== q; })
      .slice(0, 4);
  }, [descricao, historicoDescricoes]);

  function resetar() {
    setModo(transferenciaFixa ? 'transferencia' : 'saida');
    setDigitos('');
    setDescricao('');
    setData(hojeISO());
    setRepete('avista');
    setParcelas(2);
    setRecIndefinida(true);
    setRecVezes(12);
    setAssinatura(false);
    setNota('');
    setContaSel(null);
    setCartaoSel(null);
    // Em transferência fixa, fixa o lado da poupança; o outro lado o usuário escolhe.
    if (transferenciaFixa) {
      const { poupanca, direcao } = transferenciaFixa;
      setOrigemSel(direcao === 'retirada' ? poupanca : null);
      setDestinoSel(direcao === 'deposito' ? poupanca : null);
    } else {
      setOrigemSel(null);
      setDestinoSel(null);
    }
    setErro(null);
  }

  // Ao abrir, aplica o estado inicial (importante no modo fixo, que precisa
  // fixar o lado da poupança sempre que o sheet reabre).
  useEffect(() => {
    if (aberto) resetar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

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
          serie_id: repete === 'recorrente' ? crypto.randomUUID() : null,
        };
        const { error } = await comTimeout(supabase.from('transferencias').insert(payload));
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
          // Séries (parcelar/recorrente) recebem serie_id para agrupar ocorrências
          // e ancorar exceções (§4.1, §4.3); à vista não é série.
          serie_id: repete === 'avista' ? null : crypto.randomUUID(),
        };
        const { error } = await comTimeout(supabase.from('lancamentos').insert(payload));
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
      <BottomSheet aberto={aberto} onFechar={fechar} aria-label={transferenciaFixa ? transferenciaFixa.titulo : 'Novo lançamento'}>
        {/* ── Header: spacer · título centralizado · ✕ (Figma 3 colunas) ── */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 16px 8px 20px' }}>
          <span style={{ width: 22, flex: '0 0 auto' }} aria-hidden />
          <span className="type-title" style={{ color: 'var(--text-primary)', flex: 1, textAlign: 'center' }}>
            {transferenciaFixa ? transferenciaFixa.titulo : 'Novo lançamento'}
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

        {/* ── VALOR: o input É o display (toque direto abre o teclado no iOS) ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '16px 0 24px' }}>
          <span className="type-label" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Valor</span>
          <input
            ref={valorInputRef}
            value={`R$ ${formatarBR(valor)}`}
            onChange={(e) => setDigitos(e.target.value.replace(/\D/g, '').slice(0, 12))}
            inputMode="numeric"
            autoFocus
            aria-label="Valor em reais"
            className="type-display"
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-primary)',
              textAlign: 'center',
              width: '100%',
              outline: 'none',
              padding: 0,
              // mantém o caret no fim mesmo com o texto formatado
              caretColor: 'var(--accent-default)',
            }}
            onFocus={(e) => {
              // posiciona o cursor no fim ao focar
              const v = e.target.value;
              e.target.setSelectionRange(v.length, v.length);
            }}
          />
        </div>

        {/* ── Body rolável ── */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 20px 20px' }}>
          {/* Toggle ternário */}
          {!transferenciaFixa && (
            <Toggle modo={modo} onMudar={(m) => { setModo(m); if (m === 'transferencia') setRepete(repete === 'parcelar' ? 'avista' : repete); }} />
          )}

          {/* Descrição (gasto/receita e, opcional, transferência) */}
          <CampoDescricao
            key={aberto ? 'aberto' : 'fechado'}
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
                banco={cartaoSel ? cartaoSel.banco : contaEfetiva?.icone}
                tema={cartaoSel ? cartaoSel.tema : contaEfetiva?.tema}
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
                banco={origemSel?.icone}
                tema={origemSel?.tema}
                onAbrir={() => setSeletor('transf-saida')}
              />
              <CampoSeletor
                label="Conta Destino"
                valor={destinoSel?.nome ?? 'Selecionar'}
                banco={destinoSel?.icone}
                tema={destinoSel?.tema}
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

