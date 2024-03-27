import { defaultNS } from "@/i18n";
import en from "@/locales/en/translation.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: typeof defaultNS;
    resources: {
      translation: typeof en;
    };
  }
}
