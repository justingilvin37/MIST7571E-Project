// Displays the calculated risk score, label, and summary for the selected location.

import { getPlaceName } from '../riskModel.js';

function getRiskClass(label) {
  return `risk-${label.toLowerCase()}`;
}

export default function RiskScore({ context, risk }) {
  return (
    <section className="card border-0 shadow-sm result-card">
      <div className="card-body p-4">
        <div className="result-header">
          <div>
            <p className="eyebrow">Screening Result</p>
            <h2>{getPlaceName(context)}</h2>
            <p className="text-secondary mb-0">{risk.summary}</p>
          </div>

          <div className={`risk-badge ${getRiskClass(risk.label)}`}>
            <span>{risk.score}/100</span>
            <strong>{risk.label} Risk</strong>
          </div>
        </div>

        <div
          className="risk-bar"
          aria-label={`Risk score ${risk.score} out of 100`}
        >
          <div
            className={`risk-bar-fill ${getRiskClass(risk.label)}`}
            style={{ width: `${risk.score}%` }}
          />
        </div>
      </div>
    </section>
  );
}