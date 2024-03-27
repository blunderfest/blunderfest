import { sva } from "@design-system/css";

export const layout = sva({
  slots: ["root", "main", "header", "left", "right"],
  base: {
    root: {
      display: "grid",
      gridTemplateAreas: `
        'header'
        'main-content'
        'left-sidebar'
        'right-sidebar'
      `,
      md: {
        gridTemplateColumns: "2",
        gridTemplateAreas: `
          'header header'
          'main-content main-content'
          'left-sidebar right-sidebar'
      `,
      },
      lg: {
        gridTemplateColumns: "4",
        gridTemplateAreas: `
          'header header header header'
          'left-sidebar main-content main-content right-sidebar'
        `,
      },
    },
    header: {
      gridArea: "header",
    },
    left: {
      gridArea: "left-sidebar",
    },
    main: {
      gridArea: "main-content",
      lg: {
        width: "calc(100vw / 2 - token(sizes.8))",
      },
    },
    right: {
      gridArea: "right-sidebar",
    },
  },
});
