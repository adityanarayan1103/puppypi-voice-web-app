/**
 * robot.js — Direct Robot Controller via rosbridge
 *
 * Controls PuppyPi exactly like the WonderPi app does:
 * publishes directly to /puppy_control/pose, /gait, /velocity
 * and calls services like /puppy_control/go_home, /set_running,
 * /performance/enter.
 *
 * No custom nodes needed on the robot.
 */

const ROSLIB = require("roslib");
const { getRos, isConnected } = require("./ros");

let posePub = null;
let gaitPub = null;
let velPub = null;

// ── Default configs (from performance_node.py / puppy.py) ──
const DEFAULT_POSE = {
  stance_x: 0, stance_y: 0, x_shift: -0.5,
  height: -10, roll: 0, pitch: 0, yaw: 0, run_time: 500,
};

const DEFAULT_GAIT = {
  overlap_time: 0.2, swing_time: 0.2,
  clearance_time: 0.0, z_clearance: 3,
};

// ════════════════════════════════════════════════
//  Init
// ════════════════════════════════════════════════

function initPublishers() {
  const ros = getRos();
  if (!ros) return;

  posePub = new ROSLIB.Topic({ ros, name: "/puppy_control/pose", messageType: "puppy_control/Pose" });
  gaitPub = new ROSLIB.Topic({ ros, name: "/puppy_control/gait", messageType: "puppy_control/Gait" });
  velPub  = new ROSLIB.Topic({ ros, name: "/puppy_control/velocity", messageType: "puppy_control/Velocity" });

  console.log("[ROBOT] Publishers ready: /pose, /gait, /velocity");
}

// ════════════════════════════════════════════════
//  Low-level helpers
// ════════════════════════════════════════════════

function deg2rad(deg) { return deg * Math.PI / 180; }

function pubPose(opts = {}) {
  if (!posePub) return;
  const p = { ...DEFAULT_POSE, ...opts };
  posePub.publish(new ROSLIB.Message(p));
}

function pubGait(opts = {}) {
  if (!gaitPub) return;
  const g = { ...DEFAULT_GAIT, ...opts };
  gaitPub.publish(new ROSLIB.Message(g));
}

function pubVel(x = 0, y = 0, yaw_rate = 0) {
  if (!velPub) return;
  velPub.publish(new ROSLIB.Message({ x, y, yaw_rate }));
}

