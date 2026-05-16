// src/card/renderer.js
// Draws match stat card using node-canvas — no browser needed
// Output: PNG Buffer ready to send to Discord

const { createCanvas, registerFont } = require("canvas");
const path = require("path");

// ── Constants ──────────────────────────────────────────────────
const W  = 900;
const H  = 530;

// Colors
const C = {
  bg:        "#0d1117",
  bgStripe:  "#111620",
  bgHeader:  "#0a0e15",
  win:       "#00ff88",
  loss:      "#ff4655",
  winDim:    "rgba(0,255,136,0.08)",
  lossDim:   "rgba(255,70,85,0.08)",
  meDim:     "rgba(50,130,255,0.15)",
  meStroke:  "rgba(50,130,255,0.6)",
  text:      "#e2e8f0",
  textDim:   "#4a5568",
  textMid:   "#8892b0",
  border:    "#1e2535",
  white:     "#ffffff",
};

// ── Main export ────────────────────────────────────────────────
async function renderMatchCard(match, player, rankData) {
  const canvas = createCanvas(W, H);
  const ctx    = canvas.getContext("2d");

  const meta = match.metadata;
  const won  = player.team === "Blue"
    ? meta.teams.blue.has_won
    : !meta.teams.blue.has_won;

  const accent = won ? C.win : C.loss;

  // ── Background ───────────────────────────────────────────────
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle diagonal gradient overlay
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "rgba(255,255,255,0.015)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // ── Header block ─────────────────────────────────────────────
  drawHeader(ctx, meta, player, won, accent, rankData);

  // ── Hero stat strip ──────────────────────────────────────────
  drawHeroStrip(ctx, meta, player, won, accent, rankData);

  // ── Scoreboard ───────────────────────────────────────────────
  drawScoreboard(ctx, match, player, won, accent);

  // ── Bottom bar ───────────────────────────────────────────────
  drawBottomBar(ctx, meta);

  return canvas.toBuffer("image/png");
}

// ── Header ────────────────────────────────────────────────────
function drawHeader(ctx, meta, player, won, accent, rankData) {
  // Header bg
  ctx.fillStyle = C.bgHeader;
  ctx.fillRect(0, 0, W, 72);
  // Bottom border line
  ctx.fillStyle = accent;
  ctx.fillRect(0, 72, W, 2);

  // Left accent bar
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, 4, 72);

  // Result text
  ctx.fillStyle = accent;
  ctx.font      = "bold 34px 'Arial'";
  ctx.fillText(won ? "VICTORY" : "DEFEAT", 18, 44);

  // Score
  const scoreW = ctx.measureText(won ? "VICTORY" : "DEFEAT").width;
  ctx.fillStyle = C.white;
  ctx.font      = "bold 28px 'Arial'";
  const rounds  = `${meta.rounds_won ?? "?"}  :  ${meta.rounds_lost ?? "?"}`;
  ctx.fillText(rounds, 26 + scoreW, 44);

  // Meta chips (mode / duration / date)
  const chips = [
    { label: "MODE",     value: meta.mode },
    { label: "DURATION", value: formatDuration(meta.game_length) },
    { label: "DATE",     value: new Date(meta.game_start * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) },
    { label: "MAP",      value: meta.map },
  ];
  let cx = 340;
  for (const chip of chips) {
    ctx.fillStyle = C.textDim;
    ctx.font      = "10px 'Arial'";
    ctx.fillText(chip.label, cx, 28);
    ctx.fillStyle = C.text;
    ctx.font      = "bold 13px 'Arial'";
    ctx.fillText(chip.value, cx, 52);
    cx += Math.max(ctx.measureText(chip.value).width + 32, 100);
  }

  // RR pill (top right)
  const rr      = rankData.rrDelta;
  const rrLabel = rr !== null ? (rr >= 0 ? `+${rr} RR` : `${rr} RR`) : "RR —";
  const rrColor = rr === null ? C.textMid : rr >= 0 ? C.win : C.loss;
  drawPill(ctx, W - 120, 14, 104, 44, rrColor, rrLabel, rankData.currentTier ?? "");
}

