const apiKeyInput = document.querySelector('#apiKeyInput');
const cityInput = document.querySelector('#cityInput');
const projectNameInput = document.querySelector('#projectNameInput');
const facilitySizeInput = document.querySelector('#facilitySizeInput');
const waterUseInput = document.querySelector('#waterUseInput');
const coolingTypeSelect = document.querySelector('#coolingTypeSelect');
const waterStressSelect = document.querySelector('#waterStressSelect');
const waterSourceSelect = document.querySelector('#waterSourceSelect');
const wastewaterSelect = document.querySelector('#wastewaterSelect');
const notesInput = document.querySelector('#notesInput');
const analyzeButton = document.querySelector('#analyzeButton');
const loadExampleButton = document.querySelector('#loadExampleButton');
const loadingArea = document.querySelector('#loadingArea');
const loadingText = document.querySelector('#loadingText');
const errorArea = document.querySelector('#errorArea');
const resultsArea = document.querySelector('#resultsArea');
const resultsTitle = document.querySelector('#resultsTitle');
const annualWaterValue = document.querySelector('#annualWaterValue');
const annualWaterNote = document.querySelector('#annualWaterNote');
const householdValue = document.querySelector('#householdValue');
const riskLabel = document.querySelector('#riskLabel');
const riskExplanation = document.querySelector('#riskExplanation');
const aiBrief = document.querySelector('#aiBrief');
const tokenUsage = document.querySelector('#tokenUsage');
const questionList = document.querySelector('#questionList');
const assumptionGrid = document.querySelector('#assumptionGrid');
const saveScenarioButton = document.querySelector('#saveScenarioButton');
const printButton = document.querySelector('#printButton');
const savedSection = document.querySelector('#savedSection');
const savedScenarioList = document.querySelector('#savedScenarioList');
const clearSavedButton = document.querySelector('#clearSavedButton');

const SAVED_SCENARIOS_KEY = 'civic-impact-lens-scenarios';
const HOUSEHOLD_DAILY_GALLONS = 300;
let activeScenario = null;

const labels = {
  cooling: {
    'water-intensive': 'Water-intensive cooling',
    hybrid: 'Hybrid cooling',
    'air-cooled': 'Primarily air-cooled',
    unknown: 'Unknown / not disclosed'
  },
  stress: {
    low: 'Low / no known concern',
    moderate: 'Moderate / seasonal concern',
    high: 'High / drought or supply concern',
    unknown: 'Unknown / needs verification'
  },
  source: {
    municipal: 'Municipal drinking-water system',
    reclaimed: 'Reclaimed / non-potable water',
    groundwater: 'Groundwater / wells',
    surface: 'Surface water / reservoir',
    unknown: 'Unknown / not disclosed'
  },
  wastewater: {
    municipal: 'Municipal wastewater treatment',
    'on-site': 'On-site treatment / discharge',
    evaporation: 'Evaporation / blowdown management',
    unknown: 'Unknown / not disclosed'
  }
};

function setLoading(isLoading, message = 'Building your environmental screening brief...') {
  loadingText.textContent = message;
  loadingArea.classList.toggle('d-none', !isLoading);
  analyzeButton.disabled = isLoading;
  loadExampleButton.disabled = isLoading;
}

function showError(message) {
  errorArea.textContent = message;
  errorArea.classList.remove('d-none');
}

function clearError() {
  errorArea.textContent = '';
  errorArea.classList.add('d-none');
}

function formatNumber(value) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value);
}

function formatGallons(value) {
  if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)} billion gallons`;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)} million gallons`;
  return `${formatNumber(value)} gallons`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getFormData() {
  return {
    apiKey: apiKeyInput.value.trim(),
    city: cityInput.value.trim(),
    projectName: projectNameInput.value.trim(),
    facilitySize: Number(facilitySizeInput.value),
    waterUse: Number(waterUseInput.value),
    coolingType: coolingTypeSelect.value,
    waterStress: waterStressSelect.value,
    waterSource: waterSourceSelect.value,
    wastewaterPlan: wastewaterSelect.value,
    notes: notesInput.value.trim()
  };
}

