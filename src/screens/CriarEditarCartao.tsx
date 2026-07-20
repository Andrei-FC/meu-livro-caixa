import { useState } from 'react';
import { Header, Input, Botao, SeletorDeTema, CampoSeletor, SeletorDeIcone, SeletorContaCartao, ModalDeAlerta } from '../components';
import type { ChaveTema } from '../components/SeletorDeTema';
import { BANCOS, BANDEIRAS, LogoBanco, LogoBandeira, IconeImage, IconeChevronRight } from '../icons';
import { formatarBR } from '../lib/formato';
import { supabase } from '../lib/supabase';
import { indexarCiclos, regimeDoCiclo, pisoMudancaDeRegime, ancoraDeVencimento, migracaoAoMudarFechamento } from '../lib/recorrencia';
import type { Cartao, Conta, CartaoCiclo } from '../types/db';

/**
 * Criar/Editar Cartão — §5.8, §4.4, §4.9, §4.10, Figma 2046:451.
 * Página própria com Header chuld. Campos: nome; previsão mensal de gasto (com
 * hint "não é o limite do banco" — vocabulário travado em §4.4); fecha dia +
 * vence dia (lado a lado); tema (§4.9); bandeira/banco (placeholder). Footer
 * fixo: Salvar. Em edição, "Arquivar cartão" acima (§4.10).
 *
 * Grava em `cartoes`. `previsao_mensal` é o teto de previsão (§3.2/§4.4), nunca
 * o limite do banco.
 *
 * MUDANÇA DE DATAS (Fase 2b, adendo). Editar fechamento/vencimento NÃO
 * sobrescreve `cartoes.dia_*` (isso reescreveria o passado — princípio 3). Em
 * vez disso grava uma linha de vigência em `cartoes_ciclos`. Na EDIÇÃO, o
 * vencimento é um DATE PICKER de data concreta (a próxima data de vencimento no
 * mundo real) — essa data É a fonte da verdade da âncora (`ancoraDeVencimento`),
 * não uma derivação de hoje. O piso do picker é dinâmico pelo fechamento
 * (`pisoMudancaDeRegime`): não dá para ancorar num ciclo que já fechou. Mudar o
 * fechamento pode reclassificar lançamentos do ciclo-alvo (Mudança 3b) — se
 * algum migrar, um aviso explícito aparece antes de confirmar. Editar só o
 * "resto" (nome/previsão/tema/conta/banco/bandeira) faz UPDATE normal em
 * `cartoes` e não cria regime.
 *
 * CRIAÇÃO: inalterada (Fase 1) — vencimento é só o DIA numérico (repete sempre),
 * fechamento em "N dias antes". Sem date picker, sem cartoes_ciclos.
 */

type Props = {
  cartao: Cartao | null;
  /** Contas ativas — para escolher a conta que paga a fatura (§4.4/§4.5). */
  contas: Conta[];
  /** Regimes de ciclo já gravados PARA ESTE cartão (Fase 2b). Vazio em criação. */
  ciclos: CartaoCiclo[];
  /** Lançamentos (todos) — para a prévia de migração de faturas (adendo 3b). */
  lancamentos: import('../types/db').Lancamento[];
  /** Índice de exceções de série — idem, para materializar ocorrências (3b). */
  excecoes: import('../lib/recorrencia').IndiceExcecoes;
  /** Hoje — para o piso do date picker de mudança de regime (adendo Mudança 3). */
  hoje: Date;
  onVoltar: () => void;
  onSalvou: () => void;
};

/** Converte dígitos (centavos) em reais. */
function centavosParaReais(d: string): number {
  return Number(d || '0') / 100;
}
/** Reais → string de centavos, para pré-preencher na edição. */
function reaisParaCentavos(v: number | null): string {
  if (v == null) return '';
  return String(Math.round(v * 100));
}
/** Garante dia 1–31. */
function clampDia(s: string): string {
  const n = s.replace(/\D/g, '').slice(0, 2);
  if (n === '') return '';
  return String(Math.min(31, Math.max(1, Number(n))));
}

