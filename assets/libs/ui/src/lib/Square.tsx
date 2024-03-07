import React from "react";
import { square } from "./square.css";

type Props = React.PropsWithChildren & {
    squareIndex: number;
};

export function Square(props: Props) {
    const { children, squareIndex } = props;
    const color = squareIndex % 2 === (squareIndex >>> 3) % 2 ? "light" : "dark";

    return (
        <div
            className={square({
                color: color,
            })}>
            {children}
        </div>
    );
}