// ── Hero stat strip ───────────────────────────────────────────
function drawHeroStrip(ctx, meta, player, won, accent, rankData) {
  ctx.fillStyle = C.bgStripe;
  ctx.fillRect(0, 74, W, 70);

  // Agent + role
  ctx.fillStyle = accent;
  ctx.font      = "bold 22px 'Arial'";
  ctx.fillText(player.character, 16, 107);
  ctx.fillStyle = C.textDim;
  ctx.font      = "11px 'Arial'";
  ctx.fillText("✦  DUELIST", 16, 126);

  const acs   = Math.round(player.stats.score / Math.max(meta.rounds_played, 1));
  const kd    = (player.stats.kills / Math.max(player.stats.deaths, 1)).toFixed(2);
  const kdaStr = `${player.stats.kills} / ${player.stats.deaths} / ${player.stats.assists}`;

  const stats = [
    { label: "KDA",  value: kdaStr, special: true },
    { label: "HS%",  value: `${player.stats.headshots ?? "—"}%` },
    { label: "ACS",  value: `${acs}` },
    { label: "ADR",  value: `${player.damage_made ?? "—"}` },
    { label: "K/D",  value: kd },
  ];

  let sx = 160;
  for (const s of stats) {
    // Divider
    ctx.fillStyle = C.border;
    ctx.fillRect(sx, 84, 1, 48);
    sx += 12;

    if (s.special) {
      // KDA — color deaths red
      const parts = kdaStr.split(" / ");
      let px = sx;
      ctx.font = "bold 22px 'Arial'";
      for (let i = 0; i < parts.length; i++) {
        ctx.fillStyle = i === 1 ? C.loss : C.white;
        ctx.fillText(parts[i], px, 107);
        px += ctx.measureText(parts[i]).width;
        if (i < 2) {
          ctx.fillStyle = C.textDim;
          ctx.fillText(" / ", px, 107);
          px += ctx.measureText(" / ").width;
        }
      }
      ctx.fillStyle = C.textDim;
      ctx.font      = "10px 'Arial'";
      ctx.fillText(s.label, sx, 126);
      sx = px + 24;
    } else {
      ctx.fillStyle = C.white;
      ctx.font      = "bold 22px 'Arial'";
      ctx.fillText(s.value, sx, 107);
      ctx.fillStyle = C.textDim;
      ctx.font      = "10px 'Arial'";
      ctx.fillText(s.label, sx, 126);
      sx += ctx.measureText(s.value).width + 28;
    }
  }
}

