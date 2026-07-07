# ESP Thread Telemetry Dashboard

Monorepo for:
- flashing and running an ESP Thread Border Router (TBR) on ESP32-S3 or ESP32-C3,
- flashing and running an ESP32-H2 Thread node,
- collecting newline-delimited JSON telemetry from both devices over serial,
- exposing live telemetry through a backend WebSocket API,
- displaying all nodes in a React dashboard in real time.

This README documents the full workflow from repository setup to firmware flashing, serial port discovery, backend/frontend startup, and common troubleshooting.

## Scope

This project is split into two practical parts:

1. **Thread network setup**
   - Build and flash the ESP Thread Border Router.
   - Build and flash the ESP32-H2 node using the `ot_cli` example.
   - Start the Thread network on the TBR.
   - Join the H2 node to the network using the active dataset.
   - Verify IPv6 connectivity with `ot ping`.

2. **Telemetry and dashboard**
   - Make each device emit one JSON line every 5 seconds on serial.
   - Read both serial ports from the host computer.
   - Parse telemetry frames in the backend.
   - Push live updates to the frontend over WebSocket.
   - Show all nodes in a live dashboard with temperature, humidity, RSSI, timestamp, and online/offline state.

---

## Architecture

The host-side stack is intentionally simple:

- **ESP firmware** emits telemetry frames as JSON over UART.
- **Backend** opens one or more serial ports, reads lines, validates/parses JSON, stores the latest state for each node, and broadcasts updates over WebSocket.
- **Frontend** subscribes to the WebSocket and renders the latest values in real time.

### Why the backend does not use the OpenThread SDK

The host backend does **not** need OpenThread libraries.

Once the devices already emit the required telemetry over serial, the host only needs to:
- read serial,
- parse JSON,
- maintain node state,
- stream updates to the browser.

Using OpenThread host-side would add unnecessary complexity for this assignment.

---

## Repository setup

Clone and install Espressif dependencies exactly as follows:

```bash
git clone --recursive https://github.com/espressif/esp-idf.git
cd esp-idf
git checkout v5.5.4
git submodule update --init --depth 1
./install.sh
. ./export.sh
cd ..
git clone --recursive https://github.com/espressif/esp-thread-br.git
```

### Notes

- `esp-idf` is required for both `ot_rcp` and `ot_cli` examples.
- `esp-thread-br` contains the Border Router example.
- The shell where `idf.py` is used must have the ESP-IDF environment loaded with:

```bash
. /path/to/esp-idf/export.sh
```

---

## Part A - Build and flash the Thread components

### 1. Build the RCP image

```bash
cd $IDF_PATH/examples/openthread/ot_rcp
idf.py set-target esp32h2
idf.py build
```

This builds the OpenThread RCP image for the ESP32-H2.

### 2. Build the Thread Border Router firmware

```bash
cd /path/to/esp-thread-br/examples/basic_thread_border_router
idf.py set-target esp32s3
idf.py menuconfig
```

Use `esp32c3` or another compatible target if needed, but the project discussed here used ESP32-S3 for the TBR.

If Wi-Fi is not required for the assignment, no special menuconfig changes are necessary.

### 3. Flash the TBR

```bash
idf.py -p /dev/cu.usbmodem1301 flash monitor
```

Replace `/dev/cu.usbmodem1301` with the correct serial device for your board.

### 4. Start the Thread network on the TBR

Once in monitor/CLI:

```text
ot channel 13
ot panid 0x6776
ot dataset init new
ot dataset commit active
ot ifconfig up
ot thread start
```

Use your own channel and PAN ID to avoid collisions with other groups.

### 5. Build and flash the H2 CLI node

```bash
cd $IDF_PATH/examples/openthread/ot_cli
idf.py set-target esp32h2
idf.py -p /dev/cu.usbserial-2120 flash monitor
```

Replace `/dev/cu.usbserial-2120` with the correct port for the H2 board.

