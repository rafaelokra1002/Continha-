// Aplica o schema.sql no banco Neon.
// Uso:  DATABASE_URL="postgres://..." node scripts/apply-schema.mjs
import { Client } from '@neondatabase/serverless';
import { readFile } from 'node:fs/promises';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Defina DATABASE_URL no ambiente antes de rodar.');
  process.exit(1);
}

const schema = await readFile(new URL('../schema.sql', import.meta.url), 'utf8');

const client = new Client(url);
await client.connect();
await client.query(schema); // roda todos os statements de uma vez
await client.end();

console.log('Schema aplicado com sucesso ✅');
