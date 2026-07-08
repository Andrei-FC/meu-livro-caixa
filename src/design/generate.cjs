const fs = require('fs');
const path = require('path');

const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'tokens.json'), 'utf8'));
const prim = T.primitives;

// Saídas: tokens.ts fica ao lado da fonte (é importado de src/design); a folha
// de estilo vai para src/styles/tokens.css, que é a de fato importada em main.tsx.
const OUT_CSS = path.join(__dirname, '..', 'styles', 'tokens.css');
const OUT_TS = path.join(__dirname, 'tokens.ts');

// resolve an alias-or-hex to a literal hex
const lit = (v) => v.startsWith('#') ? v : prim[v];
// CSS custom-prop name from a token path: "bar/ok" -> "--bar-ok"
const cssVar = (name) => '--' + name.replace(/\//g, '-');

// ---------- tokens.css ----------
let css = `/* AUTO-GENERATED from tokens.json — do not edit by hand.\n   Source: Figma ${T.$meta.source} · ${T.$meta.spec} */\n\n`;

// primitives as --p-*
css += `:root {\n`;
for (const [k, v] of Object.entries(prim)) css += `  ${cssVar('p/' + k)}: ${v};\n`;
css += `}\n\n`;

// semantic color — light (default) and dark
const colorBlock = (mode) => {
  let s = '';
  for (const [name, modes] of Object.entries(T.color)) {
    s += `  ${cssVar(name)}: ${lit(modes[mode])};\n`;
  }
  return s;
};
css += `:root {\n`;
// spacing + radius (mode-less)
for (const [k, v] of Object.entries(T.spacing)) css += `  ${cssVar('space/' + k)}: ${v}px;\n`;
for (const [k, v] of Object.entries(T.radius)) css += `  ${cssVar('radius/' + k)}: ${v === 999 ? '999px' : v + 'px'};\n`;
css += colorBlock('light');
css += `}\n\n`;
css += `:root[data-theme="dark"] {\n${colorBlock('dark')}}\n\n`;

// themes (bank-card themes) as data-card-theme
css += `/* Card/account themes — applied via data-card-theme on the entity element */\n`;
for (const [key, val] of Object.entries(T.themes)) {
  if (key.startsWith('$')) continue;
  css += `[data-card-theme="${key}"] { --theme-bg: ${lit(val.bg)}; --theme-text: ${lit(val.text)}; }\n`;
}

// typography classes
css += `\n/* Typography — Inter scale. Apply via class, e.g. <span class="type-numeric"> */\n`;
for (const [slug, t] of Object.entries(T.typography)) {
  if (slug.startsWith('$')) continue;
  css += `.type-${slug} { font-family: ${t.family}, system-ui, sans-serif; font-weight: ${t.weight}; font-size: ${t.size}px; line-height: ${t.lineHeight}%; }\n`;
}

fs.writeFileSync(OUT_CSS, css);

// ---------- tokens.ts ----------
const themeKeys = Object.keys(T.themes).filter(k => !k.startsWith('$'));
const colorKeys = Object.keys(T.color);
const catKeys = colorKeys.filter(k => k.startsWith('categoria/'));

let ts = `// AUTO-GENERATED from tokens.json — do not edit by hand.\n`;
ts += `// Source: Figma ${T.$meta.source} · ${T.$meta.spec}\n\n`;
ts += `export type ThemeKey =\n${themeKeys.map(k => `  | ${JSON.stringify(k)}`).join('\n')};\n\n`;
ts += `export const THEME_KEYS: ThemeKey[] = [${themeKeys.map(k => JSON.stringify(k)).join(', ')}];\n\n`;
ts += `// CSS var helper: token('bar/ok') -> 'var(--bar-ok)'\n`;
ts += `export const token = (name: string) => \`var(--\${name.replace(/\\//g, '-')})\`;\n\n`;
ts += `// The 12 category tokens, in order. Index via stable hash of description (spec §5.5).\n`;
ts += `export const CATEGORIA_TOKENS = [${catKeys.map(k => JSON.stringify(k)).join(', ')}] as const;\n\n`;
ts += `// Stable hash → 1..12 → 'categoria/NN' (spec §5.5: cor nasce do texto, sem campo no schema)\n`;
ts += `export function categoriaToken(descricao: string): string {\n`;
ts += `  const s = descricao.trim().toLowerCase();\n`;
ts += `  let h = 0;\n`;
ts += `  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;\n`;
ts += `  const idx = Math.abs(h) % CATEGORIA_TOKENS.length;\n`;
ts += `  return CATEGORIA_TOKENS[idx];\n`;
ts += `}\n\n`;

// typography
const typoKeys = Object.keys(T.typography).filter(k => !k.startsWith('$'));
ts += `export type TypeStyle =\n${typoKeys.map(k => `  | ${JSON.stringify(k)}`).join('\n')};\n\n`;
ts += `export const TYPOGRAPHY: Record<TypeStyle, { family: string; weight: number; size: number; lineHeight: number }> = {\n`;
for (const k of typoKeys) {
  const t = T.typography[k];
  ts += `  ${JSON.stringify(k)}: { family: ${JSON.stringify(t.family)}, weight: ${t.weight}, size: ${t.size}, lineHeight: ${t.lineHeight} },\n`;
}
ts += `};\n`;

fs.writeFileSync(OUT_TS, ts);

console.log('Generated ' + path.relative(process.cwd(), OUT_CSS) + ' (' + css.split('\n').length + ' lines) and ' + path.relative(process.cwd(), OUT_TS));
