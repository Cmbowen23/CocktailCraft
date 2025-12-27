/**
 * Formats bottle size in ml to a user-friendly display string.
 * Converts 1000ml → "1 L", 1500ml → "1.5 L", etc.
 * 
 * @param {number|null|undefined} sizeMl - Size in milliliters
 * @returns {string} Formatted size string
 */
export function formatBottleSize(sizeMl) {
  if (!sizeMl) return "-";

  // Exact liter mappings for common sizes
  if (sizeMl === 1000) return "1 L";
  if (sizeMl === 1500) return "1.5 L";
  if (sizeMl === 1750) return "1.75 L";
  if (sizeMl === 750) return "750 ml";
  if (sizeMl === 375) return "375 ml";

  // Any other multiple of 1000ml → X L
  if (sizeMl >= 1000 && sizeMl % 1000 === 0) {
    const liters = sizeMl / 1000;
    return `${liters} L`;
  }

  // For values < 10 entered as liters (e.g., 1.75)
  if (sizeMl < 10) {
    const liters = sizeMl;
    return liters % 1 === 0 ? `${liters} L` : `${liters.toFixed(2)} L`;
  }

  // Default: ml for anything else
  return `${sizeMl} ml`;
}