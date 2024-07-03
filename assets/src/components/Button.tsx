import { ComponentProps, PropsWithChildren } from "react";
import { ButtonVariants, buttonRecipe } from "./buttonRecipe";

export function Button(props: ButtonVariants & PropsWithChildren & ComponentProps<"button">) {
  return (
    <button className={buttonRecipe(props)} {...props}>
      {props.children}
    </button>
  );
}
