import { useRef } from "react";
import { useButton } from "react-aria";
import { button } from "styled-system/recipes";

/**
 * @param {React.PropsWithChildren & import("styled-system/recipes").ButtonVariantProps & import("react-aria").AriaButtonOptions<"button">} props
 */
export function Button(props) {
  const { children, variant, size } = props;
  const ref = useRef(null);
  const { buttonProps } = useButton(props, ref);

  return (
    <button {...buttonProps} className={button({ variant, size })}>
      {children}
    </button>
  );
}
