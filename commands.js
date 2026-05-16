// src/commands.js
// Slash commands: /profile, /history, /rank

const { EmbedBuilder, SlashCommandBuilder } = require("discord.js");
const axios = require("axios");
const logger = require("./src/utils/logger");

const BASE = "https://api.henrikdev.xyz/valorant";

function henrikHeaders() {
  return {
    "User-Agent": "valorant-discord-bot/2.0",
    "Authorization": process.env.HENRIK_API_KEY,
  };
}

// ── API helpers ────────────────────────────────────────────────

async function getMatches(region, name, tag, size = 10) {
  const url = `${BASE}/v3/matches/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}?size=${size}`;
  const res = await axios.get(url, { timeout: 12000, headers: henrikHeaders() });
  return res.data?.data ?? [];
}

async function getMMR(region, name, tag) {
  const url = `${BASE}/v2/mmr/${region}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
  const res = await axios.get(url, { timeout: 12000, headers: henrikHeaders() });
  return res.data?.data ?? null;
}

// ── Command definitions ────────────────────────────────────────

const commands = [
  new SlashCommandBuilder()
    .setName("profile")
    .setDescription("Show agent stats overview for the tracked player"),

  new SlashCommandBuilder()
    .setName("history")
    .setDescription("Show last 10 matches for the tracked player"),

  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Show full ranked stats for the tracked player"),
].map(c => c.toJSON());

// ── Command handlers ───────────────────────────────────────────

async function handleProfile(interaction) {
  await interaction.deferReply();

  const name   = process.env.RIOT_NAME;
  const tag    = process.env.RIOT_TAG;
  const region = process.env.REGION || "ap";

  try {
    const matches = await getMatches(region, name, tag, 10);
    if (!matches.length) {
      return interaction.editReply("No match data found.");
    }

    // Aggregate agent stats across last 10 matches
    const agentMap = {};
    for (const match of matches) {
      const player = match.players?.all_players?.find(
        p => p.name.toLowerCase() === name.toLowerCase() && p.tag.toLowerCase() === tag.toLowerCase()
      );
      if (!player) continue;

      const agent = player.character;
      if (!agentMap[agent]) agentMap[agent] = { games: 0, kills: 0, deaths: 0, assists: 0, wins: 0, score: 0, rounds: 0 };

      const blueWon1 = match.metadata?.teams?.blue?.has_won ?? match.teams?.blue?.has_won ?? false;
      const won = player.team === "Blue" ? blueWon1 : !blueWon1;

      agentMap[agent].games++;
      agentMap[agent].kills   += player.stats.kills;
      agentMap[agent].deaths  += player.stats.deaths;
      agentMap[agent].assists += player.stats.assists;
      agentMap[agent].score   += player.stats.score;
      agentMap[agent].rounds  += match.metadata.rounds_played;
      if (won) agentMap[agent].wins++;
    }

    // Sort agents by games played
    const sorted = Object.entries(agentMap).sort((a, b) => b[1].games - a[1].games);

    const embed = new EmbedBuilder()
      .setColor(0xff4655)
      .setTitle(`🎮  ${name}#${tag} — Agent Overview`)
      .setDescription(`Last **${matches.length}** matches`)
      .setTimestamp();

    for (const [agent, s] of sorted) {
      const kd      = (s.kills / Math.max(s.deaths, 1)).toFixed(2);
      const acs     = Math.round(s.score / Math.max(s.rounds, 1));
      const winRate = Math.round((s.wins / s.games) * 100);
      embed.addFields({
        name: `${agent}  (${s.games} games)`,
        value: `KDA: ${s.kills}/${s.deaths}/${s.assists}  •  K/D: ${kd}  •  ACS: ${acs}  •  WR: ${winRate}%`,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (err) {
    logger.error("[/profile]", err.message);
    await interaction.editReply("Failed to fetch profile data. Try again later.");
  }
}

async function handleHistory(interaction) {
  await interaction.deferReply();

  const name   = process.env.RIOT_NAME;
  const tag    = process.env.RIOT_TAG;
  const region = process.env.REGION || "ap";

  try {
    const matches = await getMatches(region, name, tag, 10);
    if (!matches.length) {
      return interaction.editReply("No match history found.");
    }

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`📋  ${name}#${tag} — Last 10 Matches`)
      .setTimestamp();

    for (const match of matches) {
      const player = match.players?.all_players?.find(
        p => p.name.toLowerCase() === name.toLowerCase() && p.tag.toLowerCase() === tag.toLowerCase()
      );
      if (!player) continue;

      const meta   = match.metadata;
      const blueWon2 = meta?.teams?.blue?.has_won ?? match.teams?.blue?.has_won ?? false;
      const won    = player.team === "Blue" ? blueWon2 : !blueWon2;
      const acs    = Math.round(player.stats.score / Math.max(meta.rounds_played, 1));
      const kd     = (player.stats.kills / Math.max(player.stats.deaths, 1)).toFixed(2);
      const result = won ? "✅ W" : "❌ L";
      const date   = new Date(meta.game_start * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });

      embed.addFields({
        name: `${result}  ${meta.map}  •  ${player.character}  •  ${date}`,
        value: `KDA: \`${player.stats.kills}/${player.stats.deaths}/${player.stats.assists}\`  K/D: \`${kd}\`  ACS: \`${acs}\`  Score: \`${meta.rounds_won}–${meta.rounds_lost}\``,
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });

  } catch (err) {
    logger.error("[/history]", err.message);
    await interaction.editReply("Failed to fetch match history. Try again later.");
  }
}

async function handleRank(interaction) {
  await interaction.deferReply();

  const name   = process.env.RIOT_NAME;
  const tag    = process.env.RIOT_TAG;
  const region = process.env.REGION || "ap";

  try {
    const mmr = await getMMR(region, name, tag);
    if (!mmr) {
      return interaction.editReply("No rank data found.");
    }

    const current   = mmr.current_data;
    const highest   = mmr.highest_rank;
    const history   = mmr.by_season ?? {};

    // Wins/losses from last 10 matches for win rate
    const matches   = await getMatches(region, name, tag, 10);
    let wins = 0;
    for (const match of matches) {
      const player = match.players?.all_players?.find(
        p => p.name.toLowerCase() === name.toLowerCase() && p.tag.toLowerCase() === tag.toLowerCase()
      );
      if (!player) continue;
      const blueWon3 = match.metadata?.teams?.blue?.has_won ?? match.teams?.blue?.has_won ?? false;
      const won = player.team === "Blue" ? blueWon3 : !blueWon3;
      if (won) wins++;
    }
    const winRate = matches.length ? Math.round((wins / matches.length) * 100) : "—";

    // Last 5 RR changes
    const recentRR = (current.mmr_change_to_last_game ?? null);

    const embed = new EmbedBuilder()
      .setColor(0xffd700)
      .setTitle(`🏆  ${name}#${tag} — Ranked Stats`)
      .addFields(
        { name: "Current Rank",   value: `**${current.currenttierpatched ?? "Unranked"}**`,          inline: true },
        { name: "RR",             value: `**${current.ranking_in_tier ?? "—"}** / 100`,              inline: true },
        { name: "Last Game RR",   value: recentRR !== null ? (recentRR >= 0 ? `+${recentRR}` : `${recentRR}`) : "—", inline: true },
        { name: "Peak Rank",      value: `**${highest?.patched_tier ?? "—"}**`,                      inline: true },
        { name: "Win Rate (L10)", value: `**${winRate}%**  (${wins}W / ${matches.length - wins}L)`,  inline: true },
        { name: "Elo",            value: `**${current.elo ?? "—"}**`,                                inline: true },
      )
      .setThumbnail(current.images?.large ?? null)
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });

  } catch (err) {
    logger.error("[/rank]", err.message);
    await interaction.editReply("Failed to fetch rank data. Try again later.");
  }
}

module.exports = { commands, handleProfile, handleHistory, handleRank };
