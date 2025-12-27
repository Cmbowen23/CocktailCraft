/**
 * Safe string utilities to prevent runtime crashes from calling string methods on non-strings
 */

export function safeString(value) {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  // If it's an object with a common name field, use it
  if (typeof value === "object") {
    if (typeof value.name === "string") return value.name;
    if (typeof value.label === "string") return value.label;
    if (typeof value.title === "string") return value.title;
  }
  return String(value);
}

export function safeLower(value) {
  return safeString(value).toLowerCase();
}

export function safeUpper(value) {
  return safeString(value).toUpperCase();
}

export function safeTrim(value) {
  return safeString(value).trim();
}

export function safeIncludes(str, searchString) {
  return safeString(str).includes(safeString(searchString));
}

export function safeStartsWith(str, searchString) {
  return safeString(str).startsWith(safeString(searchString));
}

export function safeEndsWith(str, searchString) {
  return safeString(str).endsWith(safeString(searchString));
}