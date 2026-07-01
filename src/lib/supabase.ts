import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anonKey) {
  throw new Error(
    'Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no .env.local'
  );
}

// Sessão persistente: senha digitada uma vez por aparelho (§6).
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'livro-caixa-auth'
  }
});

/**
 * Corre uma Promise contra um timeout. Protege contra requisições que ficam
 * *penduradas* (rede caindo no meio: "network connection lost" no iOS/Safari) —
 * o fetch nem resolve nem rejeita, e sem isto a UI ficaria presa em "salvando".
 * Rejeita com Error após `ms` para o chamador limpar estado e mostrar erro.
 */
export function comTimeout<T>(p: PromiseLike<T>, ms = 12000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(
      () => reject(new Error('Sem resposta da rede. Verifique a conexão e tente de novo.')),
      ms,
    );
    Promise.resolve(p).then(
      (v) => { clearTimeout(id); resolve(v); },
      (e) => { clearTimeout(id); reject(e); },
    );
  });
}
