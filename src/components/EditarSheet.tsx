import { useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheet } from './BottomSheet';
import { Botao } from './Botao';
import { ModalDeAlerta } from './ModalDeAlerta';
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
  ComoSeRepete,
  type RepeteLancamento,
} from './_camposLancamento';
import { IconeClose } from '../icons';
import { formatarBR } from '../lib/formato';
import { parteData, mesDe } from '../lib/recorrencia';
import { supabase, comTimeout } from '../lib/supabase';
import type { Conta, Cartao, Lancamento } from '../types/db';
import type { OcorrenciaLancamento } from '../lib/recorrencia';
import { planejarDivisao } from '../lib/recorrencia';

/**
 * EditarSheet — editar/excluir um lançamento (§5.7, v0.8).
 *
 * FLUXO (série recorrente): o **escopo é o primeiro passo** (§5.7 v0.8) — um
 * Modal de alerta (variante escopo) abre ANTES do corpo do editor. O escopo
 * escolhido define quais campos/mudanças o editor oferece:
 *   - "só esta"          → leque completo (grandeza + natureza + cardinalidade).
 *   - "esta e as futuras" / "todas" → só o que a série comporta (grandeza +
 *                          natureza-de-regra); SEM parcelar.
 * Avulso e PARCELA abrem direto (sem escopo). Parcela é read-only + só Excluir.
 *
 * RÉGUA DE 3 NÍVEIS no "só esta" (§4.3):
 *   - Grandeza  (valor/descrição/nota) → override em `excecoes_serie` (fica na série).
 *   - Natureza  (data/conta/cartão)    → DESVINCULA: vira avulso (`serie_id: null`)
 *                                        com o meio de pagamento escolhido.
 *   - Cardinalidade (à vista→parcelar) → DESVINCULA + RELANÇA: exclui a ocorrência
 *                                        e cria uma regra `parcelar` nova.
 * "esta e as futuras"/"todas" editam a REGRA; exceções (overrides) preservadas.
 */

type Props = {
  aberto: boolean;
  ocorrencia: OcorrenciaLancamento | null;
  regra: Lancamento | null;
  contas: Conta[];
  cartoes: Cartao[];
  historicoDescricoes: string[];
  onFechar: () => void;
  onSalvou: () => void;
};

/** Escopo de uma alteração de série (§4.3): só esta · esta e as futuras · todas. */
export type EscopoSerie = 'so_esta' | 'esta_e_futuras' | 'todas';

function textoParaReais(texto: string): number {
  const limpo = texto.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? n : 0;
}

