import { createSprinkles, defineProperties } from "@vanilla-extract/sprinkles";

import { CustomMedia } from "open-props/src/props.media";

const space = {
    none: 0,
    small: "4px",
    medium: "8px",
    large: "16px",
    // etc.
};

const unresponsiveProperties = defineProperties({
    properties: {
        borderStyle: ["groove", "solid"],
        borderWidth: space,
    },
});

const responsiveProperties = defineProperties({
    conditions: {
        mobile: {},
        tablet: { "@media": CustomMedia["--md-n-above"] },
        desktop: { "@media": CustomMedia["--lg-n-above"] },
    },
    defaultCondition: "mobile",
    properties: {
        display: ["none", "flex", "block", "inline"],
        flexDirection: ["row", "column"],
        justifyContent: ["stretch", "flex-start", "center", "flex-end", "space-around", "space-between"],
        alignItems: ["stretch", "flex-start", "center", "flex-end"],
        paddingTop: space,
        paddingBottom: space,
        paddingLeft: space,
        paddingRight: space,
        // etc.
    },
    shorthands: {
        padding: ["paddingTop", "paddingBottom", "paddingLeft", "paddingRight"],
        paddingX: ["paddingLeft", "paddingRight"],
        paddingY: ["paddingTop", "paddingBottom"],
        placeItems: ["justifyContent", "alignItems"],
    },
});

const colors = {
    red: "#F00",
    green: "#0F0",
    "blue-50": "#eff6ff",
    "blue-100": "#dbeafe",
    "blue-200": "#bfdbfe",
    "gray-700": "#374151",
    "gray-800": "#1f2937",
    "gray-900": "#111827",
    // etc.
};

const colorProperties = defineProperties({
    conditions: {
        lightMode: {},
        darkMode: { "@media": CustomMedia["--OSdark"] },
    },
    defaultCondition: "lightMode",
    properties: {
        color: colors,
        background: colors,
        borderColor: colors,
        // etc.
    },
});

export const sprinkles = createSprinkles(unresponsiveProperties, responsiveProperties, colorProperties);

// It's a good idea to export the Sprinkles type too
export type Sprinkles = Parameters<typeof sprinkles>[0];
