export interface TelemetryMessage {
  type: string;
  node_id: string;
  temp: number;
  humidity: number;
  rssi: number;
  timestamp: number;
  source_port?: string;
  received_at: number;
}

export interface NodeState extends TelemetryMessage {
  online: boolean;
  age_ms: number;
}
