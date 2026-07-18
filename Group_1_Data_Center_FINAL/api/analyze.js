// Sends the location context and risk data to OpenAI and returns a plain-language summary.

const MAX_PROMPT_LENGTH = 4000;

function value(input, fallback = 'Not provided') {
  return input === null || input === undefined || input === ''
    ? fallback
    : String(input);
}

function formatBreakdown(breakdown) {
  if (!Array.isArray(breakdown) || breakdown.length === 0) {
    return 'No score breakdown was provided.';
  }

  return breakdown
    .map((item) => {
      return `${value(item.factor)}: +${value(item.points)} points, ${value(
        item.impact
      )} impact. ${value(item.explanation)}`;
    })
    .join('\n');
}

export function createAnalyzePrompt({ context, risk, averageDataCenter }) {
  const averageWaterUse =
    averageDataCenter?.waterUseGallonsPerDay ||
    risk.averageWaterUseGpd ||
    500000;

  return `You are a neutral environmental-information assistant for members of the public reviewing the possible impact of a data center.

Use clear language that a general audience can understand. Use only the data below. Do not invent local contamination, permits, legal rules, water rights, utility capacity, 
or causation. Explain that the score is an educational screening prompt, not a scientific prediction, engineering conclusion, legal conclusion, or permitting decision.

Write a concise 2-3 paragraph community impact summary covering:

1) Location context: Briefly describe the selected city and location.

2) Environmental conditions: Describe the current environmental conditions based on the weather and population data provided (do not repeat weather data verbatim—synthesize it into what it means for the area).

3) Risk score explanation: Explain what the overall risk score means and the primary environmental factor driving it. Focus on the key insight rather than repeating the detailed breakdown. Mention how data centers consume significant water and energy resources, and why these factors matter to the community.

Keep the tone neutral and informative. Limit to 250 words.

Location:
${value(context.location.city)}, ${value(context.location.state)}, ZIP ${value(
    context.location.zip
  )}

County:
${value(context.county?.name)} County

Population context:
${value(context.population)}

NOAA/NWS weather summary:
${value(context.weather?.label)}
NOAA/NWS forecast average temperature:
${value(context.weather?.averageTemperatureF)}°F
NOAA/NWS forecast precipitation:
${value(context.weather?.forecastPrecipitationIn)} inches
Weather source:
${value(context.weather?.source)}
Weather note:
${value(context.weather?.note)}

Average data center water-use assumption:
${value(averageWaterUse)} gallons per day

Annual water estimate:
${value(risk.annualWaterUse)} gallons per year

Screening score:
${value(risk.score)}/100

Risk label:
${value(risk.label)}

Score summary:
${value(risk.summary)}

Key risk factors:
${formatBreakdown(risk.breakdown)}`;
}

export async function analyzeContext({ context, risk, averageDataCenter }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      'OPENAI_API_KEY is missing from environment variables. Set it in your .env file.'
    );
  }

  const prompt = createAnalyzePrompt({ context, risk, averageDataCenter });

  if (prompt.length > MAX_PROMPT_LENGTH) {
    throw new Error(
      `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters.`
    );
  }

  let upstream;

  try {
    upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You write careful public-information summaries using only provided structured data.'
          },
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    });
  } catch (fetchError) {
    throw new Error('Could not reach OpenAI. Please check your network connection and try again.');
  }
  const data = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    let message =
      data?.error?.message || data?.error || `OpenAI request failed with status ${upstream.status}`;

    if (upstream.status === 401 || upstream.status === 403) {
      message =
        'OpenAI authentication failed. Verify that OPENAI_API_KEY is set correctly in your .env file.';
    } else if (upstream.status === 429) {
      message =
        'OpenAI rate limit or quota exceeded. Try again later or check your OpenAI account usage.';
    }

    throw new Error(message);
  }

  return data.choices?.[0]?.message?.content || 'No AI response returned.';
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    return response.status(405).json({
      error: 'Method not allowed.'
    });
  }

  if (!process.env.OPENAI_API_KEY) {
    return response.status(500).json({
      error: 'OPENAI_API_KEY is missing from environment variables.'
    });
  }

  const { context, risk, averageDataCenter } = request.body || {};

  if (!context?.location || !risk) {
    return response.status(400).json({
      error: 'Location context and risk data are required.'
    });
  }

  try {
    const brief = await analyzeContext({ context, risk, averageDataCenter });
    return response.status(200).json({ brief });
  } catch (error) {
    return response.status(502).json({
      error: error?.message || 'The AI service could not be reached.'
    });
  }
}
