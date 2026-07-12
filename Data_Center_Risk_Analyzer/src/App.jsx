import { useMemo, useState } from 'react';
import { calculateRisk, formatNumber } from './riskModel.js';
import { useSavedScenarios } from './hooks/useSavedScenarios.js';
import ZipLookupCard from './components/ZipLookupCard.jsx';
import GenerateButton from './components/GenerateButton.jsx';
import MapPanel from './components/MapPanel.jsx';

const emptyProject = {
  scenario: 'location',
  name: '',
  capacity: '',
  waterUse: '',
  cooling: '',
  source: '',
  wastewater: '',
  notes: ''
};

const SCENARIOS = {
  location: {
    label: 'Location only',
    capacity: '',
    waterUse: '',
    cooling: '',
    source: '',
    wastewater: '',
    note: 'Use public location context only; no project estimate is assumed.'
  },
  small: {
    label: 'Small planning scenario',
    capacity: '10',
    waterUse: '50000',
    cooling: 'hybrid',
    source: 'municipal',
    wastewater: '',
    note: '10 MW × 5,000 gallons/MW/day; hybrid cooling and municipal water are editable planning assumptions.'
  },
  medium: {
    label: 'Medium planning scenario',
    capacity: '25',
    waterUse: '125000',
    cooling: 'hybrid',
    source: 'municipal',
    wastewater: '',
    note: '25 MW × 5,000 gallons/MW/day; hybrid cooling and municipal water are editable planning assumptions.'
  },
  large: {
    label: 'Large planning scenario',
    capacity: '100',
    waterUse: '500000',
    cooling: 'hybrid',
    source: 'municipal',
    wastewater: '',
    note: '100 MW × 5,000 gallons/MW/day; hybrid cooling and municipal water are editable planning assumptions.'
  }
};

function formatGallons(value) {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)} billion gallons`;
  }

  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)} million gallons`;
  }

  return `${formatNumber(value)} gallons`;
}

function makePreviewBrief(project, context, risk) {
  const place = context?.location
    ? `${context.location.city}, ${context.location.state}`
    : 'the selected community';

  const scenario = SCENARIOS[project.scenario] || SCENARIOS.location;
  const projectName = project.name || scenario.label || 'The possible data center';

  const scope =
    project.scenario !== 'location'
      ? `This uses the app's ${scenario.label.toLowerCase()}, which is a team-defined planning estimate rather than verified developer data.`
      : 'No project size scenario was chosen, so this is a location-only screen rather than a project-impact estimate.';

  const proposalNote = risk.hasProposalData
    ? `The supplied inputs produce a ${risk.label.toLowerCase()} screening score of ${risk.score}/100.`
    : 'No proposal details were supplied.';

  const waterNote =
    project.waterUse !== ''
      ? `The planning water input equals approximately ${formatGallons(
          risk.annualWater
        )} per year, or ${formatNumber(
          risk.householdYears
        )} illustrative household-years at 300 gallons per household per day.`
      : 'Water demand was not provided, so the app cannot estimate annual use or a household-use comparison.';

  const missing = risk.missingFields.length
    ? `To sharpen the screen, request: ${risk.missingFields
        .slice(0, 4)
        .join(', ')}.`
    : 'The core proposal fields were supplied.';

  return `Local preview mode (not an AI response). ${projectName} is being reviewed for ${place}. ${scope} ${proposalNote} ${waterNote} Residents should ask the developer and local utility for a written water-demand profile, drought-contingency plan, wastewater or cooling-tower blowdown handling plan, and evidence of available system capacity. ${missing} This screening result is not an engineering, permitting, or legal conclusion.`;
}

