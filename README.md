# PuppyPi Voice Control System

A production-grade Node.js backend and Web App for controlling the Hiwonder PuppyPi robot using natural language voice commands. 

This system completely replaces the need for custom Python ROS nodes natively on the Raspberry Pi. Instead, it acts exactly like the official WonderPi mobile app by securely connecting over WebSocket to the robot's pre-existing `rosbridge_server` and communicating directly with the robot's motion controllers.

---

## 🏗️ System Architecture

The architecture consists of three core layers:

1. **Frontend UI (Web Speech API)**
2. **Node.js HTTP & WebSocket Server**
3. **PuppyPi ROS Core (`rosbridge`)**

```mermaid
sequenceDiagram
    participant User
    participant Browser
    participant Node.js Backend
    participant Raspberry Pi (ROS)

    User->>Browser: "Can you stand up?" (Voice)
    Browser->>Browser: Web Speech API transcribes
    Browser->>Node.js Backend: POST /command {"command": "Can you stand up?"}
    
    rect rgb(30, 41, 59)
    Note over Node.js Backend: Normalizer
    Node.js Backend->>Node.js Backend: Maps "stand up" → "stand"
    end
    
    Node.js Backend->>Raspberry Pi (ROS): WebSocket (roslibjs) -> pub /puppy_control/pose
    Raspberry Pi (ROS)-->>Node.js Backend: ACK
    Node.js Backend-->>Browser: 200 OK {"status": "ok", "normalized": "stand"}
    Browser-->>User: Visual Success Toast
```

---

## ⚙️ Component Breakdown (`src/` Directory)

The backend code is modularized into cleanly separated domains inside the `src` folder:

### `src/server.js` (The Entry Point)
- **Role:** The main executable script that ties everything together.
- **Functionality:** 
  - Initializes the Express.js HTTP server.
  - Serves the frontend Web UI (`public/`).
  - Boots up the WebSocket ROS Router.
  - Ensures a controlled boot sequence (waits for ROS connection before calling initialization commands on the robot).

### `src/routes.js` (The API Endpoints)
- **Role:** Handles incoming HTTP REST requests from the browser.
- **Functionality:**
  - `POST /command`: Receives raw voice strings, passes them to the Normalizer, and if a canonical match is found, passes it to the Robot controller.
  - `GET /health`: Used by the Web UI to constantly poll and verify that the backend is alive and connected to the robot.
  - Provides strict parameter validation and error formatting (200 OK vs 400 Bad Request).

### `src/ros.js` (The WebSocket Bridge Router)
- **Role:** Manages the low-level network connection to the Pi.
- **Functionality:**
  - Connects to `ws://10.152.0.201:9090` using the `roslibjs` library.
  - Contains fault-tolerant lifecycle management (if the Wi-Fi drops, it automatically loops a reconnect attempt every 3 seconds without crashing the server).

### `src/normalizer.js` (The Language Engine)
- **Role:** Voice transcripts are rarely perfect. A user might say *"go forward"* or *"can you walk forward please"*. The normalizer decipher this without needing an expensive NLP cloud service.
- **Functionality:**
  - Implements a lightning-fast **4-Phase Engine**:
    1. **Exact match:** e.g., "stand"
    2. **Starts-with match:** Prefers "go forward" over "go"
    3. **First-word fallback:** Captures the root verb if the rest of the sentence is fluff.
    4. **Whole-word regex:** Traps string targets hiding inside complex sentences.

### `src/robot.js` (The Core Motion Controller)
- **Role:** This module is the core innovation of the app. It bypasses the need for arbitrary custom Python listener scripts running on the Raspberry Pi.
- **Functionality:**
  - Maps words to exact robot physics constraints (e.g. `doMove(10, 0, 0, 2000)` sets XY velocity for exactly 2 seconds).
  - Directly commands the Raspberry Pi by publishing to `/puppy_control/pose`, `/puppy_control/gait`, and `/puppy_control/velocity`.
  - For complex, pre-encoded physical movements (like `push_ups` or `dance`), the server directly pings the robot's action group service with binary file targets (e.g., `push_up.d6ac`).

---

## 🎤 Complete Command Reference

All **32 voice commands** currently supported, grouped by category:

### Posture

| Command | Voice Triggers | How It Works |
|---|---|---|
| `stand` | "stand", "stand up", "get up" | Publishes default pose + gait |
| `sit` | "sit", "sit down" | Lowers body height to -6 |
| `lie` | "lie", "lie down", "lay down" | Lowers body height to -3 |
| `lie_down` | "lie down action", "play dead", "down" | Runs `lie_down.d6ac` action group |
| `home` | "home", "go home", "reset" | Calls `go_home` + `set_running` services |
| `stop` | "stop", "halt", "freeze" | Sets velocity to zero |

### Movement

| Command | Voice Triggers | How It Works |
|---|---|---|
| `forward` | "forward", "walk", "walk forward", "go forward" | Velocity x=10 for 2s |
| `back` | "back", "backward", "go back" | Velocity x=-10 for 2s |
| `left` | "left", "turn left", "go left" | Yaw rate 0.5 for 2s |
| `right` | "right", "turn right", "go right" | Yaw rate -0.5 for 2s |
| `spin` | "spin", "rotate", "turn around" | Yaw rate 1.2 for 3.5s |
| `crawl` | "crawl", "crawl forward", "creep" | Low stance + slow forward |
| `mark_time` | "march", "mark time", "step in place" | Calls `set_mark_time` service |

### Head / Look

