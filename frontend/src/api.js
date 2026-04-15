const API_BASE = 'https://prediction-service.icysmoke-a3c2bae4.westus2.azurecontainerapps.io';
const ODDS_API_KEY = '93b67ff6d302c9a4d1e012f5d77df18e';
const COINGECKO_KEY = 'CG-xsxMufs9nNheDMbXJ3vF3s8t';
const FRED_API_KEY = '810bf54b601a3f43496cfe1898100650';

const cache = {};
const CACHE_TTL = 60000;
function cached(key, fn) {
  const now = Date.now();
  if (cache[key] && now - cache[key].ts < CACHE_TTL) return Promise.resolve(cache[key].data);
  return fn().then(data => { cache[key] = { data, ts: now }; return data; });
}

// ── Real Data Fetchers ─────────────────────────────────────

async function fetchBitcoinProb() {
  return cached('btc', async () => {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_24hr_change=true`, { headers: { 'x-cg-demo-api-key': COINGECKO_KEY } });
    const data = await res.json();
    const price = data.bitcoin?.usd || 60000;
    const change24h = data.bitcoin?.usd_24h_change || 0;
    const prob = Math.min(95, Math.max(5, (price / 100000) * 80 + (change24h > 0 ? 5 : -5)));
    return { prob: Math.round(prob), price, change24h };
  });
}

async function fetchEthereumProb() {
  return cached('eth', async () => {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd&include_24hr_change=true`, { headers: { 'x-cg-demo-api-key': COINGECKO_KEY } });
    const data = await res.json();
    const price = data.ethereum?.usd || 3000;
    const change24h = data.ethereum?.usd_24h_change || 0;
    const prob = Math.min(95, Math.max(5, (price / 10000) * 80 + (change24h > 0 ? 5 : -5)));
    return { prob: Math.round(prob), price, change24h };
  });
}

async function fetchCryptoHistory(coinId) {
  return cached(`history_${coinId}`, async () => {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=1&interval=hourly`, { headers: { 'x-cg-demo-api-key': COINGECKO_KEY } });
    const data = await res.json();
    const prices = data.prices || [];
    if (prices.length < 2) return null;
    const min = Math.min(...prices.map(p => p[1]));
    const max = Math.max(...prices.map(p => p[1]));
    const range = max - min || 1;
    return prices.map(p => Math.round(((p[1] - min) / range) * 60 + 20));
  });
}

async function fetchFedRate() {
  return cached('fed_rate', async () => {
    const res = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=FEDFUNDS&api_key=${FRED_API_KEY}&file_type=json&limit=12&sort_order=desc`);
    const data = await res.json();
    const obs = data.observations || [];
    const latest = parseFloat(obs[0]?.value || 5.33);
    const prev = parseFloat(obs[3]?.value || 5.33);
    const prob = latest < prev ? 75 : latest === prev ? 45 : 25;
    return { prob, rate: latest, history: obs.slice(0,12).reverse().map(o => parseFloat(o.value||0)) };
  });
}

async function fetchInflation() {
  return cached('cpi', async () => {
    const res = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=CPIAUCSL&api_key=${FRED_API_KEY}&file_type=json&limit=13&sort_order=desc`);
    const data = await res.json();
    const obs = data.observations || [];
    const vals = obs.slice(0,13).map(o => parseFloat(o.value||300));
    const latest = vals[0], yearAgo = vals[12]||vals[vals.length-1];
    const yoyInflation = ((latest-yearAgo)/yearAgo)*100;
    const prob = Math.max(5, Math.min(95, 100-(yoyInflation/5)*80));
    return { prob: Math.round(prob), inflation: yoyInflation.toFixed(2), history: vals.reverse() };
  });
}

async function fetchGDP() {
  return cached('gdp', async () => {
    const res = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=A191RL1Q225SBEA&api_key=${FRED_API_KEY}&file_type=json&limit=8&sort_order=desc`);
    const data = await res.json();
    const obs = data.observations || [];
    const latest = parseFloat(obs[0]?.value||2.5);
    const prob = Math.max(5, Math.min(95, (latest/5)*80+10));
    return { prob: Math.round(prob), gdp: latest, history: obs.slice(0,8).reverse().map(o => parseFloat(o.value||0)) };
  });
}

