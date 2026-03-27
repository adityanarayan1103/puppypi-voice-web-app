/**
 * ros.js — ROS WebSocket Connection via roslibjs
 *
 * Manages connection to rosbridge_server on the Pi.
 * Auto-reconnects on disconnect.
 */

const ROSLIB = require("roslib");

const ROS_BRIDGE_URL =
  process.env.ROS_BRIDGE_URL || "ws://10.152.0.201:9090";

let ros = null;
let connected = false;
let reconnectTimer = null;

function connect() {
  if (ros) {
    try { ros.close(); } catch (_) {}
  }

  ros = new ROSLIB.Ros({ url: ROS_BRIDGE_URL });

  ros.on("connection", () => {
    connected = true;
    console.log(`[ROS] ✅ Connected to ${ROS_BRIDGE_URL}`);
    if (reconnectTimer) {
      clearInterval(reconnectTimer);
      reconnectTimer = null;
    }
  });

  ros.on("error", (err) => {
    console.error("[ROS] ❌ Error:", err.message || err);
  });

  ros.on("close", () => {
    connected = false;
    console.warn("[ROS] ⚠️  Disconnected. Retrying in 3s...");
    if (!reconnectTimer) {
      reconnectTimer = setInterval(() => {
        console.log("[ROS] 🔄 Reconnecting...");
        connect();
      }, 3000);
    }
  });
}

function getRos() {
  return ros;
}

function isConnected() {
  return connected;
}

module.exports = { connect, getRos, isConnected };
