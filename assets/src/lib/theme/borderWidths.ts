import { defineTokens } from "@pandacss/dev";
import Borders from "open-props/src/borders";
import { convert } from "./converter";

export const borderWidths = defineTokens.borderWidths(convert(Borders, "--border-size-"));
