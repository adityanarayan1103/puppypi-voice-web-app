/**
 * discover.js — Auto-discover PuppyPi on the local network
 *
 * Scans all local subnets for a host with port 9090 open (rosbridge_server).
 * Returns the first responding IP address.
 */

const net = require("net");
const os = require("os");

const ROSBRIDGE_PORT = 9090;
const PROBE_TIMEOUT_MS = 500;  // per-host TCP connect timeout
const CONCURRENCY = 50;        // parallel probes at once

/**
 * Get all local /24 subnet base addresses (e.g. "10.152.0")
 * by reading the machine's network interfaces.
 */
function getLocalSubnets() {
  const ifaces = os.networkInterfaces();
  const subnets = new Set();

  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        // Extract first 3 octets as the subnet base
        const parts = iface.address.split(".");
        subnets.add(`${parts[0]}.${parts[1]}.${parts[2]}`);
      }
    }
  }
  return [...subnets];
}

/**
 * Probe a single IP:port with a fast TCP connect.
 * Resolves to the IP if port is open, null otherwise.
 */
function probeHost(ip, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(PROBE_TIMEOUT_MS);

    socket.on("connect", () => {
      socket.destroy();
      resolve(ip);
    });
    socket.on("timeout", () => { socket.destroy(); resolve(null); });
    socket.on("error", ()  => { socket.destroy(); resolve(null); });

    socket.connect(port, ip);
  });
}

/**
 * Scan all local subnets for rosbridge (port 9090).
 * Returns the first IP found, or null if none respond.
 */
async function discoverRobot() {
  const subnets = getLocalSubnets();

  if (subnets.length === 0) {
    console.warn("[DISCOVER] ⚠️  No active network interfaces found");
    return null;
  }

  console.log(`[DISCOVER] 🔍 Scanning ${subnets.length} subnet(s) for rosbridge on port ${ROSBRIDGE_PORT}...`);
  for (const sub of subnets) {
    console.log(`[DISCOVER]    Subnet: ${sub}.0/24`);
  }

  // Build full list of IPs to scan (1-254 for each subnet)
  const allIPs = [];
  for (const sub of subnets) {
    for (let i = 1; i <= 254; i++) {
      allIPs.push(`${sub}.${i}`);
    }
  }

  // Scan in batches for speed
  for (let i = 0; i < allIPs.length; i += CONCURRENCY) {
    const batch = allIPs.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map((ip) => probeHost(ip, ROSBRIDGE_PORT))
    );
    const found = results.find((r) => r !== null);
    if (found) return found;
  }

  return null;
}

module.exports = { discoverRobot };