async function fetchSP500() {
  return cached('sp500', async () => {
    const res = await fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=SP500&api_key=${FRED_API_KEY}&file_type=json&limit=30&sort_order=desc`);
    const data = await res.json();
    const obs = (data.observations||[]).filter(o => o.value !== '.');
    const vals = obs.slice(0,30).map(o => parseFloat(o.value));
    const latest = vals[0]||5000;
    const prob = Math.min(95, Math.max(5, (latest/7000)*90));
    return { prob: Math.round(prob), price: latest, history: vals.reverse() };
  });
}

async function fetchSportsOdds(sport='basketball_nba') {
  return cached(`odds_${sport}`, async () => {
    try {
      const res = await fetch(`https://api.the-odds-api.com/v4/sports/${sport}/odds/?apiKey=${ODDS_API_KEY}&regions=us&markets=h2h&oddsFormat=decimal&dateFormat=iso`);
      if (!res.ok) return [];
      const games = await res.json();
      return (Array.isArray(games) ? games : []).slice(0,5).map(game => {
        const outcomes = game.bookmakers?.[0]?.markets?.[0]?.outcomes||[];
        const home = outcomes.find(o => o.name===game.home_team);
        const away = outcomes.find(o => o.name===game.away_team);
        const homeOdds = home?.price||2.0, awayOdds = away?.price||2.0;
        const homeProb = Math.round((1/homeOdds)/((1/homeOdds)+(1/awayOdds))*100);
        return { id:`odds_${game.id}`, title:`Will ${game.home_team} beat ${game.away_team}?`, category:'Sports', deadline:game.commence_time, baseProb:homeProb, yesPercent:homeProb, currentProb:homeProb, isLive:true, source:'The Odds API' };
      });
    } catch(e) { return []; }
  });
}

async function fetchPolymarketEvents() {
  return cached('polymarket', async () => {
    try {
      const res = await fetch('https://gamma-api.polymarket.com/markets?limit=10&active=true&closed=false');
      if (!res.ok) return [];
      const data = await res.json();
      return data.slice(0,8).map(m => ({
        id:`poly_${m.id}`, title:m.question,
        category: m.tags?.includes?.('politics')?'Politics': m.tags?.includes?.('crypto')?'Crypto': m.tags?.includes?.('sports')?'Sports':'Elections',
        deadline: m.endDate||'2026-12-31',
        baseProb: Math.round(parseFloat(m.outcomePrices?.[0]||'0.5')*100),
        yesPercent: Math.round(parseFloat(m.outcomePrices?.[0]||'0.5')*100),
        currentProb: Math.round(parseFloat(m.outcomePrices?.[0]||'0.5')*100),
        isLive:true, source:'Polymarket'
      }));
    } catch(e) { return []; }
  });
}

function normalizeToChart(values) {
  if (!values||values.length<2) return null;
  const min = Math.min(...values), max = Math.max(...values), range = max-min||1;
  return values.map(v => Math.round(((v-min)/range)*60+20));
}

// ── Real probability resolver ──────────────────────────────
// This is called BOTH when cards load AND when modal opens
export async function getRealProbability(event) {
  try {
    const title = event.title.toLowerCase();
    if (title.includes('bitcoin')||title.includes('btc $100k')||title.includes('$100k')) {
      const d = await fetchBitcoinProb();
      const h = await fetchCryptoHistory('bitcoin');
      return { prob:d.prob, history:h, label:`BTC $${d.price?.toLocaleString()}`, change:d.change24h };
    }
    if (title.includes('ethereum')||title.includes('eth')||title.includes('$10k')) {
      const d = await fetchEthereumProb();
      const h = await fetchCryptoHistory('ethereum');
      return { prob:d.prob, history:h, label:`ETH $${d.price?.toLocaleString()}`, change:d.change24h };
    }
    if (title.includes('bitcoin')||title.includes('$150k')) {
      const d = await fetchBitcoinProb();
      const h = await fetchCryptoHistory('bitcoin');
      return { prob:d.prob, history:h, label:`BTC $${d.price?.toLocaleString()}`, change:d.change24h };
    }
    if (title.includes('solana')||title.includes('sol etf')) {
      const d = await fetchBitcoinProb();
      return { prob: Math.min(95, Math.max(5, d.prob - 10)), history:null, label:`Crypto market sentiment`, change:d.change24h };
    }
    if (title.includes('fed')||title.includes('rate cut')||title.includes('interest rate')) {
      const d = await fetchFedRate();
      return { prob:d.prob, history:normalizeToChart(d.history), label:`Fed Rate: ${d.rate}%`, change:null };
    }
    if (title.includes('inflation')||title.includes('cpi')) {
      const d = await fetchInflation();
      return { prob:d.prob, history:normalizeToChart(d.history), label:`YoY Inflation: ${d.inflation}%`, change:null };
    }
    if (title.includes('gdp')||title.includes('recession')||title.includes('economic growth')) {
      const d = await fetchGDP();
      return { prob:d.prob, history:normalizeToChart(d.history), label:`GDP Growth: ${d.gdp}%`, change:null };
    }
    if (title.includes('s&p')||title.includes('sp500')||title.includes('7000')) {
      const d = await fetchSP500();
      return { prob:d.prob, history:normalizeToChart(d.history), label:`S&P 500: ${d.price?.toLocaleString()}`, change:null };
    }
    if (title.includes('gold')||title.includes('$3500')) {
      const d = await fetchSP500();
      return { prob: Math.min(95, Math.max(5, d.prob - 5)), history:normalizeToChart(d.history), label:`Financial market data`, change:null };
    }
    return null;
  } catch(e) { console.error('Real data fetch failed:', e); return null; }
}

