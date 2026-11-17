-- ============================================================
-- Finance Hub — schema
-- Run the whole script once in: Supabase Dashboard → SQL Editor → Run
-- No seed rows. Each signed-in user only sees their own rows.
-- ============================================================

-- ---------- TABLES ----------
create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date text not null,
  amount numeric not null default 0,
  category_name text,
  type text,
  wallet_name text,
  note text,
  is_exclude_report boolean not null default false,
  target_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.recovery_items (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text,
  category text,
  target_amount numeric not null default 0,
  recovered_amount numeric not null default 0,
  status text,
  due_date text,
  notes text,
  updated_at text,
  created_at timestamptz not null default now()
);

create table if not exists public.assets (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text,
  display_name text,
  category text,
  sub_category text,
  value numeric not null default 0,
  details text,
  is_gold boolean not null default false,
  gold_qty_gr numeric,
  price_per_gram numeric,
  created_at timestamptz not null default now()
);

create table if not exists public.stock_holdings (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ticker text,
  company_name text,
  lots numeric,
  buy_price numeric,
  market_price numeric,
  category text,
  strategy text,
  realized_profit numeric,
  last_updated text,
  created_at timestamptz not null default now()
);

-- One realized-profit row per user. id is the auth user id.
create table if not exists public.stock_holdings_meta (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  total_realized_profit numeric not null default 0
);

create index if not exists transactions_user_id_idx on public.transactions (user_id);
create index if not exists recovery_items_user_id_idx on public.recovery_items (user_id);
create index if not exists assets_user_id_idx on public.assets (user_id);
create index if not exists stock_holdings_user_id_idx on public.stock_holdings (user_id);
create unique index if not exists stock_holdings_meta_user_id_idx on public.stock_holdings_meta (user_id);

-- ---------- ROW LEVEL SECURITY ----------
-- The browser uses the signed-in user's JWT. anon has no policies, so the
-- publishable key alone cannot read or write these tables.

do $$
declare
  tables text[] := array[
    'transactions',
    'recovery_items',
    'assets',
    'stock_holdings',
    'stock_holdings_meta'
  ];
  t text;
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon', t);
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);

    execute format('drop policy if exists select_own on public.%I', t);
    execute format('drop policy if exists insert_own on public.%I', t);
    execute format('drop policy if exists update_own on public.%I', t);
    execute format('drop policy if exists delete_own on public.%I', t);

    execute format(
      'create policy select_own on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t
    );
    execute format(
      'create policy insert_own on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
      t
    );
    execute format(
      'create policy update_own on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
    execute format(
      'create policy delete_own on public.%I for delete to authenticated using (user_id = (select auth.uid()))',
      t
    );
  end loop;
end $$;

-- ---------- REALTIME ----------
-- Lets a second tab pick up inserts/updates/deletes without a refresh.
do $$
declare
  tables text[] := array[
    'transactions',
    'recovery_items',
    'assets',
    'stock_holdings',
    'stock_holdings_meta'
  ];
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array tables loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null;
    end;
    execute format('alter table public.%I replica identity full', t);
  end loop;
end $$;

notify pgrst, 'reload schema';
