import React from 'react';

export default function ZipLookupCard({ zip, setZip, lookupLocation, loadExample, loading }) {
  return (
    <div className="card shadow-sm border-0 mb-4">
      <div className="card-body p-4">
        <div className="d-flex justify-content-between align-items-start gap-3">
          <div>
            <h2 className="h4 mb-1">
              1. Find the community{' '}
              <span className="badge text-bg-success">Required</span>
            </h2>

            <p className="small text-secondary mb-3">
              A ZIP code is all you need to begin.
            </p>
          </div>

          <button
            className="btn btn-outline-success btn-sm"
            onClick={loadExample}
          >
            Load Example
          </button>
        </div>

        <label className="form-label fw-semibold" htmlFor="zip">
          5-digit U.S. ZIP code
        </label>

        <div className="input-group">
          <input
            id="zip"
            className="form-control"
            value={zip}
            onChange={(event) =>
              setZip(event.target.value.replace(/\D/g, '').slice(0, 5))
            }
            placeholder="30040"
            inputMode="numeric"
            maxLength="5"
          />

          <button
            className="btn btn-success"
            onClick={lookupLocation}
            disabled={loading}
          >
            Look Up ZIP
          </button>
        </div>
      </div>
    </div>
  );
}