function validateForm(data) {
  if (!data.apiKey) return 'Please enter your OpenAI API key before creating a brief.';
  if (!data.city) return 'Please enter the city or county affected by the proposal.';
  if (!data.projectName) return 'Please enter a project name so saved scenarios are easy to identify.';
  if (!Number.isFinite(data.facilitySize) || data.facilitySize <= 0) return 'Enter a facility size greater than zero.';
  if (!Number.isFinite(data.waterUse) || data.waterUse < 0) return 'Enter an estimated daily water-use value of zero or greater.';
  return '';
}

function calculateScreening(data) {
  const annualWater = data.waterUse * 365;
  const householdYears = annualWater / (HOUSEHOLD_DAILY_GALLONS * 365);
  let points = 0;

  if (data.waterUse >= 1000000) points += 3;
  else if (data.waterUse >= 250000) points += 2;
  else if (data.waterUse >= 50000) points += 1;

  if (data.waterStress === 'high') points += 3;
  else if (data.waterStress === 'moderate' || data.waterStress === 'unknown') points += 2;

  if (data.coolingType === 'water-intensive') points += 2;
  else if (data.coolingType === 'hybrid' || data.coolingType === 'unknown') points += 1;

  if (data.waterSource === 'groundwater' || data.waterSource === 'surface' || data.waterSource === 'unknown') points += 1;
  if (data.wastewaterPlan === 'on-site' || data.wastewaterPlan === 'evaporation' || data.wastewaterPlan === 'unknown') points += 1;

  let label = 'Lower';
  let explanation = 'The inputs suggest fewer immediate water-related red flags, but public water and discharge documentation should still be reviewed.';
  if (points >= 7) {
    label = 'High';
    explanation = 'Several inputs combine into a stronger need for early public disclosure, utility-capacity review, and water-quality safeguards.';
  } else if (points >= 4) {
    label = 'Moderate';
    explanation = 'The proposal has material questions to verify before residents can understand its likely water and wastewater implications.';
  }

  return { annualWater, householdYears, label, explanation, points };
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const fallbackMessage = `Request failed with status ${response.status}`;
    let errorMessage = fallbackMessage;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.error?.message || errorBody.message || fallbackMessage;
    } catch {
      errorMessage = fallbackMessage;
    }
    throw new Error(errorMessage);
  }
  return response.json();
}

function buildAiPrompt(data, screening) {
  return `You are an environmental-information assistant helping a resident understand early details of a proposed data center. Use only the supplied inputs. Do not invent laws, permits, contamination facts, or local utility capacity. Do not state that environmental harm will definitely occur. Clearly distinguish an estimate from a verified fact. Write plain English for a public meeting attendee.\n\nProject inputs:\n- Project: ${data.projectName}\n- Location: ${data.city}\n- Facility size: ${data.facilitySize} MW\n- Estimated water use: ${formatNumber(data.waterUse)} gallons/day (${formatGallons(screening.annualWater)}/year)\n- Cooling: ${labels.cooling[data.coolingType]}\n- Water-stress context: ${labels.stress[data.waterStress]}\n- Water source: ${labels.source[data.waterSource]}\n- Wastewater/discharge plan: ${labels.wastewater[data.wastewaterPlan]}\n- Local notes: ${data.notes || 'None supplied'}\n- Screening priority: ${screening.label}\n\nReturn exactly these three sections, using the headings shown:\n1. Summary\n2. Potential Environmental Considerations\n3. Information Residents Should Request\n\nIn Summary, provide 2-3 sentences. In Potential Environmental Considerations, provide 3 concise bullets covering water availability, water quality/wastewater or chemicals, and one additional relevant issue such as electricity demand, heat, noise, or backup generators. In Information Residents Should Request, provide 5 specific public-record questions. Keep the total under 450 words.`;
}

async function getEnvironmentalBrief(apiKey, data, screening) {
  return fetchJson('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You provide cautious, neutral environmental screening information. You never present estimates as verified engineering conclusions.' },
        { role: 'user', content: buildAiPrompt(data, screening) }
      ],
      temperature: 0.25,
      max_tokens: 700
    })
  });
}