export default function App() {
  const [zip, setZip] = useState('');
  const [project, setProject] = useState(emptyProject);
  const [context, setContext] = useState(null);
  const [status, setStatus] = useState({
    loading: false,
    error: ''
  });

  const [brief, setBrief] = useState(
    'Start with a ZIP code. Then choose location-only or an editable planning scenario.'
  );

  const {
    saved,
    saveScenario: persistScenario,
    clearSavedScenarios
  } = useSavedScenarios();

  const risk = useMemo(() => {
    return calculateRisk(project, context);
  }, [project, context]);

  function updateProject(field, value) {
    setProject((current) => ({
      ...current,
      [field]: value,
      scenario: field === 'scenario' ? value : current.scenario
    }));
  }

  function applyScenario(key) {
    const scenario = SCENARIOS[key];

    setProject({
      scenario: key,
      name: key === 'location' ? '' : scenario.label,
      capacity: scenario.capacity,
      waterUse: scenario.waterUse,
      cooling: scenario.cooling,
      source: scenario.source,
      wastewater: scenario.wastewater,
      notes: ''
    });

    setBrief(
      key === 'location'
        ? 'Location-only mode selected. Look up a ZIP to see public context without assuming any facility details.'
        : `${scenario.label} selected. The capacity, water estimate, cooling, and source assumptions are editable before you generate a brief.`
    );
  }

  function clearProposalInputs() {
    applyScenario('location');
  }

  async function lookupLocation() {
    const cleanZip = zip.replace(/\D/g, '').slice(0, 5);

    if (!/^\d{5}$/.test(cleanZip)) {
      setStatus({
        loading: false,
        error: 'Enter a valid 5-digit U.S. ZIP code.'
      });
      return;
    }

    setStatus({
      loading: true,
      error: ''
    });

    try {
      const response = await fetch(`/api/context?zip=${cleanZip}`);

      if (!response.ok) {
        throw new Error('Context endpoint unavailable');
      }

      const data = await response.json();

      setContext(data);

      setBrief(
        `Location found: ${data.location.city}, ${data.location.state}. You can keep a location-only screen, choose a planning scenario, or enter verified developer details.`
      );

      setStatus({
        loading: false,
        error: ''
      });
    } catch {
      try {
        const places = await fetch(
          `https://api.zippopotam.us/us/${cleanZip}`
        ).then((response) => {
          if (!response.ok) {
            throw new Error('ZIP not found');
          }

          return response.json();
        });

        const place = places.places?.[0];

        const census = await fetch(
          `https://api.census.gov/data/2023/acs/acs5?get=NAME,B01003_001E&for=zip%20code%20tabulation%20area:${cleanZip}`
        ).then((response) => {
          return response.ok ? response.json() : null;
        });

        const population = census?.[1]?.[1]
          ? Number(census[1][1])
          : null;

        setContext({
          location: {
            zip: cleanZip,
            city: place['place name'],
            state: place['state abbreviation'],
            latitude: Number(place.latitude),
            longitude: Number(place.longitude)
          },
          population,
          drought: {
            label: 'Needs deployed lookup',
            dsci: null,
            source: 'Local preview cannot request the county drought service.'
          },
          weather: {
            label: 'Needs deployed NOAA lookup'
          },
          sourceMode: 'local preview'
        });

        setBrief(
          'Location found in local preview mode. When deployed on Vercel, the app also retrieves NOAA/NWS weather and U.S. Drought Monitor county context.'
        );

        setStatus({
          loading: false,
          error: ''
        });
      } catch {
        setStatus({
          loading: false,
          error:
            'The ZIP lookup failed. Try another U.S. ZIP code or use 30040 for an example.'
        });
      }
    }
  }

  async function createBrief() {
    if (!context?.location) {
      setStatus({
        loading: false,
        error: 'Look up a ZIP code before generating a community brief.'
      });
      return;
    }

    if (project.capacity !== '' && Number(project.capacity) < 1) {
      setStatus({
        loading: false,
        error: 'Capacity must be at least 1 MW when provided.'
      });
      return;
    }

    if (project.waterUse !== '' && Number(project.waterUse) < 0) {
      setStatus({
        loading: false,
        error: 'Daily water use cannot be negative.'
      });
      return;
    }

    setStatus({
      loading: true,
      error: ''
    });

    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          project,
          context,
          risk
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'AI request failed.');
      }

      setBrief(data.brief);

      setStatus({
        loading: false,
        error: ''
      });
    } catch {
      setBrief(makePreviewBrief(project, context, risk));

      setStatus({
        loading: false,
        error:
          'AI endpoint is unavailable locally, so a clearly labeled local preview brief is shown. Deploy to Vercel with OPENAI_API_KEY for the real AI response.'
      });
    }
  }

  function loadExample() {
    setZip('30040');

    setProject({
      scenario: 'large',
      name: 'Example Data Center Campus',
      capacity: '150',
      waterUse: '500000',
      cooling: 'water-intensive',
      source: 'municipal',
      wastewater: 'municipal',
      notes:
        'Residents want water-system capacity, drought planning, and wastewater details before a zoning decision.'
    });

    setContext(null);

    setBrief(
      'Example loaded. Select Look Up ZIP to retrieve location context.'
    );

    setStatus({
      loading: false,
      error: ''
    });
  }

  function saveScenario() {
    if (!context?.location) {
      setStatus({
        loading: false,
        error: 'Look up a ZIP code before saving a scenario.'
      });
      return;
    }

    persistScenario({
      id: crypto.randomUUID(),
      createdAt: new Date().toLocaleString(),
      zip,
      project,
      context,
      risk,
      brief
    });
  }

  function restoreScenario(item) {
    setZip(item.zip);
    setProject({
      ...emptyProject,
      ...item.project
    });

    setContext(item.context);
    setBrief(item.brief);

    setStatus({
      loading: false,
      error: ''
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  const mapUrl = context?.location
    ? `https://www.google.com/maps?q=${context.location.latitude},${context.location.longitude}&z=10&output=embed`
    : null;

  const proposalSummary =
    project.scenario !== 'location'
      ? `${SCENARIOS[project.scenario].label} selected · ${risk.inputCoverage}% of optional proposal fields supplied`
      : risk.hasProposalData
        ? `${risk.inputCoverage}% of optional proposal fields supplied`
        : 'Location-only screen — no proposal fields supplied';

  return (
    <main className="container py-4 py-lg-5">
      <header className="text-center mb-4">
        <p className="eyebrow mb-2">MIST 7571E GROUP PROJECT</p>

        <h1 className="display-6 fw-bold">
          Data Center Risk Analyzer
        </h1>

        <p className="lead text-secondary mx-auto intro">
          A community screening tool that combines ZIP-based public context,
          editable planning scenarios, and an OpenAI-generated plain-language
          brief.
        </p>
      </header>

      {status.loading && (
        <div
          className="alert alert-info d-flex align-items-center gap-2"
          role="status"
        >
          <div className="spinner-border spinner-border-sm" />
          <span>Loading public data or generating the AI brief…</span>
        </div>
      )}

      {status.error && (
        <div className="alert alert-warning" role="alert">
          {status.error}
        </div>
      )}

      <div className="row g-4">
        <section className="col-12 col-lg-5">
          <ZipLookupCard
            zip={zip}
            setZip={setZip}
            lookupLocation={lookupLocation}
            loadExample={loadExample}
            loading={status.loading}
          />

          <div className="card shadow-sm border-0 mb-4">
            <div className="card-body p-4">
              <h2 className="h4 mb-1">
                2. Choose a planning scenario{' '}
                <span className="badge text-bg-light border">Optional</span>
              </h2>

              <p className="small text-secondary">
                Use a researched, team-defined starting point when project
                documents are unavailable. Every value remains editable below.
              </p>

              <div
                className="scenario-grid"
                role="group"
                aria-label="Planning scenario"
              >
                {Object.entries(SCENARIOS).map(([key, scenario]) => (
                  <button
                    key={key}
                    type="button"
                    className={`scenario-choice ${
                      project.scenario === key ? 'selected' : ''
                    }`}
                    onClick={() => applyScenario(key)}
                  >
                    <strong>
                      {key === 'location'
                        ? 'Location only'
                        : key[0].toUpperCase() + key.slice(1)}
                    </strong>

                    <span>
                      {key === 'location'
                        ? 'No facility assumptions'
                        : `${scenario.capacity} MW · ${formatNumber(
                            scenario.waterUse
                          )} gal/day`}
                    </span>
                  </button>
                ))}
              </div>

              {project.scenario !== 'location' && (
                <div className="scenario-note mt-3">
                  <strong>Planning-default notice:</strong>{' '}
                  {SCENARIOS[project.scenario].note} Cooling design, climate,
                  utilization, and water source can materially change actual
                  use—replace these values when documents become available.
                </div>
              )}
            </div>
          </div>

          <details className="card shadow-sm border-0 mb-4" open>
            <summary className="card-header bg-white p-4 border-0">
              <span className="h4 mb-0 d-inline-block">
                3. Review or add project details{' '}
                <span className="badge text-bg-light border">Optional</span>
              </span>

              <span className="d-block small text-secondary mt-1">
                Skip anything you do not know. More inputs make the screen more
                specific.
              </span>
            </summary>

            <div className="card-body p-4 pt-0">
              <label className="form-label">
                Project name{' '}
                <span className="text-secondary small">(optional)</span>
              </label>

              <input
                className="form-control mb-3"
                value={project.name}
                onChange={(event) =>
                  updateProject('name', event.target.value)
                }
                placeholder="Proposed Northside Campus"
              />

              <div className="row g-3">
                <div className="col-6">
                  <label className="form-label">
                    Capacity (MW){' '}
                    <span className="text-secondary small">(optional)</span>
                  </label>

                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={project.capacity}
                    onChange={(event) =>
                      updateProject('capacity', event.target.value)
                    }
                    placeholder="150"
                  />
                </div>

                <div className="col-6">
                  <label className="form-label">
                    Water (gal/day){' '}
                    <span className="text-secondary small">(optional)</span>
                  </label>

                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={project.waterUse}
                    onChange={(event) =>
                      updateProject('waterUse', event.target.value)
                    }
                    placeholder="500000"
                  />
                </div>
              </div>

              <label className="form-label mt-3">
                Cooling method{' '}
                <span className="text-secondary small">(optional)</span>
              </label>

              <select
                className="form-select"
                value={project.cooling}
                onChange={(event) =>
                  updateProject('cooling', event.target.value)
                }
              >
                <option value="">Not provided</option>
                <option value="water-intensive">Water-intensive</option>
                <option value="hybrid">Hybrid</option>
                <option value="air-cooled">Primarily air-cooled</option>
                <option value="unknown">Unknown / not disclosed</option>
              </select>

              <label className="form-label mt-3">
                Water source{' '}
                <span className="text-secondary small">(optional)</span>
              </label>

              <select
                className="form-select"
                value={project.source}
                onChange={(event) =>
                  updateProject('source', event.target.value)
                }
              >
                <option value="">Not provided</option>
                <option value="municipal">
                  Municipal drinking-water system
                </option>
                <option value="reclaimed">
                  Reclaimed / non-potable water
                </option>
                <option value="groundwater">Groundwater / wells</option>
                <option value="surface">Surface water / reservoir</option>
                <option value="unknown">Unknown / not disclosed</option>
              </select>

              <label className="form-label mt-3">
                Wastewater plan{' '}
                <span className="text-secondary small">(optional)</span>
              </label>

              <select
                className="form-select"
                value={project.wastewater}
                onChange={(event) =>
                  updateProject('wastewater', event.target.value)
                }
              >
                <option value="">Not provided</option>
                <option value="municipal">
                  Municipal treatment system
                </option>
                <option value="onsite">
                  On-site treatment / discharge
                </option>
                <option value="evaporation">
                  Evaporation / blowdown management
                </option>
                <option value="unknown">Unknown / not disclosed</option>
              </select>

              <label className="form-label mt-3">
                Community notes{' '}
                <span className="text-secondary small">(optional)</span>
              </label>

              <textarea
                className="form-control"
                rows="3"
                value={project.notes}
                onChange={(event) =>
                  updateProject('notes', event.target.value)
                }
                placeholder="Nearby stream, seasonal water restrictions, missing developer information…"
              />

              <div className="d-flex gap-2 mt-3">
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={clearProposalInputs}
                >
                  Use location only
                </button>

                <span className="small text-secondary align-self-center">
                  {proposalSummary}
                </span>
              </div>
            </div>
          </details>

          <GenerateButton
            createBrief={createBrief}
            loading={status.loading}
            project={project}
            risk={risk}
          />
        </section>

        <section className="col-12 col-lg-7">
          <div className="card shadow-sm border-0 mb-4">
            <div className="card-body p-4 text-center">
              <h2 className="h4">Screening result</h2>

              <div
                className={`risk-pill ${risk.label
                  .toLowerCase()
                  .replaceAll(' ', '-')}`}
              >
                {risk.label === 'Location only'
                  ? 'Location-only context'
                  : `${risk.score}/100 · ${risk.label}`}
              </div>

              <p className="small text-secondary mt-3 mb-0">
                {risk.hasProposalData
                  ? 'A transparent screen using supplied or planning-default inputs. Defaults are not verified project facts.'
                  : 'Add a planning scenario or verified proposal data later to calculate a project screen.'}
              </p>
            </div>
          </div>

          <div className="card shadow-sm border-0 mb-4">
            <div className="card-body p-4">
              <h2 className="h4 mb-3">Location and public context</h2>

              {context?.location ? (
                <>
                  <div className="row g-3 mb-3">
                    <div className="col-md-4">
                      <div className="metric">
                        <span>Location</span>
                        <strong>
                          {context.location.city}, {context.location.state}
                        </strong>
                        <small>ZIP {context.location.zip}</small>
                      </div>
                    </div>

                    <div className="col-md-4">
                      <div className="metric">
                        <span>Population</span>
                        <strong>
                          {context.population
                            ? formatNumber(context.population)
                            : 'Unavailable'}
                        </strong>
                        <small>Census ZIP-area estimate</small>
                      </div>
                    </div>

                    <div className="col-md-4">
                      <div className="metric">
                        <span>Drought context</span>
                        <strong>
                          {context.drought?.label || 'Unavailable'}
                        </strong>
                        <small>
                          {context.drought?.source || 'Public drought source'}
                        </small>
                      </div>
                    </div>
                  </div>

                  <MapPanel context={context} mapUrl={mapUrl} />
                </>
              ) : (
                <MapPanel context={context} mapUrl={mapUrl} />
              )}
            </div>
          </div>

          <div className="card shadow-sm border-0 mb-4">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                <div>
                  <h2 className="h4 mb-1">Environmental snapshot</h2>

                  <p className="text-secondary mb-0">
                    This makes missing project information visible instead of
                    guessing it.
                  </p>
                </div>

                <button
                  className="btn btn-outline-success btn-sm"
                  onClick={saveScenario}
                >
                  Save Scenario
                </button>
              </div>

              <div className="row g-3 mt-1">
                <div className="col-md-4">
                  <div className="metric">
                    <span>Annual water demand</span>

                    <strong>
                      {project.waterUse !== ''
                        ? formatGallons(risk.annualWater)
                        : 'Not provided'}
                    </strong>

                    <small>
                      {project.waterUse !== ''
                        ? `${formatNumber(project.waterUse)} gallons/day × 365`
                        : 'Select a planning scenario or add water use.'}
                    </small>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="metric">
                    <span>Household-use comparison</span>

                    <strong>
                      {project.waterUse !== ''
                        ? formatNumber(risk.householdYears)
                        : 'Not provided'}
                    </strong>

                    <small>
                      Illustrative household-years at 300 gal/day
                    </small>
                  </div>
                </div>

                <div className="col-md-4">
                  <div className="metric">
                    <span>Data completeness</span>

                    <strong>
                      {risk.hasProposalData
                        ? `${risk.inputCoverage}%`
                        : 'Location only'}
                    </strong>

                    <small>
                      {project.scenario !== 'location'
                        ? 'Includes editable planning defaults'
                        : 'Optional project fields supplied'}
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="card shadow-sm border-0">
            <div className="card-body p-4">
              <div className="d-flex justify-content-between align-items-start gap-3 flex-wrap">
                <div>
                  <h2 className="h4 mb-1">AI community brief</h2>

                  <p className="text-secondary mb-0">
                    The deployed app uses a secure Vercel server-side OpenAI
                    call.
                  </p>
                </div>

                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => window.print()}
                >
                  Print
                </button>
              </div>

              <div className="brief mt-3">{brief}</div>

              <h3 className="h6 mt-4">Questions residents can ask</h3>

              <ul className="mb-0">
                <li>
                  What is the maximum, average, and seasonal water demand for
                  this project?
                </li>
                <li>
                  Does the project use a planning estimate or a
                  developer-verified water model?
                </li>
                <li>
                  What happens to water demand during drought restrictions or
                  peak summer demand?
                </li>
                <li>
                  What chemicals, blowdown, or wastewater streams will be
                  generated and where will they be treated?
                </li>
                <li>
                  What utility-capacity studies and permits can be reviewed
                  before a local decision?
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      {saved.length > 0 && (
        <section className="card shadow-sm border-0 mt-4">
          <div className="card-body p-4">
            <h2 className="h4">Saved scenarios</h2>

            <div className="row g-3">
              {saved.map((item) => (
                <div className="col-md-6" key={item.id}>
                  <div className="border rounded p-3 h-100">
                    <strong>
                      {item.project.name || 'Location-only screen'}
                    </strong>

                    <p className="small text-secondary mb-2">
                      {item.createdAt} · {item.context.location?.city},{' '}
                      {item.context.location?.state} ·{' '}
                      {item.risk.label === 'Location only'
                        ? 'Location context'
                        : `${item.risk.score}/100`}
                    </p>

                    <button
                      className="btn btn-sm btn-outline-success"
                      onClick={() => restoreScenario(item)}
                    >
                      Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              className="btn btn-sm btn-outline-danger mt-3"
              onClick={clearSavedScenarios}
            >
              Clear saved
            </button>
          </div>
        </section>
      )}

      <footer className="small text-secondary text-center mt-5">
        Data Center Risk Analyzer is an educational screening tool. Verify
        figures with developers, utilities, regulators, and public permitting
        records.
      </footer>
    </main>
  );
}
