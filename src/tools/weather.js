import { USER_AGENT } from "../constants.js";

/**
 * Tool: weather
 *
 * Returns current weather conditions for any city or location.
 * Uses the Open-Meteo API (free, no API key required) combined with
 * the Open-Meteo geocoding API to resolve the city name to coordinates.
 */

const WMO_CODES = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Icy fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  77: "Snow grains",
  80: "Slight showers",
  81: "Moderate showers",
  82: "Violent showers",
  85: "Slight snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

export const weatherTool = {
  name: "weather",
  description:
    "Returns the current weather conditions (temperature, wind speed, conditions) " +
    "for a given city or location. Use this when the user asks about the weather.",
  parameters: {
    type: "object",
    properties: {
      location: {
        type: "string",
        description: "City name or location, e.g. 'New York', 'London', 'Tokyo'.",
      },
    },
    required: ["location"],
  },

  /**
   * Execute the tool.
   * @param {{ location: string }} params
   * @returns {Promise<string>}
   */
  async execute({ location }) {
    try {
      // Step 1: Geocode the location name → latitude/longitude
      const geoUrl =
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location.trim())}&count=1&language=en&format=json`;

      const geoRes = await fetch(geoUrl, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!geoRes.ok) {
        return `Geocoding request failed with status ${geoRes.status}.`;
      }
      const geoData = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        return `Could not find location: "${location}". Try a different city name.`;
      }

      const place = geoData.results[0];
      const { latitude, longitude, name, country } = place;

      // Step 2: Fetch current weather from Open-Meteo
      const weatherUrl =
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
        `&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weathercode` +
        `&temperature_unit=celsius&wind_speed_unit=kmh&timezone=auto`;

      const weatherRes = await fetch(weatherUrl, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!weatherRes.ok) {
        return `Weather request failed with status ${weatherRes.status}.`;
      }
      const weatherData = await weatherRes.json();
      const c = weatherData.current;

      const condition = WMO_CODES[c.weathercode] ?? `Code ${c.weathercode}`;
      const tempC = c.temperature_2m;
      const tempF = ((tempC * 9) / 5 + 32).toFixed(1);
      const humidity = c.relative_humidity_2m;
      const wind = c.wind_speed_10m;

      return (
        `🌤️ **Weather in ${name}, ${country}**\n` +
        `• Conditions: ${condition}\n` +
        `• Temperature: ${tempC}°C / ${tempF}°F\n` +
        `• Humidity: ${humidity}%\n` +
        `• Wind speed: ${wind} km/h`
      );
    } catch (err) {
      return `Error fetching weather: ${err.message}`;
    }
  },
};