function formatAiText(text) {
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  let output = '';
  let inList = false;
  for (const line of lines) {
    const heading = /^(1\.|2\.|3\.)\s/.test(line);
    const bullet = /^[-•]\s/.test(line);
    if (heading) {
      if (inList) { output += '</ul>'; inList = false; }
      output += `<h4>${escapeHtml(line.replace(/^\d\.\s*/, ''))}</h4>`;
    } else if (bullet) {
      if (!inList) { output += '<ul>'; inList = true; }
      output += `<li>${escapeHtml(line.replace(/^[-•]\s*/, ''))}</li>`;
    } else {
      if (inList) { output += '</ul>'; inList = false; }
      output += `<p>${escapeHtml(line)}</p>`;
    }
  }
  if (inList) output += '</ul>';
  return output;
}

function buildQuestions(data) {
  return [
    `What is the maximum daily, monthly, and annual water withdrawal requested for ${data.projectName}, including summer peak demand?`,
    `Which source will supply the water (${labels.source[data.waterSource]}), and what capacity or drought-contingency analysis supports that plan?`,
    `Will the project use potable, reclaimed, groundwater, or surface water at different times of year, and how will those volumes be reported publicly?`,
    `What wastewater, cooling-tower blowdown, treatment chemicals, or other discharges will be generated, and which permits or monitoring requirements apply?`,
    `What enforceable limits, reporting commitments, or mitigation measures will protect nearby residents and waterways if water stress worsens?`
  ];
}

function displayScreening(data, screening) {
  resultsTitle.textContent = `${data.projectName}: environmental impact snapshot`;
  annualWaterValue.textContent = formatGallons(screening.annualWater);
  annualWaterNote.textContent = `${formatNumber(data.waterUse)} gallons/day × 365 days`;
  householdValue.textContent = formatNumber(screening.householdYears);
  riskLabel.textContent = screening.label;
  riskExplanation.textContent = screening.explanation;

  questionList.innerHTML = '';
  buildQuestions(data).forEach((question) => {
    const item = document.createElement('li');
    item.textContent = question;
    questionList.appendChild(item);
  });

  const assumptions = [
    ['Location', data.city],
    ['Facility size', `${formatNumber(data.facilitySize)} MW`],
    ['Water estimate', `${formatNumber(data.waterUse)} gallons/day`],
    ['Cooling approach', labels.cooling[data.coolingType]],
    ['Water-stress context', labels.stress[data.waterStress]],
    ['Water source', labels.source[data.waterSource]],
    ['Wastewater plan', labels.wastewater[data.wastewaterPlan]],
    ['Local notes', data.notes || 'No additional notes supplied']
  ];
  assumptionGrid.innerHTML = assumptions.map(([label, value]) => `
    <div class="col-12 col-md-6 col-lg-3">
      <div class="assumption-tile p-3 h-100">
        <div class="small text-uppercase fw-bold text-success mb-1">${escapeHtml(label)}</div>
        <div>${escapeHtml(value)}</div>
      </div>
    </div>
  `).join('');
}

function displayAiResponse(openAiData) {
  const message = openAiData.choices?.[0]?.message?.content?.trim();
  if (!message) throw new Error('The AI response did not include an environmental brief.');
  aiBrief.innerHTML = formatAiText(message);
  const usage = openAiData.usage;
  tokenUsage.textContent = usage
    ? `AI response usage — prompt: ${usage.prompt_tokens}, completion: ${usage.completion_tokens}, total: ${usage.total_tokens}.`
    : 'AI response usage was not returned for this request.';
  return message;
}

async function handleAnalyze() {
  clearError();
  resultsArea.classList.add('d-none');
  const data = getFormData();
  const validationError = validateForm(data);
  if (validationError) { showError(validationError); return; }

  try {
    const screening = calculateScreening(data);
    setLoading(true, 'Calculating transparent screening estimates...');
    displayScreening(data, screening);
    setLoading(true, 'Creating an AI plain-language environmental brief...');
    const openAiData = await getEnvironmentalBrief(data.apiKey, data, screening);
    const brief = displayAiResponse(openAiData);
    activeScenario = { ...data, screening, brief, createdAt: new Date().toISOString() };
    resultsArea.classList.remove('d-none');
    renderSavedScenarios();
  } catch (error) {
    showError(error.message || 'Something went wrong. Please try again.');
  } finally {
    setLoading(false);
  }
}

