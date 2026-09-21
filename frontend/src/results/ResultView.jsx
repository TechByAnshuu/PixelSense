import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { usePollResult } from './usePollResult';

export default function ResultView() {
  const { imageId }            = useParams();
  const { result, isPolling, error } = usePollResult(imageId);

  if (error) {
    return (
      <div className="result-page">
        <div className="result-container">
          <div className="alert alert-error">{error}</div>
          <Link to="/upload" className="btn-secondary">Upload another image</Link>
        </div>
      </div>
    );
  }

  if (isPolling || !result) {
    return (
      <div className="result-page">
        <div className="result-container">
          <div className="processing-state">
            <div className="pulse-ring" aria-hidden="true" />
            <div className="processing-icon">⚙️</div>
            <h2>Analyzing your image…</h2>
            <p>Running Rekognition + Bedrock AI pipeline. Usually completes in under 10 seconds.</p>
            <div className="processing-steps">
              {['Object Detection', 'Face Analysis', 'Celebrity Recognition', 'OCR', 'AI Summary'].map((step) => (
                <div key={step} className="processing-step">
                  <span className="step-dot blink" aria-hidden="true" />
                  {step}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const { labels = [], faces = [], celebrities = [], text = [], summary } = result;

  return (
    <div className="result-page">
      <div className="result-container">
        <div className="result-header">
          <div>
            <h1>Analysis Complete</h1>
            <p className="result-meta">Image ID: <code>{imageId}</code></p>
          </div>
          <Link to="/upload" className="btn-secondary">Analyze another</Link>
        </div>

        {/* AI Summary */}
        {summary && (
          <section className="result-section summary-card">
            <div className="section-badge">✨ AI Summary</div>
            <blockquote className="summary-text">&ldquo;{summary}&rdquo;</blockquote>
          </section>
        )}

        {/* Object Labels */}
        {labels.length > 0 && (
          <section className="result-section">
            <h2 className="section-title">
              <span className="section-icon">🏷️</span> Object Detection
              <span className="count-badge">{labels.length}</span>
            </h2>
            <div className="tags-grid">
              {labels.map((l) => (
                <div key={l.name} className="tag-item">
                  <span className="tag-name">{l.name}</span>
                  <span className="tag-confidence">{l.confidence}%</span>
                  <div className="tag-bar">
                    <div className="tag-bar-fill" style={{ width: `${l.confidence}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Faces */}
        {faces.length > 0 && (
          <section className="result-section">
            <h2 className="section-title">
              <span className="section-icon">👤</span> Face Analysis
              <span className="count-badge">{faces.length} face{faces.length !== 1 ? 's' : ''}</span>
            </h2>
            <div className="cards-grid">
              {faces.map((f, i) => (
                <div key={i} className="detail-card">
                  <div className="detail-row"><span>Gender</span><strong>{f.gender || '—'}</strong></div>
                  {f.ageRange && (
                    <div className="detail-row"><span>Age range</span><strong>{f.ageRange.Low}–{f.ageRange.High} yrs</strong></div>
                  )}
                  {f.smile !== undefined && (
                    <div className="detail-row"><span>Smiling</span><strong>{f.smile ? 'Yes' : 'No'}</strong></div>
                  )}
                  {f.emotions?.length > 0 && (
                    <div className="detail-row">
                      <span>Top emotion</span>
                      <strong>{f.emotions[0].type} ({f.emotions[0].confidence}%)</strong>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Celebrities */}
        {celebrities.length > 0 && (
          <section className="result-section">
            <h2 className="section-title">
              <span className="section-icon">⭐</span> Celebrities Recognized
            </h2>
            <div className="celebrity-list">
              {celebrities.map((c) => (
                <div key={c.name} className="celebrity-item">
                  <span className="celeb-name">{c.name}</span>
                  <span className="celeb-confidence">{c.confidence}% match</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* OCR Text */}
        {text.length > 0 && (
          <section className="result-section">
            <h2 className="section-title">
              <span className="section-icon">📄</span> OCR Text Detected
            </h2>
            <div className="ocr-block">
              {text.map((t, i) => (
                <div key={i} className="ocr-line">
                  <span className="ocr-text">{t.detectedText}</span>
                  <span className="ocr-conf">{t.confidence}%</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {labels.length === 0 && faces.length === 0 && celebrities.length === 0 && text.length === 0 && (
          <div className="empty-state">
            <p>No specific objects, faces, or text were detected in this image.</p>
          </div>
        )}
      </div>
    </div>
  );
}
