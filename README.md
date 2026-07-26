# 💰 Continha

> os gastos da casa, sem complicação

App moderno para registrar os gastos domésticos. Front-end em HTML/CSS/JS puro, com API em **Cloudflare Workers** e banco **Neon Postgres** — os dados ficam na nuvem e sincronizam entre celular e computador. Funciona offline (cache no navegador) e sincroniza quando volta a conexão.

## ✨ Recursos

- ➕ Registro de gastos com descrição, valor, data e categoria
- 🏷️ 8 categorias visuais (Mercado, Contas, Moradia, Transporte, Saúde, Lazer, Comida, Outros)
- 📊 Resumo do mês: total, número de lançamentos e média por dia
- 📈 Gráfico de gastos por categoria (valor e %)
- 🗓️ Filtro por mês, navegação por sidebar
- ☁️ Dados na nuvem (Neon Postgres) com fallback offline
- 📱 Layout responsivo (celular e computador)
- 🌙 Visual moderno em tema escuro

## 🏗️ Arquitetura

```
Navegador (public/index.html)  ──►  Worker /api/*  (src/index.js)  ──►  Neon Postgres
```

O Worker também serve o app estático (pasta `public/`). A senha do banco fica só no
**secret** `DATABASE_URL` — nunca no código nem no repositório.

## 🚀 Rodar e publicar

Pré-requisitos: Node 18+ e uma conta Cloudflare (grátis).

```bash
# 1. Instalar dependências
npm install

# 2. Criar as tabelas no banco (uma vez)
DATABASE_URL="postgres://...seu-neon..." npm run db:schema

# 3. Rodar local (crie um arquivo .dev.vars com DATABASE_URL="...")
npm run dev            # http://localhost:8787

# 4. Publicar na Cloudflare
npx wrangler login             # login no navegador (interativo)
npx wrangler secret put DATABASE_URL   # cola a string de conexão do Neon
npm run deploy
```

## 🔌 API

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET`    | `/api/expenses?month=YYYY-MM` | Lista os gastos do mês |
| `POST`   | `/api/expenses`               | Cria um gasto `{desc, value, date, cat}` |
| `DELETE` | `/api/expenses/:id`           | Remove um gasto |

## 🛠️ Tecnologia

HTML, CSS e JS puro no front · Cloudflare Workers + `@neondatabase/serverless` no back · Neon Postgres.
