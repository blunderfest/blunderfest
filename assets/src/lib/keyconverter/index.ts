function convert(obj: unknown, converter: (str: string) => string): unknown {
  if (Array.isArray(obj)) {
    return obj.map((value) => convert(value, converter));
  } else if (obj !== null && typeof obj === "object") {
    return Object.keys(obj).reduce((acc: Record<string, unknown>, key) => {
      const convertedKey = converter(key);
      acc[convertedKey] = convert(obj[key as keyof typeof obj], converter);
      return acc;
    }, {});
  }

  return obj;
}

export function convertKeysToCamelCase(obj: unknown) {
  return convert(obj, (str) => str.replace(/_./g, (match) => match.charAt(1).toUpperCase()));
}

export function convertKeysToSnakeCase(obj: unknown) {
  return convert(obj, (str) => str.replace(/([A-Z])/g, "_$1").toLowerCase());
}
