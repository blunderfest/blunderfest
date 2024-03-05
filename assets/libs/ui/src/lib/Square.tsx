import { SquareVariants, square } from "@blunderfest/design-system";

export function Square(props: React.PropsWithChildren & SquareVariants) {
    const { children, ...rest } = props;

    return <div className={square(rest)}>{children}</div>;
}
