// Kutipan IDX publik tanpa API key.
//
// Saham: TradingView scanner `IDX:<KODE>` kolom `close` = harga terakhir bar
// berjalan (bukan penutupan kemarin). Dicek 6 Nov 2026 ~10:23 WIB untuk TLKM:
// close 1.935, sama dengan Yahoo `regularMarketPrice`, sementara previous close 1.990.
//
// IHSG: scanner `IDX:COMPOSITE` lebih baru daripada Yahoo `^JKSE` pada sesi yang sama
// (10:25 WIB → 4.941 vs Yahoo 10:16 WIB → 4.935; previous close keduanya 5.030).
// `update_mode` sering `delayed_streaming_600` (kutipan publik ±10 menit dari bursa).
// Fallback Yahoo memakai `regularMarketPrice`, baru close intraday, baru previous close.

export type PriceField = 'close' | 'regularMarketPrice' | 'intradayClose' | 'previousClose';

export type IdxQuote = {
  symbol: string;
  price: number;
  priceField: PriceField;
  currency: string;
  source: string;
  previousClose: number | null;
  /** Perubahan absolut vs penutupan sebelumnya. */
  change: number | null;
  /** Perubahan dalam persen. */
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  perfWeek: number | null;
  perfMonth: number | null;
  perfYtd: number | null;
  /** Unix detik dari sumber (TradingView last_bar_update_time atau Yahoo regularMarketTime). */
  quoteTime: number | null;
  delayed: boolean;
  delaySeconds: number | null;
  name: string | null;
  fallbackFrom?: string;
};

const TV_URL = 'https://scanner.tradingview.com/indonesia/scan';
const COLUMNS = [
  'close',
  'open',
  'high',
  'low',
  'volume',
  'change',
  'change_abs',
  'Perf.W',
  'Perf.1M',
  'Perf.YTD',
  'currency',
  'last_bar_update_time',
  'update_mode',
  'description',
  'name',
] as const;

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function col(row: unknown[], name: (typeof COLUMNS)[number]): unknown {
  return row[COLUMNS.indexOf(name)];
}

function parseDelay(updateMode: unknown): { delayed: boolean; delaySeconds: number | null } {
  const s = typeof updateMode === 'string' ? updateMode : '';
  const m = /delayed_streaming_(\d+)/.exec(s);
  if (m) return { delayed: true, delaySeconds: Number(m[1]) };
  if (s.includes('delayed')) return { delayed: true, delaySeconds: null };
  return { delayed: false, delaySeconds: null };
}

function tickerFromTv(symbol: string): string {
  const i = symbol.lastIndexOf(':');
  return (i >= 0 ? symbol.slice(i + 1) : symbol).toUpperCase();
}

function quoteFromTv(ticker: string, row: unknown[]): IdxQuote {
  const close = num(col(row, 'close'));
  if (close == null || close <= 0) throw new Error('Tidak ada harga terakhir');
  const changeAbs = num(col(row, 'change_abs'));
  const currencyRaw = col(row, 'currency');
  const description = col(row, 'description');
  const delay = parseDelay(col(row, 'update_mode'));
  return {
    symbol: ticker,
    price: close,
    priceField: 'close',
    currency: typeof currencyRaw === 'string' && currencyRaw ? currencyRaw : 'IDR',
    source: 'tradingview-scanner',
    previousClose: changeAbs != null ? close - changeAbs : null,
    change: changeAbs,
    changePercent: num(col(row, 'change')),
    open: num(col(row, 'open')),
    high: num(col(row, 'high')),
    low: num(col(row, 'low')),
    volume: num(col(row, 'volume')),
    perfWeek: num(col(row, 'Perf.W')),
    perfMonth: num(col(row, 'Perf.1M')),
    perfYtd: num(col(row, 'Perf.YTD')),
    quoteTime: num(col(row, 'last_bar_update_time')),
    name: typeof description === 'string' ? description : null,
    ...delay,
  };
}