function callService(name, type, data = {}) {
  return new Promise((resolve, reject) => {
    const ros = getRos();
    if (!ros || !isConnected()) return reject("Not connected");
    const srv = new ROSLIB.Service({ ros, name, serviceType: type });
    srv.callService(new ROSLIB.ServiceRequest(data), resolve, reject);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ════════════════════════════════════════════════
//  Robot initialization (same as WonderPi app)
// ════════════════════════════════════════════════

async function initRobot() {
  console.log("[ROBOT] Initializing robot (go_home + set_running)...");

  try {
    await callService("/puppy_control/go_home", "std_srvs/Empty");
    console.log("[ROBOT] ✅ go_home done");
  } catch (e) {
    console.warn("[ROBOT] ⚠️  go_home failed:", e);
  }

  await sleep(800);

  try {
    await callService("/puppy_control/set_running", "std_srvs/SetBool", { data: true });
    console.log("[ROBOT] ✅ set_running(true) done");
  } catch (e) {
    console.warn("[ROBOT] ⚠️  set_running failed:", e);
  }

  await sleep(500);
  pubPose();
  await sleep(300);
  pubGait();
  await sleep(200);
  console.log("[ROBOT] ✅ Robot initialized and ready.");
}

// ════════════════════════════════════════════════
//  Action handlers (publish directly, no robot-side listener needed)
// ════════════════════════════════════════════════

async function doStand() {
  pubVel(0, 0, 0);
  await sleep(200);
  pubPose();
  await sleep(300);
  pubGait();
}

async function doSit() {
  pubVel(0, 0, 0);
  await sleep(200);
  pubPose({ height: -6, run_time: 600 });
}

async function doLie() {
  pubVel(0, 0, 0);
  await sleep(200);
  pubPose({ height: -3, run_time: 800 });
}

async function doMove(x = 0, y = 0, yaw_rate = 0, duration = 2000) {
  pubPose();
  await sleep(300);
  pubGait();
  await sleep(200);
  pubVel(x, y, yaw_rate);
  await sleep(duration);
  pubVel(0, 0, 0);
}

async function doStop() {
  pubVel(0, 0, 0);
}

async function doHome() {
  await initRobot();
}

async function doLookUp() {
  pubVel(0, 0, 0);
  await sleep(200);
  pubPose({ pitch: deg2rad(20), run_time: 500 });
  await sleep(1500);
  pubPose({ run_time: 500 });
}

async function doHello() {
  for (let i = 0; i < 3; i++) {
    pubPose({ roll: deg2rad(10), run_time: 200 });
    await sleep(250);
    pubPose({ roll: deg2rad(-10), run_time: 200 });
    await sleep(250);
  }
  pubPose({ run_time: 200 });
}

async function doDance() {
  pubPose();
  await sleep(300);
  pubGait();
  await sleep(200);
  for (let i = 0; i < 4; i++) {
    pubPose({ pitch: deg2rad(10), roll: deg2rad(8), run_time: 250 });
    await sleep(300);
    pubPose({ pitch: deg2rad(-10), roll: deg2rad(-8), run_time: 250 });
    await sleep(300);
  }
  pubPose({ run_time: 300 });
}

async function doJump() {
  pubPose();
  await sleep(300);
  pubGait();
  await sleep(200);
  pubPose({ height: -14, run_time: 200 });
  await sleep(250);
  pubPose({ height: -8, run_time: 150 });
  await sleep(200);
  pubPose({ run_time: 300 });
}

async function doShake() {
  pubVel(0, 0, 0);
  await sleep(200);
  for (let i = 0; i < 3; i++) {
    pubPose({ yaw: 0.3, run_time: 200 });
    await sleep(250);
    pubPose({ yaw: -0.3, run_time: 200 });
    await sleep(250);
  }
  pubPose({ run_time: 200 });
}

async function doCrawl() {
  pubVel(0, 0, 0);
  await sleep(200);
  // Crawl stance
  pubGait({ overlap_time: 0.4, swing_time: 0.3, clearance_time: 0.20, z_clearance: 3 });
  await sleep(50);
  pubPose({ stance_x: 0, stance_y: 0, x_shift: -0.5, height: -7, roll: 0, pitch: 0, yaw: 0, run_time: 300 });
  await sleep(350);
  // Crawl forward
  pubVel(5, 0, 0);
  await sleep(3000);
  pubVel(0, 0, 0);
  await sleep(200);
  // Go back to normal standing
  await initRobot();
}

async function doPushUps() {
  await initRobot();
  try {
    console.log("[ROBOT] Calling ActionGroup push_up.d6ac");
    await callService("/puppy_control/runActionGroup", "puppy_control/SetRunActionName", {
      name: "push_up.d6ac",
      wait: false
    });
  } catch (e) {
    console.warn("[ROBOT] ⚠️  ActionGroup push_up failed:", e);
  }
}

// ════════════════════════════════════════════════
//  Command dispatch
// ════════════════════════════════════════════════

const DISPATCH = {
  stand:    doStand,
  sit:      doSit,
  forward:  () => doMove(10, 0, 0, 2000),
  back:     () => doMove(-10, 0, 0, 2000),
  left:     () => doMove(0, 0, 0.5, 2000),
  right:    () => doMove(0, 0, -0.5, 2000),
  spin:     () => doMove(0, 0, 1.2, 3500),
  stop:     doStop,
  lie:      doLie,
  look_up:  doLookUp,
  home:     doHome,
  hello:    doHello,
  dance:    doDance,
  jump:     doJump,
  shake:    doShake,
  crawl:    doCrawl,
  push_ups: doPushUps,
};

/**
 * Execute a normalized command.
 * @param {string} command - Canonical command name
 * @returns {boolean}
 */
function executeCommand(command) {
  const handler = DISPATCH[command];
  if (!handler) {
    console.warn(`[ROBOT] Unknown command: "${command}"`);
    return false;
  }

  if (!isConnected()) {
    console.error("[ROBOT] ❌ Not connected to ROS");
    return false;
  }

  console.log(`[ROBOT] ➡️  Executing: ${command}`);
  handler().catch(err => console.error(`[ROBOT] Error in ${command}:`, err));
  return true;
}

module.exports = { initPublishers, initRobot, executeCommand, DISPATCH };
