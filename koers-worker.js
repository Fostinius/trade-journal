// Cloudflare Worker "koers" — live koersen + dagslotkoersen via Yahoo Finance
//
// Gebruik:
//   ?symbol=AAPL            → { price, currency, high52, low52 }
//   ?symbol=AAPL&history=1  → idem + closes: [ ... ±2 jaar dagelijkse slotkoersen ... ]
//
// Installeren: Cloudflare dashboard → Workers & Pages → koers → Edit code →
// alles vervangen door dit bestand → Deploy.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

function json(body, status = 200, maxAge = 60) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": `public, max-age=${maxAge}` },
  });
}

async function yahooChart(symbol, range) {
  const path = `/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&includePrePost=false`;
  for (const host of ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"]) {
    try {
      const r = await fetch(host + path, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", Accept: "application/json" },
        cf: { cacheTtl: range === "5d" ? 60 : 900, cacheEverything: true },
      });
      if (!r.ok) continue;
      const d = await r.json();
      const res = d?.chart?.result?.[0];
      if (res) return res;
    } catch (_) {}
  }
  return null;
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    const url = new URL(request.url);
    const symbol = (url.searchParams.get("symbol") || "").trim();
    const history = url.searchParams.get("history") === "1";
    if (!symbol) return json({ error: "symbol ontbreekt" }, 400);

    const res = await yahooChart(symbol, history ? "2y" : "5d");
    if (!res) return json({ error: `Geen data voor ${symbol}` }, 404, 30);

    const m = res.meta || {};
    const rawCloses = res.indicators?.quote?.[0]?.close || [];
    const closes = rawCloses.filter(v => typeof v === "number" && isFinite(v));
    const price = m.regularMarketPrice ?? closes[closes.length - 1] ?? null;
    if (!price) return json({ error: `Geen koers voor ${symbol}` }, 404, 30);

    const out = {
      symbol: m.symbol || symbol,
      price,
      currency: m.currency || null,
      high52: m.fiftyTwoWeekHigh ?? null,
      low52: m.fiftyTwoWeekLow ?? null,
    };
    if (history) {
      // Laatste (lopende) dag bijwerken met de actuele koers, zoals de daggrafiek in TradingView
      if (closes.length && m.regularMarketPrice) closes[closes.length - 1] = m.regularMarketPrice;
      out.closes = closes.map(v => Math.round(v * 10000) / 10000);
      const ts = res.timestamp || [];
      out.lastDate = ts.length ? new Date(ts[ts.length - 1] * 1000).toISOString().slice(0, 10) : null;
    }
    return json(out, 200, history ? 900 : 60);
  },
};
