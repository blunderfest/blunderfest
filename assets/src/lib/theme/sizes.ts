import { defineTokens } from "@pandacss/dev";
import Sizes from "open-props/src/sizes";
import { convert } from "./converter";

const converted = convert(Sizes, "--size-");
converted["0"] = {
    value: "0",
};

export const sizes = defineTokens.sizes(converted);