async function fetchTradingView(tickers: string[]): Promise<Map<string, IdxQuote>> {
  const map = new Map<string, IdxQuote>();
  if (tickers.length === 0) return map;
  const res = await fetch(TV_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': UA,
    },
    body: JSON.stringify({
      symbols: { tickers: tickers.map((t) => `IDX:${t}`), query: { types: [] } },
      columns: COLUMNS,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`TradingView ${res.status}`);
  const json = (await res.json()) as { data?: { s?: string; d?: unknown[] }[] };
  for (const row of json.data ?? []) {
    if (!row?.s || !row.d) continue;
    const ticker = tickerFromTv(row.s);
    try {
      map.set(ticker, quoteFromTv(ticker, row.d));
    } catch {
      // baris tanpa close diabaikan — pemanggil jatuh ke Yahoo
    }
  }
  return map;
}

function lastIntraday(closes: (number | null)[] | undefined): number | null {
  if (!closes) return null;
  for (let i = closes.length - 1; i >= 0; i--) {
    const v = closes[i];
    if (v != null && Number.isFinite(v) && v > 0) return v;
  }
  return null;
}

async function fetchYahooHost(host: string, yahooSymbol: string): Promise<IdxQuote> {
  const url = `https://${host}/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1m&range=1d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
    },
    cache: 'no-store',
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Yahoo ${host} ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const meta = result?.meta;
  const closes = result?.indicators?.quote?.[0]?.close as (number | null)[] | undefined;
  const live = num(meta?.regularMarketPrice);
  const intra = lastIntraday(closes);
  const prev = num(meta?.previousClose) ?? num(meta?.chartPreviousClose);
  let price: number;
  let priceField: PriceField;
  if (live != null && live > 0) {
    price = live;
    priceField = 'regularMarketPrice';
  } else if (intra != null) {
    price = intra;
    priceField = 'intradayClose';
  } else if (prev != null && prev > 0) {
    price = prev;
    priceField = 'previousClose';
  } else {
    throw new Error('Tidak ada harga di Yahoo');
  }
  const changePct = num(meta?.regularMarketChangePercent);
  const changeAbs =
    num(meta?.regularMarketChange) ?? (prev != null ? price - prev : null);
  return {
    symbol: yahooSymbol,
    price,
    priceField,
    currency: typeof meta?.currency === 'string' ? meta.currency : 'IDR',
    source: host,
    previousClose: prev,
    change: changeAbs,
    changePercent: changePct,
    open: num(meta?.regularMarketOpen),
    high: num(meta?.regularMarketDayHigh),
    low: num(meta?.regularMarketDayLow),
    volume: num(meta?.regularMarketVolume),
    perfWeek: null,
    perfMonth: null,
    perfYtd: null,
    quoteTime: num(meta?.regularMarketTime),
    delayed: false,
    delaySeconds: null,
    name: null,
  };
}

async function fetchYahoo(yahooSymbol: string): Promise<IdxQuote> {
  let last = 'Yahoo gagal';
  for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
    try {
      return await fetchYahooHost(host, yahooSymbol);
    } catch (err) {
      last = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(last);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeTickers(raw: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const symbol = item.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
    if (!symbol || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push(symbol);
    if (out.length >= 40) break;
  }
  return out;
}

/** Satu panggilan TradingView untuk semua kode, Yahoo hanya untuk yang gagal. */
export async function fetchStockQuotes(tickers: string[]): Promise<{
  quotes: IdxQuote[];
  errors: { symbol: string; error: string }[];
}> {
  const wanted = normalizeTickers(tickers);
  const quotes: IdxQuote[] = [];
  const errors: { symbol: string; error: string }[] = [];
  let tvError = '';
  let tv = new Map<string, IdxQuote>();
  try {
    tv = await fetchTradingView(wanted);
  } catch (err) {
    tvError = err instanceof Error ? err.message : String(err);
  }

  let yahooCalls = 0;
  for (const ticker of wanted) {
    const hit = tv.get(ticker);
    if (hit) {
      quotes.push({ ...hit, symbol: ticker });
      continue;
    }
    try {
      if (yahooCalls > 0) await sleep(150);
      yahooCalls += 1;
      const y = await fetchYahoo(`${ticker}.JK`);
      quotes.push({
        ...y,
        symbol: ticker,
        fallbackFrom: tvError || 'Tidak ada di TradingView',
      });
    } catch (err) {
      errors.push({
        symbol: ticker,
        error: err instanceof Error ? err.message : 'Gagal mengambil harga',
      });
    }
  }
  return { quotes, errors };
}

export type IhsgQuote = IdxQuote & {
  symbol: 'IHSG';
  tradingViewSymbol: 'IDX:COMPOSITE';
  yahooSymbol: '^JKSE';
};

/** IHSG: TradingView IDX:COMPOSITE dulu (lebih segar + OHLC & kinerja), Yahoo ^JKSE jika gagal. */
export async function fetchIhsg(): Promise<IhsgQuote> {
  let tvError = '';
  try {
    const tv = await fetchTradingView(['COMPOSITE']);
    const hit = tv.get('COMPOSITE');
    if (hit) {
      return {
        ...hit,
        symbol: 'IHSG',
        tradingViewSymbol: 'IDX:COMPOSITE',
        yahooSymbol: '^JKSE',
        name: hit.name || 'IDX Composite',
      };
    }
    tvError = 'IDX:COMPOSITE kosong';
  } catch (err) {
    tvError = err instanceof Error ? err.message : String(err);
  }

  const y = await fetchYahoo('^JKSE');
  const previous = y.previousClose;
  const change = y.change ?? (previous != null ? y.price - previous : null);
  return {
    ...y,
    symbol: 'IHSG',
    tradingViewSymbol: 'IDX:COMPOSITE',
    yahooSymbol: '^JKSE',
    name: 'IDX Composite',
    change,
    fallbackFrom: tvError,
  };
}
