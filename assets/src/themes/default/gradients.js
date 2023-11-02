import { defineTokens } from "@pandacss/dev";

export const gradients = defineTokens.gradients({
  background: {
    value: {
      type: "linear",
      placement: "to bottom right",
      stops: ["{colors.surface.1}", "{colors.surface.4}"],
    },
  },
});
