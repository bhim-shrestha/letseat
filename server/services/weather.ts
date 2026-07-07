import { getWeatherForLocationTool } from "../mcp/weather-server.js";

const WEATHER_CONDITIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Cloudy / Overcast",
  2: "Cloudy / Overcast",
  3: "Cloudy / Overcast",
  45: "Foggy",
  48: "Foggy",
  51: "Drizzling",
  53: "Drizzling",
  55: "Drizzling",
  56: "Drizzling",
  57: "Drizzling",
  61: "Raining",
  63: "Raining",
  65: "Raining",
  66: "Raining",
  67: "Raining",
  71: "Snowing",
  73: "Snowing",
  75: "Snowing",
  77: "Snowing",
  80: "Raining",
  81: "Raining",
  82: "Raining",
  85: "Snowing",
  86: "Snowing",
  95: "Thunderstorm",
  96: "Thunderstorm",
  99: "Thunderstorm"
};

const geocodeCache = new Map<string, { data: any, timestamp: number }>();
const GEOCODE_CACHE_TTL = 1000 * 60 * 60 * 24; // 24h
const MAX_GEOCODE_ENTRIES = 500;

function cacheGeocode(key: string, data: any) {
  while (geocodeCache.size >= MAX_GEOCODE_ENTRIES && !geocodeCache.has(key)) {
    const oldestKey = geocodeCache.keys().next().value;
    if (oldestKey === undefined) break;
    geocodeCache.delete(oldestKey);
  }
  geocodeCache.set(key, { data, timestamp: Date.now() });
}

export async function getRealTimeWeatherAndLocation(city: string, clientIp?: string) {
  let resolvedCityName = city;
  let weatherInfo = "Weather information could not be retrieved, assume typical weather for this time of year.";

  try {
    let userCountryCode = "";
    let userRegion = "";
    
    // NOTE: forwards client IP to freeipapi.com for geolocation. Disclosed in README's
    // privacy section. Set DISABLE_IP_GEOLOCATION=true to skip this call entirely.
    const ipPromise = (async () => {
      if (clientIp && process.env.DISABLE_IP_GEOLOCATION !== 'true') {
        try {
          // Validate IP format before use (IPv4 or IPv6 characters only)
          const ipIsValid = /^[\d.]+$/.test(clientIp) || /^[a-fA-F0-9:]+$/.test(clientIp);
          if (!ipIsValid) throw new Error("Invalid IP format");
          // Use freeipapi.com which supports HTTPS for secure geolocation
          const ipRes = await fetch(`https://freeipapi.com/api/json/${clientIp}`);
          if (ipRes.ok) {
            const ipData = await ipRes.json();
            // freeipapi uses countryCode and regionName matching our logic
            if (ipData && ipData.countryCode) {
              userCountryCode = ipData.countryCode;
              userRegion = ipData.regionName;
            }
          }
        } catch (e) {
          console.warn("Failed to get IP info", e);
        }
      }
    })();

    const cacheKey = city.toLowerCase();
    const geoPromise = (async () => {
      const cached = geocodeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < GEOCODE_CACHE_TTL) {
        return cached.data;
      }
      const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=10&language=en&format=json`);
      const data = await geoRes.json();
      cacheGeocode(cacheKey, data);
      return data;
    })();

    const [, geoData] = await Promise.all([ipPromise, geoPromise]);
    
    if (!geoData.results || geoData.results.length === 0) {
      console.warn(`Geocoding couldn't find "${city}". Rejecting — not a real city.`);
      const err: any = new Error(`We couldn't find a city called "${city}". Please enter a real city name.`);
      err.status = 404;
      throw err;
    }

    let bestMatch = geoData.results[0];
    
    // Attempt to find a match where the name actually matches what the user typed
    // This prevents Open-Meteo from returning aliases with higher populations (e.g., Dayton for "venice")
    const exactNameMatches = geoData.results.filter((r: any) => r.name.toLowerCase() === city.toLowerCase());
    if (exactNameMatches.length > 0) {
      bestMatch = exactNameMatches[0];
    }

    if (userCountryCode) {
      // Find the result that matches the user's country code, and possibly region
      const countryMatches = (exactNameMatches.length > 0 ? exactNameMatches : geoData.results).filter((r: any) => r.country_code === userCountryCode);
      if (countryMatches.length > 0) {
        let localMatch = countryMatches[0];
        if (userRegion) {
          const exactRegionMatch = countryMatches.find((r: any) => r.admin1 === userRegion);
          if (exactRegionMatch) localMatch = exactRegionMatch;
        }

        const bestPop = bestMatch.population || 0;
        const localPop = localMatch.population || 0;

        // Override the globally most prominent match ONLY IF the local match is reasonably significant
        // (at least 1/10th the population of the global top match) or if populations are unknown.
        // This prevents small local towns (like Venice, Ohio) from overriding major global cities (Venice, Italy).
        if (bestPop === 0 || localPop >= bestPop / 10) {
          bestMatch = localMatch;
        }
      }
    }

    const { latitude, longitude, name, country, admin1 } = bestMatch;
    resolvedCityName = `${name}, ${admin1 ? admin1 + ', ' : ''}${country}`;

    // Invoke our local MCP server tool to fetch weather
    const mcpResponse: any = await getWeatherForLocationTool({
      lat: latitude,
      lng: longitude
    });

    if (mcpResponse && !mcpResponse.isError && mcpResponse.content?.[0] && mcpResponse.content?.[0].type === "text") {
       const weatherRaw = JSON.parse(mcpResponse.content[0].text);
       const temp = weatherRaw.temperature;
       const code = weatherRaw.weathercode;
       const time = weatherRaw.time;

       const condition = WEATHER_CONDITIONS[code] || "Clear";

       weatherInfo = `The current real-time weather in ${resolvedCityName} is ${temp}°C and ${condition}.`;
       if (time) {
          // Open-Meteo returns time as a local ISO string when timezone=auto (e.g. "2024-01-15T14:30")
          // Parse hour/minute directly from the string to avoid server timezone offset contamination
          const timeParts = time.match(/T(\d{2}):(\d{2})/);
          if (timeParts) {
            const hour = parseInt(timeParts[1], 10);
            const minute = timeParts[2];
            const ampm = hour >= 12 ? 'PM' : 'AM';
            const hour12 = hour % 12 === 0 ? 12 : hour % 12;
            weatherInfo += ` The local time is approximately ${hour12}:${minute} ${ampm}.`;
          }
       }
    }
  } catch (e: any) {
    if (e.status === 404) throw e;
    console.error("Failed to fetch weather/geocoding:", e);
  }

  return { resolvedCityName, weatherInfo };
}
