import { sva } from "design-system/css";

export const layoutRecipe = sva({
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
      display: "flex",
      flexDirection: "row",
      justifyContent: "end",
      backgroundColor: "surface.background.1",
    },
    left: {
      gridArea: "left-sidebar",
      backgroundColor: "surface.background.2",
    },
    main: {
      gridArea: "main-content",
      lg: {
        width: "calc(100vw / 2 - token(sizes.8))",
      },
      backgroundColor: "surface.background.2",
    },
    right: {
      gridArea: "right-sidebar",
      backgroundColor: "surface.background.2",
    },
  },
});
