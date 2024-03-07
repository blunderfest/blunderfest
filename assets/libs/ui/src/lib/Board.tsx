import { Square } from "./Square";
import { board } from "./board.css";

export function Board() {
    const squares = Array.from({ length: 8 }).flatMap((_, rank) =>
        Array.from({ length: 8 }).map((_, file) => (7 - rank) * 8 + file)
    );

    return (
        <div className={board}>
            {squares.map((square) => (
                <Square key={square} squareIndex={square}>
                    {square}
                </Square>
            ))}
        </div>
    );
}
