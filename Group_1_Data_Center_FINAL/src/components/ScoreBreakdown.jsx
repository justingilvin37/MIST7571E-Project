// Reveals the detailed breakdown of how each factor contributes to the risk score.

import { useState } from 'react';

export default function ScoreBreakdown({ risk }) {
  const [open, setOpen] = useState(false);

  const breakdown = Array.isArray(risk?.breakdown) ? risk.breakdown : [];
  const missingData = Array.isArray(risk?.missingData) ? risk.missingData : [];

  return (
    <section className="card border-0 shadow-sm">

      <button
        className="water-toggle"
        onClick={() => setOpen(!open)}
      >
        <span className="water-icon">🥛</span>

        <div className="water-text">
          <strong>View Risk Score Breakdown</strong>
          <small>
            See how each environmental factor contributes to the overall score.
          </small>
        </div>

        <span className="toggle-arrow">
          {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="card-body p-4">

          <p className="eyebrow">Why This Score?</p>

          <h2 className="h4 mb-3">
            Risk score breakdown
          </h2>

          {breakdown.length === 0 ? (
            <p className="text-secondary">
              The score breakdown is unavailable.
            </p>
          ) : (
            <div className="breakdown-list">
              {breakdown.map((item) => (
                <article
                  className="breakdown-item"
                  key={item.id}
                >
                  <div>
                    <h3>{item.factor}</h3>

                    <p>{item.explanation}</p>

                    <small>{item.value}</small>
                  </div>

                  <div className="breakdown-score">
                    <strong>+{item.points}</strong>

                    <span>{item.impact}</span>
                  </div>
                </article>
              ))}
            </div>
          )}

          {missingData.length > 0 && (
            <div className="missing-data">
              <strong>Missing data:</strong>{" "}
              {missingData.join(", ")}.
            </div>
          )}

        </div>
      )}

    </section>
  );
}