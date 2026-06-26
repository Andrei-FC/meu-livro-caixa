import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Input, Botao } from '../components';

export function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState(false);
  const [enviando, setEnviando] = useState(false);

  async function entrar() {
    setEnviando(true);
    setErro(false);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha
    });
    if (error) setErro(true);
    setEnviando(false);
    // sucesso: onAuthStateChange troca a tela automaticamente
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 var(--space-xl)',
        background: 'var(--bg-page)'
      }}
    >
      {/* Brand */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 40 }}>
        <h1 className="type-display" style={{ color: 'var(--text-primary)' }}>
          Meu Livro-Caixa
        </h1>
        <p className="type-body" style={{ color: 'var(--text-secondary)' }}>
          Entre para continuar
        </p>
      </div>

      {/* Form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Input
          label="E-mail"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="username"
          value={email}
          error={erro}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
        />
        <Input
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          error={erro}
          onChange={(e) => setSenha(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && entrar()}
          placeholder="••••••••"
        />

        {erro && (
          <p className="type-label" style={{ color: 'var(--value-saida)' }}>
            E-mail ou senha incorretos. Tente novamente.
          </p>
        )}

        <Botao onClick={entrar} disabled={enviando || !email || !senha}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </Botao>
      </div>
    </main>
  );
}

/** Estado de carregamento enquanto verifica a sessão (§ Home — Verificando sessão). */
export function VerificandoSessao() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-md)',
        background: 'var(--bg-page)'
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          border: '3px solid var(--border-default)',
          borderTopColor: 'var(--accent-default)',
          borderRadius: '50%',
          animation: 'spin 700ms linear infinite'
        }}
      />
      <p className="type-body" style={{ color: 'var(--text-secondary)' }}>
        Verificando sessão…
      </p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