// ── Scoreboard ────────────────────────────────────────────────
function drawScoreboard(ctx, match, player, won, accent) {
  const HEADER_Y = 148;
  const ROW_H    = 33;
  const COLS     = [
    { label: "PLAYER",  x: 14,  w: 190, align: "left" },
    { label: "AGENT",   x: 210, w: 90,  align: "left" },
    { label: "RANK",    x: 300, w: 70,  align: "left" },
    { label: "KDA",     x: 374, w: 110, align: "left" },
    { label: "ACS",     x: 490, w: 60,  align: "right" },
    { label: "ADR",     x: 560, w: 60,  align: "right" },
    { label: "HS%",     x: 630, w: 50,  align: "right" },
    { label: "K/D",     x: 690, w: 55,  align: "right" },
    { label: "SCORE",   x: 754, w: 70,  align: "right" },
  ];

  const meta    = match.metadata;
  const myName  = `${process.env.RIOT_NAME}#${process.env.RIOT_TAG}`.toLowerCase();

  // Header row
  ctx.fillStyle = "#080c12";
  ctx.fillRect(0, HEADER_Y, W, 22);
  ctx.fillStyle = C.textDim;
  ctx.font      = "bold 9px 'Arial'";
  for (const col of COLS) {
    ctx.textAlign = col.align;
    const tx = col.align === "right" ? col.x + col.w : col.x;
    ctx.fillText(col.label, tx, HEADER_Y + 15);
  }
  ctx.textAlign = "left";

  // Sort: winners first, then by score
  const sorted = [...match.players.all_players].sort((a, b) => {
    const aWon = a.team === "Blue" ? meta.teams.blue.has_won : !meta.teams.blue.has_won;
    const bWon = b.team === "Blue" ? meta.teams.blue.has_won : !meta.teams.blue.has_won;
    if (aWon !== bWon) return aWon ? -1 : 1;
    return b.stats.score - a.stats.score;
  });

  let rowY = HEADER_Y + 22;
  let prevTeam = null;

  for (const p of sorted) {
    const pWon  = p.team === "Blue" ? meta.teams.blue.has_won : !meta.teams.blue.has_won;
    const isMe  = `${p.name}#${p.tag}`.toLowerCase() === myName;
    const pAcs  = Math.round(p.stats.score / Math.max(meta.rounds_played, 1));
    const pKd   = (p.stats.kills / Math.max(p.stats.deaths, 1)).toFixed(2);

    // Section divider between teams
    if (prevTeam !== null && prevTeam !== p.team) {
      ctx.fillStyle = C.border;
      ctx.fillRect(0, rowY, W, 2);
      rowY += 2;
    }
    prevTeam = p.team;

    // Row background
    if (isMe) {
      ctx.fillStyle = C.meDim;
    } else {
      ctx.fillStyle = pWon
        ? (rowY % 2 === 0 ? "rgba(0,255,136,0.03)" : "rgba(0,255,136,0.05)")
        : (rowY % 2 === 0 ? "rgba(255,70,85,0.02)"  : "rgba(255,70,85,0.04)");
    }
    ctx.fillRect(0, rowY, W, ROW_H);

    // Me highlight border
    if (isMe) {
      ctx.strokeStyle = C.meStroke;
      ctx.lineWidth   = 1;
      ctx.strokeRect(0.5, rowY + 0.5, W - 1, ROW_H - 1);
    }

    const textY = rowY + ROW_H / 2 + 5;

    // Player name
    ctx.fillStyle = isMe ? "#6ea8ff" : C.text;
    ctx.font      = `bold 12px 'Arial'`;
    ctx.textAlign = "left";
    ctx.fillText(p.name, 14, textY);
    const nameW   = ctx.measureText(p.name).width;
    ctx.fillStyle = C.textDim;
    ctx.font      = "10px 'Arial'";
    ctx.fillText(`#${p.tag}`, 16 + nameW, textY);

    // YOU badge
    if (isMe) {
      const bx = 14 + nameW + ctx.measureText(`#${p.tag}`).width + 20;
      ctx.fillStyle = "#3b82f6";
      roundRect(ctx, bx, rowY + 8, 30, 16, 3);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font      = "bold 8px 'Arial'";
      ctx.textAlign = "center";
      ctx.fillText("YOU", bx + 15, rowY + 19);
      ctx.textAlign = "left";
    }

    // Agent
    ctx.fillStyle = C.textMid;
    ctx.font      = "11px 'Arial'";
    ctx.fillText(p.character, 210, textY);

    // Rank
    ctx.fillStyle = C.textMid;
    ctx.font      = "10px 'Arial'";
    ctx.fillText(p.currenttier_patched ?? "—", 300, textY);

    // KDA
    const kills   = `${p.stats.kills}`;
    const deaths  = `${p.stats.deaths}`;
    const assists = `${p.stats.assists}`;
    ctx.font      = "bold 12px 'Arial'";
    let kx        = 374;

    ctx.fillStyle = C.text;
    ctx.fillText(kills, kx, textY);
    kx += ctx.measureText(kills).width;

    ctx.fillStyle = C.textDim;
    ctx.fillText(" / ", kx, textY);
    kx += ctx.measureText(" / ").width;

    ctx.fillStyle = C.loss;
    ctx.fillText(deaths, kx, textY);
    kx += ctx.measureText(deaths).width;

    ctx.fillStyle = C.textDim;
    ctx.fillText(" / ", kx, textY);
    kx += ctx.measureText(" / ").width;

    ctx.fillStyle = C.text;
    ctx.fillText(assists, kx, textY);

    // ACS
    ctx.textAlign = "right";
    ctx.fillStyle = C.textMid;
    ctx.font      = "12px 'Arial'";
    ctx.fillText(`${pAcs}`, 550, textY);

    // ADR
    ctx.fillText(`${p.damage_made ?? "—"}`, 620, textY);

    // HS%
    ctx.fillStyle = p.stats.headshots >= 30 ? "#facc15" : C.textMid;
    ctx.fillText(`${p.stats.headshots ?? "—"}%`, 680, textY);

    // K/D
    ctx.fillStyle = parseFloat(pKd) >= 1 ? C.win : C.loss;
    ctx.fillText(pKd, 745, textY);

    // Score
    ctx.fillStyle = isMe ? (pWon ? C.win : C.loss) : C.text;
    ctx.font      = "bold 13px 'Arial'";
    ctx.fillText(`${p.stats.score}`, 824, textY);

    ctx.textAlign = "left";
    rowY += ROW_H;
  }
}

// ── Bottom bar ────────────────────────────────────────────────
function drawBottomBar(ctx, meta) {
  ctx.fillStyle = C.bgHeader;
  ctx.fillRect(0, H - 24, W, 24);
  ctx.fillStyle = C.textDim;
  ctx.font      = "10px 'Arial'";
  ctx.textAlign = "left";
  ctx.fillText("⚡ Valorant Tracker Bot", 12, H - 8);
  ctx.textAlign = "right";
  ctx.fillText(new Date().toLocaleString(), W - 12, H - 8);
  ctx.textAlign = "left";
}

// ── Helpers ───────────────────────────────────────────────────
function drawPill(ctx, x, y, w, h, accentColor, mainText, subText) {
  // Background
  ctx.fillStyle = `${accentColor}18`;
  roundRect(ctx, x, y, w, h, 6);
  ctx.fill();
  // Border
  ctx.strokeStyle = `${accentColor}40`;
  ctx.lineWidth   = 1;
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 6);
  ctx.stroke();
  // Main value
  ctx.fillStyle = accentColor;
  ctx.font      = "bold 17px 'Arial'";
  ctx.textAlign = "center";
  ctx.fillText(mainText, x + w / 2, y + 22);
  // Sub label
  ctx.fillStyle = C.textDim;
  ctx.font      = "9px 'Arial'";
  ctx.fillText(subText, x + w / 2, y + 36);
  ctx.textAlign = "left";
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function formatDuration(seconds) {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

module.exports = { renderMatchCard };
