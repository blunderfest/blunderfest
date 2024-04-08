import { useId } from "react";
import { RxChevronUp } from "react-icons/rx";
import { tv } from "tailwind-variants";

const recipe = tv({
  slots: {
    details: "justify- group relative flex w-full items-center",
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

export function Accordion(props) {
  const { onClick, isOpen, text, children } = props;

  const labelId = useId();
  const classes = recipe({
    isOpen: isOpen,
  });

  return (
    <details open={isOpen} className={classes.details()} aria-labelledby={labelId}>
      <summary
        aria-expanded={isOpen}
        className={classes.summary()}
        onClick={(e) => {
          e.preventDefault();
          onClick();
        }}>
        <h2 id={labelId}>{text}</h2>
        <RxChevronUp className={classes.icon()} />
      </summary>
      {children}
    </details>
  );
}
