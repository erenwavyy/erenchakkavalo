// src/utils/logger.js
// Simple timestamped console logger

const levels = { info: "ℹ️ ", warn: "⚠️ ", error: "❌" };

function log(level, ...args) {
  const ts = new Date().toISOString();
  console[level](`[${ts}] ${levels[level] ?? ""}`, ...args);
}

module.exports = {
  info:  (...a) => log("info",  ...a),
  warn:  (...a) => log("warn",  ...a),
  error: (...a) => log("error", ...a),
};
