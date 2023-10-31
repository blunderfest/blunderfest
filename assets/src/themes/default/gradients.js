import { defineTokens } from "@pandacss/dev";

export const gradients = defineTokens.gradients({
  background: {
    value: {
      type: "linear",
      placement: "to bottom right",
      stops: ["hsl({colors.surface.1} / 1)", "hsl({colors.surface.4} / 1)"],
    },
  },
});
