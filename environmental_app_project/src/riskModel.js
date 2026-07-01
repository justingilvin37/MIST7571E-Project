export function calculateRisk(project, context) {
  const waterUse = Number(project.waterUse) || 0;
  const capacity = Number(project.capacity) || 0;
  const disclosedFields = [
    project.name?.trim(),
    project.capacity !== '',
    project.waterUse !== '',
    project.cooling,
    project.source,
    project.wastewater,
    project.notes?.trim()
  ].filter(Boolean).length;

  let score = 0;
  const reasons = [];
  const missingFields = [];

  if (project.waterUse !== '') {
    if (waterUse >= 1_000_000) { score += 32; reasons.push('reported daily water demand is at least 1 million gallons'); }
    else if (waterUse >= 500_000) { score += 24; reasons.push('reported daily water demand is at least 500,000 gallons'); }
    else if (waterUse >= 100_000) { score += 14; reasons.push('reported daily water demand is at least 100,000 gallons'); }
    else if (waterUse > 0) { score += 6; reasons.push('daily water demand was reported'); }
  } else {
    missingFields.push('daily water demand');
  }

  if (project.capacity !== '') {
    if (capacity >= 250) { score += 12; reasons.push('planned capacity is 250 MW or more'); }
    else if (capacity >= 100) { score += 8; reasons.push('planned capacity is 100 MW or more'); }
  } else {
    missingFields.push('facility capacity');
  }

  const coolingPoints = { 'water-intensive': 15, hybrid: 7, 'air-cooled': 2, unknown: 10 };
  if (project.cooling) {
    score += coolingPoints[project.cooling] ?? 0;
    if (project.cooling === 'unknown') reasons.push('cooling method is not disclosed');
    else if (project.cooling !== 'air-cooled') reasons.push(`cooling is ${project.cooling.replace('-', ' ')}`);
  } else {
    missingFields.push('cooling method');
  }

  const sourcePoints = { municipal: 6, reclaimed: 1, groundwater: 12, surface: 9, unknown: 10 };
  if (project.source) {
    score += sourcePoints[project.source] ?? 0;
    if (project.source === 'groundwater') reasons.push('groundwater is proposed as the source');
    if (project.source === 'unknown') reasons.push('water source is not disclosed');
  } else {
    missingFields.push('water source');
  }

  const wastewaterPoints = { municipal: 4, onsite: 10, evaporation: 7, unknown: 10 };
  if (project.wastewater) {
    score += wastewaterPoints[project.wastewater] ?? 0;
    if (project.wastewater === 'unknown') reasons.push('wastewater plan is not disclosed');
  } else {
    missingFields.push('wastewater plan');
  }

  const droughtScore = Number(context?.drought?.dsci);
  if (Number.isFinite(droughtScore)) {
    if (droughtScore >= 300) { score += 18; reasons.push('county drought severity is high'); }
    else if (droughtScore >= 150) { score += 10; reasons.push('county drought severity is moderate'); }
    else if (droughtScore > 0) { score += 4; reasons.push('county is abnormally dry or in drought'); }
  } else if (context?.location) {
    missingFields.push('verified drought context');
  }

  const hasProposalData = disclosedFields > 0;
  score = Math.min(100, score);
  const label = !hasProposalData ? 'Location only' : score >= 70 ? 'High' : score >= 40 ? 'Moderate' : 'Lower';
  const annualWater = waterUse * 365;
  const householdYears = waterUse ? Math.round(annualWater / (300 * 365)) : 0;
  const inputCoverage = Math.round((disclosedFields / 7) * 100);

  return { score, label, reasons, missingFields, annualWater, householdYears, inputCoverage, hasProposalData };
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Math.round(value || 0));
}
