import { useState } from 'react';
import { Header, Input, Botao, SeletorDeTema, CampoSeletor, SeletorDeIcone, SeletorContaCartao } from '../components';
import type { ChaveTema } from '../components/SeletorDeTema';
import { BANCOS, BANDEIRAS, LogoBanco, LogoBandeira, IconeImage, IconeChevronRight } from '../icons';
import { formatarBR } from '../lib/formato';
import { supabase } from '../lib/supabase';
import { indexarCiclos, regimeDoCiclo, ancoraMudancaDeRegime } from '../lib/recorrencia';
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
 * MUDANÇA DE DATAS (Fase 2b, doc-fase2). Editar fechamento/vencimento NÃO
 * sobrescreve mais `cartoes.dia_*` (isso reescreveria o passado — princípio 3).
 * Em vez disso grava uma linha de vigência em `cartoes_ciclos`, com âncora
 * DERIVADA (não digitada): o regime novo vale do PRÓXIMO ciclo de fechamento
 * (o ciclo em curso termina intacto sob a regra velha). Os campos exibidos
 * refletem o regime VIGENTE de hoje (respeitando qualquer mudança já agendada).
 * Editar só o "resto" (nome/previsão/tema/conta/banco/bandeira), sem mexer nas
 * datas, faz um UPDATE normal em `cartoes` e não cria regime.
 */

