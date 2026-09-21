import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/apiClient';

const STATUS_COLORS = {
  COMPLETE:   'status-complete',
  PROCESSING: 'status-processing',
  FAILED:     'status-failed',
};

function formatDate(iso) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function HistoryList() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    apiClient.get('/results')
      .then((res) => setItems(res.data.items || []))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load history'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="history-page">
        <div className="history-container">
          <div className="skeleton-list">
            {[1, 2, 3].map((i) => <div key={i} className="skeleton-row" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="history-page">
      <div className="history-container">
        <div className="page-header">
          <div>
            <h1>Your Analysis History</h1>
            <p>{items.length} image{items.length !== 1 ? 's' : ''} analyzed</p>
          </div>
          <Link to="/upload" className="btn-primary">New Analysis</Link>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {items.length === 0 && !error ? (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">📭</div>
            <p>No images analyzed yet.</p>
            <Link to="/upload" className="btn-primary">Upload your first image</Link>
          </div>
        ) : (
          <div className="history-list" role="list">
            {items.map((item) => (
              <Link
                key={item.imageId}
                to={`/results/${item.imageId}`}
                className="history-item"
                role="listitem"
              >
                <div className="history-item-left">
                  <span className={`status-badge ${STATUS_COLORS[item.status] || ''}`}>
                    {item.status}
                  </span>
                  <div>
                    <p className="history-image-id">{item.imageId}</p>
                    <p className="history-date">{formatDate(item.createdAt)}</p>
                  </div>
                </div>
                <div className="history-item-right">
                  {item.labels?.length > 0 && (
                    <div className="history-tags">
                      {item.labels.slice(0, 3).map((l) => (
                        <span key={l.name} className="mini-tag">{l.name}</span>
                      ))}
                      {item.labels.length > 3 && (
                        <span className="mini-tag muted">+{item.labels.length - 3} more</span>
                      )}
                    </div>
                  )}
                  <span className="history-arrow" aria-hidden="true">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
