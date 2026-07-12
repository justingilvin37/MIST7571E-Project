function value(input, fallback = 'Not provided') {
  return input === null || input === undefined || input === '' ? fallback : String(input);
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({ error: 'Method not allowed.' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return response.status(500).json({ error: 'OPENAI_API_KEY is missing from Vercel environment variables.' });
  }
  const { project, context, risk } = request.body || {};
  if (!project || !context?.location || !risk) {
    return response.status(400).json({ error: 'Project, location context, and risk data are required.' });
  }

  const proposalMode = risk.hasProposalData ? 'Project and location screen' : 'Location-only screen';
  const scenarioNote = project.scenario && project.scenario !== 'location'
    ? `Selected planning scenario: ${value(project.scenario)}. Capacity, water use, cooling, and source may be team-defined planning defaults rather than developer-verified facts. State that distinction clearly.`
    : 'No planning scenario was selected.';
  const prompt = `You are a neutral environmental-information assistant for indivials reviewing a possible data center. Use clear, concise language that the general public can understand. If a technical term is used, provide a simple explanation. Use only the data below. Do not invent local contamination, permits, water rights, legal rules, utility capacity, or causation. Treat omitted project fields as missing information to request, not as evidence of a problem. Explain that the score is a screening prompt, not a scientific prediction. Ensure that there is a distinction between verified and unverified information. Avoid speculation, advocacy, or policy recommendations. Use the following headings and structure:

Return 3 short sections with these exact headings:
Overall assessment - State the score and risk label, and summarize the reasons for that score with 2 to 3 reasons. Explain that the score is a screening prompt, not a scientific prediction.
Water and drought questions - Summarize the project's water use, cooling method, and source. Explain how that compares to local drought conditions and household water use. Note any missing or unverified information.
Wastewater and next steps - Summarize the project's wastewater handling and any missing or unverified information. Provide a clear next step for the public to request more information from their local authorities and utility providers. In this section, add some sample questions that the public could ask local authorities and utility providers to get more information about the project, its water use, and wastewater handling.

Screen type: ${proposalMode}.
${scenarioNote}
Location: ${value(context.location.city)}, ${value(context.location.state)}, ZIP ${value(context.location.zip)}.
Population context: ${value(context.population)}.
Drought context: ${value(context.drought?.label)}.
NOAA/NWS weather: ${value(context.weather?.label)}.
Project: ${value(project.name)}; ${value(project.capacity)} MW; ${value(project.waterUse)} gallons/day; cooling ${value(project.cooling)}; water source ${value(project.source)}; wastewater ${value(project.wastewater)}. Notes: ${value(project.notes)}.
Screening score: ${value(risk.score)}/100 (${value(risk.label)}). Reasons: ${Array.isArray(risk.reasons) && risk.reasons.length ? risk.reasons.join('; ') : 'No proposal impact signals were supplied'}.
Missing or unverified fields: ${Array.isArray(risk.missingFields) && risk.missingFields.length ? risk.missingFields.join('; ') : 'None listed'}.
Annual water calculation: ${project.waterUse === '' ? 'Not available because water use was not supplied.' : `${value(risk.annualWater)} gallons/year`}. Household comparison: ${project.waterUse === '' ? 'Not available.' : `${value(risk.householdYears)} household-years at 300 gallons/day`}.

Limit the response to 350 words.`;

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        temperature: 0.2,
        messages: [
          { role: 'system', content: 'You write careful public-information summaries using only provided structured data.' },
          { role: 'user', content: prompt }
        ]
      })
    });
    const data = await upstream.json();
    if (!upstream.ok) return response.status(upstream.status).json({ error: data?.error?.message || 'OpenAI request failed.' });
    return response.status(200).json({ brief: data.choices?.[0]?.message?.content || 'No AI response returned.' });
  } catch {
    return response.status(502).json({ error: 'The AI service could not be reached.' });
  }
}

const MAX_PROMPT_LENGTH = 4000;
  
  if (prompt.length > MAX_PROMPT_LENGTH) {
      return response.status(400).json({ 
      error:
        `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters.` });
    }