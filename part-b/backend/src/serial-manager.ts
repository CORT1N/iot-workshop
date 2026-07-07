import { ReadlineParser, SerialPort } from 'serialport';
import { telemetrySchema } from './schema.js';
import type { TelemetryMessage } from './types.js';

interface SerialManagerOptions {
  ports: string[];
  baudRate: number;
  onTelemetry: (message: TelemetryMessage) => void;
  onStatus: (payload: { level: 'info' | 'error'; message: string }) => void;
}

export class SerialManager {
  constructor(private readonly options: SerialManagerOptions) {}

  start(): void {
    for (const path of this.options.ports) {
      const port = new SerialPort({ path, baudRate: this.options.baudRate, autoOpen: true });
      const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

      port.on('open', () => {
        this.options.onStatus({ level: 'info', message: `Serial port opened: ${path}` });
      });

      port.on('error', (error) => {
        this.options.onStatus({ level: 'error', message: `Serial error on ${path}: ${error.message}` });
      });

      parser.on('data', (line: string) => {
        this.handleLine(path, line);
      });
    }
  }

  private handleLine(path: string, line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const parsed = JSON.parse(trimmed);
      const telemetry = telemetrySchema.parse(parsed);

      this.options.onTelemetry({
        ...telemetry,
        source_port: path,
        received_at: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown parsing error';
      this.options.onStatus({
        level: 'error',
        message: `Dropped frame from ${path}: ${message} | line=${trimmed}`,
      });
    }
  }
}
