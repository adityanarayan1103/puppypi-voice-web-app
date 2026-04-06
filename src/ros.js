/**
 * ros.js — ROS WebSocket Connection via roslibjs
 *
 * Manages connection to rosbridge_server on the Pi.
 * Supports auto-discovered or manually set robot IP.
 * Auto-reconnects on disconnect.
 */

const ROSLIB = require("roslib");

let rosBridgeUrl = process.env.ROS_BRIDGE_URL || null;
let ros = null;
let connected = false;
let reconnectTimer = null;

/**
 * Set the rosbridge URL (called by server.js after discovery).
 */
function setUrl(url) {
  rosBridgeUrl = url;
}

function connect() {
  if (!rosBridgeUrl) {
    console.error("[ROS] ❌ No rosbridge URL set. Cannot connect.");
    return;
  }

  if (ros) {
    try { ros.close(); } catch (_) {}
  }

  ros = new ROSLIB.Ros({ url: rosBridgeUrl });

  ros.on("connection", () => {
    connected = true;
    console.log(`[ROS] ✅ Connected to ${rosBridgeUrl}`);
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

function getUrl() {
  return rosBridgeUrl;
}

module.exports = { connect, getRos, isConnected, setUrl, getUrl };
