import { Box } from "@blunderfest/design-system";
import clsx from "clsx";
import { PropsWithChildren, Ref, forwardRef } from "react";
import { ButtonVariants, button } from "./button.css";

export const Button = forwardRef(
    (
        props: PropsWithChildren &
            ButtonVariants & {
                className?: string;
                onClick?: React.MouseEventHandler<HTMLButtonElement>;
            },
        ref: Ref<HTMLButtonElement>
    ) => {
        const { tone, variant, className, ...rest } = props;
        const variantClass = button({
            tone: props?.tone,
            variant: variant,
        });

        return <Box as="button" ref={ref} className={clsx(variantClass, className)} {...rest} />;
    }
);