const OPCOES_ESCOPO: { id: EscopoSerie; titulo: string; descricao: string }[] = [
  { id: 'so_esta', titulo: 'Só esta', descricao: 'Muda apenas este mês, sem afetar os outros' },
  { id: 'esta_e_futuras', titulo: 'Esta e as futuras', descricao: 'Muda deste mês em diante; os anteriores ficam como estão' },
  { id: 'todas', titulo: 'Todas', descricao: 'Muda todos os meses, inclusive os já passados' },
];

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
  const ehSerieRecorrente = !!ocorrencia?.serieId && regra?.repeticao === 'recorrente';
  const ehParcela = !!ocorrencia?.serieId && regra?.repeticao === 'parcelar';

  // Campos.
  const [valorTexto, setValorTexto] = useState('');
  const [descricao, setDescricao] = useState('');
  const [data, setData] = useState('');
  const [nota, setNota] = useState('');
  const [contaSel, setContaSel] = useState<Conta | null>(null);
  const [cartaoSel, setCartaoSel] = useState<Cartao | null>(null);

  // Cardinalidade (à vista ↔ parcelar) — só habilitada no escopo "só esta".
  const [repete, setRepete] = useState<RepeteLancamento>('avista');
  const [parcelas, setParcelas] = useState(2);

  // Fase de escopo (§5.7 v0.8): null enquanto a série recorrente ainda não
  // escolheu; o corpo só monta depois de escolher. Avulso/parcela nunca entram
  // nessa fase (o corpo monta direto).
  const [escopo, setEscopo] = useState<EscopoSerie | null>(null);

  const [seletor, setSeletor] = useState<ContextoSeletor | null>(null);
  const [confirmarExcluirTodas, setConfirmarExcluirTodas] = useState(false);
  // Excluir uma PARCELA também é uma operação de série (§4.3): abre o escopo
  // (só esta · esta e futuras · todas). A edição da parcela segue travada; só a
  // exclusão tem escopo. `true` enquanto escolhe o escopo da exclusão.
  const [escopoExcluirParcela, setEscopoExcluirParcela] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const valorInputRef = useRef<HTMLInputElement>(null);

  // Sincroniza ao abrir numa nova ocorrência.
  useEffect(() => {
    if (!aberto || !ocorrencia || !regra) return;
    setValorTexto(formatarBR(ocorrencia.valor));
    setDescricao(ocorrencia.descricao);
    setData(ocorrencia.data);
    setNota(regra.nota ?? '');
    setContaSel(ocorrencia.cartao_id ? null : contas.find((c) => c.id === ocorrencia.conta_id) ?? null);
    setCartaoSel(ocorrencia.cartao_id ? cartoes.find((k) => k.id === ocorrencia.cartao_id) ?? null : null);
    setRepete('avista');
    setParcelas(2);
    setEscopo(null);
    setConfirmarExcluirTodas(false);
    setEscopoExcluirParcela(false);
    setErro(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto, ocorrencia?.id]);

  const valor = textoParaReais(valorTexto);

  const sugestoes = useMemo(() => {
    const q = descricao.trim().toLowerCase();
    if (!q) return [];
    return historicoDescricoes.filter((d) => { const dl = d.toLowerCase(); return dl.includes(q) && dl !== q; }).slice(0, 4);
  }, [descricao, historicoDescricoes]);

  // "só esta" abre o leque de cardinalidade (parcelar). Nos demais escopos e em
  // avulso, parcelar não faz sentido/aparece.
  const permiteParcelar = escopo === 'so_esta';
  const parcelarValido = !permiteParcelar || repete !== 'parcelar' || parcelas >= 2;
  const podeSalvar = valor > 0 && descricao.trim().length > 0 && parcelarValido && !salvando;

  function fechar() {
    setConfirmarExcluirTodas(false);
    onFechar();
  }

  // ── Persistência ──

  /** Edição direta da própria linha (avulso). */
  async function editarAvulso() {
    if (!regra) return;
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
  }

  /** Marca a ocorrência do mês como excluída (exceção). */
  async function excluirOcorrencia() {
    if (!ocorrencia) return;
    const { error } = await comTimeout(supabase
      .from('excecoes_serie')
      .upsert(
        { serie_id: ocorrencia.serieId, mes_alvo: mesDe(ocorrencia.data), excluida: true, valor: null, descricao: null, nota: null },
        { onConflict: 'serie_id,mes_alvo' },
      ));
    if (error) throw error;
  }

  /** "Só esta" no salvar — aplica a régua de 3 níveis (§4.3). */
  async function salvarSoEsta() {
    if (!ocorrencia || !regra) return;

    const contaOriginal = ocorrencia.cartao_id ? null : ocorrencia.conta_id;
    const cartaoOriginal = ocorrencia.cartao_id;
    const naturezaMudou =
      data !== ocorrencia.data ||
      (contaSel?.id ?? null) !== contaOriginal ||
      (cartaoSel?.id ?? null) !== cartaoOriginal;

    // CARDINALIDADE — virou parcelamento: desvincula + relança como regra
    // `parcelar` nova (§4.3). Parcelar é intrinsecamente "só esta".
    if (repete === 'parcelar') {
      await excluirOcorrencia();
      const novo = await comTimeout(supabase.from('lancamentos').insert({
        tipo: regra.tipo,
        valor, // total; cada parcela vale valor/parcelas (§3.3)
        descricao: descricao.trim(),
        nota: nota.trim() || null,
        data,
        conta_id: cartaoSel ? contaPagadora(regra) : contaSel?.id ?? regra.conta_id,
        cartao_id: cartaoSel?.id ?? null,
        repeticao: 'parcelar',
        parcelas,
        recorrencia_fim: null,
        assinatura: false,
        serie_id: crypto.randomUUID(),
      }));
      if (novo.error) throw novo.error;
      return;
    }

    // NATUREZA — data/conta/cartão mudou: desvincula, vira avulso com o meio
    // de pagamento ESCOLHIDO (§4.3, handoff item 3).
    if (naturezaMudou) {
      await excluirOcorrencia();
      const novo = await comTimeout(supabase.from('lancamentos').insert({
        tipo: regra.tipo,
        valor,
        descricao: descricao.trim(),
        nota: nota.trim() || null,
        data,
        conta_id: cartaoSel ? contaPagadora(regra) : contaSel?.id ?? regra.conta_id,
        cartao_id: cartaoSel?.id ?? null,
        repeticao: 'avista',
        parcelas: null,
        recorrencia_fim: null,
        assinatura: false,
        serie_id: null,
      }));
      if (novo.error) throw novo.error;
      return;
    }

    // GRANDEZA — só valor/descrição/nota: override in-place (fica na série).
    const { error } = await comTimeout(supabase
      .from('excecoes_serie')
      .upsert(
        { serie_id: ocorrencia.serieId, mes_alvo: mesDe(ocorrencia.data), excluida: false, valor, descricao: descricao.trim(), nota: nota.trim() || null },
        { onConflict: 'serie_id,mes_alvo' },
      ));
    if (error) throw error;
  }

  /** Edita a regra inteira ("todas" ou "futuras" na 1ª ocorrência). Inclui o
   *  dia-âncora (§4.1). Conta/cartão editam a regra (natureza-de-regra). */
  async function editarRegraInteira() {
    if (!regra) return;
    const [anoRegra, mesRegra] = parteData(regra.data);
    const diaNovo = parteData(data)[2];
    const dataRegra = `${String(anoRegra).padStart(4, '0')}-${String(mesRegra).padStart(2, '0')}-${String(diaNovo).padStart(2, '0')}`;
    const { error } = await comTimeout(supabase
      .from('lancamentos')
      .update({
        valor,
        descricao: descricao.trim(),
        nota: nota.trim() || null,
        data: dataRegra,
        conta_id: cartaoSel ? contaPagadora(regra) : contaSel?.id ?? regra.conta_id,
        cartao_id: cartaoSel?.id ?? null,
      })
      .eq('id', regra.id));
    if (error) throw error;
  }

  /** "Esta e as futuras" no salvar: divide a série mantendo o serie_id (§4.3). */
  async function executarDivisao(acao: 'salvar' | 'excluir') {
    if (!ocorrencia || !regra) return;
    const corteIndice = ocorrencia.indice - 1; // indice 1-based
    const plano = planejarDivisao(
      regra,
      ocorrencia.data,
      corteIndice,
      acao,
      acao === 'salvar' ? { valor, descricao: descricao.trim(), nota: nota.trim() || null } : undefined,
    );

    const upd =
      plano.encerrar.campo === 'parcelas'
        ? { parcelas: plano.encerrar.manter }
        : { recorrencia_fim: plano.encerrar.manter };
    const e1 = await comTimeout(supabase.from('lancamentos').update(upd).eq('id', regra.id));
    if (e1.error) throw e1.error;

    const e2 = await comTimeout(supabase
      .from('excecoes_serie')
      .delete()
      .eq('serie_id', ocorrencia.serieId)
      .gte('mes_alvo', plano.removerExcecoesAPartirDe));
    if (e2.error) throw e2.error;

    if (plano.novaRegra) {
      const [anoCorte, mesCorte] = parteData(plano.novaRegra.data);
      const diaNovo = parteData(data)[2];
      const dataNovaFase = `${String(anoCorte).padStart(4, '0')}-${String(mesCorte).padStart(2, '0')}-${String(diaNovo).padStart(2, '0')}`;
      const e3 = await comTimeout(supabase.from('lancamentos').insert({
        tipo: regra.tipo,
        valor: plano.novaRegra.valor,
        descricao: plano.novaRegra.descricao,
        nota: plano.novaRegra.nota,
        data: dataNovaFase,
        conta_id: cartaoSel ? contaPagadora(regra) : contaSel?.id ?? regra.conta_id,
        cartao_id: cartaoSel?.id ?? null,
        repeticao: 'recorrente',
        parcelas: null,
        recorrencia_fim: plano.novaRegra.recorrencia_fim,
        assinatura: regra.assinatura,
        serie_id: ocorrencia.serieId,
      }));
      if (e3.error) throw e3.error;
    }
  }

  async function aplicarEdicao() {
    if (!ocorrencia || !regra) return;
    setSalvando(true);
    setErro(null);
    try {
      if (!ehSerieRecorrente) {
        await editarAvulso();
      } else if (escopo === 'so_esta') {
        await salvarSoEsta();
      } else if (escopo === 'esta_e_futuras') {
        // 1ª ocorrência não tem passado a preservar → edita a regra inteira
        // (encerrar a fase antiga em 0 violaria recorrencia_fim >= 1).
        if (ocorrencia.indice - 1 === 0) await editarRegraInteira();
        else await executarDivisao('salvar');
      } else if (escopo === 'todas') {
        await editarRegraInteira();
      }
      finalizar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
      setSalvando(false);
    }
  }

  async function aplicarExclusao(escopoExc: EscopoSerie | null) {
    if (!ocorrencia || !regra) return;
    setSalvando(true);
    setErro(null);
    try {
      if (escopoExc === null) {
        // Avulso OU parcela: apaga a regra inteira.
        const { error } = await comTimeout(supabase.from('lancamentos').delete().eq('id', regra.id));
        if (error) throw error;
      } else if (escopoExc === 'so_esta') {
        await excluirOcorrencia();
      } else if (escopoExc === 'esta_e_futuras') {
        await executarDivisao('excluir');
      } else if (escopoExc === 'todas') {
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

  function finalizar() {
    setSalvando(false);
    setConfirmarExcluirTodas(false);
    onSalvou();
    onFechar();
  }

  // ── Disparos ──

  function aoSalvar() {
    aplicarEdicao();
  }
  function aoExcluir() {
    // Série recorrente: o escopo já foi escolhido no início; "todas" pede
    // confirmação destrutiva.
    if (ehSerieRecorrente) {
      if (escopo === 'todas') { setConfirmarExcluirTodas(true); return; }
      aplicarExclusao(escopo);
    } else if (ehParcela) {
      // Parcela: edição travada, mas excluir mantém o fluxo de escopo (§4.3).
      setEscopoExcluirParcela(true);
    } else {
      aplicarExclusao(null);
    }
  }

  /** Escopo escolhido para EXCLUIR uma parcela. "Todas" → confirmação destrutiva. */
  function aoEscolherEscopoExclusaoParcela(id: EscopoSerie) {
    setEscopoExcluirParcela(false);
    if (id === 'todas') { setConfirmarExcluirTodas(true); return; }
    aplicarExclusao(id);
  }

  function aoEscolherEscopo(id: EscopoSerie) {
    setEscopo(id);
  }

  function aoSelecionar(sel: Selecao) {
    if (sel.kind === 'conta') { setContaSel(sel.conta); setCartaoSel(null); }
    else { setCartaoSel(sel.cartao); setContaSel(null); }
    setSeletor(null);
  }

  if (!ocorrencia || !regra) return null;

  // Fase de escopo: série recorrente sem escopo escolhido → só o Modal.
  const mostrarEscopo = ehSerieRecorrente && escopo === null;

  return (
    <>
      <BottomSheet aberto={aberto && !mostrarEscopo} onFechar={fechar} aria-label="Editar lançamento">
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

        {/* VALOR */}
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
              disabled={ehParcela}
              size={Math.max(valorTexto.length, 4)}
              style={{
                border: 'none',
                background: 'transparent',
                color: 'var(--text-primary)',
                textAlign: 'left',
                width: 'auto',
                flex: '0 0 auto',
                outline: 'none',
                padding: 0,
                caretColor: 'var(--accent-default)',
              }}
            />
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 18, padding: '4px 20px 20px' }}>
          {ehParcela && (
            <span className="type-caption" style={{ color: 'var(--text-muted)' }}>
              Parcela{ocorrencia.total ? ` ${ocorrencia.indice}/${ocorrencia.total}` : ''} — editar parcelas ainda não é possível. Você pode excluir.
            </span>
          )}
          {ehSerieRecorrente && escopo && (
            <span className="type-caption" style={{ color: 'var(--text-muted)' }}>
              {escopo === 'so_esta' && 'Alterando só este mês.'}
              {escopo === 'esta_e_futuras' && 'Alterando deste mês em diante.'}
              {escopo === 'todas' && 'Alterando todos os meses da série.'}
            </span>
          )}

          {ehParcela ? (
            <ResumoParcela ocorrencia={ocorrencia} contaNome={contaSel?.nome ?? null} cartaoNome={cartaoSel?.nome ?? null} data={data} />
          ) : (
            <>
              <CampoDescricao
                key={ocorrencia?.origemId ?? 'novo'}
                valor={descricao}
                onMudar={setDescricao}
                sugestoes={sugestoes}
                onEscolherSugestao={(s) => setDescricao(s)}
                iniciaTravada={historicoDescricoes.some(
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

              {/* Cardinalidade — só no "só esta". Vira desvincular + relançar. */}
              {permiteParcelar && (
                <ComoSeRepete
                  repete={repete}
                  onMudar={setRepete}
                  valor={valor}
                  parcelas={parcelas}
                  setParcelas={setParcelas}
                  recIndefinida={false}
                  setRecIndefinida={() => {}}
                  recVezes={2}
                  setRecVezes={() => {}}
                  assinatura={false}
                  setAssinatura={() => {}}
                  semAssinatura
                />
              )}
              {repete === 'parcelar' && (
                <span className="type-caption" style={{ color: 'var(--text-muted)' }}>
                  Ao salvar, este mês sai da série recorrente e vira uma compra parcelada.
                </span>
              )}
            </>
          )}

          {erro && <span className="type-caption" style={{ color: 'var(--value-saida)' }}>{erro}</span>}

          {/* Excluir (§5.7) — evita toque acidental na lista. */}
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

        {/* Footer — parcela não salva (só exclui). */}
        {!ehParcela && (
          <div style={{ padding: '12px 20px calc(24px + env(safe-area-inset-bottom))', borderTop: '1px solid var(--border-subtle)' }}>
            <Botao onClick={aoSalvar} disabled={!podeSalvar}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </Botao>
          </div>
        )}
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

      {/* Escopo — PRIMEIRO passo (§5.7 v0.8), Modal (não bottom sheet). */}
      {mostrarEscopo && (
        <ModalDeAlerta<EscopoSerie>
          tipo="escopo"
          titulo="Lançamento recorrente"
          corpo="Esse lançamento se repete todo mês. O que você quer alterar?"
          opcoes={OPCOES_ESCOPO}
          onConfirmarOpcao={aoEscolherEscopo}
          secundaria={{ rotulo: 'Cancelar', onClick: fechar }}
          onScrim={fechar}
        />
      )}

      {/* Escopo de EXCLUSÃO de parcela — Modal (edição travada; excluir tem escopo). */}
      {escopoExcluirParcela && (
        <ModalDeAlerta<EscopoSerie>
          tipo="escopo"
          titulo="Lançamento parcelado"
          corpo="Essa compra foi parcelada. Quais parcelas você quer excluir?"
          opcoes={OPCOES_ESCOPO}
          onConfirmarOpcao={aoEscolherEscopoExclusaoParcela}
          secundaria={{ rotulo: 'Cancelar', onClick: () => setEscopoExcluirParcela(false) }}
          onScrim={() => setEscopoExcluirParcela(false)}
        />
      )}

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
    </>
  );
}

/** Conta pagadora da regra (fallback para o conta_id da própria regra). */
function contaPagadora(regra: Lancamento): string {
  return regra.conta_id;
}

/** Resumo read-only de uma parcela (edição travada — só Excluir). */
function ResumoParcela({
  ocorrencia, contaNome, cartaoNome, data,
}: {
  ocorrencia: OcorrenciaLancamento;
  contaNome: string | null;
  cartaoNome: string | null;
  data: string;
}) {
  const [a, m, d] = parteData(data);
  const dataFmt = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
  const meio = cartaoNome ?? contaNome ?? '—';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <LinhaResumo rotulo="Descrição" valor={ocorrencia.descricao} />
      <LinhaResumo rotulo="Data" valor={dataFmt} />
      <LinhaResumo rotulo="Meio" valor={meio} />
    </div>
  );
}

function LinhaResumo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span className="type-body" style={{ color: 'var(--text-muted)' }}>{rotulo}</span>
      <span className="type-body-strong" style={{ color: 'var(--text-primary)', textAlign: 'right' }}>{valor}</span>
    </div>
  );
}
