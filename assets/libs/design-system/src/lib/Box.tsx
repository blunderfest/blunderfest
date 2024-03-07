import { forwardRef, type ComponentPropsWithRef, type ElementType, type JSX, type JSXElementConstructor, type Ref } from "react";
import { atoms, extractAtoms } from "./atoms";

type IntrinsicAttributes<E extends keyof JSX.IntrinsicElements | JSXElementConstructor<unknown>> = JSX.LibraryManagedAttributes<
    E,
    ComponentPropsWithRef<E>
>;

export interface BoxOwnProps<E extends ElementType = ElementType> {
    as?: E;
    className?: string;
}

export type BoxProps<E extends ElementType> = BoxOwnProps<E> & Omit<IntrinsicAttributes<E>, keyof BoxOwnProps>;

export const Box = forwardRef(({ as: Element = "div", ...props }: BoxOwnProps, ref: Ref<Element>) => {
    const [atomsProps, propsToForward] = extractAtoms(props);
    const className = atoms({
        className: propsToForward.className,
        reset: typeof Element === "string" ? Element : "div",
        ...atomsProps,
    });

    return <Element {...propsToForward} className={className} ref={ref} />;
}) as <E extends ElementType = "div">(props: BoxProps<E>) => JSX.Element;
