import { deselect, mark, select } from "@/features/board/boardSlice";
import { useClickAway } from "@uidotdev/usehooks";
import { useEffect } from "react";
import { Board } from "styled-system/jsx";
import { Square } from "./features/board/square-recipe";
import { useAppDispatch, useAppSelector } from "./store";

import { Piece } from "./features/board/pieces/Piece";

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
				>
					{square.square_index === 0 && <Piece color="white" piece="rook" />}
					{square.square_index === 1 && <Piece color="white" piece="knight" />}
					{square.square_index === 2 && <Piece color="white" piece="bishop" />}
					{square.square_index === 3 && <Piece color="white" piece="queen" />}
					{square.square_index === 4 && <Piece color="white" piece="king" />}
					{square.square_index === 5 && <Piece color="white" piece="bishop" />}
					{square.square_index === 6 && <Piece color="white" piece="knight" />}
					{square.square_index === 7 && <Piece color="white" piece="rook" />}

					{square.square_index === 8 && <Piece color="white" piece="pawn" />}
					{square.square_index === 9 && <Piece color="white" piece="pawn" />}
					{square.square_index === 10 && <Piece color="white" piece="pawn" />}
					{square.square_index === 11 && <Piece color="white" piece="pawn" />}
					{square.square_index === 12 && <Piece color="white" piece="pawn" />}
					{square.square_index === 13 && <Piece color="white" piece="pawn" />}
					{square.square_index === 14 && <Piece color="white" piece="pawn" />}
					{square.square_index === 15 && <Piece color="white" piece="pawn" />}

					{square.square_index === 56 && <Piece color="black" piece="rook" />}
					{square.square_index === 57 && <Piece color="black" piece="knight" />}
					{square.square_index === 58 && <Piece color="black" piece="bishop" />}
					{square.square_index === 59 && <Piece color="black" piece="queen" />}
					{square.square_index === 60 && <Piece color="black" piece="king" />}
					{square.square_index === 61 && <Piece color="black" piece="bishop" />}
					{square.square_index === 62 && <Piece color="black" piece="knight" />}

					{square.square_index === 63 && <Piece color="black" piece="rook" />}
					{square.square_index === 48 && <Piece color="black" piece="pawn" />}
					{square.square_index === 49 && <Piece color="black" piece="pawn" />}
					{square.square_index === 50 && <Piece color="black" piece="pawn" />}
					{square.square_index === 51 && <Piece color="black" piece="pawn" />}
					{square.square_index === 52 && <Piece color="black" piece="pawn" />}
					{square.square_index === 53 && <Piece color="black" piece="pawn" />}
					{square.square_index === 54 && <Piece color="black" piece="pawn" />}
					{square.square_index === 55 && <Piece color="black" piece="pawn" />}
				</Square>
			))}
		</Board>
	);
}

export default App;
