import { neon } from '@neondatabase/serverless';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const CATEGORIES = ['mercado', 'contas', 'moradia', 'transporte', 'saude', 'lazer', 'comida', 'outros'];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ---- API ----
    if (path.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url, path);
      } catch (err) {
        return json({ error: 'Erro interno', detail: String(err?.message || err) }, 500);
      }
    }

    // ---- App estatico ----
    return env.ASSETS.fetch(request);
  },
};

async function handleApi(request, env, url, path) {
  if (!env.DATABASE_URL) {
    return json({ error: 'DATABASE_URL nao configurada (rode: wrangler secret put DATABASE_URL)' }, 500);
  }
  const sql = neon(env.DATABASE_URL);
  const method = request.method;

  // GET /api/expenses?month=YYYY-MM  -> lista
  if (path === '/api/expenses' && method === 'GET') {
    const month = url.searchParams.get('month'); // "YYYY-MM"
    let rows;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const start = `${month}-01`;
      rows = await sql`
        select id, description, amount, spent_on, category, settled
        from expenses
        where spent_on >= ${start}::date
          and spent_on < (${start}::date + interval '1 month')
        order by spent_on desc, id desc`;
    } else {
      rows = await sql`
        select id, description, amount, spent_on, category, settled
        from expenses order by spent_on desc, id desc`;
    }
    return json(rows.map(toClient));
  }

  // POST /api/expenses  -> cria
  if (path === '/api/expenses' && method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const desc = String(body.desc || '').trim();
    const value = Number(body.value);
    const date = String(body.date || '');
    const cat = CATEGORIES.includes(body.cat) ? body.cat : 'outros';

    if (!desc) return json({ error: 'Descricao obrigatoria' }, 400);
    if (!(value > 0)) return json({ error: 'Valor invalido' }, 400);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'Data invalida' }, 400);

    const [row] = await sql`
      insert into expenses (description, amount, spent_on, category)
      values (${desc}, ${value}, ${date}::date, ${cat})
      returning id, description, amount, spent_on, category, settled`;
    return json(toClient(row), 201);
  }

  // PATCH /api/expenses/:id  -> dar/tirar baixa (pago)
  const patch = path.match(/^\/api\/expenses\/(\d+)$/);
  if (patch && method === 'PATCH') {
    const id = Number(patch[1]);
    const body = await request.json().catch(() => ({}));
    const settled = Boolean(body.settled);
    const [row] = await sql`
      update expenses set settled = ${settled} where id = ${id}
      returning id, description, amount, spent_on, category, settled`;
    if (!row) return json({ error: 'Gasto nao encontrado' }, 404);
    return json(toClient(row));
  }

  // DELETE /api/expenses/:id
  const del = path.match(/^\/api\/expenses\/(\d+)$/);
  if (del && method === 'DELETE') {
    const id = Number(del[1]);
    await sql`delete from expenses where id = ${id}`;
    return json({ ok: true });
  }

  return json({ error: 'Rota nao encontrada' }, 404);
}

function toClient(row) {
  return {
    id: Number(row.id),
    desc: row.description,
    value: Number(row.amount),
    // spent_on pode vir como Date ou string; normaliza para YYYY-MM-DD
    date: typeof row.spent_on === 'string' ? row.spent_on.slice(0, 10) : new Date(row.spent_on).toISOString().slice(0, 10),
    cat: row.category,
    settled: Boolean(row.settled),
  };
}
