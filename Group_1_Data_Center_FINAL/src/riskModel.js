// Provides the risk scoring logic and formatting helpers used by the app.
export const AVG_DATA_CENTER_WATER_GPD = 500_000;
export const HOUSEHOLD_WATER_GPD = 300;

function firstValidNumber(values) {
  const found = values.find((value) => {
    const numberValue = Number(value);
    return Number.isFinite(numberValue);
  });

  if (found === undefined || found === null || found === '') {
    return null;
  }

  return Number(found);
}

export function formatNumber(value) {
  return new Intl.NumberFormat('en-US').format(Math.round(Number(value) || 0));
}

export function formatGallons(value) {
  const numberValue = Number(value) || 0;

  if (numberValue >= 1_000_000_000) {
    return `${(numberValue / 1_000_000_000).toFixed(2)} billion gallons`;
  }

  if (numberValue >= 1_000_000) {
    return `${(numberValue / 1_000_000).toFixed(1)} million gallons`;
  }

  return `${formatNumber(numberValue)} gallons`;
}

export function getAverageTempF(context) {
  return firstValidNumber([
    context?.weather?.forecastAverageTemperatureF,
    context?.weather?.averageTemperatureF,
    context?.weather?.avgTempF,
    context?.weather?.avgTemp,
    context?.weather?.temperatureF,
    context?.weather?.temperature
  ]);
}

export function getForecastPrecipitationIn(context) {
  return firstValidNumber([
    context?.weather?.forecastPrecipitationIn,
    context?.weather?.averageRainfallIn,
    context?.weather?.avgRainfallIn,
    context?.weather?.precipitationIn,
    context?.weather?.rainfallIn
  ]);
}

export function getPlaceName(context) {
  const city = context?.location?.city;
  const state = context?.location?.state;
  const zip = context?.location?.zip;

  if (city && state) {
    return `${city}, ${state}`;
  }

  if (city) {
    return city;
  }

  if (zip) {
    return `ZIP ${zip}`;
  }

  return 'Selected location';
}

export function calculateRisk(context) {
  const averageTempF = getAverageTempF(context);
  const forecastPrecipitationIn = getForecastPrecipitationIn(context);
 

  const annualWaterUse = AVG_DATA_CENTER_WATER_GPD * 365;
  const householdYears = Math.round(
    annualWaterUse / (HOUSEHOLD_WATER_GPD * 365)
  );

  let score = 0;
  const breakdown = [];
  const missingData = [];

  score += 30;

  breakdown.push({
    id: 'water-demand',
    factor: 'Estimated data center water demand',
    value: `${formatNumber(AVG_DATA_CENTER_WATER_GPD)} gallons/day`,
    points: 30,
    impact: 'Moderate',
    explanation:
      'The app uses a fixed average data center estimate so users do not need to know technical project details.'
  });

  if (Number.isFinite(averageTempF)) {
    if (averageTempF >= 85) {
      score += 35;
      breakdown.push({
        id: 'temperature',
        factor: 'NOAA/NWS forecast average temperature',
        value: `${Math.round(averageTempF)}°F`,
        points: 35,
        impact: 'High',
        explanation:
          'Hotter conditions can increase cooling needs, which may increase energy or water pressure.'
      });
    } else if (averageTempF >= 75) {
      score += 25;
      breakdown.push({
        id: 'temperature',
        factor: 'NOAA/NWS forecast average temperature',
        value: `${Math.round(averageTempF)}°F`,
        points: 25,
        impact: 'Moderate',
        explanation:
          'The forecast temperature suggests moderate cooling pressure.'
      });
    } else if (averageTempF >= 65) {
      score += 15;
      breakdown.push({
        id: 'temperature',
        factor: 'NOAA/NWS forecast average temperature',
        value: `${Math.round(averageTempF)}°F`,
        points: 15,
        impact: 'Some concern',
        explanation:
          'The forecast temperature creates some cooling demand, but it is not a major risk driver.'
      });
    } else {
      score += 5;
      breakdown.push({
        id: 'temperature',
        factor: 'NOAA/NWS forecast average temperature',
        value: `${Math.round(averageTempF)}°F`,
        points: 5,
        impact: 'Lower',
        explanation:
          'Cooler forecast temperatures reduce estimated cooling-related risk.'
      });
    }
  } else {
    score += 10;
    missingData.push('NOAA/NWS forecast temperature');

    breakdown.push({
      id: 'temperature',
      factor: 'NOAA/NWS forecast average temperature',
      value: 'Unavailable',
      points: 10,
      impact: 'Unknown',
      explanation:
        'Temperature data was not available, so the score includes a small uncertainty penalty.'
    });
  }

  if (Number.isFinite(forecastPrecipitationIn)) {
    if (forecastPrecipitationIn < 0.25) {
      score += 35;
      breakdown.push({
        id: 'precipitation',
        factor: 'NOAA/NWS 7-day precipitation forecast',
        value: `${forecastPrecipitationIn.toFixed(2)} inches`,
        points: 35,
        impact: 'High',
        explanation:
          'Very little precipitation is forecast, which may increase short-term water-stress concerns.'
      });
    } else if (forecastPrecipitationIn < 0.75) {
      score += 25;
      breakdown.push({
        id: 'precipitation',
        factor: 'NOAA/NWS 7-day precipitation forecast',
        value: `${forecastPrecipitationIn.toFixed(2)} inches`,
        points: 25,
        impact: 'Moderate',
        explanation:
          'Lower forecast precipitation may increase concern about local water conditions.'
      });
    } else if (forecastPrecipitationIn < 1.5) {
      score += 15;
      breakdown.push({
        id: 'precipitation',
        factor: 'NOAA/NWS 7-day precipitation forecast',
        value: `${forecastPrecipitationIn.toFixed(2)} inches`,
        points: 15,
        impact: 'Some concern',
        explanation:
          'Some precipitation is forecast, but water demand should still be reviewed carefully.'
      });
    } else {
      score += 5;
      breakdown.push({
        id: 'precipitation',
        factor: 'NOAA/NWS 7-day precipitation forecast',
        value: `${forecastPrecipitationIn.toFixed(2)} inches`,
        points: 5,
        impact: 'Lower',
        explanation:
          'Higher forecast precipitation lowers the short-term precipitation-related risk signal.'
      });
    }
  } else {
    score += 10;
    missingData.push('NOAA/NWS precipitation forecast');

    breakdown.push({
      id: 'precipitation',
      factor: 'NOAA/NWS 7-day precipitation forecast',
      value: 'Unavailable',
      points: 10,
      impact: 'Unknown',
      explanation:
        'Precipitation data was not available, so the score includes a small uncertainty penalty.'
    });
  }

  const finalScore = Math.min(100, Math.round(score));
  const label =
    finalScore >= 70 ? 'High' : finalScore >= 40 ? 'Moderate' : 'Lower';

  const summary =
    label === 'High'
      ? 'This location may face meaningful environmental pressure from a typical data center, especially around water demand, precipitation, or cooling needs.'
      : label === 'Moderate'
        ? 'This location has some environmental concerns that should be reviewed before a data center is approved or built.'
        : 'This location appears lower risk based on the available screening factors, but local utility and permitting data should still be reviewed.';

  return {
    score: finalScore,
    label,
    summary,
    breakdown,
    missingData,
    annualWaterUse,
    householdYears,
    averageWaterUseGpd: AVG_DATA_CENTER_WATER_GPD
  };
}