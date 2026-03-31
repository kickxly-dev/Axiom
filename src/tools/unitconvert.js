/**
 * Tool: unit_convert
 * Converts between common units of measurement.
 * Supports length, weight, volume, speed, and temperature.
 * Pure math — no external API needed.
 */

/** metres per second per km/h */
const KMH_TO_MS = 1000 / 3600;

/**
 * Non-temperature units expressed as a multiplier to a shared base unit.
 *
 * Base units:
 *   length  → metre
 *   weight  → kilogram
 *   volume  → litre
 *   speed   → metre per second
 *
 * @type {Record<string, { base: string, factor: number }>}
 */
const UNITS = {
  // Length
  km:      { base: "length", factor: 1000 },
  kilometer:   { base: "length", factor: 1000 },
  kilometers:  { base: "length", factor: 1000 },
  m:       { base: "length", factor: 1 },
  meter:   { base: "length", factor: 1 },
  meters:  { base: "length", factor: 1 },
  metre:   { base: "length", factor: 1 },
  metres:  { base: "length", factor: 1 },
  cm:      { base: "length", factor: 0.01 },
  centimeter:  { base: "length", factor: 0.01 },
  centimeters: { base: "length", factor: 0.01 },
  mm:      { base: "length", factor: 0.001 },
  millimeter:  { base: "length", factor: 0.001 },
  millimeters: { base: "length", factor: 0.001 },
  mile:    { base: "length", factor: 1609.344 },
  miles:   { base: "length", factor: 1609.344 },
  yard:    { base: "length", factor: 0.9144 },
  yards:   { base: "length", factor: 0.9144 },
  ft:      { base: "length", factor: 0.3048 },
  foot:    { base: "length", factor: 0.3048 },
  feet:    { base: "length", factor: 0.3048 },
  in:      { base: "length", factor: 0.0254 },
  inch:    { base: "length", factor: 0.0254 },
  inches:  { base: "length", factor: 0.0254 },

  // Weight
  kg:      { base: "weight", factor: 1 },
  kilogram:    { base: "weight", factor: 1 },
  kilograms:   { base: "weight", factor: 1 },
  g:       { base: "weight", factor: 0.001 },
  gram:    { base: "weight", factor: 0.001 },
  grams:   { base: "weight", factor: 0.001 },
  mg:      { base: "weight", factor: 0.000001 },
  milligram:   { base: "weight", factor: 0.000001 },
  milligrams:  { base: "weight", factor: 0.000001 },
  lb:      { base: "weight", factor: 0.453592 },
  lbs:     { base: "weight", factor: 0.453592 },
  pound:   { base: "weight", factor: 0.453592 },
  pounds:  { base: "weight", factor: 0.453592 },
  oz:      { base: "weight", factor: 0.0283495 },
  ounce:   { base: "weight", factor: 0.0283495 },
  ounces:  { base: "weight", factor: 0.0283495 },
  ton:     { base: "weight", factor: 1000 },
  tons:    { base: "weight", factor: 1000 },
  tonne:   { base: "weight", factor: 1000 },
  tonnes:  { base: "weight", factor: 1000 },

  // Volume
  l:       { base: "volume", factor: 1 },
  liter:   { base: "volume", factor: 1 },
  liters:  { base: "volume", factor: 1 },
  litre:   { base: "volume", factor: 1 },
  litres:  { base: "volume", factor: 1 },
  ml:      { base: "volume", factor: 0.001 },
  milliliter:  { base: "volume", factor: 0.001 },
  milliliters: { base: "volume", factor: 0.001 },
  gallon:  { base: "volume", factor: 3.78541 },
  gallons: { base: "volume", factor: 3.78541 },
  quart:   { base: "volume", factor: 0.946353 },
  quarts:  { base: "volume", factor: 0.946353 },
  pint:    { base: "volume", factor: 0.473176 },
  pints:   { base: "volume", factor: 0.473176 },
  cup:     { base: "volume", factor: 0.236588 },
  cups:    { base: "volume", factor: 0.236588 },
  floz:    { base: "volume", factor: 0.0295735 },
  "fl oz": { base: "volume", factor: 0.0295735 },

  // Speed
  "m/s":   { base: "speed", factor: 1 },
  "km/h":  { base: "speed", factor: KMH_TO_MS },
  kph:     { base: "speed", factor: KMH_TO_MS },
  mph:     { base: "speed", factor: 0.44704 },
  knot:    { base: "speed", factor: 0.514444 },
  knots:   { base: "speed", factor: 0.514444 },
};

const TEMP_UNITS = new Set(["c", "celsius", "f", "fahrenheit", "k", "kelvin"]);

/**
 * Convert a temperature value between Celsius, Fahrenheit, and Kelvin.
 * Returns the converted value, or null if a unit is unrecognised.
 */
function convertTemperature(value, from, to) {
  let celsius;
  switch (from) {
    case "c":
    case "celsius":
      celsius = value;
      break;
    case "f":
    case "fahrenheit":
      celsius = (value - 32) * (5 / 9);
      break;
    case "k":
    case "kelvin":
      celsius = value - 273.15;
      break;
    default:
      return null;
  }

  switch (to) {
    case "c":
    case "celsius":
      return celsius;
    case "f":
    case "fahrenheit":
      return celsius * (9 / 5) + 32;
    case "k":
    case "kelvin":
      return celsius + 273.15;
    default:
      return null;
  }
}

export const unitconvertTool = {
  name: "unit_convert",
  description:
    "Converts a value between units of measurement. " +
    "Supports length (km, miles, feet, inches…), weight (kg, lbs, oz…), " +
    "volume (liters, gallons, cups…), speed (mph, km/h, m/s…), and temperature (°C, °F, K). " +
    "Use this whenever the user asks to convert units.",
  parameters: {
    type: "object",
    properties: {
      value: {
        type: "number",
        description: "The numeric value to convert.",
      },
      from: {
        type: "string",
        description: "The source unit, e.g. 'miles', 'fahrenheit', 'kg', 'km/h'.",
      },
      to: {
        type: "string",
        description: "The target unit, e.g. 'km', 'celsius', 'lbs', 'mph'.",
      },
    },
    required: ["value", "from", "to"],
  },

  /**
   * Execute the tool.
   * @param {{ value: number, from: string, to: string }} params
   * @returns {string}
   */
  execute({ value, from, to }) {
    const fromKey = from.toLowerCase().trim();
    const toKey   = to.toLowerCase().trim();

    // Temperature (special-cased — not a simple multiplicative conversion)
    if (TEMP_UNITS.has(fromKey) || TEMP_UNITS.has(toKey)) {
      const result = convertTemperature(value, fromKey, toKey);
      if (result === null) {
        return `Error: unrecognised temperature unit. Use celsius, fahrenheit, or kelvin.`;
      }
      const rounded = Math.round(result * 100) / 100;
      return `${value} ${from} = ${rounded} ${to}`;
    }

    const fromDef = UNITS[fromKey];
    const toDef   = UNITS[toKey];

    if (!fromDef) return `Error: unrecognised unit "${from}".`;
    if (!toDef)   return `Error: unrecognised unit "${to}".`;
    if (fromDef.base !== toDef.base) {
      return `Error: cannot convert ${from} (${fromDef.base}) to ${to} (${toDef.base}).`;
    }

    const inBase = value * fromDef.factor;
    const result = inBase / toDef.factor;

    // Round to at most 6 significant figures to avoid floating-point noise.
    const rounded = parseFloat(result.toPrecision(6));
    return `${value} ${from} = ${rounded} ${to}`;
  },
};
