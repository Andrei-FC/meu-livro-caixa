import { useState } from 'react';
import { Header, Input, Botao, SeletorDeTema, CampoSeletor, SeletorDeIcone } from '../components';
import type { ChaveTema } from '../components/SeletorDeTema';
import { BANCOS, LogoBanco } from '../icons';
import { supabase } from '../lib/supabase';
import type { Conta } from '../types/db';

/**
 * Criar/Editar Conta — §5.8, §4.9, §4.10, Figma 2048:505.
 * Página própria com Header chuld. Campos: nome, tema (8 swatches §4.9), logo
 * do banco (placeholder até a biblioteca de logos entrar). Footer fixo: Salvar.
 * Em edição, acima do Salvar aparece "Arquivar conta" (§4.10 — exige saldo zero;
 * a checagem de saldo virá com §4.7, por ora arquiva direto via arquivada_em).
 *
 * Grava em `contas`. O tipo da conta (corrente/poupança) não é editável aqui:
 * conta nova nasce corrente; poupança nasce do fluxo do Cofre (§5.4).
 */

type Props = {
  /** Conta a editar, ou null para criar nova. */
  conta: Conta | null;
  onVoltar: () => void;
  onSalvou: () => void;
};

export function CriarEditarConta({ conta, onVoltar, onSalvou }: Props) {
  const editando = conta !== null;
  const [nome, setNome] = useState(conta?.nome ?? '');
  const [tema, setTema] = useState<string | null>(conta?.tema ?? null);
  const [icone, setIcone] = useState<string | null>(conta?.icone ?? null);
  const [sheetIcone, setSheetIcone] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeSalvar = nome.trim().length > 0 && !salvando;

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      if (editando) {
        const { error } = await supabase
          .from('contas')
          .update({ nome: nome.trim(), tema, icone })
          .eq('id', conta!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('contas')
          .insert({ nome: nome.trim(), tipo: 'corrente', tema, icone });
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

  async function arquivar() {
    setErro(null);
    setSalvando(true);
    try {
      const { error } = await supabase
        .from('contas')
        .update({ arquivada_em: new Date().toISOString() })
        .eq('id', conta!.id);
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
      <Header variante="chuld" titulo={editando ? 'Editar Conta' : 'Nova Conta'} onVoltar={onVoltar} />

      {/* Corpo */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 18, padding: 'var(--space-sm) var(--space-xl) var(--space-xl)' }}>
        <Input label="Nome da conta" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Conta principal" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
          <span className="type-label" style={{ color: 'var(--text-secondary)' }}>Tema</span>
          <SeletorDeTema valor={tema} onMudar={(t: ChaveTema) => setTema(t)} />
        </div>

        {/* Logo do banco — abre o seletor de ícone (§4.9) */}
        <CampoSeletor
          label="Banco"
          logo={<LogoBanco chave={icone} tamanho={22} />}
          onClick={() => setSheetIcone(true)}
        />

        {erro && <span className="type-caption" style={{ color: 'var(--value-saida)' }}>{erro}</span>}
      </div>

      <SeletorDeIcone
        aberto={sheetIcone}
        titulo="Selecione o Banco"
        biblioteca={BANCOS}
        valor={icone}
        onFechar={() => setSheetIcone(false)}
        onSelecionar={(chave) => { setIcone(chave); setSheetIcone(false); }}
      />

      {/* Arquivar (só em edição) — §4.10 */}
      {editando && (
        <div style={{ padding: 'var(--space-md) var(--space-xl)' }}>
          <Botao hierarquia="secondary" onClick={arquivar} disabled={salvando} style={{ color: 'var(--value-saida)' }}>
            Arquivar conta
          </Botao>
        </div>
      )}

      {/* Footer fixo: Salvar */}
      <div style={{ borderTop: '1px solid var(--border-default)', background: 'var(--bg-surface)', padding: 'var(--space-md) var(--space-xl) calc(var(--space-xl) + env(safe-area-inset-bottom))' }}>
        <Botao onClick={salvar} disabled={!podeSalvar}>
          {salvando ? 'Salvando…' : 'Salvar conta'}
        </Botao>
      </div>
    </div>
  );
}
