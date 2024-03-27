import { sva } from "../../../styled-system/css";

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
      backgroundColor: "surface.background.2",
      color: "surface.text.2",
      height: "8",
      gridArea: "header",
    },
    left: {
      backgroundColor: "surface.background.1",
      color: "surface.text.1",
      gridArea: "left-sidebar",
    },
    main: {
      backgroundColor: "surface.background.1",
      color: "surface.text.1",
      gridArea: "main-content",
    },
    right: {
      backgroundColor: "surface.background.1",
      color: "surface.text.1",
      gridArea: "right-sidebar",
    },
  },
});
