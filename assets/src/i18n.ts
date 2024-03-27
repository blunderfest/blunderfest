import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";

export const defaultNS = "translation" as const;

export const resources = {
  en: {
    pieces: {
      "black.king": "Black king",
      "black.queen": "Black queen",
      "black.rook": "Black rook",
      "black.bishop": "Black bishop",
      "black.knight": "Black knight",
      "black.pawn": "Black pawn",
      "white.king": "White king",
      "white.queen": "White queen",
      "white.rook": "White rook",
      "white.bishop": "White bishop",
      "white.knight": "White knight",
      "white.pawn": "White pawn",
    },

    translation: {
      description: {
        part1: "Edit <1>src/App.js</1> and save to reload.",
        part2: "Learn React",
      },
      counter_one: "Changed language just once",
      counter_other: "Changed language already {{count}} times",
    },
  },
  nl: {
    pieces: {
      "black.king": "Zwarte koning",
      "black.queen": "Zwarte dame",
      "black.rook": "Zwarte toren",
      "black.bishop": "Zwarte loper",
      "black.knight": "Zwarte paard",
      "black.pawn": "Zwarte pion",
      "white.king": "Witte koning",
      "white.queen": "Witte dame",
      "white.rook": "Witte toren",
      "white.bishop": "Witte loper",
      "white.knight": "Witte paard",
      "white.pawn": "Witte pion",
    },
    translation: {
      description: {
        part1: "Ändere <1>src/App.js</1> und speichere um neu zu laden.",
        part2: "Lerne React",
      },
      counter_one: "Die Sprache wurde erst ein mal gewechselt",
      counter_other: "Die Sprache wurde {{count}} mal gewechselt",
    },
  },
} as const;

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    lng: "en",
    ns: ["translation", "piece"],
    defaultNS,
    resources,
  });

export default i18n;
