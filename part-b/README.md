# Part B - Collect data and dashboard

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

## 1 - Build and flash the Thread components

### A. Build the RCP image

```bash
cd $IDF_PATH/examples/openthread/ot_rcp
idf.py set-target esp32h2
idf.py build
```

This builds the OpenThread RCP image for the ESP32-H2.

### B. Build the Thread Border Router firmware
#### Important: we need to setup custom code first

1. `cd /path/to/esp-thread-br/examples/basic_thread_border_router/main`
2. Add *sensors.h* and *sensors.c* contained in [firmware](./firmware/)
3. Replace **CMakeLists.txt** and **esp_ot_cli.c** with files contained in [firmware/ot_br](./firmware/ot_br/)

```bash
idf.py set-target esp32s3
idf.py menuconfig
```

Use `esp32c3` or another compatible target if needed, but the project discussed here used ESP32-S3 for the TBR.

If Wi-Fi is not required for the assignment, no special menuconfig changes are necessary.

### C. Flash the TBR

```bash
idf.py -p /dev/cu.usbmodem1301 flash monitor
```

Replace `/dev/cu.usbmodem1301` with the correct serial device for your board.

### D. Start the Thread network on the TBR

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

### E. Build and flash the H2 CLI node
#### Important: we need to setup custom code first

1. `cd $IDF_PATH/examples/openthread/ot_cli`
2. Add *sensors.h* and *sensors.c* contained in [firmware](./firmware/)
3. Replace **CMakeLists.txt** and **esp_ot_cli.c** with files contained in [firmware/ot_cli](./firmware/ot_cli/)

```bash
idf.py set-target esp32h2
idf.py -p /dev/cu.usbserial-2120 flash monitor
```

Replace `/dev/cu.usbserial-2120` with the correct port for the H2 board.

### F. Export the active dataset from the TBR

On the TBR serial console:

```text
ot dataset active -x
```

Copy the full hexadecimal dataset string.

### G. Join the Thread network from the H2 node

On the H2 CLI console:

```text
ot dataset set active <PASTE_ACTIVE_DATASET_HEX_HERE>
ot dataset commit active
ot ifconfig up
ot thread start
```

The node should attach as a child or router.

### H. Verify connectivity

On the TBR:

```text
ot ipaddr
```

Take one of the mesh-local IPv6 addresses and ping it from the H2 node:

```text
ot ping <TBR_IPV6_ADDRESS>
```

Successful replies confirm that the Thread network is up and the node has joined correctly.

## 2. Display data

Each device now emits **one JSON object per line** every 5 seconds over serial.

### Format

```json
{"type":"telemetry","node_id":"FA9656299634CBB9","temp":23.25,"humidity":49.4,"rssi":-45,"timestamp":11697}
```

### Fields

| Field | Type | Description |
|------|------|-------------|
| `type` | string | Fixed value, usually `telemetry` |
| `node_id` | string | Node identifier, typically an EUI-64 / long hex identifier |
| `temp` | number | Simulated or measured temperature |
| `humidity` | number | Simulated or measured humidity |
| `rssi` | number | RSSI value |
| `timestamp` | number | Device timestamp or Unix timestamp |
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