const MESES_CURTO = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Último dia do mês (ano, mes 0-11). */
function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(ano, mes + 1, 0).getDate();
}
/** Monta YYYY-MM-DD a partir de (ano, mes 0-11, dia), com clamp do dia ao mês. */
function isoDeMesDia(ano: number, mes: number, dia: number): string {
  const d = Math.min(dia, ultimoDiaDoMes(ano, mes));
  return `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
/** Data de vencimento (ISO) de um ciclo de fechamento `cicloAbs`, dado o dia de
 *  pagamento e a regra de offset (venc depois do fech → mesmo mês; senão +1). */
function vencimentoISODoCiclo(cicloAbs: number, diaFech: number, diaPag: number): string {
  const vencAbs = diaPag > diaFech ? cicloAbs : cicloAbs + 1;
  return isoDeMesDia(Math.floor(vencAbs / 12), vencAbs % 12, diaPag);
}

export function CriarEditarCartao({ cartao, contas, ciclos, lancamentos, excecoes, hoje, onVoltar, onSalvou }: Props) {
  const editando = cartao !== null;
  const correntes = contas.filter((c) => c.tipo === 'corrente');

  // Regime VIGENTE de hoje (Fase 2b): os campos mostram o que está em força
  // AGORA, não o campo-base cru — se já há mudança agendada, a tela reflete ela.
  const indiceCiclos = indexarCiclos(ciclos);

  // PISO da mudança (adendo Mudança 3): primeiro ciclo cujo fechamento ainda não
  // ocorreu — a PRÓXIMA fatura. É o menor ciclo onde a mudança pode ancorar
  // (trava o date picker) e também o ciclo cujo regime a tela deve refletir.
  // Depende só de cartao/hoje/ciclos — por isso calculado antes do regime.
  const pisoAbs = cartao ? pisoMudancaDeRegime(cartao, hoje, indiceCiclos) : 0;

  // Regime VIGENTE que a tela mostra: o da PRÓXIMA fatura (piso), não o do
  // mês-calendário de hoje. Uma mudança ancorada em agosto não vale em julho;
  // ler o regime no mês de hoje (julho) reabriria a tela com os dados velhos
  // mesmo após salvar. Ler no piso reflete a mudança já agendada.
  const regimeVigente = cartao
    ? regimeDoCiclo(cartao, pisoAbs, indiceCiclos)
    : { dia_fechamento: 0, dia_pagamento: 0 };

  // Data de vencimento do ciclo-piso sob o regime vigente — valor inicial e
  // mínimo do picker (a "próxima fatura" sob a regra atual).
  const vencPisoISO = cartao
    ? vencimentoISODoCiclo(pisoAbs, regimeVigente.dia_fechamento, regimeVigente.dia_pagamento)
    : '';

  const [nome, setNome] = useState(cartao?.nome ?? '');
  const [digitos, setDigitos] = useState(cartao ? reaisParaCentavos(cartao.previsao_mensal) : '');
  // CRIAÇÃO: vencimento é só o DIA numérico (repete sempre) + N dias antes.
  const [venceDia, setVenceDia] = useState(cartao ? String(regimeVigente.dia_pagamento) : '');
  // EDIÇÃO: vencimento é a DATA CONCRETA do próximo vencimento (date picker),
  // inicializada na próxima fatura sob o regime vigente. É a fonte da âncora.
  const [vencData, setVencData] = useState(vencPisoISO);
  const [diasAntes, setDiasAntes] = useState(
    cartao ? String(regimeVigente.dia_pagamento - regimeVigente.dia_fechamento) : '',
  );
  const [contaId, setContaId] = useState<string | null>(
    cartao?.conta_id ?? (correntes.length === 1 ? correntes[0].id : null),
  );
  const [tema, setTema] = useState<string | null>(cartao?.tema ?? null);
  const [banco, setBanco] = useState<string | null>(cartao?.banco ?? null);
  const [bandeira, setBandeira] = useState<string | null>(cartao?.bandeira ?? null);
  const [sheet, setSheet] = useState<null | 'banco' | 'bandeira' | 'conta'>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Aviso de migração 3b: quando há lançamentos migrando, guardamos o payload
  // pendente e mostramos o modal; confirmar grava, cancelar volta.
  const [avisoMigracao, setAvisoMigracao] = useState<null | { entram: number; saem: number }>(null);

  const contaSel = correntes.find((c) => c.id === contaId) ?? null;

  const temPrevisao = digitos.replace(/0/g, '') !== '';
  const previsao = temPrevisao ? centavosParaReais(digitos) : null;

  // Dias antes (comum às duas telas). N ≥ 1.
  const nDias = diasAntes === '' ? null : Number(diasAntes);

  // --- Validação e derivações, divergindo por modo ---
  // CRIAÇÃO: usa venceDia numérico. Trava fechamento no mesmo mês (venceDia − N ≥ 1).
  const venceN = venceDia === '' ? null : Number(venceDia);
  const fechamentoNoMesCriar = nDias !== null && venceN !== null && venceN - nDias >= 1;

  // EDIÇÃO: usa vencData (ISO). O dia da data escolhida é o dia_pagamento novo;
  // fechamento = dia − N, no mesmo mês (trava idêntica à Fase 1).
  const diaVenc = vencData ? Number(vencData.slice(8, 10)) : null;
  const fechamentoNoMesEditar = nDias !== null && diaVenc !== null && diaVenc - nDias >= 1;

  const fechamentoNoMes = editando ? fechamentoNoMesEditar : fechamentoNoMesCriar;
  const diasValido = nDias !== null && nDias >= 1 && fechamentoNoMes;

  // Datas novas resultantes (dia_fechamento / dia_pagamento do regime a gravar).
  const novoPagamento = editando ? (diaVenc ?? 0) : Number(venceDia || 0);
  const novoFechamento = novoPagamento - (nDias ?? 0);

  // Mudou a data em relação ao regime vigente? (só edição gera regime)
  const mudouData =
    editando &&
    (novoFechamento !== regimeVigente.dia_fechamento || novoPagamento !== regimeVigente.dia_pagamento);

  // Âncora (edição, mudança de data): vem da DATA CONCRETA, floorada no piso.
  const desdeAbs =
    editando && diasValido && vencData
      ? Math.max(ancoraDeVencimento(vencData, novoFechamento, novoPagamento), pisoAbs)
      : 0;
  const desdeMesTexto = mudouData
    ? `${MESES_CURTO[((desdeAbs % 12) + 12) % 12]}/${Math.floor(desdeAbs / 12)}`
    : null;

  const podeSalvar =
    nome.trim().length > 0 &&
    (editando ? vencData !== '' : venceDia !== '') &&
    diasValido &&
    contaId !== null &&
    !salvando;

  // Grava o regime novo em cartoes_ciclos (upsert por âncora). Chamado direto
  // (sem migração) ou após confirmar o aviso 3b.
  async function gravarRegime() {
    const { error } = await supabase
      .from('cartoes_ciclos')
      .upsert(
        {
          cartao_id: cartao!.id,
          desde_ciclo_abs: desdeAbs,
          dia_fechamento: novoFechamento,
          dia_pagamento: novoPagamento,
        },
        { onConflict: 'cartao_id,desde_ciclo_abs' },
      );
    if (error) throw error;
  }

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      const restoPayload = {
        nome: nome.trim(),
        conta_id: contaId,
        previsao_mensal: previsao,
        tema,
        banco,
        bandeira,
      };

      if (!editando) {
        // Criação: regime-base nos próprios campos de cartoes; sem cartoes_ciclos.
        const { error } = await supabase.from('cartoes').insert({
          ...restoPayload,
          dia_fechamento: novoFechamento,
          dia_pagamento: novoPagamento,
        });
        if (error) throw error;
        onSalvou();
        onVoltar();
        return;
      }

      // Edição: atualiza o "resto" em cartoes (sem tocar nas datas-base).
      const { error: erroResto } = await supabase
        .from('cartoes')
        .update(restoPayload)
        .eq('id', cartao!.id);
      if (erroResto) throw erroResto;

      // Sem mudança de data: acabou (edição de resto, nenhum regime criado).
      if (!mudouData) {
        onSalvou();
        onVoltar();
        return;
      }

      // Mudou a data. Antes de gravar, checa se algum lançamento do cartão migra
      // de fatura por causa do novo fechamento (adendo 3b). Se sim, mostra aviso
      // e espera a confirmação; a gravação real acontece no onConfirmar do modal.
      const mig = migracaoAoMudarFechamento(
        lancamentos, cartao!, desdeAbs, novoFechamento, novoPagamento, hoje, excecoes,
      );
      if (mig.entram > 0 || mig.saem > 0) {
        setAvisoMigracao(mig);
        setSalvando(false); // libera; o fluxo continua no modal
        return;
      }

      // Nada migra: grava direto.
      await gravarRegime();
      onSalvou();
      onVoltar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
      setSalvando(false);
    }
  }

  // Confirmação do aviso 3b: grava o regime e fecha.
  async function confirmarComMigracao() {
    setAvisoMigracao(null);
    setSalvando(true);
    setErro(null);
    try {
      await gravarRegime();
      onSalvou();
      onVoltar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
      setSalvando(false);
    }
  }

  async function arquivar() {
    setErro(null);
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('cartoes')
        .update({ arquivado_em: new Date().toISOString() })
        .eq('id', cartao!.id);
      if (error) throw error;
      onSalvou();
      onVoltar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao arquivar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <Header variante="chuld" titulo={editando ? 'Editar Cartão' : 'Novo Cartão'} onVoltar={onVoltar} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18, padding: 'var(--space-sm) var(--space-xl) 120px' }}>
        <Input label="Nome do cartão" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nubank" />

        {/* Previsão mensal de gasto — hint travado em §4.4 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="type-label" style={{ color: 'var(--text-secondary)' }}>Previsão mensal de gasto</span>
          <span className="type-caption" style={{ color: 'var(--text-muted)' }}>
            Opcional. Sem previsão, o cartão só acumula o que você lançar — não é o limite do banco
          </span>
          <input
            value={temPrevisao ? `R$ ${formatarBR(previsao ?? 0)}` : ''}
            onChange={(e) => {
              // Só dígitos; zeros à esquerda caem fora. Se sobrar vazio (ou só
              // zeros), o campo volta ao estado "sem previsão" — permite apagar
              // de volta a vazio sem ficar preso numa meta R$ 0 (§3.2/§4.4).
              const so = e.target.value.replace(/\D/g, '').replace(/^0+/, '').slice(0, 12);
              setDigitos(so);
            }}
            inputMode="numeric"
            placeholder="Sem previsão"
            aria-label="Previsão mensal em reais"
            className="type-body"
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
            onFocus={(e) => { const v = e.target.value; e.target.setSelectionRange(v.length, v.length); }}
          />
        </div>

        {/* Vencimento + fechamento. CRIAÇÃO: dia numérico (repete sempre).
            EDIÇÃO: date picker da próxima data de vencimento (âncora concreta,
            adendo Mudança 1/2). Fechamento sempre em "N dias antes". */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <div style={{ flex: 1 }}>
              {editando ? (
                <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span className="type-label" style={{ color: 'var(--text-secondary)' }}>
                    Próximo vencimento
                  </span>
                  <input
                    type="date"
                    value={vencData}
                    min={vencPisoISO}
                    onChange={(e) => { if (e.target.value) setVencData(e.target.value); }}
                    className="type-body"
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
                </label>
              ) : (
                <Input
                  label="Vence dia"
                  value={venceDia}
                  onChange={(e) => setVenceDia(clampDia(e.target.value))}
                  inputMode="numeric"
                  placeholder="05"
                />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <Input
                label="Fecha (dias antes)"
                value={diasAntes}
                onChange={(e) => setDiasAntes(e.target.value.replace(/\D/g, '').slice(0, 2))}
                inputMode="numeric"
                placeholder="7"
              />
            </div>
          </div>
          {!fechamentoNoMes && ((editando && vencData !== '') || (!editando && venceDia !== '')) && diasAntes !== '' && (
            <span className="type-caption" style={{ color: 'var(--value-saida)' }}>
              Nesta versão o fechamento precisa cair no mesmo mês do vencimento.
            </span>
          )}
          {desdeMesTexto && (
            <span className="type-caption" style={{ color: 'var(--text-muted)' }}>
              A nova data passa a valer a partir da fatura de {desdeMesTexto}. As faturas
              anteriores não mudam.
            </span>
          )}
        </div>

        {/* Conta que paga a fatura (§4.4/§4.5) — abre o seletor de contas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="type-label" style={{ color: 'var(--text-secondary)' }}>
            Conta que será debitado o cartão
          </span>
          <button
            type="button"
            onClick={() => setSheet('conta')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-surface)',
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span
              aria-hidden
              data-card-theme={contaSel?.tema ?? undefined}
              style={{
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-sm)',
                background: contaSel?.tema ? 'var(--theme-bg)' : 'var(--p-slate-400)',
                color: contaSel?.tema ? 'var(--theme-text)' : 'var(--p-white)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '0 0 auto',
              }}
            >
              <IconeImage tamanho={18} />
            </span>
            <span
              className="type-body"
              style={{ flex: '1 1 auto', color: contaSel ? 'var(--text-primary)' : 'var(--text-muted)' }}
            >
              {contaSel ? contaSel.nome : 'Escolher conta'}
            </span>
            <span style={{ flex: '0 0 auto', display: 'inline-flex', color: 'var(--text-muted)' }} aria-hidden>
              <IconeChevronRight />
            </span>
          </button>
        </div>

        {/* Tema (§4.9) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <span className="type-label" style={{ color: 'var(--text-secondary)' }}>Tema</span>
          <SeletorDeTema valor={tema} onMudar={(t: ChaveTema) => setTema(t)} />
        </div>

        {/* Banco + Bandeira — dois seletores de logo (§4.9) */}
        <CampoSeletor
          label="Banco"
          logo={<LogoBanco chave={banco} tamanho={22} />}
          onClick={() => setSheet('banco')}
        />
        <CampoSeletor
          label="Bandeira"
          logo={<LogoBandeira chave={bandeira} tamanho={22} />}
          onClick={() => setSheet('bandeira')}
        />

        {erro && <span className="type-caption" style={{ color: 'var(--value-saida)' }}>{erro}</span>}

        {/* Arquivar (só em edição) — §4.10. Espelha CriarEditarConta: preserva
            passado E futuro (parcelas em curso). Dentro do corpo, no fim: fica
            atrás do Salvar fixo e exige rolar para alcançar (anti-toque-acidental). */}
        {editando && (
          <div style={{ marginTop: 'var(--space-md)' }}>
            <Botao hierarquia="secondary" onClick={arquivar} disabled={salvando} style={{ color: 'var(--value-saida)' }}>
              Arquivar cartão
            </Botao>
          </div>
        )}
      </div>

      <SeletorContaCartao
        aberto={sheet === 'conta'}
        contexto="cartao-conta"
        contas={correntes}
        cartoes={[]}
        onFechar={() => setSheet(null)}
        onSelecionar={(sel) => {
          if (sel.kind === 'conta') setContaId(sel.conta.id);
          setSheet(null);
        }}
      />

      <SeletorDeIcone
        aberto={sheet === 'banco'}
        titulo="Selecione o Banco"
        biblioteca={BANCOS}
        valor={banco}
        onFechar={() => setSheet(null)}
        onSelecionar={(chave) => { setBanco(chave); setSheet(null); }}
      />
      <SeletorDeIcone
        aberto={sheet === 'bandeira'}
        titulo="Selecione a Bandeira"
        biblioteca={BANDEIRAS}
        valor={bandeira}
        onFechar={() => setSheet(null)}
        onSelecionar={(chave) => { setBandeira(chave); setSheet(null); }}
      />

      {/* Aviso 3b — migração de faturas ao mudar o fechamento. Não bloqueia:
          informa quantos lançamentos entram/saem do ciclo-alvo e confirma.
          Usa tipo 'confirmacao' (dois botões, não-destrutivo). */}
      {avisoMigracao && (
        <ModalDeAlerta
          tipo="confirmacao"
          titulo="A mudança remaneja lançamentos"
          corpo={(() => {
            const partes: string[] = [];
            if (avisoMigracao.entram > 0)
              partes.push(
                `${avisoMigracao.entram} lançamento${avisoMigracao.entram > 1 ? 's passam' : ' passa'} a cair na fatura de ${desdeMesTexto}`,
              );
            if (avisoMigracao.saem > 0)
              partes.push(
                `${avisoMigracao.saem} lançamento${avisoMigracao.saem > 1 ? 's saem' : ' sai'} da fatura de ${desdeMesTexto}`,
              );
            return `${partes.join(' e ')}. As faturas anteriores não mudam. Confirmar?`;
          })()}
          primaria={{ rotulo: 'Confirmar', onClick: () => { void confirmarComMigracao(); } }}
          secundaria={{ rotulo: 'Cancelar', onClick: () => setAvisoMigracao(null) }}
          onScrim={() => setAvisoMigracao(null)}
        />
      )}

      {/* Footer fixo: Salvar — sempre acessível na base, cobre o Apagar. */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 10, borderTop: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--space-md) var(--space-xl) calc(var(--space-xl) + env(safe-area-inset-bottom))' }}>
          <Botao onClick={salvar} disabled={!podeSalvar}>
            {salvando ? 'Salvando…' : 'Salvar cartão'}
          </Botao>
        </div>
      </div>
    </div>
  );
}
