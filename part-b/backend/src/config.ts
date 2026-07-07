import dotenv from 'dotenv';

dotenv.config();

const parsePorts = (value?: string): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const config = {
  serialPorts: parsePorts(process.env.SERIAL_PORTS),
  serialBaudRate: Number(process.env.SERIAL_BAUD_RATE ?? 115200),
  httpPort: Number(process.env.HTTP_PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  staleAfterMs: Number(process.env.STALE_AFTER_MS ?? 15000),
};
