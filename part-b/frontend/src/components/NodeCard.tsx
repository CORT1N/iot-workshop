import type { NodeState } from '../types';

interface NodeCardProps {
  node: NodeState;
}

const formatRelative = (ageMs: number): string => `${Math.max(0, Math.round(ageMs / 1000))}s ago`;

const formatTimestamp = (timestamp: number): string => {
  const value = timestamp > 9999999999 ? timestamp : timestamp * 1000;
  return new Date(value).toLocaleTimeString();
};

export function NodeCard({ node }: NodeCardProps) {
  const role = node.node_id === 0 ? 'TBR' : `Node ${node.node_id}`;

  return (
    <article className="node-card">
      <header className="node-card__header">
        <div>
          <p className="node-card__eyebrow">{role}</p>
          <h2 className="node-card__title">ID {node.node_id}</h2>
        </div>
        <span className={`status-pill ${node.online ? 'is-online' : 'is-offline'}`}>
          {node.online ? 'Online' : 'Offline'}
        </span>
      </header>

      <section className="metric-grid">
        <div className="metric-box metric-box--primary">
          <span className="metric-box__label">Temperature</span>
          <strong className="metric-box__value">{node.temp.toFixed(1)}°C</strong>
        </div>
        <div className="metric-box">
          <span className="metric-box__label">RSSI</span>
          <strong className="metric-box__value">{node.rssi} dBm</strong>
        </div>
        <div className="metric-box">
          <span className="metric-box__label">Humidity</span>
          <strong className="metric-box__value">{node.humidity.toFixed(1)}%</strong>
        </div>
        <div className="metric-box">
          <span className="metric-box__label">Source</span>
          <strong className="metric-box__value metric-box__value--small">{node.source_port ?? 'n/a'}</strong>
        </div>
      </section>

      <footer className="node-card__footer">
        <span>Frame time: {formatTimestamp(node.timestamp)}</span>
        <span>Last seen: {formatRelative(node.age_ms)}</span>
      </footer>
    </article>
  );
}
