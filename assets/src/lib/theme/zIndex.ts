import { defineTokens } from "@pandacss/dev";
import ZIndex from "open-props/src/zindex";
import { convert } from "./converter";

export const zIndex = defineTokens.zIndex(convert(ZIndex, "--layer-"));
