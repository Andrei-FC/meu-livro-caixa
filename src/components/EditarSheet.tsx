import { useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { Botao } from './Botao';
import { ModalDeAlerta } from './ModalDeAlerta';
import { EscopoSheet, type EscopoSerie } from './EscopoSheet';
import {
  SeletorContaCartao,
  type ContextoSeletor,
  type Selecao,
} from './SeletorContaCartao';
import {
  CampoDescricao,
  CampoData,
  CampoSeletor,
  CampoNota,
} from './_camposLancamento';
import { IconeClose } from '../icons';
import { formatarBR } from '../lib/formato';
import { supabase, comTimeout } from '../lib/supabase';
import type { Conta, Cartao, Lancamento } from '../types/db';
import type { OcorrenciaLancamento } from '../lib/recorrencia';
import { planejarDivisao, suportaFuturas } from '../lib/recorrencia';

/**
 * EditarSheet — editar/excluir um lançamento (§5.7). Clone do LancarSheet
 * (reusa os mesmos campos de `_camposLancamento`), com Excluir e escopo de
 * série (§4.3).
 *
 * FASE 1: à vista (edição/exclusão direta) + escopos "só esta" e "todas" para
 * séries. "Esta e as futuras" (divisão de série) chega na Fase 2 — por ora
 * aparece desabilitada com aviso.
 *
 * - "só esta"  → grava override/exclusão em `excecoes_serie` (a ocorrência).
 * - "todas"    → edita/exclui a própria regra em `lancamentos`; exceções
 *                gravadas permanecem (§4.3). Excluir "todas" passa por uma
 *                confirmação de bloqueio (apaga passado consolidado).
 */

type Props = {
  aberto: boolean;
  /** Ocorrência tocada na lista (traz data resolvida, índice, série). */
  ocorrencia: OcorrenciaLancamento | null;
  /** Regra de origem em `lancamentos` (campos que a ocorrência não carrega). */
  regra: Lancamento | null;
  contas: Conta[];
  cartoes: Cartao[];
  historicoDescricoes: string[];
  onFechar: () => void;
  onSalvou: () => void;
};

/**
 * Parse de texto livre BR → número em reais. Aceita "1.234,56", "1234,5",
 * "150", ",5". Ignora tudo que não for dígito, vírgula ou ponto; trata ponto
 * como separador de milhar (removido) e vírgula como decimal. Vazio → 0.
 */
function textoParaReais(texto: string): number {
  const limpo = texto.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

export function EditarSheet({
  aberto,
  ocorrencia,
  regra,
  contas,
  cartoes,
  historicoDescricoes,
  onFechar,
  onSalvou,
}: Props) {
  const ehSerie = !!ocorrencia?.serieId && regra?.repeticao !== 'avista';

  // Campos pré-preenchidos a partir da ocorrência (+ nota da regra).
  const [valorTexto, setValorTexto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState('');
  const [nota, setNota] = useState('');
  const [contaSel, setContaSel] = useState<Conta | null>(null);
  const [cartaoSel, setCartaoSel] = useState<Cartao | null>(null);

  const [seletor, setSeletor] = useState<ContextoSeletor | null>(null);
  const [escopoPara, setEscopoPara] = useState<'salvar' | 'excluir' | null>(null);
  const [confirmarExcluirTodas, setConfirmarExcluirTodas] = useState(false);
  // Bloqueio (§4.3/P0.2): trocar a conta/cartão de UMA ocorrência de série não é
  // modelável — `excecoes_serie` não guarda conta/cartão, e mudar no meio da
  // série violaria o passado. Em vez de lógica de exceção frágil, bloqueamos com
  // aviso (decisão travada).
  const [bloqueioConta, setBloqueioConta] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const valorInputRef = useRef<HTMLInputElement>(null);

  // Sincroniza os campos quando abre numa nova ocorrência.
  useEffect(() => {
    if (!aberto || !ocorrencia || !regra) return;
    setValorTexto(formatarBR(ocorrencia.valor));
    setDescricao(ocorrencia.descricao);
    setData(ocorrencia.data);
    setNota(regra.nota ?? '');
    setContaSel(ocorrencia.cartao_id ? null : contas.find((c) => c.id === ocorrencia.conta_id) ?? null);
    setCartaoSel(ocorrencia.cartao_id ? cartoes.find((k) => k.id === ocorrencia.cartao_id) ?? null : null);
    setErro(null);
    // Sem foco automático aqui (decisão de UX): na edição o usuário toca no
    // campo que quer mexer; o caret cai onde ele tocou. Abrir o teclado sozinho
    // atrapalharia quem só quer conferir/editar outro campo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, ocorrencia?.id]);

  const valor = textoParaReais(valorTexto);

  const sugestoes = useMemo(() => {
    const q = descricao.trim().toLowerCase();
    if (!q) return [];
    return historicoDescricoes.filter((d) => { const dl = d.toLowerCase(); return dl.includes(q) && dl !== q; }).slice(0, 4);
  }, [descricao, historicoDescricoes]);

  const podeSalvar = valor > 0 && descricao.trim().length > 0 && !salvando;

  function fechar() {
    setEscopoPara(null);
    setConfirmarExcluirTodas(false);
    setBloqueioConta(false);
    onFechar();
  }

  // ── Persistência ──

  /** Aplica a edição conforme o escopo. À vista nunca chega aqui com escopo. */
  async function aplicarEdicao(escopo: EscopoSerie | null) {
    if (!ocorrencia || !regra) return;
    setSalvando(true);
    setErro(null);
    try {
      if (!ehSerie || escopo === null) {
        // À vista: edição direta da própria linha.
        const { error } = await comTimeout(supabase
          .from('lancamentos')
          .update({
            valor,
            descricao: descricao.trim(),
            nota: nota.trim() || null,
            data,
            conta_id: cartaoSel ? regra.conta_id : contaSel?.id ?? regra.conta_id,
            cartao_id: cartaoSel?.id ?? null,
          })
          .eq('id', regra.id));
        if (error) throw error;
      } else if (escopo === 'so_esta') {
        // Override desta ocorrência (a regra continua intacta).
        const { error } = await comTimeout(supabase
          .from('excecoes_serie')
          .upsert(
            {
              serie_id: ocorrencia.serieId,
              data_alvo: ocorrencia.data,
              excluida: false,
              valor,
              descricao: descricao.trim(),
              nota: nota.trim() || null,
            },
            { onConflict: 'serie_id,data_alvo' },
          ));
        if (error) throw error;
      } else if (escopo === 'esta_e_futuras') {
        await executarDivisao('salvar');
      } else if (escopo === 'todas') {
        // Edita a regra inteira; exceções já gravadas permanecem (§4.3).
        const { error } = await comTimeout(supabase
          .from('lancamentos')
          .update({
            valor,
            descricao: descricao.trim(),
            nota: nota.trim() || null,
          })
          .eq('id', regra.id));
        if (error) throw error;
      }
      finalizar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
      setSalvando(false);
    }
  }

  async function aplicarExclusao(escopo: EscopoSerie | null) {
    if (!ocorrencia || !regra) return;
    setSalvando(true);
    setErro(null);
    try {
      if (!ehSerie || escopo === null) {
        const { error } = await comTimeout(supabase.from('lancamentos').delete().eq('id', regra.id));
        if (error) throw error;
      } else if (escopo === 'so_esta') {
        const { error } = await comTimeout(supabase
          .from('excecoes_serie')
          .upsert(
            { serie_id: ocorrencia.serieId, data_alvo: ocorrencia.data, excluida: true },
            { onConflict: 'serie_id,data_alvo' },
          ));
        if (error) throw error;
      } else if (escopo === 'esta_e_futuras') {
        await executarDivisao('excluir');
      } else if (escopo === 'todas') {
        // Apaga a regra e suas exceções (após a confirmação de bloqueio).
        const e1 = await comTimeout(supabase.from('excecoes_serie').delete().eq('serie_id', ocorrencia.serieId));
        if (e1.error) throw e1.error;
        const e2 = await comTimeout(supabase.from('lancamentos').delete().eq('id', regra.id));
        if (e2.error) throw e2.error;
      }
      finalizar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir.');
      setSalvando(false);
    }
  }

  /** Executa "esta e as futuras": encerra a regra antiga, cria a nova fase
   *  (no salvar) com o mesmo serie_id, e limpa exceções a partir do corte. */
  async function executarDivisao(acao: 'salvar' | 'excluir') {
    if (!ocorrencia || !regra) return;
    const corteIndice = ocorrencia.indice - 1; // indice é 1-based
    const plano = planejarDivisao(
      regra,
      ocorrencia.data,
      corteIndice,
      acao,
      acao === 'salvar' ? { valor, descricao: descricao.trim(), nota: nota.trim() || null } : undefined,
    );

    // 1. encerra a regra antiga no ponto de corte
    const upd =
      plano.encerrar.campo === 'parcelas'
        ? { parcelas: plano.encerrar.manter }
        : { recorrencia_fim: plano.encerrar.manter };
    const e1 = await comTimeout(supabase.from('lancamentos').update(upd).eq('id', regra.id));
    if (e1.error) throw e1.error;

    // 2. limpa exceções que agora pertenceriam à nova fase (data_alvo >= corte)
    const e2 = await comTimeout(supabase
      .from('excecoes_serie')
      .delete()
      .eq('serie_id', ocorrencia.serieId)
      .gte('data_alvo', plano.removerExcecoesAPartirDe));
    if (e2.error) throw e2.error;

    // 3. cria a nova regra (só no salvar), mesmo serie_id (mesma etiqueta)
    if (plano.novaRegra) {
      const e3 = await comTimeout(supabase.from('lancamentos').insert({
        tipo: regra.tipo,
        valor: plano.novaRegra.valor,
        descricao: plano.novaRegra.descricao,
        nota: plano.novaRegra.nota,
        data: plano.novaRegra.data,
        conta_id: regra.conta_id,
        cartao_id: regra.cartao_id,
        repeticao: 'recorrente',
        parcelas: null,
        recorrencia_fim: plano.novaRegra.recorrencia_fim,
        assinatura: regra.assinatura,
        serie_id: ocorrencia.serieId,
      }));
      if (e3.error) throw e3.error;
    }
  }

  function finalizar() {
    setSalvando(false);
    setEscopoPara(null);
    setConfirmarExcluirTodas(false);
    onSalvou();
    onFechar();
  }

  // ── Disparos (escopo só para série) ──

  /** Conta/cartão original da ocorrência (para detectar troca numa série). */
  const contaOriginal = ocorrencia?.cartao_id ? null : ocorrencia?.conta_id ?? null;
  const cartaoOriginal = ocorrencia?.cartao_id ?? null;
  const contaMudou =
    (contaSel?.id ?? null) !== contaOriginal || (cartaoSel?.id ?? null) !== cartaoOriginal;

  function aoSalvar() {
    // Série + troca de conta/cartão → bloqueia (P0.2). À vista pode trocar livre.
    if (ehSerie && contaMudou) {
      setBloqueioConta(true);
      return;
    }
    if (ehSerie) setEscopoPara('salvar');
    else aplicarEdicao(null);
  }
  function aoExcluir() {
    if (ehSerie) setEscopoPara('excluir');
    else aplicarExclusao(null);
  }
  function aoEscolherEscopo(escopo: EscopoSerie) {
    setEscopoPara(null);
    if (escopoPara === 'excluir' && escopo === 'todas') {
      setConfirmarExcluirTodas(true); // segundo passo (§4.3)
      return;
    }
    if (escopoPara === 'salvar') aplicarEdicao(escopo);
    else aplicarExclusao(escopo);
  }

  function aoSelecionar(sel: Selecao) {
    if (sel.kind === 'conta') { setContaSel(sel.conta); setCartaoSel(null); }
    else { setCartaoSel(sel.cartao); setContaSel(null); }
    setSeletor(null);
  }

  if (!ocorrencia || !regra) return null;

  return (
    <>
      <BottomSheet aberto={aberto} onFechar={fechar} aria-label="Editar lançamento">
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '4px 16px 8px 20px' }}>
          <span style={{ width: 22, flex: '0 0 auto' }} aria-hidden />
          <span className="type-title" style={{ color: 'var(--text-primary)', flex: 1, textAlign: 'center' }}>
            Editar lançamento
          </span>
          <button type="button" onClick={fechar} aria-label="Fechar" style={{ border: 'none', background: 'transparent', color: 'var(--text-muted)', display: 'inline-flex', padding: 0, flex: '0 0 auto' }}>
            <IconeClose />
          </button>
        </div>

        {/* VALOR — input de texto livre visível: o caret cai onde o usuário
            toca, e ele conserta o dígito no lugar sem perder o resto (§ UX). */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '12px 0 20px', width: '100%' }}>
          <span className="type-label" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Valor</span>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, maxWidth: '100%' }}>
            <span className="type-body-strong" style={{ color: 'var(--text-primary)', flex: '0 0 auto' }}>R$</span>
            <input
              ref={valorInputRef}
              value={valorTexto}
              onChange={(e) => setValorTexto(e.target.value.replace(/[^\d.,]/g, ''))}
              inputMode="decimal"
              placeholder="0,00"
              aria-label="Valor em reais"
              className="type-display"
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                textAlign: 'left',
                width: `${Math.max(valorTexto.length, 4) + 1}ch`,
                maxWidth: '100%',
                outline: 'none',
                padding: 0,
                caretColor: 'var(--accent-default)',
              }}
            />
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 20px 20px' }}>
          {ehSerie && (
            <span className="type-caption" style={{ color: 'var(--text-muted)' }}>
              Parte de uma série{ocorrencia.total ? ` · ${ocorrencia.indice}/${ocorrencia.total}` : ' recorrente'}.
            </span>
          )}

          <CampoDescricao
            key={ocorrencia?.origemId ?? 'novo'}
            valor={descricao}
            onMudar={setDescricao}
            sugestoes={sugestoes}
            onEscolherSugestao={(s) => setDescricao(s)}
            iniciaTravada={ocorrencia != null && historicoDescricoes.some(
              (d) => d.trim().toLowerCase() === ocorrencia.descricao.trim().toLowerCase(),
            )}
            obrigatorio
          />
          <CampoData valor={data} onMudar={setData} />
          <CampoSeletor
            label="Conta"
            valor={cartaoSel ? cartaoSel.nome : contaSel?.nome ?? 'Selecionar'}
            ehCartao={!!cartaoSel}
            banco={cartaoSel ? cartaoSel.banco : contaSel?.icone}
            tema={cartaoSel ? cartaoSel.tema : contaSel?.tema}
            onAbrir={() => setSeletor(ocorrencia.tipo === 'entrada' ? 'entrada' : 'saida')}
          />
          <CampoNota valor={nota} onMudar={setNota} />

          {erro && <span className="type-caption" style={{ color: 'var(--value-saida)' }}>{erro}</span>}

          {/* Excluir mora aqui dentro (§5.7) — evita toque acidental na lista. */}
          <button
            type="button"
            onClick={aoExcluir}
            disabled={salvando}
            className="type-body-strong"
            style={{ border: 'none', background: 'transparent', color: 'var(--value-saida)', padding: '8px 0', cursor: 'pointer', alignSelf: 'flex-start' }}
          >
            Excluir
          </button>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px calc(24px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border-subtle)' }}>
          <Botao onClick={aoSalvar} disabled={!podeSalvar}>
            {salvando ? 'Salvando…' : 'Salvar'}
          </Botao>
        </div>
      </BottomSheet>

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

      <EscopoSheet
        aberto={escopoPara !== null}
        acao={escopoPara ?? 'salvar'}
        rotuloSerie={regra?.repeticao === 'parcelar' ? 'Lançamento parcelado' : 'Lançamento recorrente'}
        desabilitadas={
          regra && escopoPara && !suportaFuturas(regra.repeticao, escopoPara)
            ? ['esta_e_futuras']
            : []
        }
        onFechar={() => setEscopoPara(null)}
        onConfirmar={aoEscolherEscopo}
      />

      {confirmarExcluirTodas && (
        <ModalDeAlerta
          tipo="bloqueio"
          titulo="Excluir a série inteira?"
          corpo="Isto apaga todas as ocorrências, inclusive as passadas já consolidadas. Não dá para desfazer."
          primaria={{ rotulo: 'Excluir tudo', onClick: () => aplicarExclusao('todas') }}
          secundaria={{ rotulo: 'Cancelar', onClick: () => setConfirmarExcluirTodas(false) }}
          onScrim={() => setConfirmarExcluirTodas(false)}
        />
      )}

      {bloqueioConta && (
        <ModalDeAlerta
          tipo="erro"
          titulo="Não dá para trocar a conta de uma série"
          corpo="Mudar a conta ou o cartão só de uma ocorrência não é possível. Para mover a série toda, exclua e lance de novo na conta certa."
          primaria={{ rotulo: 'Entendi', onClick: () => setBloqueioConta(false) }}
          onScrim={() => setBloqueioConta(false)}
        />
      )}
    </>
  );
}
