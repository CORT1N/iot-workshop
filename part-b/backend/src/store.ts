import { config } from './config.js';
import type { NodeState, TelemetryMessage } from './types.js';

export class TelemetryStore {
  private readonly nodes = new Map<number, TelemetryMessage>();

  upsert(message: TelemetryMessage): NodeState {
    this.nodes.set(message.node_id, message);
    return this.toNodeState(message);
  }

  getSnapshot(): NodeState[] {
    return Array.from(this.nodes.values())
      .map((message) => this.toNodeState(message))
      .sort((a, b) => a.node_id - b.node_id);
  }

  private toNodeState(message: TelemetryMessage): NodeState {
    const ageMs = Date.now() - message.received_at;

    return {
      ...message,
      age_ms: ageMs,
      online: ageMs <= config.staleAfterMs,
    };
  }
}
