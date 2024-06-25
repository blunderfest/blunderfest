/**
 * @param {Object} obj
 * @param {string[]} keys
 */
export function deepGet(obj, keys) {
  return keys.reduce((xs, x) => xs?.[x] ?? null, obj);
}

/**
 * @param {any} obj
 * @param {(str: string) => string} converter
 */
export function convert(obj, converter) {
  if (Array.isArray(obj)) {
    return obj.map((value) => convert(value, converter));
  } else if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc, key) => {
      const convertedKey = converter(key);
      acc[convertedKey] = convert(obj[key], converter);

      return acc;
    }, {});
  }

  return obj;
}

export function convertKeysToCamelCase(obj) {
  return convert(obj, (str) => str.replace(/_./g, (match) => match.charAt(1).toUpperCase()));
}

export function convertKeysToSnakeCase(obj) {
  return convert(obj, (str) => str.replace(/([A-Z])/g, "_$1").toLowerCase());
}
