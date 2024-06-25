export function deepGet(obj: Record<string, any>, keys: string[]): any {
  return keys.reduce((xs: any, x: string) => xs?.[x] ?? null, obj);
}

export function convert(obj: any, converter: (str: string) => string): any {
  if (Array.isArray(obj)) {
    return obj.map((value) => convert(value, converter));
  } else if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc: Record<string, any>, key) => {
      const convertedKey = converter(key);
      acc[convertedKey] = convert(obj[key], converter);
      return acc;
    }, {});
  }

  return obj;
}

export function convertKeysToCamelCase(obj: any) {
  return convert(obj, (str) => str.replace(/_./g, (match) => match.charAt(1).toUpperCase()));
}

export function convertKeysToSnakeCase(obj: any) {
  return convert(obj, (str) => str.replace(/([A-Z])/g, "_$1").toLowerCase());
}