type Props = {
  cartao: Cartao | null;
  /** Contas ativas — para escolher a conta que paga a fatura (§4.4/§4.5). */
  contas: Conta[];
  /** Regimes de ciclo já gravados PARA ESTE cartão (Fase 2b). Vazio em criação. */
  ciclos: CartaoCiclo[];
  /** Hoje — para derivar a âncora da mudança de regime (§ doc-fase2). */
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

export function CriarEditarCartao({ cartao, contas, ciclos, hoje, onVoltar, onSalvou }: Props) {
  const editando = cartao !== null;
  const correntes = contas.filter((c) => c.tipo === 'corrente');

  // Regime VIGENTE de hoje (Fase 2b): os campos de data mostram o que está em
  // força AGORA, não o campo-base cru — assim, se já há uma mudança agendada, a
  // tela reflete ela. Índice construído só com os ciclos deste cartão.
  const indiceCiclos = indexarCiclos(ciclos);
  const cicloHojeAbs = cartao ? hoje.getFullYear() * 12 + hoje.getMonth() : 0;
  const regimeVigente = cartao
    ? regimeDoCiclo(cartao, cicloHojeAbs, indiceCiclos)
    : { dia_fechamento: 0, dia_pagamento: 0 };

  const [nome, setNome] = useState(cartao?.nome ?? '');
  const [digitos, setDigitos] = useState(cartao ? reaisParaCentavos(cartao.previsao_mensal) : '');
  // Entrada por "N dias antes do vencimento" (Fase 1); mostra o regime vigente
  // (Fase 2b). A conta reversa é exata porque fechamento e vencimento estão no
  // mesmo mês (dia_pagamento − dia_fechamento) — caso conservador da Fase 1.
  const [venceDia, setVenceDia] = useState(cartao ? String(regimeVigente.dia_pagamento) : '');
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

  const contaSel = correntes.find((c) => c.id === contaId) ?? null;

  // Previsão é opcional (§4.4): sem valor → null (cartão só acumula o realizado,
  // sem barra). Só entra no cálculo quando o usuário digita algo. Dígitos só de
  // zero ('', '0', '00'…) contam como sem previsão — assim dá para esvaziar o
  // campo de volta ao estado "sem previsão" e nunca fica preso numa meta R$ 0.
  const temPrevisao = digitos.replace(/0/g, '') !== '';
  const previsao = temPrevisao ? centavosParaReais(digitos) : null;

  // Fase 1: dia_fechamento derivado (dia_pagamento − N). Trava: N ≥ 1 e o
  // fechamento precisa cair no mesmo mês do vencimento (venceDia − N ≥ 1). O
  // caso "furar o mês" (vencimento no início) é Fase 2 — bloqueado aqui.
  const nDias = diasAntes === '' ? null : Number(diasAntes);
  const venceN = venceDia === '' ? null : Number(venceDia);
  const fechamentoNoMes = nDias !== null && venceN !== null && venceN - nDias >= 1;
  const diasValido = nDias !== null && nDias >= 1 && fechamentoNoMes;
  const podeSalvar =
    nome.trim().length > 0 && venceDia !== '' && diasValido && contaId !== null && !salvando;

  // Aviso "a partir de mmm/aaaa" (Fase 2b): quando, em edição, as datas mudam em
  // relação ao regime vigente, a mudança NÃO vale já — vale do próximo ciclo de
  // fechamento (o ciclo em curso termina sob a regra velha). Mostra ao usuário
  // quando passa a valer, para nunca surpreender (princípio 4). Só calcula com
  // datas válidas e em edição.
  const dataMudou =
    editando && diasValido && venceN !== null &&
    (venceN - (nDias ?? 0) !== regimeVigente.dia_fechamento || venceN !== regimeVigente.dia_pagamento);
  const desdeAbs = editando && cartao ? ancoraMudancaDeRegime(cartao, hoje, indiceCiclos) : 0;
  const desdeMesTexto = dataMudou
    ? `${MESES_CURTO[((desdeAbs % 12) + 12) % 12]}/${Math.floor(desdeAbs / 12)}`
    : null;

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      const novoFechamento = Number(venceDia) - Number(diasAntes);
      const novoPagamento = Number(venceDia);

      // Campos "resto" (não-data) — sempre vão para cartoes. As DATAS-BASE em
      // cartoes NUNCA são tocadas na edição (Fase 2b): mudança de data vira
      // regime em cartoes_ciclos, preservando o passado (princípio 3).
      const restoPayload = {
        nome: nome.trim(),
        conta_id: contaId,
        previsao_mensal: previsao,
        tema,
        banco,
        bandeira,
      };

      if (!editando) {
        // Criação: o cartão nasce com o regime-base nos próprios campos de
        // cartoes (não há passado a preservar). Sem cartoes_ciclos.
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

      // Edição: sempre atualiza o "resto" em cartoes (sem as datas-base).
      const { error: erroResto } = await supabase
        .from('cartoes')
        .update(restoPayload)
        .eq('id', cartao!.id);
      if (erroResto) throw erroResto;

      // As datas mudaram em relação ao regime VIGENTE de hoje? Se não, acabou —
      // foi edição de resto, nenhum regime criado (comportamento idêntico ao
      // de antes para quem só mexe em nome/tema/previsão).
      const mudouData =
        novoFechamento !== regimeVigente.dia_fechamento ||
        novoPagamento !== regimeVigente.dia_pagamento;
      if (!mudouData) {
        onSalvou();
        onVoltar();
        return;
      }

      // Mudança de data: grava um regime novo em cartoes_ciclos, com âncora
      // DERIVADA — o regime novo vale do PRÓXIMO ciclo de fechamento; o ciclo em
      // curso termina sob a regra velha (§ doc-fase2). Nada do passado se mexe.
      const desde = ancoraMudancaDeRegime(cartao!, hoje, indiceCiclos);

      // Se já existe uma mudança AINDA-NÃO-VIGENTE ancorada no mesmo ciclo
      // (o usuário editou a data duas vezes antes do próximo fechamento),
      // substitui essa linha em vez de inserir outra (o índice único
      // (cartao_id, desde_ciclo_abs) exige upsert). onConflict casa a UNIQUE.
      const { error: erroCiclo } = await supabase
        .from('cartoes_ciclos')
        .upsert(
          {
            cartao_id: cartao!.id,
            desde_ciclo_abs: desde,
            dia_fechamento: novoFechamento,
            dia_pagamento: novoPagamento,
          },
          { onConflict: 'cartao_id,desde_ciclo_abs' },
        );
      if (erroCiclo) throw erroCiclo;

      onSalvou();
      onVoltar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
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

        {/* Vence dia · Fecha N dias antes (Fase 1: entrada por N; grava dia_fechamento = venceDia − N) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <div style={{ flex: 1 }}>
              <Input
                label="Vence dia"
                value={venceDia}
                onChange={(e) => setVenceDia(clampDia(e.target.value))}
                inputMode="numeric"
                placeholder="05"
              />
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
          {venceDia !== '' && diasAntes !== '' && !fechamentoNoMes && (
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
