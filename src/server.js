/**
 * server.js — Entry Point
 *
 * Connects to the robot's rosbridge (already running on Pi),
 * publishes directly to robot topics — no custom nodes on robot needed.
 *
 * Usage:
 *   npm start
 *   ROS_BRIDGE_URL=ws://10.152.0.201:9090 npm start
 */

const express = require("express");
const cors = require("cors");
const { connect: connectROS } = require("./ros");
const { initPublishers, initRobot } = require("./robot");
const routes = require("./routes");

const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());

// Serve static frontend UI
const path = require("path");
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
console.log("═══════════════════════════════════════════════════");
console.log("  🐾  PuppyPi Voice Control Backend");
console.log("  📡  Direct rosbridge control (no robot-side nodes needed)");
console.log("═══════════════════════════════════════════════════");

connectROS();

// After ROS connects, init publishers and robot
setTimeout(async () => {
  initPublishers();
  // Give publishers time to register
  await new Promise(r => setTimeout(r, 1000));
  // Initialize robot (go_home + set_running + pose + gait)
  await initRobot();
}, 2000);

app.listen(PORT, () => {
  console.log(`[HTTP] ✅ Server on http://localhost:${PORT}`);
  console.log(`[HTTP] Try: curl -X POST http://localhost:${PORT}/command -H "Content-Type: application/json" -d '{"command":"stand"}'`);
  console.log("═══════════════════════════════════════════════════");
});
