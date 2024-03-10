import Aspects from "open-props/src/aspects";
import { transformOpenPropsObj } from "./utils";

export const aspectRatios = transformOpenPropsObj(Aspects, (key) => key.replace("--ratio-", ""));
