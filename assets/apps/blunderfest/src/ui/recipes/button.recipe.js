import { cva } from "@blunderfest/design-system/styled-system/css";

export const button = cva({
  base: {
    display: "flex",
  },
  variants: {
    visual: {
      solid: { bg: "darksalmon", color: "black" },
      outline: { borderWidth: "1px", borderColor: "red.200" },
    },
    size: {
      sm: { padding: "4", fontSize: "12px" },
      lg: { padding: "48", fontSize: "24px" },
    },
  },
});
