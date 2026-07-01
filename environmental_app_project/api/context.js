function latestRecord(records) {
  if (!Array.isArray(records) || records.length === 0) return null;
  return records[records.length - 1];
}

function droughtLabel(dsci) {
  if (!Number.isFinite(dsci)) return 'Unavailable';
  if (dsci >= 300) return 'High drought severity';
  if (dsci >= 150) return 'Moderate drought severity';
  if (dsci > 0) return 'Abnormally dry / low drought severity';
  return 'No drought category reported';
}

export default async function handler(request, response) {
  const zip = String(request.query?.zip || '').replace(/\D/g, '').slice(0, 5);
  if (!/^\d{5}$/.test(zip)) return response.status(400).json({ error: 'A valid 5-digit ZIP code is required.' });

  try {
    const zipResponse = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!zipResponse.ok) return response.status(404).json({ error: 'ZIP code not found.' });
    const zipData = await zipResponse.json();
    const place = zipData.places?.[0];
    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);

    const [censusResult, countyResult, weatherPointResult] = await Promise.allSettled([
      fetch(`https://api.census.gov/data/2023/acs/acs5?get=NAME,B01003_001E&for=zip%20code%20tabulation%20area:${zip}`).then((r) => r.ok ? r.json() : null),
      fetch(`https://geo.fcc.gov/api/census/area?lat=${latitude}&lon=${longitude}&format=json`).then((r) => r.ok ? r.json() : null),
      fetch(`https://api.weather.gov/points/${latitude},${longitude}`, { headers: { 'User-Agent': 'Data-Center-Risk-Analyzer educational project (student@example.edu)', Accept: 'application/geo+json' } }).then((r) => r.ok ? r.json() : null)
    ]);

    const census = censusResult.status === 'fulfilled' ? censusResult.value : null;
    const countyInfo = countyResult.status === 'fulfilled' ? countyResult.value?.results?.[0] : null;
    const pointData = weatherPointResult.status === 'fulfilled' ? weatherPointResult.value : null;
    const countyFips = countyInfo?.county_fips;

    let weather = { label: 'Unavailable' };
    if (pointData?.properties?.forecast) {
      const forecastResponse = await fetch(pointData.properties.forecast, { headers: { 'User-Agent': 'Data-Center-Risk-Analyzer educational project (student@example.edu)', Accept: 'application/geo+json' } });
      const forecastData = forecastResponse.ok ? await forecastResponse.json() : null;
      const period = forecastData?.properties?.periods?.[0];
      if (period) weather = { label: `${period.temperature}°${period.temperatureUnit}, ${period.shortForecast}; precipitation chance ${period.probabilityOfPrecipitation?.value ?? 'not reported'}%`, source: 'NOAA National Weather Service' };
    }

    let drought = { label: 'Unavailable', dsci: null, source: 'U.S. Drought Monitor' };
    if (countyFips) {
      const end = new Date();
      const start = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const format = (date) => `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
      const droughtResponse = await fetch(`https://usdmdataservices.unl.edu/api/CountyStatistics/GetDSCI?aoi=${countyFips}&startdate=${encodeURIComponent(format(start))}&enddate=${encodeURIComponent(format(end))}&statisticsType=1`, { headers: { Accept: 'application/json' } });
      const droughtData = droughtResponse.ok ? await droughtResponse.json() : null;
      const record = latestRecord(droughtData);
      const rawDsci = record?.DSCI ?? record?.dsci ?? record?.DroughtSeverityandCoverageIndex;
      const dsci = rawDsci === null || rawDsci === undefined ? null : Number(rawDsci);
      drought = { label: droughtLabel(dsci), dsci: Number.isFinite(dsci) ? dsci : null, source: 'U.S. Drought Monitor county DSCI' };
    }

    const population = census?.[1]?.[1] ? Number(census[1][1]) : null;
    return response.status(200).json({
      location: { zip, city: place['place name'], state: place['state abbreviation'], latitude, longitude },
      population,
      county: countyInfo ? { name: countyInfo.county_name, fips: countyFips } : null,
      drought,
      weather,
      sourceMode: 'Vercel public-data lookup'
    });
  } catch {
    return response.status(502).json({ error: 'Public location context could not be retrieved. Please try again.' });
  }
}
