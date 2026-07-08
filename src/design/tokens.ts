// AUTO-GENERATED from tokens.json — do not edit by hand.
// Source: Figma Figma file 2h3h8G4YWPLxmbYC4tQ3TD · Meu Livro-Caixa v0.7.1

export type ThemeKey =
  | "vermelho"
  | "laranja"
  | "azul"
  | "roxo"
  | "grafite"
  | "onix"
  | "petroleo"
  | "azul-profundo";

export const THEME_KEYS: ThemeKey[] = ["vermelho", "laranja", "azul", "roxo", "grafite", "onix", "petroleo", "azul-profundo"];

// CSS var helper: token('bar/ok') -> 'var(--bar-ok)'
export const token = (name: string) => `var(--${name.replace(/\//g, '-')})`;

// The 12 category tokens, in order. Index via stable hash of description (spec §5.5).
export const CATEGORIA_TOKENS = ["categoria/01", "categoria/02", "categoria/03", "categoria/04", "categoria/05", "categoria/06", "categoria/07", "categoria/08", "categoria/09", "categoria/10", "categoria/11", "categoria/12"] as const;

// Stable hash → 1..12 → 'categoria/NN' (spec §5.5: cor nasce do texto, sem campo no schema)
export function categoriaToken(descricao: string): string {
  const s = descricao.trim().toLowerCase();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  const idx = Math.abs(h) % CATEGORIA_TOKENS.length;
  return CATEGORIA_TOKENS[idx];
}

export type TypeStyle =
  | "display"
  | "title"
  | "body"
  | "body-strong"
  | "body-small"
  | "body-small-strong"
  | "label"
  | "caption"
  | "numeric"
  | "micro"
  | "micro-strong";

export const TYPOGRAPHY: Record<TypeStyle, { family: string; weight: number; size: number; lineHeight: number }> = {
  "display": { family: "Inter", weight: 700, size: 32, lineHeight: 110 },
  "title": { family: "Inter", weight: 600, size: 20, lineHeight: 130 },
  "body": { family: "Inter", weight: 400, size: 16, lineHeight: 145 },
  "body-strong": { family: "Inter", weight: 500, size: 16, lineHeight: 145 },
  "body-small": { family: "Inter", weight: 500, size: 14, lineHeight: 130 },
  "body-small-strong": { family: "Inter", weight: 600, size: 14, lineHeight: 130 },
  "label": { family: "Inter", weight: 500, size: 13, lineHeight: 130 },
  "caption": { family: "Inter", weight: 400, size: 12, lineHeight: 130 },
  "numeric": { family: "Inter", weight: 600, size: 16, lineHeight: 130 },
  "micro": { family: "Inter", weight: 500, size: 11, lineHeight: 130 },
  "micro-strong": { family: "Inter", weight: 700, size: 11, lineHeight: 130 },
};
