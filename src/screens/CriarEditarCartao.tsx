import { useState } from 'react';
import { Header, Input, Botao, SeletorDeTema, CampoSeletor, SeletorDeIcone, SeletorContaCartao } from '../components';
import type { ChaveTema } from '../components/SeletorDeTema';
import { BANCOS, BANDEIRAS, LogoBanco, LogoBandeira, IconeImage, IconeChevronRight } from '../icons';
import { formatarBR } from '../lib/formato';
import { supabase } from '../lib/supabase';
import type { Cartao, Conta } from '../types/db';

/**
 * Criar/Editar Cartão — §5.8, §4.4, §4.9, §4.10, Figma 2046:451.
 * Página própria com Header chuld. Campos: nome; previsão mensal de gasto (com
 * hint "não é o limite do banco" — vocabulário travado em §4.4); fecha dia +
 * vence dia (lado a lado); tema (§4.9); bandeira/banco (placeholder). Footer
 * fixo: Salvar. Em edição, "Apagar cartão" acima (§4.10 — apagar exige cartão
 * sem lançamentos; a checagem fina virá depois, aqui o delete falha por FK se
 * houver vínculo, e a mensagem do Supabase é exibida).
 *
 * Grava em `cartoes`. `previsao_mensal` é o teto de previsão (§3.2/§4.4), nunca
 * o limite do banco.
 */

type Props = {
  cartao: Cartao | null;
  /** Contas ativas — para escolher a conta que paga a fatura (§4.4/§4.5). */
  contas: Conta[];
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

export function CriarEditarCartao({ cartao, contas, onVoltar, onSalvou }: Props) {
  const editando = cartao !== null;
  const correntes = contas.filter((c) => c.tipo === 'corrente');
  const [nome, setNome] = useState(cartao?.nome ?? '');
  const [digitos, setDigitos] = useState(cartao ? reaisParaCentavos(cartao.previsao_mensal) : '');
  const [fechaDia, setFechaDia] = useState(cartao ? String(cartao.dia_fechamento) : '');
  const [venceDia, setVenceDia] = useState(cartao ? String(cartao.dia_pagamento) : '');
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
  // sem barra). Só entra no cálculo quando o usuário digita algo.
  const temPrevisao = digitos !== '';
  const previsao = temPrevisao ? centavosParaReais(digitos) : null;
  const podeSalvar =
    nome.trim().length > 0 && fechaDia !== '' && venceDia !== '' && contaId !== null && !salvando;

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      const payload = {
        nome: nome.trim(),
        conta_id: contaId,
        previsao_mensal: previsao,
        dia_fechamento: Number(fechaDia),
        dia_pagamento: Number(venceDia),
        tema,
        banco,
        bandeira,
      };
      if (editando) {
        const { error } = await supabase.from('cartoes').update(payload).eq('id', cartao!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('cartoes').insert(payload);
        if (error) throw error;
      }
      onSalvou();
      onVoltar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  }

  async function apagar() {
    setErro(null);
    setSalvando(true);
    try {
      const { error } = await supabase.from('cartoes').delete().eq('id', cartao!.id);
      if (error) throw error;
      onSalvou();
      onVoltar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível apagar (o cartão pode ter lançamentos).');
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
            onChange={(e) => setDigitos(e.target.value.replace(/\D/g, '').slice(0, 12))}
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

        {/* Fecha dia · Vence dia (lado a lado) */}
        <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
          <div style={{ flex: 1 }}>
            <Input
              label="Fecha dia"
              value={fechaDia}
              onChange={(e) => setFechaDia(clampDia(e.target.value))}
              inputMode="numeric"
              placeholder="28"
            />
          </div>
          <div style={{ flex: 1 }}>
            <Input
              label="Vence dia"
              value={venceDia}
              onChange={(e) => setVenceDia(clampDia(e.target.value))}
              inputMode="numeric"
              placeholder="05"
            />
          </div>
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

        {/* Apagar (só em edição) — §4.10. Dentro do corpo, no fim: fica atrás do
            Salvar fixo e exige rolar para alcançar (anti-toque-acidental). */}
        {editando && (
          <div style={{ marginTop: 'var(--space-md)' }}>
            <Botao hierarquia="secondary" onClick={apagar} disabled={salvando} style={{ color: 'var(--value-saida)' }}>
              Apagar cartão
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
