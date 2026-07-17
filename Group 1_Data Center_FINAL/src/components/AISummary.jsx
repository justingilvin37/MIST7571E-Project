// Fetches and shows the AI-generated community summary for the selected location and risk score.

import { useEffect, useState } from 'react';

export default function AISummary({ context, risk, averageDataCenter }) {
  const [brief, setBrief] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function getSummary() {
      if (!context || !risk) return;

      setLoading(true);
      setError('');

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            context,
            risk,
            averageDataCenter
          })
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || 'AI summary failed.');
        }

        setBrief(data.brief || 'No summary was returned.');
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    getSummary();
  }, [context, risk, averageDataCenter]);

  return (
    <section className="card border-0 shadow-sm">
      <div className="card-body p-4">
        <p className="eyebrow">AI Community Summary</p>

        <h2 className="h4 mb-2">Community Impact Summary</h2>

        <p className="text-secondary">
          This summary explains the environmental findings and overall risk
          score in language that community members and decision makers can
          understand.
        </p>

        <div className="ai-brief">
          {loading && <p>Generating AI summary...</p>}
          {error && <p className="text-danger">{error}</p>}
          {!loading && !error && <p>{brief}</p>}
        </div>
      </div>
    </section>
  );
}