import { deselect, mark, select } from "@/features/board/boardSlice";
import { useClickAway } from "@uidotdev/usehooks";
import { useEffect } from "react";
import { Board } from "styled-system/jsx";
import { useAppDispatch, useAppSelector } from "./store";

import { Square } from "./features/board/Square";

function App() {
	const board = useAppSelector((state) => state.board);
	const dispatch = useAppDispatch();

	/** @type {import("react").MutableRefObject<HTMLDivElement>} */
	const ref = useClickAway(() => {
		dispatch(deselect());
	});

	useEffect(() => {
		const disableContextMenu = (/** @type {MouseEvent} */ e) => e.preventDefault();
		document.addEventListener("contextmenu", disableContextMenu);

		return () => document.removeEventListener("contextmenu", disableContextMenu);
	});

	/** @type {Array<Piece | undefined>} */
	const pieces = [...Array.from({ length: 64 }).keys()].map((square_index) => {
		switch (square_index) {
			case 0:
				return { color: "white", piece: "rook" };
			case 1:
				return { color: "white", piece: "knight" };
			case 2:
				return { color: "white", piece: "bishop" };
			case 3:
				return { color: "white", piece: "queen" };
			case 4:
				return { color: "white", piece: "king" };
			case 5:
				return { color: "white", piece: "bishop" };
			case 6:
				return { color: "white", piece: "knight" };
			case 7:
				return { color: "white", piece: "rook" };

			case 8:
				return { color: "white", piece: "pawn" };
			case 9:
				return { color: "white", piece: "pawn" };
			case 10:
				return { color: "white", piece: "pawn" };
			case 11:
				return { color: "white", piece: "pawn" };
			case 12:
				return { color: "white", piece: "pawn" };
			case 13:
				return { color: "white", piece: "pawn" };
			case 14:
				return { color: "white", piece: "pawn" };
			case 15:
				return { color: "white", piece: "pawn" };

			case 56:
				return { color: "black", piece: "rook" };
			case 57:
				return { color: "black", piece: "knight" };
			case 58:
				return { color: "black", piece: "bishop" };
			case 59:
				return { color: "black", piece: "queen" };
			case 60:
				return { color: "black", piece: "king" };
			case 61:
				return { color: "black", piece: "bishop" };
			case 62:
				return { color: "black", piece: "knight" };

			case 63:
				return { color: "black", piece: "rook" };
			case 48:
				return { color: "black", piece: "pawn" };
			case 49:
				return { color: "black", piece: "pawn" };
			case 50:
				return { color: "black", piece: "pawn" };
			case 51:
				return { color: "black", piece: "pawn" };
			case 52:
				return { color: "black", piece: "pawn" };
			case 53:
				return { color: "black", piece: "pawn" };
			case 54:
				return { color: "black", piece: "pawn" };
			case 55:
				return { color: "black", piece: "pawn" };
			default: {
				return undefined;
			}
		}
	});

	return (
		<Board ref={ref}>
			{board.squares.map((square) => (
				<Square
					key={square.square_index}
					color={square.color}
					selected={square.mark !== "none" ? square.mark : board.selectedSquare === square.square_index ? "highlighted" : "none"}
					onClick={() => dispatch(select(square.square_index))}
					onContextMenu={(e) => {
						dispatch(
							mark({
								square: square.square_index,
								alt: e.altKey,
								ctrl: e.ctrlKey,
							}),
						);
					}}
					piece={pieces[square.square_index]}
				></Square>
			))}
		</Board>
	);
}

export default App;
