import React from 'react';

export default function ProcessingLog({ logs = [] }) {
  return (
    <div className="glass-panel" style={{ padding: '1.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h3 style={{ fontSize: '1.15rem' }}>⚡ Pipeline Execution Log</h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-dim)', fontFamily: 'var(--font-mono)' }}>
          stdout / audit trail
        </span>
      </div>

      <div className="terminal-window">
        {logs.length === 0 ? (
          <div style={{ color: 'var(--text-dim)' }}>System ready. Awaiting job trigger...</div>
        ) : (
          logs.map((line, index) => (
            <div key={index} className="terminal-line">
              <span className="terminal-timestamp">[{String(index + 1).padStart(2, '0')}]</span>
              <span>{line}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
