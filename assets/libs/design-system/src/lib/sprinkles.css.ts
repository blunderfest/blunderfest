import { createSprinkles, defineProperties } from "@vanilla-extract/sprinkles";
import { CustomMedia } from "open-props/src/props.media";

import { colorProps, responsiveProps, unresponsiveProps } from "./props";

const unresponsiveProperties = defineProperties({
    properties: unresponsiveProps,
});

const responsiveProperties = defineProperties({
    conditions: {
        mobile: {},
        tablet: { "@media": CustomMedia["--md-n-above"] },
        desktop: { "@media": CustomMedia["--lg-n-above"] },
    },
    defaultCondition: "mobile",
    properties: responsiveProps,
    shorthands: {},
});

const colorAtomicProps = defineProperties({
    conditions: {
        lightMode: {},
        darkMode: { "@media": CustomMedia["--OSdark"] },
    },
    defaultCondition: "lightMode",
    properties: colorProps,
});

export const sprinkles = createSprinkles(unresponsiveProperties, colorAtomicProps, responsiveProperties);

// It's a good idea to export the Sprinkles type too
export type Sprinkles = Parameters<typeof sprinkles>[0];
