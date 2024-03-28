import { layoutRecipe } from "@/components/recipes/layout.recipe";
import { PropsWithChildren, ReactNode } from "react";

type Props = PropsWithChildren & {
  toolbar: ReactNode;
  left: ReactNode;
  right: ReactNode;
};

export function Layout(props: Props) {
  const { toolbar, left, children, right } = props;
  const classes = layoutRecipe();

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
