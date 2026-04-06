/**
 * server.js — Entry Point
 *
 * Auto-discovers the robot on the local network, then connects
 * to its rosbridge and publishes directly to robot topics.
 *
 * Usage:
 *   npm start                                      (auto-discover)
 *   ROS_BRIDGE_URL=ws://10.152.0.201:9090 npm start (manual override)
 */

const express = require("express");
const cors = require("cors");
const path = require("path");
const { discoverRobot } = require("./discover");
const { connect: connectROS, setUrl } = require("./ros");
const { initPublishers, initRobot } = require("./robot");
const routes = require("./routes");

const PORT = process.env.PORT || 3000;
const FALLBACK_IP = "10.152.0.201";

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend UI
app.use(express.static(path.join(__dirname, "../public")));

// Request logging (skip health checks)
app.use((req, _res, next) => {
  if (req.method !== "GET" || req.path !== "/health") {
    console.log(`[HTTP] ${req.method} ${req.path}`);
  }
  next();
});

app.use("/", routes);

// ── Startup ──
async function boot() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  🐾  PuppyPi Voice Control Backend");
  console.log("  📡  Direct rosbridge control (no robot-side nodes needed)");
  console.log("═══════════════════════════════════════════════════");

  // Determine robot IP
  let robotIP;

  if (process.env.ROS_BRIDGE_URL) {
    // Manual override via environment variable
    console.log(`[BOOT] Using manual ROS_BRIDGE_URL: ${process.env.ROS_BRIDGE_URL}`);
    setUrl(process.env.ROS_BRIDGE_URL);
  } else {
    // Auto-discover
    console.log("[BOOT] 🔍 Auto-discovering robot on local network...");
    robotIP = await discoverRobot();

    if (robotIP) {
      console.log(`[BOOT] ✅ Robot found at ${robotIP}`);
    } else {
      console.warn(`[BOOT] ⚠️  No robot found. Falling back to ${FALLBACK_IP}`);
      robotIP = FALLBACK_IP;
    }
    setUrl(`ws://${robotIP}:9090`);
  }

  // Connect to ROS
  connectROS();

  // After ROS connects, init publishers and robot
  setTimeout(async () => {
    initPublishers();
    await new Promise((r) => setTimeout(r, 1000));
    await initRobot();
  }, 2000);

  app.listen(PORT, () => {
    console.log(`[HTTP] ✅ Server on http://localhost:${PORT}`);
    console.log(`[HTTP] Try: curl -X POST http://localhost:${PORT}/command -H "Content-Type: application/json" -d '{"command":"stand"}'`);
    console.log("═══════════════════════════════════════════════════");
  });
}

boot();
