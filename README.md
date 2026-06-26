# Meu Livro-Caixa

PWA de finanças do casal — livro-razão contínuo. Spec v0.7.1.
React + Vite + Supabase. Tokens extraídos do Figma (fonte de verdade).

## Rodar localmente

```bash
npm install      # instala dependências (uma vez)
npm run dev      # sobe em http://localhost:5173
```

Abra o endereço que o terminal mostrar. Deve aparecer "Conectado · 1 conta(s)".

## Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha com as credenciais do
seu projeto Supabase (Project Settings → API). A `.env.local` NÃO vai pro git.

## Tokens de design

`src/styles/tokens.css` e `src/design/tokens.ts` são GERADOS a partir de
`src/design/tokens.json` (espelho do Figma). Para regenerar:

```bash
npm run tokens
```

## Build de produção

```bash
npm run build    # gera dist/
npm run preview  # testa o build localmente
```