// ── Enrich all events with real probabilities on load ──────
// Called once when app loads — fetches real data for matching events
export async function enrichEventsWithRealData(events) {
  // Fetch all real data in parallel (not one by one — much faster!)
  const [btcData, ethData, fedData, gdpData, sp500Data] = await Promise.allSettled([
    fetchBitcoinProb(),
    fetchEthereumProb(),
    fetchFedRate(),
    fetchGDP(),
    fetchSP500()
  ]);

  const btc = btcData.status === 'fulfilled' ? btcData.value : null;
  const eth = ethData.status === 'fulfilled' ? ethData.value : null;
  const fed = fedData.status === 'fulfilled' ? fedData.value : null;
  const gdp = gdpData.status === 'fulfilled' ? gdpData.value : null;
  const sp500 = sp500Data.status === 'fulfilled' ? sp500Data.value : null;

  return events.map(event => {
    const title = event.title.toLowerCase();
    let realProb = null;
    let dataSource = null;

    if ((title.includes('bitcoin')||title.includes('$100k')||title.includes('$150k')) && btc) {
      realProb = btc.prob;
      dataSource = `BTC $${btc.price?.toLocaleString()}`;
    } else if ((title.includes('ethereum')||title.includes('eth')||title.includes('$10k')) && eth) {
      realProb = eth.prob;
      dataSource = `ETH $${eth.price?.toLocaleString()}`;
    } else if (title.includes('solana') && btc) {
      realProb = Math.min(95, Math.max(5, btc.prob - 10));
      dataSource = 'Crypto sentiment';
    } else if ((title.includes('fed')||title.includes('rate cut')||title.includes('interest')) && fed) {
      realProb = fed.prob;
      dataSource = `Fed Rate: ${fed.rate}%`;
    } else if ((title.includes('gdp')||title.includes('recession')) && gdp) {
      realProb = gdp.prob;
      dataSource = `GDP: ${gdp.gdp}%`;
    } else if ((title.includes('s&p')||title.includes('sp500')||title.includes('7000')) && sp500) {
      realProb = sp500.prob;
      dataSource = `S&P: ${sp500.price?.toLocaleString()}`;
    } else if (title.includes('gold') && sp500) {
      realProb = Math.min(95, Math.max(5, sp500.prob - 5));
      dataSource = 'Financial data';
    } else if ((title.includes('inflation')||title.includes('cpi')) && fed) {
      realProb = Math.max(5, Math.min(95, 100 - fed.rate * 15));
      dataSource = `Fed Rate: ${fed.rate}%`;
    }

    if (realProb !== null) {
      return {
        ...event,
        currentProb: realProb,
        yesPercent: realProb,
        dataSource,
        hasRealData: true
      };
    }
    return event;
  });
}

export const api = {
  getEvents: async () => {
    try {
      const [dbRes, oddsRes, polyRes] = await Promise.allSettled([
        fetch(`${API_BASE}/events`).then(r=>r.json()),
        fetchSportsOdds('basketball_nba'),
        fetchPolymarketEvents()
      ]);
      const dbEvents = dbRes.status==='fulfilled' ? (dbRes.value.events||[]) : [];
      const liveOdds = oddsRes.status==='fulfilled' && oddsRes.value ? oddsRes.value : [];
      const liveMarkets = polyRes.status==='fulfilled' ? polyRes.value : [];
      return [...dbEvents, ...liveOdds, ...liveMarkets].map(e => ({
        ...e, yesPercent:e.yesPercent||e.baseProb||50, currentProb:e.yesPercent||e.baseProb||50
      }));
    } catch(e) { console.error('Failed to fetch events:', e); return []; }
  },

  getRealData: getRealProbability,
  enrichEvents: enrichEventsWithRealData,

  makePrediction: async (userId, eventId, predictedValue, prediction, category, deadline) => {
    try {
      const response = await fetch(`${API_BASE}/predictions`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ userId, eventId:eventId||"event_001", prediction:prediction||eventId, category:category||"General", confidence:predictedValue*100, deadline:deadline||"2026-12-31" })
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch(e) { console.error('Failed to save prediction:', e.message); throw e; }
  },

  getLeaderboard: async () => {
    try {
      const response = await fetch('https://leaderboard-service.icysmoke-a3c2bae4.westus2.azurecontainerapps.io/leaderboard');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return (data.leaderboard||[]).map(p => ({ playerName:p.userId, score:p.avgBrierScore }));
    } catch(e) { console.error('Failed to fetch leaderboard:', e.message); return []; }
  }
};