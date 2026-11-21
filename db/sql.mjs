// =====================================================================
// db/sql.mjs — roda SQL direto no Postgres do Supabase.
//
// Ferramenta de manutenção, fora do app. Não é importada por nada em
// src/ e não vai pro bundle.
//
//   node db/sql.mjs db/conferir-cartao.sql        # leitura (padrão)
//   node db/sql.mjs db/corrigir.sql --dry         # testa escrita e DESFAZ
//   node db/sql.mjs db/corrigir.sql --write       # grava de verdade
//   node db/sql.mjs -e "select count(*) from lancamentos"
//
// Os três modos, por segurança:
//   padrão  BEGIN; SET TRANSACTION READ ONLY; ...; ROLLBACK
//           um UPDATE/DELETE aqui falha com erro, não passa batido.
//   --dry   BEGIN; ...; ROLLBACK
//           roda a escrita, mostra quantas linhas cada comando tocaria,
//           e desfaz. É assim que se confere um lote antes de gravar.
//   --write BEGIN; ...; COMMIT
//           tudo ou nada: se um comando falhar, o lote inteiro volta.
//
// A connection string sai de DATABASE_URL no .env.local (que já está
// no .gitignore). O script nunca imprime a URL — só o host mascarado.
// =====================================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

// `date` (OID 1082) como texto puro. O parser padrão devolve um Date em
// hora local, que vira "2026-06-30T03:00:00Z" na tela — num app onde a
// data manda em tudo (princípio 2), isso confunde mais do que ajuda.
pg.types.setTypeParser(1082, (v) => v);

// fileURLToPath, não .pathname: o caminho deste projeto tem espaços
// ("My MacBook Pro"), que no URL viram %20 e quebram o readFileSync.
const RAIZ = fileURLToPath(new URL('..', import.meta.url));

function lerEnvLocal() {
  let texto;
  try {
    texto = readFileSync(RAIZ + '.env.local', 'utf8');
  } catch {
    return {};
  }
  const env = {};
  for (const linha of texto.split('\n')) {
    const corte = linha.indexOf('=');
    if (corte < 1 || linha.trim().startsWith('#')) continue;
    env[linha.slice(0, corte).trim()] = linha
      .slice(corte + 1)
      .trim()
      .replace(/^["']|["']$/g, '');
  }
  return env;
}

// Parse manual da URI. O `new URL()` tropeça em senha com @ : / ? # não
// escapados; aqui a senha é tudo entre o 1º ":" das credenciais e o
// ÚLTIMO "@", que é como a userinfo é delimitada na prática.
function partirUrl(url) {
  const corpo = url.slice(url.indexOf('//') + 2);
  const arroba = corpo.lastIndexOf('@');
  const cred = corpo.slice(0, arroba);
  const resto = corpo.slice(arroba + 1);
  const dois = cred.indexOf(':');
  return {
    user: dois < 0 ? cred : cred.slice(0, dois),
    password: dois < 0 ? undefined : cred.slice(dois + 1),
    host: resto.split(':')[0].split('/')[0],
    port: Number((resto.split(':')[1] || '5432').split('/')[0]),
    database: resto.split('/')[1] || 'postgres',
  };
}

function mascarar(url) {
  try {
    const u = new URL(url);
    return `${u.hostname}:${u.port || 5432}${u.pathname}`;
  } catch {
    return '(url ilegível)';
  }
}

function imprimir(res, i) {
  const cmd = res.command || '?';
  if (!res.rows || res.rows.length === 0) {
    console.log(`\n[${i + 1}] ${cmd} — ${res.rowCount ?? 0} linha(s)`);
    return;
  }
  console.log(`\n[${i + 1}] ${cmd} — ${res.rows.length} linha(s)`);
  // console.table trunca mal com texto longo; para 1 coluna só, imprime cru.
  const colunas = Object.keys(res.rows[0]);
  if (colunas.length === 1 && res.rows.length === 1) {
    console.log(res.rows[0][colunas[0]]);
  } else {
    console.table(res.rows);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const escrever = args.includes('--write');
  const dry = args.includes('--dry');
  const inline = args.indexOf('-e');
  const arquivo = args.find(
    (a, i) => !a.startsWith('-') && !(inline >= 0 && i === inline + 1)
  );

  let sql;
  if (inline >= 0) sql = args[inline + 1];
  else if (arquivo) sql = readFileSync(arquivo, 'utf8');
  else {
    console.error('uso: node db/sql.mjs <arquivo.sql | -e "SQL"> [--dry|--write]');
    process.exit(2);
  }

  const env = lerEnvLocal();
  const url = process.env.DATABASE_URL || env.DATABASE_URL;
  // Senha em linha separada: evita ter que percent-encodar @ : / ? # na URI.
  const senhaSolta = process.env.DATABASE_PASSWORD || env.DATABASE_PASSWORD;
  if (!url) {
    console.error(
      'Falta DATABASE_URL no .env.local.\n' +
        'Pegue em: Supabase → Connect → Session pooler (URI) e cole a linha:\n' +
        '  DATABASE_URL=postgresql://...'
    );
    process.exit(2);
  }

  const modo = escrever ? 'ESCRITA (commit)' : dry ? 'ensaio (rollback)' : 'leitura';
  console.log(`→ ${mascarar(url)}  ·  modo: ${modo}`);

  const ssl = { rejectUnauthorized: false };
  const client = new pg.Client(
    senhaSolta ? { ...partirUrl(url), password: senhaSolta, ssl } : { connectionString: url, ssl }
  );
  try {
    await client.connect();
  } catch (erro) {
    console.error(`\n✗ não conectou: ${erro.message}`);
    if (erro.code === '28P01') {
      console.error(
        '  (28P01 = senha recusada. Confira se o [YOUR-PASSWORD] foi trocado,\n' +
          '   e se a senha tem @ : / ? # — esses precisam ser escapados na URI.)'
      );
    }
    process.exitCode = 1;
    return;
  }
  try {
    await client.query('BEGIN');
    if (!escrever && !dry) await client.query('SET TRANSACTION READ ONLY');

    const res = await client.query(sql);
    const lista = Array.isArray(res) ? res : [res];
    lista.forEach(imprimir);

    if (escrever) {
      await client.query('COMMIT');
      console.log('\n✓ COMMIT — gravado.');
    } else {
      await client.query('ROLLBACK');
      console.log(`\n↩ ROLLBACK — nada foi gravado${dry ? ' (ensaio)' : ''}.`);
    }
  } catch (erro) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(`\n✗ ${erro.message}`);
    if (erro.position) console.error(`  posição ${erro.position}`);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
