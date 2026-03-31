/**
 * tools/weather.js
 *
 * Fetches current weather using:
 *   1. Open-Meteo Geocoding API (free, no key) to resolve city → lat/lon
 *   2. Open-Meteo Forecast API (free, no key) for current conditions
 */

const WMO_CODES = {
  0:  "Clear sky",
  1:  "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Rime fog",
  51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
  61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
  71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
  77: "Snow grains",
  80: "Slight showers", 81: "Moderate showers", 82: "Violent showers",
  85: "Snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail",
};

export const weatherTool = {
  name: "weather",
  description:
    "Get the current weather for any city. Returns temperature, " +
    "conditions, wind speed, and humidity.",
  parameters: {
    type: "object",
    properties: {
      location: {
        type:        "string",
        description: "City name, e.g. \"London\", \"New York\", \"Tokyo\".",
      },
      units: {
        type:        "string",
        enum:        ["celsius", "fahrenheit"],
        description: "Temperature unit. Defaults to celsius.",
      },
    },
    required: ["location"],
  },

  async execute({ location, units = "celsius" }) {
    if (!location?.trim()) return "Error: location cannot be empty.";

    // Step 1 — geocoding
    let lat, lon, resolvedName;
    try {
      const geoUrl =
        "https://geocoding-api.open-meteo.com/v1/search?" +
        new URLSearchParams({ name: location, count: "1", language: "en", format: "json" });
      const geoRes  = await fetch(geoUrl);
      if (!geoRes.ok) throw new Error(`Geocoding HTTP ${geoRes.status}`);
      const geoData = await geoRes.json();
      const place   = geoData.results?.[0];
      if (!place) return `Could not find location: "${location}". Try a major city name.`;
      lat          = place.latitude;
      lon          = place.longitude;
      resolvedName = [place.name, place.country].filter(Boolean).join(", ");
    } catch (err) {
      return `Error resolving location: ${err.message}`;
    }

    // Step 2 — weather
    try {
      const tempUnit   = units === "fahrenheit" ? "fahrenheit" : "celsius";
      const windUnit   = "kmh";
      const weatherUrl =
        "https://api.open-meteo.com/v1/forecast?" +
        new URLSearchParams({
          latitude:              String(lat),
          longitude:             String(lon),
          current:               "temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code",
          temperature_unit:      tempUnit,
          wind_speed_unit:       windUnit,
          timezone:              "auto",
        });

      const wRes  = await fetch(weatherUrl);
      if (!wRes.ok) throw new Error(`Weather HTTP ${wRes.status}`);
      const wData = await wRes.json();
      const c     = wData.current;

      const tempSuffix  = tempUnit === "fahrenheit" ? "°F" : "°C";
      const condition   = WMO_CODES[c.weather_code] ?? `Code ${c.weather_code}`;
      const humidity    = c.relative_humidity_2m;
      const wind        = c.wind_speed_10m;
      const temp        = c.temperature_2m;

      return (
        `Weather in ${resolvedName}:\n` +
        `• Condition: ${condition}\n` +
        `• Temperature: ${temp}${tempSuffix}\n` +
        `• Humidity: ${humidity}%\n` +
        `• Wind: ${wind} km/h`
      );
    } catch (err) {
      return `Error fetching weather: ${err.message}`;
    }
  },
};
