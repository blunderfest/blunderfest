import { defineTokens } from "@pandacss/dev";
import Aspects from "open-props/src/aspects";
import { convert } from "./converter";

export const aspectRatios = defineTokens.aspectRatios(convert(Aspects, "--ratio-"));
