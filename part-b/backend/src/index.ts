import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { config } from './config.js';
import { SerialManager } from './serial-manager.js';
import { TelemetryStore } from './store.js';
import type { NodeState } from './types.js';

const app = Fastify({ logger: true });
const store = new TelemetryStore();
const clients = new Set<{ send: (payload: string) => void }>();

const broadcast = (payload: unknown): void => {
  const data = JSON.stringify(payload);
  for (const client of clients) {
    client.send(data);
  }
};

await app.register(cors, { origin: config.corsOrigin });
await app.register(websocket);

app.get('/health', async () => ({
  ok: true,
  ports: config.serialPorts,
  staleAfterMs: config.staleAfterMs,
}));

app.get('/api/nodes', async () => ({
  nodes: store.getSnapshot(),
}));

app.get('/ws', { websocket: true }, (socket) => {
  const client = {
    send: (payload: string) => socket.send(payload),
  };

  clients.add(client);
  socket.send(JSON.stringify({ type: 'snapshot', nodes: store.getSnapshot() }));

  socket.on('close', () => {
    clients.delete(client);
  });
});

const serialManager = new SerialManager({
  ports: config.serialPorts,
  baudRate: config.serialBaudRate,
  onTelemetry: (message) => {
    const nodeState: NodeState = store.upsert(message);
    broadcast({ type: 'telemetry', node: nodeState });
  },
  onStatus: ({ level, message }) => {
    if (level === 'error') app.log.error(message);
    else app.log.info(message);
  },
});

if (config.serialPorts.length > 0) {
  serialManager.start();
} else {
  app.log.warn('No SERIAL_PORTS configured.');
}

setInterval(() => {
  broadcast({ type: 'snapshot', nodes: store.getSnapshot() });
}, 5000);

await app.listen({ port: config.httpPort, host: '0.0.0.0' });
