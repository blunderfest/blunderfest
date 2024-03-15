import { css } from "design-system";
import { checkbox } from "./checkbox.recipe";

export const Checkbox = () => {
  const classes = checkbox({ size: "sm" });
  return (
    <label className={classes.root}>
      <input type="checkbox" className={css({ srOnly: true })} />
      <div className={classes.control} />
      <span className={classes.label}>Checkbox Label</span>
    </label>
  );
};
