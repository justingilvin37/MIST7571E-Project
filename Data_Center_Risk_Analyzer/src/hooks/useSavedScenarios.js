import { useEffect, useState } from 'react';

const STORAGE_KEY = 'data-center-risk-analyzer-scenarios';
const MAX_SAVED_SCENARIOS = 8;

function readSavedScenarios() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Reusable hook for browser-persisted user scenarios.
export function useSavedScenarios() {
  const [saved, setSaved] = useState(readSavedScenarios);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  }, [saved]);

  function saveScenario(scenario) {
    const next = [scenario, ...saved].slice(0, MAX_SAVED_SCENARIOS);
    setSaved(next);
  }

  function clearSavedScenarios() {
    setSaved([]);
  }

  return { saved, saveScenario, clearSavedScenarios };
}
