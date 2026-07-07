import { useEffect, useMemo, useState } from 'react';
import { NodeCard } from './components/NodeCard';
import type { NodeState, WsPayload } from './types';

const wsUrl = (() => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.hostname;
  return `${protocol}//${host}:4000/ws`;
})();

function App() {
  const [nodes, setNodes] = useState<NodeState[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const socket = new WebSocket(wsUrl);

    socket.addEventListener('open', () => setConnected(true));
    socket.addEventListener('close', () => setConnected(false));

    socket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data) as WsPayload;

      if (payload.type === 'snapshot') {
        setNodes(payload.nodes);
        return;
      }

      setNodes((current) => {
        const next = current.filter((item) => item.node_id !== payload.node.node_id);
        next.push(payload.node);
        return next.sort((a, b) => a.node_id - b.node_id);
      });
    });

    return () => socket.close();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNodes((current) =>
        current.map((node) => {
          const ageMs = Date.now() - node.received_at;
          return {
            ...node,
            age_ms: ageMs,
            online: ageMs <= 15000,
          };
        }),
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    const online = nodes.filter((node) => node.online).length;
    const averageTemp = nodes.length > 0 ? nodes.reduce((sum, node) => sum + node.temp, 0) / nodes.length : 0;
    const bestRssi = nodes.length > 0 ? Math.max(...nodes.map((node) => node.rssi)) : null;
    return { online, total: nodes.length, averageTemp, bestRssi };
  }, [nodes]);

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div>
          <p className="eyebrow">Thread telemetry</p>
          <h1>Live serial ingestion for your Thread nodes.</h1>
          <p className="lead">
            Backend serial readers parse newline-delimited JSON and stream updates to this dashboard over WebSocket.
          </p>
        </div>
        <div className="connection-chip">
          <span className={`connection-indicator ${connected ? 'is-online' : 'is-offline'}`} />
          {connected ? 'WebSocket connected' : 'WebSocket disconnected'}
        </div>
      </section>

      <section className="summary-grid">
        <article className="summary-card">
          <span className="summary-card__label">Nodes online</span>
          <strong className="summary-card__value">{summary.online}/{summary.total}</strong>
        </article>
        <article className="summary-card">
          <span className="summary-card__label">Average temp</span>
          <strong className="summary-card__value">{summary.averageTemp.toFixed(1)}°C</strong>
        </article>
        <article className="summary-card">
          <span className="summary-card__label">Best RSSI</span>
          <strong className="summary-card__value">
            {summary.bestRssi ?? 'n/a'}{summary.bestRssi !== null ? ' dBm' : ''}
          </strong>
        </article>
      </section>

      <section className="cards-grid">
        {nodes.length > 0 ? (
          nodes.map((node) => <NodeCard key={node.node_id} node={node} />)
        ) : (
          <article className="empty-state">
            <h2>No telemetry yet</h2>
            <p>Start the backend with configured serial ports and wait for the next JSON frames.</p>
          </article>
        )}
      </section>
    </main>
  );
}

export default App;
