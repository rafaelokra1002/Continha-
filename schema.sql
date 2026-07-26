-- Continha — estrutura do banco (Neon Postgres)

create table if not exists expenses (
  id          bigint generated always as identity primary key,
  description text        not null,
  amount      numeric(12,2) not null check (amount > 0),
  spent_on    date        not null,
  category    text        not null,
  created_at  timestamptz not null default now()
);

-- Consultas por mes usam o intervalo de datas
create index if not exists idx_expenses_spent_on on expenses (spent_on);
