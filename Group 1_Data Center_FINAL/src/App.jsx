// Main application component that handles search, data loading, risk calculation, and page layout.

import { useMemo, useState } from 'react';
import AISummary from './components/AISummary.jsx';
import EnvironmentalSnapshot from './components/EnvironmentalSnapshot.jsx';
import MapPanel from './components/MapPanel.jsx';
import RiskScore from './components/RiskScore.jsx';
import ScoreBreakdown from './components/ScoreBreakdown.jsx';
import Search from './components/Search.jsx';
import { calculateRisk, getPlaceName } from './riskModel.js';

async function fetchLocationContext(searchTerm) {
  const cleanSearch = searchTerm.trim();

  if (!cleanSearch) {
    throw new Error('Please enter a 5-digit ZIP code.');
  }

  if (!/^[0-9]{5}$/.test(cleanSearch)) {
    throw new Error('Please enter a valid 5-digit ZIP code.');
  }

  const response = await fetch(`/api/context?search=${encodeURIComponent(
    cleanSearch
  )}`);

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Location context could not be loaded.');
  }

  return response.json();
}

export default function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [context, setContext] = useState(null);
  const [status, setStatus] = useState({
    loading: false,
    error: ''
  });

  const risk = useMemo(() => {
    return context ? calculateRisk(context) : null;
  }, [context]);

  async function handleSearch(event) {
    event.preventDefault();

    const cleanSearch = searchTerm.trim();

    if (!cleanSearch) {
      setStatus({
        loading: false,
        error: 'Please enter a valid 5-digit ZIP code.'
      });
      return;
    }

    setStatus({
      loading: true,
      error: ''
    });

    setContext(null);

    try {
      const locationData = await fetchLocationContext(cleanSearch);
      setContext(locationData);
    } catch (error) {
      setStatus({
        loading: false,
        error: error.message
      });
    } finally {
      setStatus((currentStatus) => ({
        ...currentStatus,
        loading: false
      }));
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-section">
        <div className="container">
          <div className="hero-card">
            <p className="eyebrow">Data Center Risk Analyzer</p>

            <h1>
              Understand the environmental risk of a data center in your
              community.
            </h1>

            <p className="hero-text">
              Search a 5-digit ZIP code to see a risk score based on NOAA weather data
              and an average data center water-use estimate.
            </p>

            <Search
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onSearch={handleSearch}
              loading={status.loading}
            />
          </div>
        </div>
      </section>

      <section className="container results-section">
        {status.error && (
          <div className="alert alert-warning" role="alert">
            {status.error}
          </div>
        )}

        {context && risk && (
          <div className="content-grid">
            <RiskScore context={context} risk={risk} />

            <EnvironmentalSnapshot context={context} risk={risk} />

            <MapPanel context={context} />

            <ScoreBreakdown risk={risk} />

            <AISummary
              context={context}
              risk={risk}
              averageDataCenter={{ waterUseGallonsPerDay: risk.averageWaterUseGpd }}
            />
          </div>
        )}
      </section>

      <footer className="container footer">
        <p>
          Educational screening tool only. Final decisions should use verified
          utility records, developer disclosures, permitting documents, and local
          environmental review.
        </p>

        {context && <p>Current location: {getPlaceName(context)}</p>}
      </footer>
    </main>
  );
}