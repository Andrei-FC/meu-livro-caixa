import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Conta } from '../types/db';
import { Botao } from '../components';

/** Home provisória (scaffold). Será substituída pela Home real (§5.1).
 *  Por ora prova que, autenticado, a RLS libera a leitura das contas. */
export function Home() {
  const [contas, setContas] = useState<Conta[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase
      .from('contas')
      .select('*')
      .order('criada_em', { ascending: true })
      .then(({ data }) => {
        setContas(data ?? []);
        setCarregando(false);
      });
  }, []);

  return (
    <main style={{ padding: 'var(--space-xl)', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <h1 className="type-display">Meu Livro-Caixa</h1>
      </div>
      <p className="type-caption" style={{ color: 'var(--text-muted)' }}>
        Logado · {carregando ? '…' : `${contas.length} conta(s)`}
      </p>

      <ul style={{ listStyle: 'none', marginTop: 'var(--space-xl)' }}>
        {contas.map((c) => (
          <li
            key={c.id}
            data-card-theme={c.tema ?? undefined}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 'var(--space-md)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-sm)',
              background: c.tema ? 'var(--theme-bg)' : 'var(--bg-elevated)',
              color: c.tema ? 'var(--theme-text)' : 'var(--text-primary)'
            }}
          >
            <span className="type-body-strong">{c.nome}</span>
            <span className="type-micro" style={{ opacity: 0.8 }}>{c.tipo}</span>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 'var(--space-2xl)' }}>
        <Botao hierarquia="secondary" onClick={() => supabase.auth.signOut()}>
          Sair
        </Botao>
      </div>
    </main>
  );
}
