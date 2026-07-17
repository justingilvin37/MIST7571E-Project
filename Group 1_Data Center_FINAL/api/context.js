// Provides location context for a city or ZIP search, including weather, county, and population data.

const USER_AGENT =
  'Data-Center-Risk-Analyzer educational project (student@example.edu)';

const NWS_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'application/geo+json'
};

const JSON_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'application/json'
};

function toNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

async function fetchJson(url, options = {}) {
  const result = await fetch(url, options);

  if (!result.ok) {
    return null;
  }

  return result.json();
}

function celsiusToFahrenheit(celsius) {
  return (celsius * 9) / 5 + 32;
}

function millimetersToInches(millimeters) {
  return millimeters / 25.4;
}

function getStartDate(validTime) {
  if (!validTime || typeof validTime !== 'string') {
    return null;
  }

  const [start] = validTime.split('/');
  const date = new Date(start);

  return Number.isNaN(date.getTime()) ? null : date;
}

function getValuesWithinDays(values, days) {
  if (!Array.isArray(values)) {
    return [];
  }

  const now = Date.now();
  const cutoff = now + days * 24 * 60 * 60 * 1000;

  return values.filter((item) => {
    const startDate = getStartDate(item.validTime);
    const itemValue = toNumber(item.value);

    return (
      startDate &&
      itemValue !== null &&
      startDate.getTime() >= now &&
      startDate.getTime() <= cutoff
    );
  });
}

function averageGridValues(values, converter = (value) => value) {
  if (!values.length) {
    return null;
  }

  const convertedValues = values
    .map((item) => converter(Number(item.value)))
    .filter((value) => Number.isFinite(value));

  if (!convertedValues.length) {
    return null;
  }

  const total = convertedValues.reduce((sum, value) => sum + value, 0);
  return Math.round((total / convertedValues.length) * 10) / 10;
}

function sumGridValues(values, converter = (value) => value) {
  if (!values.length) {
    return null;
  }

  const convertedValues = values
    .map((item) => converter(Number(item.value)))
    .filter((value) => Number.isFinite(value));

  if (!convertedValues.length) {
    return null;
  }

  const total = convertedValues.reduce((sum, value) => sum + value, 0);
  return Math.round(total * 100) / 100;
}

async function getLocationFromZip(zip) {
  const zipData = await fetchJson(`https://api.zippopotam.us/us/${zip}`);

  if (!zipData) {
    return null;
  }

  const place = zipData.places?.[0];

  if (!place) {
    return null;
  }

  return {
    query: zip,
    zip,
    city: place['place name'],
    state: place['state abbreviation'],
    latitude: toNumber(place.latitude),
    longitude: toNumber(place.longitude)
  };
}

async function getLocationFromText(locationText) {
  const url = new URL('https://nominatim.openstreetmap.org/search');

  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '1');
  url.searchParams.set('countrycodes', 'us');
  url.searchParams.set('q', locationText);

  let results = await fetchJson(url.toString(), {
    headers: JSON_HEADERS
  });

  let match = Array.isArray(results) ? results[0] : null;

  if (!match) {
    const fallbackText = `${locationText}, USA`;
    url.searchParams.set('q', fallbackText);
    results = await fetchJson(url.toString(), {
      headers: JSON_HEADERS
    });
    match = Array.isArray(results) ? results[0] : null;
  }

  if (!match) {
    return null;
  }

  const address = match.address || {};

  return {
    query: locationText,
    zip: address.postcode || '',
    city:
      address.city ||
      address.town ||
      address.village ||
      address.hamlet ||
      address.county ||
      address.state ||
      locationText,
    state: address.state || '',
    latitude: toNumber(match.lat),
    longitude: toNumber(match.lon)
  };
}
async function getPopulation(zip) {
  if (!zip) {
    return null;
  }

  const census = await fetchJson(
    `https://api.census.gov/data/2023/acs/acs5?get=NAME,B01003_001E&for=zip%20code%20tabulation%20area:${zip}`
  );

  return census?.[1]?.[1] ? Number(census[1][1]) : null;
}

