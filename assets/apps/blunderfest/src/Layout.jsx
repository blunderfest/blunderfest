import { css, sva } from "@blunderfest/design-system/styled-system/css";
import PropTypes from "prop-types";

const layout = sva({
  slots: ["root", "main", "header", "left", "right"],
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      minHeight: "100vh",
    },
    main: {
      backgroundColor: "surface.1",
      flex: 1,
    },
    header: {
      backgroundColor: "surface.2",
      height: "8",
    },
    left: {
      backgroundColor: "surface.1",
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: "1/4",
      md: {
        width: "half",
      },
      lg: {
        width: "quarter",
      },
    },
    right: {
      backgroundColor: "surface.1",
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: "1/4",
      md: {
        width: "half",
      },
      lg: {
        width: "quarter",
      },
    },
  },
});

/**
 * @param {import("react").PropsWithChildren & {
 *    toolbar: import("react").ReactNode,
 *    left: import("react").ReactNode,
 *    right: import("react").ReactNode,
 * }} props
 */
export function Layout(props) {
  const { toolbar, left, children, right } = props;
  const classes = layout();

  return (
    <div className={classes.root}>
      <header className={classes.header}>{toolbar}</header>
      <div
        className={css({
          display: "flex",
          flexGrow: 1,
        })}>
        <aside className={classes.left}>{left}</aside>
        <main className={classes.main}>{children}</main>
        <aside className={classes.right}>{right}</aside>
      </div>
    </div>
  );
}

Layout.propTypes = {
  toolbar: PropTypes.node.isRequired,
  left: PropTypes.node.isRequired,
  right: PropTypes.node.isRequired,
  children: PropTypes.node.isRequired,
};
