# Finance Hub

Personal finance dashboard: accounts, cashflow, targets, a Money Lover spreadsheet importer, Indonesia stock prices (IHSG), a daily cashflow chart, and a balance-hiding toggle. The interface is in Indonesian. Glass cards, light and dark themes.

Each signed-in user only sees their own rows. A new account starts empty: add an account in **Setup & Importer**, then record a transaction.

This template does not include sample transactions, personal names, or a hosted database. You connect your own [Supabase](https://supabase.com) project.

## 1. Create a Supabase project

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard).
2. Open **SQL Editor** and run the full script in [`supabase/schema.sql`](supabase/schema.sql). The same script is copied at [`supabase/migrations/20261116120000_init_finance.sql`](supabase/migrations/20261116120000_init_finance.sql) if you use the Supabase CLI.
3. In **Authentication → Providers**, keep Email enabled.
4. For a quicker local trial, turn off **Confirm email** under **Authentication → Sign In / Providers → Email**. If you leave confirmation on, open the signup email before the dashboard will load.
5. Copy the project URL and the **anon** (publishable) key from **Project Settings → API**. Do not use the `service_role` key in this app.

The script creates `transactions`, `recovery_items`, `assets`, `stock_holdings`, and `stock_holdings_meta`. Row Level Security is on. Policies allow `select`, `insert`, `update`, and `delete` only when `user_id` equals `auth.uid()`. The anon key alone cannot read those tables.

## 2. Configure env vars

```bash
cp .env.example .env.local
```

Set:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Leave the placeholders in `.env.example` unchanged. `.env.local` is gitignored.

## 3. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), create an account, then:

1. **Setup & Importer** → add an account (for example Cash or your bank) and a starting balance.
2. **Catat Transaksi** to record income or spending. Cashflow, the dashboard chart, and net worth update from that data.
3. **Target & Recovery** to add a goal.
4. Optional: import a Money Lover `.xlsx` export from Setup. A blank example file downloads from that screen. Wallet names in the file should match the account names you created.

`NEXT_PUBLIC_UI_PREVIEW=1` (development only) skips login and shows the empty dashboard without calling Supabase. Do not set it in production.

## 4. Deploy on Vercel

1. Import the repository on [Vercel](https://vercel.com/new).
2. Add the same two environment variables for Production and Preview.
3. Deploy. In Supabase **Authentication → URL configuration**, add your Vercel URL to **Site URL** and **Redirect URLs** so password reset (`/update-password`) returns to the app.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |

## Notes

- Stock quotes and IHSG use public market endpoints. Gold balances marked as gold use a public Antam buyback quote. Both need outbound network access from the deployment.
- Theme and the hidden-balance toggle stay in the browser. Financial rows stay in Supabase.
- There is no seeded data. Reset in Setup clears only the signed-in user's rows.
