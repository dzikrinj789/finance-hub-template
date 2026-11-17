import { NextRequest, NextResponse } from 'next/server';
import { fetchStockQuotes, normalizeTickers, type IdxQuote } from '@/lib/idx-market';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

const headers = { 'Cache-Control': 'no-store, no-cache, must-revalidate' };

function toResponse(q: IdxQuote) {
  return {
    symbol: q.symbol,
    yahooSymbol: `${q.symbol}.JK`,
    tradingViewSymbol: `IDX:${q.symbol}`,
    price: q.price,
    currency: q.currency,
    source: q.source,
    priceField: q.priceField,
    // Field lama: `change` = persen (kolom TradingView "change"), `changeAbs` = poin/rupiah.
    change: q.changePercent,
    changeAbs: q.change,
    changePercent: q.changePercent,
    previousClose: q.previousClose,
    open: q.open,
    high: q.high,
    low: q.low,
    volume: q.volume,
    regularMarketTime: q.quoteTime,
    quoteTime: q.quoteTime,
    delayed: q.delayed,
    delaySeconds: q.delaySeconds,
    ...(q.fallbackFrom ? { fallbackFrom: q.fallbackFrom } : {}),
  };
}

/**
 * GET /api/stock-price?symbol=TLKM
 * GET /api/stock-price?symbols=TLKM,BBCA
 *
 * Harga terakhir IDX. Utama: TradingView `close` (harga bar berjalan, bukan penutupan kemarin).
 * Cadangan: Yahoo `.JK` — `regularMarketPrice`, lalu close 1 menit, baru previous close.
 * Banyak kode diambil dalam satu permintaan scanner, lalu Yahoo hanya untuk yang gagal.
 */
export async function GET(req: NextRequest) {
  const many = req.nextUrl.searchParams.get('symbols');
  const one = req.nextUrl.searchParams.get('symbol');

  if (many != null) {
    const symbols = normalizeTickers(many.split(','));
    if (symbols.length === 0) {
      return NextResponse.json(
        { error: 'symbols required, e.g. ?symbols=TLKM,BBCA' },
        { status: 400, headers }
      );
    }
    try {
      const { quotes, errors } = await fetchStockQuotes(symbols);
      return NextResponse.json(
        { quotes: quotes.map(toResponse), errors },
        { headers }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal fetch harga';
      return NextResponse.json({ error: msg, quotes: [], errors: [] }, { status: 500, headers });
    }
  }

  const symbols = normalizeTickers(one ? [one] : []);
  if (symbols.length === 0) {
    return NextResponse.json({ error: 'symbol required, e.g. ?symbol=TLKM' }, { status: 400, headers });
  }
  const symbol = symbols[0];
  try {
    const { quotes, errors } = await fetchStockQuotes([symbol]);
    const quote = quotes[0];
    if (!quote) {
      return NextResponse.json(
        { error: errors[0]?.error || 'Gagal fetch harga', symbol, yahooSymbol: `${symbol}.JK` },
        { status: 500, headers }
      );
    }
    return NextResponse.json(toResponse(quote), { headers });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Gagal fetch harga';
    return NextResponse.json(
      { error: msg, symbol, yahooSymbol: `${symbol}.JK` },
      { status: 500, headers }
    );
  }
}
