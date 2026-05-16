// src/api/riot.js
// Official Riot Games API — requires approved API key
// Apply at: https://developer.riotgames.com
//
// Endpoints used:
//   GET /riot/account/v1/accounts/by-riot-id/{gameName}/{tagLine}  (account PUUID)
//   GET /val/ranked/v1/leaderboards/by-act/{actId}                 (rank info)
//
// NOTE: Riot's personal API key expires every 24h.
//       Production key requires an application submission.

const axios = require("axios");
const logger = require("../utils/logger");

// Region → Riot platform routing host
const PLATFORM_HOSTS = {
  na:    "na.api.riotgames.com",
  eu:    "eu.api.riotgames.com",
  ap:    "ap.api.riotgames.com",
  kr:    "kr.api.riotgames.com",
  latam: "latam.api.riotgames.com",
  br:    "br.api.riotgames.com",
};

// Region → Americas/Asia/Europe routing (account v1 endpoint)
const REGIONAL_HOSTS = {
  na:    "americas.api.riotgames.com",
  latam: "americas.api.riotgames.com",
  br:    "americas.api.riotgames.com",
  eu:    "europe.api.riotgames.com",
  ap:    "asia.api.riotgames.com",
  kr:    "asia.api.riotgames.com",
};

const KEY = process.env.RIOT_API_KEY;

// ── Get PUUID for a Riot ID ────────────────────────────────────
async function getPUUID(region, name, tag) {
  const host = REGIONAL_HOSTS[region] ?? "americas.api.riotgames.com";
  const url  = `https://${host}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
  const res  = await riotGet(url);
  return res?.puuid ?? null;
}

// ── Get current rank / RR for a player ────────────────────────
async function fetchRankInfo(region, name, tag) {
  try {
    const puuid    = await getPUUID(region, name, tag);
    if (!puuid) return null;

    const host = PLATFORM_HOSTS[region] ?? "na.api.riotgames.com";
    const url  = `https://${host}/val/ranked/v1/players/by-puuid/${puuid}`;
    const data = await riotGet(url);
    return data ?? null;
  } catch (err) {
    // Rank fetch is non-critical — log and continue
    logger.warn(`[Riot] fetchRankInfo failed (non-fatal): ${err.message}`);
    return null;
  }
}

async function riotGet(url) {
  const res = await axios.get(url, {
    timeout: 10000,
    headers: {
      "X-Riot-Token": KEY,
      "User-Agent":   "valorant-discord-bot/2.0",
    },
  });
  return res.data ?? null;
}

module.exports = { fetchRankInfo, getPUUID };