function getSavedScenarios() {
  try { return JSON.parse(localStorage.getItem(SAVED_SCENARIOS_KEY)) || []; }
  catch { return []; }
}

function renderSavedScenarios() {
  const saved = getSavedScenarios();
  savedSection.classList.toggle('d-none', saved.length === 0);
  savedScenarioList.innerHTML = saved.map((scenario, index) => `
    <div class="col-12 col-md-6 col-lg-4">
      <article class="card saved-card h-100">
        <div class="card-body">
          <p class="small text-uppercase fw-bold text-success mb-1">${escapeHtml(scenario.city)}</p>
          <h3 class="h5">${escapeHtml(scenario.projectName)}</h3>
          <p class="text-secondary small mb-3">${formatNumber(scenario.waterUse)} gal/day · ${scenario.screening.label} screening priority</p>
          <button type="button" class="btn btn-sm btn-outline-success" data-load-scenario="${index}">Load scenario</button>
        </div>
      </article>
    </div>
  `).join('');

  document.querySelectorAll('[data-load-scenario]').forEach((button) => {
    button.addEventListener('click', () => loadSavedScenario(Number(button.dataset.loadScenario)));
  });
}

function loadSavedScenario(index) {
  const scenario = getSavedScenarios()[index];
  if (!scenario) return;
  cityInput.value = scenario.city;
  projectNameInput.value = scenario.projectName;
  facilitySizeInput.value = scenario.facilitySize;
  waterUseInput.value = scenario.waterUse;
  coolingTypeSelect.value = scenario.coolingType;
  waterStressSelect.value = scenario.waterStress;
  waterSourceSelect.value = scenario.waterSource;
  wastewaterSelect.value = scenario.wastewaterPlan;
  notesInput.value = scenario.notes || '';
  const screening = calculateScreening(scenario);
  displayScreening(scenario, screening);
  aiBrief.innerHTML = formatAiText(scenario.brief || 'Saved scenario did not include an AI brief. Create a new brief to generate one.');
  tokenUsage.textContent = `Loaded saved scenario from ${new Date(scenario.createdAt).toLocaleString()}.`;
  activeScenario = { ...scenario, screening };
  clearError();
  resultsArea.classList.remove('d-none');
  window.scrollTo({ top: resultsArea.offsetTop - 24, behavior: 'smooth' });
}

function saveActiveScenario() {
  if (!activeScenario) { showError('Create a brief before saving a scenario.'); return; }
  const scenarios = getSavedScenarios();
  const withoutDuplicate = scenarios.filter((scenario) => !(scenario.projectName === activeScenario.projectName && scenario.city === activeScenario.city));
  withoutDuplicate.unshift(activeScenario);
  localStorage.setItem(SAVED_SCENARIOS_KEY, JSON.stringify(withoutDuplicate.slice(0, 12)));
  renderSavedScenarios();
  saveScenarioButton.textContent = 'Saved';
  setTimeout(() => { saveScenarioButton.textContent = 'Save scenario'; }, 1600);
}

function loadExample() {
  cityInput.value = 'Cumming, GA';
  projectNameInput.value = 'Example Northside Data Campus';
  facilitySizeInput.value = '150';
  waterUseInput.value = '500000';
  coolingTypeSelect.value = 'hybrid';
  waterStressSelect.value = 'moderate';
  waterSourceSelect.value = 'municipal';
  wastewaterSelect.value = 'municipal';
  notesInput.value = 'Example only: residents want more clarity about summer water demand, wastewater treatment capacity, and impacts on nearby streams.';
  apiKeyInput.focus();
}

analyzeButton.addEventListener('click', handleAnalyze);
loadExampleButton.addEventListener('click', loadExample);
saveScenarioButton.addEventListener('click', saveActiveScenario);
printButton.addEventListener('click', () => window.print());
clearSavedButton.addEventListener('click', () => {
  localStorage.removeItem(SAVED_SCENARIOS_KEY);
  renderSavedScenarios();
});

[cityInput, projectNameInput, facilitySizeInput, waterUseInput].forEach((input) => {
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') handleAnalyze();
  });
});

renderSavedScenarios();
