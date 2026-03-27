/**
 * routes.js — Express API Routes
 *
 * POST /command   — Receive a command, normalize, execute on robot
 * GET  /health    — Health check
 * GET  /commands  — List all available commands
 */

const express = require("express");
const { normalize, COMMAND_MAP } = require("./normalizer");
const { executeCommand } = require("./robot");
const { isConnected } = require("./ros");

const router = express.Router();

/**
 * POST /command
 * Body: { "command": "stand up" }
 */
router.post("/command", (req, res) => {
  const { command } = req.body;

  if (!command || typeof command !== "string") {
    return res.status(400).json({
      status: "error",
      message: "Missing 'command' field. Send { \"command\": \"stand\" }",
    });
  }

  console.log(`[API] Received: "${command}"`);

  const normalized = normalize(command);
  if (!normalized) {
    console.warn(`[API] ❌ Unknown command: "${command}"`);
    return res.status(400).json({
      status: "error",
      message: `Unknown command: "${command}"`,
      available: Object.keys(COMMAND_MAP),
    });
  }

  console.log(`[API] Normalized: "${command}" → "${normalized}"`);

  const executed = executeCommand(normalized);
  if (!executed) {
    return res.status(503).json({
      status: "error",
      message: "ROS bridge not connected or command failed",
    });
  }

  return res.json({
    status: "ok",
    raw: command,
    normalized: normalized,
  });
});

/**
 * GET /health
 */
router.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    ros_connected: isConnected(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /commands
 */
router.get("/commands", (_req, res) => {
  res.json({ commands: COMMAND_MAP });
});

module.exports = router;
