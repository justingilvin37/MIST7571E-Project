import React from 'react';

export default function GenerateButton({ createBrief, loading, project, risk }) {
  const label =
    project?.scenario === 'location' && !risk?.hasProposalData
      ? 'Generate location-only brief'
      : 'Generate community brief';

  return (
    <button
      className="btn btn-success w-100 mb-4 py-2"
      onClick={createBrief}
      disabled={loading}
    >
      {label}
    </button>
  );
}
