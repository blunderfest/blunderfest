import en from "@/translations/en.json";
import nl from "@/translations/nl.json";

export const resources = {
  en,
  nl,
};

export type Language = keyof typeof resources;
