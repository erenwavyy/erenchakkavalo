// ================================================================
//  Valorant Discord Stats Bot  —  Production Ready
//  Rendering: Canvas (no browser needed)
//  API: Henrik Dev (match data) + Riot Official (RR tracking)
//  Host: Railway / Render friendly
// ================================================================

require("dotenv").config();
const { Client, GatewayIntentBits, AttachmentBuilder, EmbedBuilder, REST, Routes } = require("discord.js");
const { fetchLatestMatch }                        = require("./src/api/henrik");
const { fetchRankInfo }                           = require("./src/api/riot");
const { renderMatchCard }                         = require("./src/card/renderer");
const logger                                      = require("./src/utils/logger");
const { commands, handleProfile, handleHistory, handleRank } = require("./commands");

// ── Validate env on startup ────────────────────────────────────
const REQUIRED_ENV = ["DISCORD_TOKEN", "CHANNEL_ID", "RIOT_NAME", "RIOT_TAG", "RIOT_API_KEY", "CLIENT_ID"];
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    logger.error(`Missing required env variable: ${key}`);
    process.exit(1);
  }
}

const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || "60000");
const REGION        = process.env.REGION || "ap";

// ── State ──────────────────────────────────────────────────────
let lastMatchId = null;
let prevRR      = null;
let isFirstPoll = true;

// ── Discord client ─────────────────────────────────────────────
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", async () => {
  logger.info(`✅  Bot online as ${client.user.tag}`);

  // Register slash commands
  try {
    const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );
    logger.info("✅  Slash commands registered.");
  } catch (e) {
    logger.warn("Could not register slash commands:", e.message);
  }

  // Seed lastMatchId so we don't post old matches on restart
  try {
    const match = await fetchLatestMatch(REGION, process.env.RIOT_NAME, process.env.RIOT_TAG);
    if (match) lastMatchId = match.metadata.matchid;
    logger.info(`🔖  Seeded last match ID: ${lastMatchId}`);
  } catch (e) {
    logger.warn("Could not seed match ID on startup:", e.message);
  }

  isFirstPoll = false;
  startPolling();
});

// ── Slash command interactions ─────────────────────────────────
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "profile") return handleProfile(interaction);
  if (interaction.commandName === "history") return handleHistory(interaction);
  if (interaction.commandName === "rank")    return handleRank(interaction);
});

// ── Polling ────────────────────────────────────────────────────
function startPolling() {
  poll();
  setInterval(poll, POLL_INTERVAL);
}

async function poll() {
  try {
    logger.info(`🔍  Polling for ${process.env.RIOT_NAME}#${process.env.RIOT_TAG}...`);

    const [match, rankInfo] = await Promise.all([
      fetchLatestMatch(REGION, process.env.RIOT_NAME, process.env.RIOT_TAG),
      fetchRankInfo(REGION, process.env.RIOT_NAME, process.env.RIOT_TAG),
    ]);

    if (!match) { logger.warn("No match data returned."); return; }
    if (match.metadata.matchid === lastMatchId) { logger.info("No new match."); return; }

    lastMatchId = match.metadata.matchid;

    const player = extractPlayer(match);
    if (!player) { logger.warn("Tracked player not found in match data."); return; }

    const currentRR   = rankInfo?.ranking_in_tier ?? null;
    const currentTier = rankInfo?.currenttierpatched ?? "Unknown";
    let rrDelta       = null;
    if (prevRR !== null && currentRR !== null) {
      rrDelta = currentRR - prevRR;
      if (rrDelta < -50) rrDelta = rrDelta + 100;
      if (rrDelta > 80)  rrDelta = rrDelta - 100;
    }
    prevRR = currentRR;

    logger.info(`🎮  New match found! Result posting...`);

    const imageBuffer = await renderMatchCard(match, player, { rrDelta, currentRR, currentTier });
    await postToDiscord(match, player, imageBuffer, { rrDelta, currentRR, currentTier });
    logger.info(`📨  Match posted to Discord successfully.`);

  } catch (err) {
    logger.error("Poll failed:", err.message);
    if (err.stack) logger.error(err.stack);
  }
}

// ── Extract tracked player from match ─────────────────────────
function extractPlayer(match) {
  const name = `${process.env.RIOT_NAME}#${process.env.RIOT_TAG}`.toLowerCase();
  return match.players.all_players.find(
    (p) => `${p.name}#${p.tag}`.toLowerCase() === name
  ) ?? null;
}

// ── Post to Discord ────────────────────────────────────────────
async function postToDiscord(match, player, imageBuffer, rankData) {
  const channel = await client.channels.fetch(process.env.CHANNEL_ID);
  if (!channel?.isTextBased()) {
    logger.error("Channel not found or not text-based.");
    return;
  }

  const meta   = match.metadata;
  const won    = player.team === "Blue" ? meta.teams.blue.has_won : !meta.teams.blue.has_won;
  const color  = won ? 0x00ff88 : 0xff4655;
  const result = won ? "✅ VICTORY" : "❌ DEFEAT";
  const acs    = Math.round(player.stats.score / Math.max(meta.rounds_played, 1));
  const kd     = (player.stats.kills / Math.max(player.stats.deaths, 1)).toFixed(2);
  const rrText = rankData.rrDelta !== null
    ? (rankData.rrDelta >= 0 ? `+${rankData.rrDelta}` : `${rankData.rrDelta}`) + " RR"
    : "RR N/A";

  const file  = new AttachmentBuilder(imageBuffer, { name: "match.png" });
  const embed = new EmbedBuilder()
    .setColor(color)
    .setAuthor({ name: `${player.name}#${player.tag}  •  ${player.character}`, iconURL: player.assets?.agent?.small ?? null })
    .setTitle(`${result}  ${meta.rounds_won ?? "?"}–${meta.rounds_lost ?? "?"}  •  ${meta.map}`)
    .addFields(
      { name: "KDA",  value: `${player.stats.kills}/${player.stats.deaths}/${player.stats.assists}`, inline: true },
      { name: "ACS",  value: `${acs}`,                                    inline: true },
      { name: "ADR",  value: `${player.damage_made ?? "—"}`,              inline: true },
      { name: "HS%",  value: `${player.stats.headshots ?? "—"}%`,         inline: true },
      { name: "K/D",  value: kd,                                           inline: true },
      { name: "RR",   value: `**${rrText}** (${rankData.currentTier})`,   inline: true },
    )
    .setImage("attachment://match.png")
    .setFooter({ text: `${meta.mode}  •  ${new Date(meta.game_start * 1000).toLocaleString()}` })
    .setTimestamp();

  await channel.send({ embeds: [embed], files: [file] });
}

client.login(process.env.DISCORD_TOKEN);
