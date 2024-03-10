import { defineTokens } from "@pandacss/dev";
import Fonts from "open-props/src/fonts";
import { convert } from "./converter";

export const fontSizes = defineTokens.fontSizes(convert(Fonts, "--font-size-"));
