import React, { useId } from "react";
import { RxChevronUp } from "react-icons/rx";
import { tv } from "tailwind-variants";

const recipe = tv({
  slots: {
    details: "group relative flex w-full items-center",
    icon: "h-5 w-5 group-open:rotate-180 ",
    summary: "flex cursor-pointer list-none justify-between *:inline group-open:font-bold [&::-webkit-details-marker]:hidden",
  },
  variants: {
    isOpen: {
      true: {
        icon: "rotate-180",
      },
    },
  },
});

export function Accordion(props: React.PropsWithChildren & { onClick: () => void; isOpen: boolean; text: string }) {
  const labelId = useId();
  const classes = recipe({
    isOpen: props.isOpen,
  });

  return (
    <details open={props.isOpen} className={classes.details()} aria-labelledby={labelId}>
      <summary
        aria-expanded={props.isOpen}
        className={classes.summary()}
        onClick={(e) => {
          e.preventDefault();
          props.onClick();
        }}>
        <h2 id={labelId}>{props.text}</h2>
        <RxChevronUp className={classes.icon()} />
      </summary>
      {props.children}
    </details>
  );
}
