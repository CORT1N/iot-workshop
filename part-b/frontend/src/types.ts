export interface NodeState {
  type: string;
  node_id: string;
  temp: number;
  humidity: number;
  rssi: number;
  timestamp: number;
  source_port?: string;
  received_at: number;
  online: boolean;
  age_ms: number;
}

export interface SnapshotMessage {
  type: 'snapshot';
  nodes: NodeState[];
}

export interface TelemetryMessage {
  type: 'telemetry';
  node: NodeState;
}

export type WsPayload = SnapshotMessage | TelemetryMessage;