| Command | Voice Triggers | How It Works |
|---|---|---|
| `look_up` | "look up", "raise head", "head up" | Pitch +20° |
| `look_down` | "look down", "head down", "lower head" | Pitch -15° |
| `nod` | "nod", "nod head", "yes" | Runs `nod.d6ac` action group |
| `shake_head` | "shake head", "no", "say no" | Runs `shake_head.d6ac` action group |

### Expressions

| Command | Voice Triggers | How It Works |
|---|---|---|
| `hello` | "hello", "hi", "hey" | Roll oscillation wave |
| `shake_hands` | "shake hands", "handshake", "give paw" | Runs `shake_hands.d6ac` |
| `shake` | "shake", "wiggle" | Yaw oscillation |
| `wave` | "wave", "wave paw" | Runs `wave.d6ac` |
| `bow` | "bow", "take a bow", "bow down" | Runs `bow.d6ac` |

### Tricks

| Command | Voice Triggers | How It Works |
|---|---|---|
| `dance` | "dance" | Pitch + roll oscillation pattern |
| `jump` | "jump" | Height drop + spring up |
| `push_ups` | "push up", "push ups", "exercise" | Runs `push_up.d6ac` |
| `moonwalk` | "moonwalk", "moon walk", "michael jackson" | Runs `moonwalk.d6ac` |
| `kick_left` | "kick left", "left kick" | Runs `kick_ball_left.d6ac` |
| `kick_right` | "kick right", "right kick" | Runs `kick_ball_right.d6ac` |
| `climb_stairs` | "climb", "climb stairs", "go upstairs" | Runs `up_stairs_2cm.d6ac` |
| `boxing` | "box", "boxing", "punch", "fight" | Runs `boxing.d6ac` |

### Body Demos

| Command | Voice Triggers | How It Works |
|---|---|---|
| `turn_pitch` | "pitch", "turn pitch", "tilt" | Smooth pitch oscillation ±23° |
| `turn_roll` | "roll", "turn roll", "sway" | Smooth roll oscillation ±23° |

---

## 🛠️ Extensibility

To add a new action (e.g. "Sit Down"):

1. **Add to `robot.js` Action Handlers:**
   ```javascript
   async function doSit() {
     pubVel(0, 0, 0);                 // 1. Stop Movement
     await sleep(200);                // 2. Wait for momentum halt
     pubPose({ height: -6, run_time: 600 }); // 3. Drop Z-axis height
   }
   ```
2. **Map it in `DISPATCH` (`robot.js`):**
   ```javascript
   sit: doSit,
   ```
3. **Add aliases to `normalizer.js`:**
   ```javascript
   sit: ["sit", "sit down"],
   ```
4. **Add a UI chip (`public/index.html`):**
   ```html
   <span class="chip">"Sit down"</span>
   ```

## 🚀 Running the App

```bash
# Install dependencies
npm install

# Run backend on port 3000
npm start
```

## 📝 Sample Execution Log

When running the application, you'll see real-time logging as voice commands are transcribed, normalized, and executed on the robot:

```text
(base) adityanarayanverma@Aditya-Narayan-Verma-B995s-Macbook-Air ~ % cd ~/Desktop/puppipi/ros1_ws/voicecontrolapp && npm start

> puppypi-voice-backend@1.0.0 start
> node src/server.js

═══════════════════════════════════════════════════
  🐾  PuppyPi Voice Control Backend
  📡  Direct rosbridge control (no robot-side nodes needed)
═══════════════════════════════════════════════════
ROSLib uses utf8 encoding by default. It would be more efficient to use ascii (if possible).
[HTTP] ✅ Server on http://localhost:3000
[HTTP] Try: curl -X POST http://localhost:3000/command -H "Content-Type: application/json" -d '{"command":"stand"}'
═══════════════════════════════════════════════════
[ROS] ✅ Connected to ws://10.152.0.201:9090
[ROBOT] Publishers ready: /pose, /gait, /velocity
[ROBOT] Initializing robot (go_home + set_running)...
[ROBOT] ✅ go_home done
[ROBOT] ✅ set_running(true) done
[ROBOT] ✅ Robot initialized and ready.
[HTTP] POST /command
[API] Received: "turn right"
[API] Normalized: "turn right" → "right"
[ROBOT] ➡️  Executing: right
[HTTP] POST /command
[API] Received: "shutdown"
[API] ❌ Unknown command: "shutdown"
[HTTP] POST /command
[API] Received: "sit down"
[API] Normalized: "sit down" → "sit"
[ROBOT] ➡️  Executing: sit
[HTTP] POST /command
[API] Received: "jump jump"
[API] Normalized: "jump jump" → "jump"
[ROBOT] ➡️  Executing: jump
[HTTP] POST /command
[API] Received: "crawl"
[API] Normalized: "crawl" → "crawl"
[ROBOT] ➡️  Executing: crawl
[ROBOT] Initializing robot (go_home + set_running)...
[ROBOT] ✅ go_home done
[ROBOT] ✅ set_running(true) done
[ROBOT] ✅ Robot initialized and ready.
[HTTP] POST /command
[API] Received: "push up"
[API] Normalized: "push up" → "push_ups"
[ROBOT] ➡️  Executing: push_ups
[ROBOT] Initializing robot (go_home + set_running)...
[ROBOT] ✅ go_home done
[ROBOT] ✅ set_running(true) done
[ROBOT] ✅ Robot initialized and ready.
[ROBOT] Calling ActionGroup push_up.d6ac
```
