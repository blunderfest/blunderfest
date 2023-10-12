import { deselect, mark, select } from "@/features/board/boardSlics";
import { useClickAway } from "@uidotdev/usehooks";
import { useEffect } from "react";
import { Board } from "styled-system/jsx";
import { Square } from "./features/board/square-recipe";
import { useAppDispatch, useAppSelector } from "./store";

function App() {
	const board = useAppSelector((state) => state.board);
	const dispatch = useAppDispatch();

	/** @type {import("react").MutableRefObject<HTMLDivElement>} */
	const ref = useClickAway(() => {
		dispatch(deselect());
	});

	useEffect(() => {
		const disableContextMenu = (/** @type {MouseEvent} */ e) =>
			e.preventDefault();
		document.addEventListener("contextmenu", disableContextMenu);

		return () =>
			document.removeEventListener("contextmenu", disableContextMenu);
	});

	return (
		<Board ref={ref}>
			{board.squares.map((square) => (
				<Square
					key={square.square_index}
					color={square.color}
					selected={
						square.mark !== "none"
							? square.mark
							: board.selectedSquare === square.square_index
							? "highlighted"
							: "none"
					}
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
				></Square>
			))}
		</Board>
	);
}

export default App;
