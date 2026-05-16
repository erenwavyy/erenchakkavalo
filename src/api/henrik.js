// src/api/henrik.js
// Free Valorant match data — no key required for basic usage
// Docs: https://docs.henrikdev.xyz

const axios = require("axios");
const logger = require("../../utils/logger");

const BASE = "https://api.henrikdev.xyz/valorant";
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

async function fetchLatestMatch(region, name, tag) {
  const url = `${BASE}/v3/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?size=1`;
  return withRetry(() => get(url), "fetchLatestMatch");
}

async function get(url) {
  const res = await axios.get(url, {
    timeout: 12000,
    headers: {
      "User-Agent": "valorant-discord-bot/2.0",
    },
  });

  if (res.data?.status !== 200 && res.data?.errors) {
    throw new Error(`Henrik API error: ${JSON.stringify(res.data.errors)}`);
  }

  return res.data?.data?.[0] ?? res.data?.data ?? null;
}

async function withRetry(fn, label) {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === RETRY_ATTEMPTS;
      if (isLast) throw err;
      logger.warn(`[Henrik] ${label} attempt ${attempt} failed: ${err.message}. Retrying in ${RETRY_DELAY_MS}ms...`);
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { fetchLatestMatch };
