// Shows environmental metrics and estimated water use for the selected location.

import {
  formatGallons,
  formatNumber,
  getAverageTempF,
  getForecastPrecipitationIn
} from '../riskModel.js';

function formatTemperature(value) {
  return Number.isFinite(value) ? `${Math.round(value)}°F` : 'Unavailable';
}

function formatPrecipitation(value) {
  return Number.isFinite(value)
    ? `${value.toFixed(2)} in next 7 days`
    : 'Unavailable';
}

function MetricCard({ label, value, helper }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
      {helper && <small>{helper}</small>}
    </div>
  );
}

export default function EnvironmentalSnapshot({ context, risk }) {
  const averageTempF = getAverageTempF(context);
  const precipitationIn = getForecastPrecipitationIn(context);

  const locationName = context?.location?.city && context?.location?.state
  ? `${context.location.city}, ${context.location.state}`
  : context?.location?.zip
    ? `ZIP ${context.location.zip}`
    : "this location";

  return (
    <section className="card border-0 shadow-sm">
      <div className="card-body p-4">
        <p className="eyebrow">Environmental Snapshot</p>
        <h2 className="h4 mb-1">
          Estimated Impact for {locationName}
        </h2>


        <div className="row g-3">
          <div className="col-md-4">
            <MetricCard
              label="NOAA/NWS forecast temperature"
              value={formatTemperature(averageTempF)}
              helper="Higher temperatures may increase cooling needs."
            />
          </div>

          <div className="col-md-4">
            <MetricCard
              label="NOAA/NWS precipitation forecast"
              value={formatPrecipitation(precipitationIn)}
              helper="Lower precipitation may increase short-term water-stress concerns."
            />
          </div>

          <div className="col-md-4">
            <MetricCard
              label="Estimated water use"
              value={`${formatNumber(risk.averageWaterUseGpd)} gal/day`}
              helper="Average data center assumption used by the app."
            />
          </div>

          <div className="col-md-4">
            <MetricCard
              label="Annual water use"
              value={formatGallons(risk.annualWaterUse)}
              helper="Estimated daily water use multiplied by 365."
            />
          </div>

          <div className="col-md-4">
            <MetricCard
              label="Household comparison"
              value={formatNumber(risk.householdYears)}
              helper="Household-years at 300 gallons per day."
            />
          </div>
        </div>

        {context?.weather?.note && (
          <p className="snapshot-note">
            <strong>Weather data note:</strong> {context.weather.note}
          </p>
        )}
      </div>
    </section>
  );
}