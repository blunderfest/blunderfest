import { layout } from "@blunderfest/ui/recipes";
import PropTypes from "prop-types";

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
      <aside aria-label="Left side" className={classes.left}>
        {left}
      </aside>
      <main className={classes.main}>{children}</main>
      <aside aria-label="Right side" className={classes.right}>
        {right}
      </aside>
    </div>
  );
}

Layout.propTypes = {
  toolbar: PropTypes.node.isRequired,
  left: PropTypes.node.isRequired,
  right: PropTypes.node.isRequired,
  children: PropTypes.node.isRequired,
};
