import { useState } from 'react';
import { Header, Input, Botao, SeletorDeTema, CampoSeletor, SeletorDeIcone } from '../components';
import type { ChaveTema } from '../components/SeletorDeTema';
import { ICONES_POUPANCA } from '../icons';
import { supabase } from '../lib/supabase';
import type { Conta } from '../types/db';

/**
 * Criar/Editar Poupança — §5.4, §5.8, §4.9, §4.10, Figma 2307:1619.
 * Clone do Criar/Editar Conta: mesmo layout (nome, tema, ícone, footer Salvar),
 * trocando só a biblioteca de ícone (temática de poupança, não bancos) e o
 * tipo gravado (`poupanca`). Em edição, "Apagar poupança" acima do Salvar
 * (§4.10 — apagar exige conta vazia; a checagem virá junto do saldo, por ora
 * remove direto).
 *
 * Grava em `contas` com tipo='poupanca'. Nenhum markup próprio de card/tema —
 * tudo instanciado da biblioteca.
 */

type Props = {
  /** Poupança a editar, ou null para criar nova. */
  poupanca: Conta | null;
  onVoltar: () => void;
  onSalvou: () => void;
};

export function CriarEditarPoupanca({ poupanca, onVoltar, onSalvou }: Props) {
  const editando = poupanca !== null;
  const [nome, setNome] = useState(poupanca?.nome ?? '');
  const [tema, setTema] = useState<string | null>(poupanca?.tema ?? null);
  const [icone, setIcone] = useState<string | null>(poupanca?.icone ?? null);
  const [sheetIcone, setSheetIcone] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeSalvar = nome.trim().length > 0 && !salvando;

  const IconeSel = icone ? ICONES_POUPANCA[icone] : null;

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      if (editando) {
        const { error } = await supabase
          .from('contas')
          .update({ nome: nome.trim(), tema, icone })
          .eq('id', poupanca!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contas')
          .insert({ nome: nome.trim(), tipo: 'poupanca', tema, icone });
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
      const { error } = await supabase.from('contas').delete().eq('id', poupanca!.id);
      if (error) throw error;
      onSalvou();
      onVoltar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao apagar.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div style={{ maxWidth: 480, margin: '0 auto', minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
      <Header variante="chuld" titulo={editando ? 'Editar Poupança' : 'Nova Poupança'} onVoltar={onVoltar} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18, padding: 'var(--space-sm) var(--space-xl) 120px' }}>
        <Input label="Nome da poupança" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Viagem" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <span className="type-label" style={{ color: 'var(--text-secondary)' }}>Tema</span>
          <SeletorDeTema valor={tema} onMudar={(t: ChaveTema) => setTema(t)} />
        </div>

        {/* Ícone temático — abre o seletor com a biblioteca de poupança (§4.9) */}
        <CampoSeletor
          label="Ícone"
          logo={IconeSel ? <IconeSel tamanho={22} /> : null}
          onClick={() => setSheetIcone(true)}
        />

        {erro && <span className="type-caption" style={{ color: 'var(--value-saida)' }}>{erro}</span>}

        {/* Apagar (só em edição) — §4.10. Dentro do corpo, no fim: fica atrás do
            Salvar fixo e exige rolar para alcançar (anti-toque-acidental). */}
        {editando && (
          <div style={{ marginTop: 'var(--space-md)' }}>
            <Botao hierarquia="secondary" onClick={apagar} disabled={salvando} style={{ color: 'var(--value-saida)' }}>
              Apagar poupança
            </Botao>
          </div>
        )}
      </div>

      <SeletorDeIcone
        aberto={sheetIcone}
        titulo="Selecione o Ícone"
        biblioteca={ICONES_POUPANCA}
        valor={icone}
        onFechar={() => setSheetIcone(false)}
        onSelecionar={(chave) => { setIcone(chave); setSheetIcone(false); }}
      />

      {/* Footer fixo: Salvar — sempre acessível na base, cobre o Apagar. */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 10, borderTop: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}>
        <div style={{ maxWidth: 480, margin: '0 auto', padding: 'var(--space-md) var(--space-xl) calc(var(--space-xl) + env(safe-area-inset-bottom))' }}>
          <Botao onClick={salvar} disabled={!podeSalvar}>
            {salvando ? 'Salvando…' : 'Salvar poupança'}
          </Botao>
        </div>
      </div>
    </div>
  );
}