### 6. Export the active dataset from the TBR

On the TBR serial console:

```text
ot dataset active -x
```

Copy the full hexadecimal dataset string.

### 7. Join the Thread network from the H2 node

On the H2 CLI console:

```text
ot dataset set active <PASTE_ACTIVE_DATASET_HEX_HERE>
ot dataset commit active
ot ifconfig up
ot thread start
```

The node should attach as a child or router.

### 8. Verify connectivity

On the TBR:

```text
ot ipaddr
```

Take one of the mesh-local IPv6 addresses and ping it from the H2 node:

```text
ot ping <TBR_IPV6_ADDRESS>
```

Successful replies confirm that the Thread network is up and the node has joined correctly.

---

## Telemetry format for Part B

Each device must emit **one JSON object per line** every 5 seconds over serial.

### Required format

```json
{"type":"telemetry","node_id":"FA9656299634CBB9","temp":23.25,"humidity":49.4,"rssi":-45,"timestamp":11697}
```

### Required fields

| Field | Type | Description |
|------|------|-------------|
| `type` | string | Fixed value, usually `telemetry` |
| `node_id` | string | Node identifier, typically an EUI-64 / long hex identifier |
| `temp` | number | Simulated or measured temperature |
| `humidity` | number | Simulated or measured humidity |
| `rssi` | number | RSSI value |
| `timestamp` | number | Device timestamp or Unix timestamp |

### Important serial rule

Each telemetry frame **must be a single complete line terminated by `\n`**.

Good:

```text
{"type":"telemetry","node_id":"FA9656299634CBB9","temp":23.25,"humidity":49.4,"rssi":-45,"timestamp":11697}
```

Bad:
- partial JSON,
- multiple JSON objects merged together,
- logs mixed into the same line,
- binary or debug noise in the middle of the JSON.

If firmware logs and telemetry share the same serial output, parsing becomes unreliable.

---

## Host project structure

Recommended monorepo structure:

```text
thread-telemetry-dashboard/
├── .devcontainer/
│   └── devcontainer.json
├── package.json
├── .gitignore
├── README.md
├── backend/
│   ├── .env.example
│   ├── package.json
│   ├── tsconfig.json
│   ├── eslint.config.js
│   └── src/
│       ├── index.ts
│       ├── config.ts
│       ├── schema.ts
│       ├── store.ts
│       ├── serial-manager.ts
│       ├── list-ports.ts
│       └── types.ts
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── tsconfig.app.json
    ├── tsconfig.node.json
    ├── vite.config.ts
    ├── eslint.config.js
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── styles.css
        ├── types.ts
        └── components/
            └── NodeCard.tsx
```

---

## Devcontainer

Example `.devcontainer/devcontainer.json`:

```json
{
  "name": "thread-telemetry-dashboard",
  "image": "mcr.microsoft.com/devcontainers/javascript-node:22-bookworm",
  "features": {
    "ghcr.io/devcontainers/features/git:1": {},
    "ghcr.io/devcontainers/features/common-utils:2": {}
  },
  "forwardPorts": [4000, 5173],
  "postCreateCommand": "npm install",
  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "ms-vscode.vscode-typescript-next"
      ]
    }
  },
  "remoteUser": "node"
}
```

### Important note about serial devices in containers

On macOS, serial devices are often easier to access from the host directly than from inside a devcontainer.

For this project, the most reliable workflow is often:
- use the devcontainer for editing and dependency isolation,
- run the backend on the **host** if container access to `/dev/cu.*` is problematic,
- or explicitly configure device passthrough if supported by your setup.

---

## Host dependencies

### Root `package.json`

