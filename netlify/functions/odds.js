// Proxies The Odds API (https://the-odds-api.com) so the API key never reaches the browser.
// Two markets, fetched in parallel:
//   - soccer_fifa_world_cup            h2h moneyline on scheduled matches (real book odds — only exist once a fixture is on the calendar)
//   - soccer_fifa_world_cup_winner     outright "to win it all" futures (exist for every team all tournament long)
// Both responses are cached per warm container for CACHE_TTL_MS to stay well under the free-tier
// monthly request quota (500 req/mo) even with several browser tabs auto-refreshing.

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = { matches: null, matchesTs: 0, outrights: null, outrightsTs: 0 };

exports.handler = async function () {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
    'Cache-Control': 'public, max-age=120'
  };

  const apiKey = process.env.ODDS_API_KEY;
  if (!apiKey) {
    return { statusCode: 200, headers, body: JSON.stringify({ matches: [], outrights: [], error: 'no_api_key' }) };
  }

  const now = Date.now();
  const [matches, outrights] = await Promise.all([
    fetchWithCache('matches', `${ODDS_API_BASE}/sports/soccer_fifa_world_cup/odds/?regions=us,uk,eu&markets=h2h&oddsFormat=american&apiKey=${apiKey}`, now),
    fetchWithCache('outrights', `${ODDS_API_BASE}/sports/soccer_fifa_world_cup_winner/odds/?regions=us,uk,eu&markets=outrights&oddsFormat=american&apiKey=${apiKey}`, now)
  ]);

  return { statusCode: 200, headers, body: JSON.stringify({ matches, outrights }) };
};

async function fetchWithCache(key, url, now) {
  const tsKey = key + 'Ts';
  if (cache[key] && now - cache[tsKey] < CACHE_TTL_MS) return cache[key];
  try {
    const res = await fetch(url);
    if (!res.ok) return cache[key] || [];
    const data = await res.json();
    cache[key] = data;
    cache[tsKey] = now;
    return data;
  } catch {
    return cache[key] || [];
  }
}
