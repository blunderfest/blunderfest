import type { Dict } from "@pandacss/types";
import css from "css";

export const camelize = (text: string) => {
    return text
        .replace(/[-]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ""))
        .toLowerCase()
        .replace(/^./, (match) => match.toLowerCase());
};

export const transformOpenPropsObj = (obj: Dict, keyTransform = camelize, valueTransform = (text: string) => text) =>
    Object.fromEntries(Object.entries(obj).map(([key, value]) => [keyTransform(key), { value: valueTransform(value) }]));

type Keyframes = Omit<Required<css.KeyFrames>, "keyframes"> & { keyframes: Array<Required<css.KeyFrame>> };

export const cssKeyframesToObj = (_css: string) => {
    const parsedCss = css.parse(_css);
    const stylesheet = parsedCss.stylesheet;
    if (!stylesheet) return {};

    function isKeyframe(rule: unknown): rule is Keyframes {
        return typeof rule === "object" && rule !== null && "keyframes" in rule && "type" in rule && rule.type === "keyframes";
    }

    const rule = stylesheet.rules[0];
    if (!isKeyframe(rule) || !rule.keyframes) return {};

    return rule.keyframes
        .map((keyframe) => {
            const key = keyframe.values.join(", ");
            const value = keyframe.declarations
                ?.map((decl: css.Declaration) => ({
                    [decl.property!]: decl.value,
                }))
                .reduce((acc, nxt) => Object.assign({}, acc, nxt), {});

            return { [key]: value };
        })
        .reduce((acc, nxt) => Object.assign({}, acc, nxt), {});
};