```json
{
  "name": "thread-telemetry-dashboard",
  "private": true,
  "workspaces": ["backend", "frontend"],
  "scripts": {
    "dev": "npm-run-all --parallel dev:backend dev:frontend",
    "dev:backend": "npm --workspace backend run dev",
    "dev:frontend": "npm --workspace frontend run dev",
    "build": "npm run build:backend && npm run build:frontend",
    "build:backend": "npm --workspace backend run build",
    "build:frontend": "npm --workspace frontend run build",
    "lint": "npm-run-all lint:backend lint:frontend",
    "lint:backend": "npm --workspace backend run lint",
    "lint:frontend": "npm --workspace frontend run lint"
  },
  "devDependencies": {
    "npm-run-all": "^4.1.5"
  }
}
```

### Backend `package.json`

```json
{
  "name": "backend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/index.js",
    "lint": "eslint .",
    "ports": "tsx src/list-ports.ts"
  },
  "dependencies": {
    "@fastify/cors": "^10.0.1",
    "@fastify/websocket": "^11.0.2",
    "dotenv": "^16.6.1",
    "fastify": "^5.6.0",
    "serialport": "^13.0.0",
    "zod": "^4.1.5"
  },
  "devDependencies": {
    "@eslint/js": "^9.32.0",
    "@types/node": "^24.1.0",
    "eslint": "^9.32.0",
    "globals": "^16.3.0",
    "tsx": "^4.20.3",
    "typescript": "^5.9.2",
    "typescript-eslint": "^8.38.0"
  }
}
```

### Frontend `package.json`

```json
{
  "name": "frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint ."
  },
  "dependencies": {
    "react": "^19.1.1",
    "react-dom": "^19.1.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.32.0",
    "@types/react": "^19.1.9",
    "@types/react-dom": "^19.1.7",
    "@vitejs/plugin-react": "^5.0.0",
    "eslint": "^9.32.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    "eslint-plugin-react-refresh": "^0.4.20",
    "globals": "^16.3.0",
    "typescript": "^5.9.2",
    "typescript-eslint": "^8.38.0",
    "vite": "^7.0.6"
  }
}
```

---

## Backend configuration

Example `backend/.env.example`:

```env
SERIAL_PORTS=/dev/cu.usbmodem1301,/dev/cu.usbserial-2120
SERIAL_BAUD_RATE=115200
HTTP_PORT=4000
CORS_ORIGIN=http://localhost:5173
STALE_AFTER_MS=15000
```

### Meaning of each variable

| Variable | Description |
|---------|-------------|
| `SERIAL_PORTS` | Comma-separated list of serial devices to open |
| `SERIAL_BAUD_RATE` | UART speed |
| `HTTP_PORT` | Backend HTTP/WebSocket port |
| `CORS_ORIGIN` | Allowed frontend origin |
| `STALE_AFTER_MS` | Node is considered offline after this delay |

---

## How to find the correct serial ports

### Method 1 - list all serial devices

```bash
ls /dev/cu.*
```

Typical results on macOS look like:

```text
/dev/cu.usbmodem1301
/dev/cu.usbserial-2120
```

### Method 2 - use the helper script

```bash
npm --workspace backend run ports
```

This should print the available serial ports and associated metadata.

### Method 3 - compare before and after plugging a board

```bash
ls /dev/cu.* > /tmp/ports-before.txt
# plug the board
ls /dev/cu.* > /tmp/ports-after.txt
diff /tmp/ports-before.txt /tmp/ports-after.txt
```

This is useful when several USB serial devices are present.

---

## Install and run the host project

From the monorepo root:

```bash
npm install
cp backend/.env.example backend/.env
```

Edit `backend/.env` and set your actual serial ports.

### Start backend and frontend together

```bash
npm run dev
```

### Start only backend

```bash
npm --workspace backend run dev
```

### Start only frontend

```bash
npm --workspace frontend run dev
```

### Production builds

```bash
npm run build
```

---

## Backend behavior

The backend does the following:

1. Opens all configured serial ports.
2. Reads serial data line by line.
3. Attempts to extract and parse JSON telemetry frames.
4. Validates the payload schema.
5. Stores the latest state for each node.
6. Broadcasts updates to all WebSocket clients.
7. Exposes an HTTP API and a `/ws` WebSocket endpoint.

### Expected node identifier type

`node_id` must be treated as a **string**, not a number.

This project observed telemetry like:

```json
{"node_id":"FA9656299634CBB9"}
```

So all types and schema definitions should use string IDs.

---

## Frontend behavior

The frontend:

- connects to the backend WebSocket,
- receives a full snapshot on connect,
- receives incremental telemetry updates after that,
- renders one card per node,
- shows temperature, humidity, RSSI, source port, timestamp, and online/offline state.

### Suggested dashboard fields

| Field | Purpose |
|------|---------|
| Node label | Human-readable identity |
| `node_id` | Unique node identifier |
| `temp` | Live temperature |
| `humidity` | Live humidity |
| `rssi` | Link quality indicator |
| `timestamp` | Device-side timestamp |
| `last_seen` | Host-side freshness |
| `online` | Connectivity status |

---

## Recommended firmware telemetry emission

If telemetry is generated directly in firmware, prefer emitting only the telemetry line itself on serial:

```c
printf("{\"type\":\"telemetry\",\"node_id\":\"%s\",\"temp\":%.2f,\"humidity\":%.2f,\"rssi\":%d,\"timestamp\":%lu}\n",
       node_id,
       temp,
       humidity,
       rssi,
       timestamp);
fflush(stdout);
```

### Recommendations

- Always terminate the JSON with `\n`.
- Avoid mixing telemetry with debug logs on the same line.
- Keep one object per line.
- Use string `node_id` values.

---

## Serial locking problem

A common issue during development is:

```text
Error Resource temporarily unavailable Cannot lock port
```

This happens when another process already owns the serial device.

### Typical cause

`idf.py monitor` or `esp_idf_monitor` is still attached to the board.

### How to identify the process holding the ports

```bash
lsof /dev/cu.usbmodem1301 /dev/cu.usbserial-2120
```

### Example of processes that may hold the ports

- `Python -m esp_idf_monitor`
- `idf.py flash monitor`
- `screen`
- `miniterm`
- another backend instance

### How to stop the port owners

```bash
kill <PID1> <PID2>
```

If needed:

```bash
kill -9 <PID1> <PID2>
```

### Verify the ports are free

```bash
lsof /dev/cu.usbmodem1301 /dev/cu.usbserial-2120
```

If nothing is printed, the ports are free.

### Important workflow rule

Do **not** keep `idf.py monitor` open while the telemetry backend is trying to read the same serial ports.

Use one of these workflows:
- flash and debug first, then close monitors and start the backend,
- or use a separate telemetry transport,
- or separate debug logging from telemetry.

---

## Parsing issues encountered and their fix

During testing, two problems appeared.

### 1. `node_id` schema mismatch

Problem:

```text
Invalid input: expected number, received string
```

Cause:
- firmware sent `node_id` as a hex string,
- backend schema expected a number.

Fix:
- define `node_id` as `string` in backend and frontend types,
- validate it as a string in the parsing schema.

### 2. Corrupted or merged serial frames

Problem:

```text
Unexpected non-whitespace character after JSON at position ...
```

Cause:
- partial line,
- merged logs,
- noisy serial output,
- telemetry not isolated from other UART logs.

Fix:
- emit one clean JSON line per message,
- terminate with `\n`,
- make the parser more tolerant by extracting the substring between the first `{` and the last `}` when appropriate,
- avoid unrelated logs on the same serial stream.

---

## End-to-end usage flow

### Step 1 - prepare the Espressif environment

```bash
cd /path/to/esp-idf
. ./export.sh
```

### Step 2 - build and flash the TBR

```bash
cd /path/to/esp-thread-br/examples/basic_thread_border_router
idf.py set-target esp32s3
idf.py -p /dev/cu.usbmodem1301 flash monitor
```