async function getCountyInfo(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const countyData = await fetchJson(
    `https://geo.fcc.gov/api/census/area?lat=${latitude}&lon=${longitude}&format=json`
  );

  const county = countyData?.results?.[0];

  if (!county) {
    return null;
  }

  return {
    name: county.county_name,
    fips: county.county_fips
  };
}

async function getNwsWeather(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return {
      label: 'Unavailable',
      averageTemperatureF: null,
      forecastPrecipitationIn: null,
      source: 'NOAA National Weather Service'
    };
  }

  const pointData = await fetchJson(
    `https://api.weather.gov/points/${latitude},${longitude}`,
    {
      headers: NWS_HEADERS
    }
  );

  let label = 'Unavailable';
  let averageTemperatureF = null;
  let forecastPrecipitationIn = null;

  if (pointData?.properties?.forecast) {
    const forecastData = await fetchJson(pointData.properties.forecast, {
      headers: NWS_HEADERS
    });

    const period = forecastData?.properties?.periods?.[0];

    if (period) {
      label = `${period.temperature}°${period.temperatureUnit}, ${
        period.shortForecast
      }; precipitation chance ${
        period.probabilityOfPrecipitation?.value ?? 'not reported'
      }%`;
    }
  }

  if (pointData?.properties?.forecastGridData) {
    const gridData = await fetchJson(pointData.properties.forecastGridData, {
      headers: NWS_HEADERS
    });

    const temperatureValues = getValuesWithinDays(
      gridData?.properties?.temperature?.values,
      7
    );

    const precipitationValues = getValuesWithinDays(
      gridData?.properties?.quantitativePrecipitation?.values,
      7
    );

    averageTemperatureF = averageGridValues(
      temperatureValues,
      celsiusToFahrenheit
    );

    forecastPrecipitationIn = sumGridValues(
      precipitationValues,
      millimetersToInches
    );
  }

  return {
    label,
    averageTemperatureF,
    forecastAverageTemperatureF: averageTemperatureF,
    averageRainfallIn: forecastPrecipitationIn,
    forecastPrecipitationIn,
    source: 'NOAA National Weather Service 7-day forecast grid data',
    note:
      'This is NOAA/NWS forecast data, not a 30-year historical climate normal.'
  };
}

export async function getLocationContext(searchTerm) {
  const cleanSearch = String(searchTerm || '').trim();

  if (!cleanSearch) {
    throw new Error('Please enter a city or ZIP code.');
  }

  const isZip = /^\d{5}$/.test(cleanSearch);
  const location = isZip
    ? await getLocationFromZip(cleanSearch)
    : await getLocationFromText(cleanSearch);

  if (!location) {
    throw new Error(
      isZip
        ? 'ZIP code not found. Try another U.S. ZIP code.'
        : 'Location not found. Try a city and state, such as "Athens, GA."'
    );
  }

  const [populationResult, countyResult, weatherResult] =
    await Promise.allSettled([
      getPopulation(location.zip),
      getCountyInfo(location.latitude, location.longitude),
      getNwsWeather(location.latitude, location.longitude)
    ]);

  return {
    location,
    population:
      populationResult.status === 'fulfilled' ? populationResult.value : null,
    county: countyResult.status === 'fulfilled' ? countyResult.value : null,
    weather:
      weatherResult.status === 'fulfilled'
        ? weatherResult.value
        : {
            label: 'Unavailable',
            averageTemperatureF: null,
            forecastPrecipitationIn: null,
            source: 'NOAA National Weather Service'
          },
    sourceMode: isZip
      ? 'ZIP lookup with NOAA weather data'
      : 'City search with NOAA weather data'
  };
}

export default async function handler(request, response) {
  const search = String(
    request.query?.search || request.body?.search || ''
  ).trim();

  if (!search) {
    return response.status(400).json({
      error: 'A city or ZIP code search is required.'
    });
  }

  try {
    const context = await getLocationContext(search);
    return response.status(200).json(context);
  } catch (error) {
    return response.status(404).json({
      error: error?.message || 'Location not found.'
    });
  }
}