### Step 3 - create the Thread network on the TBR

```text
ot channel 13
ot panid 0x6776
ot dataset init new
ot dataset commit active
ot ifconfig up
ot thread start
```

### Step 4 - build and flash the H2 node

```bash
cd $IDF_PATH/examples/openthread/ot_cli
idf.py set-target esp32h2
idf.py -p /dev/cu.usbserial-2120 flash monitor
```

### Step 5 - retrieve the active dataset from the TBR

```text
ot dataset active -x
```

### Step 6 - join the H2 node

```text
ot dataset set active <DATASET_HEX>
ot dataset commit active
ot ifconfig up
ot thread start
```

### Step 7 - verify ping

On TBR:

```text
ot ipaddr
```

On H2:

```text
ot ping <TBR_IPV6>
```

### Step 8 - stop both serial monitors

Before launching the telemetry backend, close `idf.py monitor` on both boards.

If needed, identify holders:

```bash
lsof /dev/cu.usbmodem1301 /dev/cu.usbserial-2120
```

### Step 9 - configure the backend ports

```bash
cp backend/.env.example backend/.env
```

Edit:

```env
SERIAL_PORTS=/dev/cu.usbmodem1301,/dev/cu.usbserial-2120
```

### Step 10 - start the dashboard stack

```bash
npm install
npm run dev
```

### Step 11 - open the frontend

Open the Vite frontend URL, typically:

```text
http://localhost:5173
```

The backend is typically available on:

```text
http://localhost:4000
```

---

## Validation checklist

The project is considered working when all of the following are true:

- The TBR firmware builds and flashes successfully.
- The H2 CLI firmware builds and flashes successfully.
- The Thread network starts on the TBR.
- The H2 node joins the Thread network using the active dataset.
- The H2 node successfully pings the Border Router IPv6 address.
- Both boards emit telemetry JSON lines every 5 seconds.
- The backend opens both serial ports without lock conflicts.
- The backend parses telemetry frames successfully.
- The frontend shows all nodes in real time.
- Temperature and RSSI visibly update over time.
- Nodes become offline if telemetry stops beyond the stale timeout.

---

## Troubleshooting

### `Cannot lock port`

Cause:
- another monitor or serial process is already attached.

Fix:
- stop `idf.py monitor`, `esp_idf_monitor`, `screen`, or other readers,
- verify with `lsof`.

### `expected number, received string` on `node_id`

Cause:
- schema mismatch.

Fix:
- use string IDs everywhere.

### `Unexpected non-whitespace character after JSON`

Cause:
- broken serial line or mixed logs.

Fix:
- clean firmware output,
- ensure one JSON per line,
- harden the parser.

### Frontend shows repeated WebSocket connections

Cause:
- hot reload or repeated reconnects during development.

Fix:
- usually normal during Vite development,
- ensure only one frontend tab is open if needed.

### No nodes displayed

Check:
- backend started correctly,
- frontend connected to the right WebSocket URL,
- serial ports configured correctly,
- no lock on serial ports,
- telemetry lines valid JSON,
- `node_id` handled as a string.

---

## Suggested future improvements

- Auto-detect serial devices by USB VID/PID.
- Map known ports to friendly names like `TBR` and `H2 Node`.
- Add automatic serial reconnection.
- Add a raw serial debug panel in the frontend.
- Store telemetry history and draw charts.
- Export telemetry to CSV.
- Support MQTT in addition to WebSocket.
- Separate firmware debug logs from telemetry output.

---

## Deliverable summary

This project demonstrates:

- Thread Border Router setup on ESP32-S3,
- Thread node setup on ESP32-H2,
- Thread attachment using the active dataset,
- IPv6 connectivity validation with `ot ping`,
- host-side serial ingestion,
- JSON telemetry parsing,
- WebSocket broadcasting,
- React dashboard visualization in real time.
