import { mark, select } from "@/features/board/boardSlics";
import { Square } from "@/recipes/square-recipe";
import { Board } from "styled-system/jsx";
import { useAppDispatch, useAppSelector } from "./store";

function App() {
	const board = useAppSelector((state) => state.board);
	const dispatch = useAppDispatch();

	return (
		<Board>
			{board.squares.map((square) => (
				<Square
					key={square.square_index}
					color={square.color}
					selected={
						board.markedSquares.includes(square.square_index)
							? "marked"
							: square.square_index === board.selectedSquare
							? "highlighted"
							: "none"
					}
					onClick={() => dispatch(select(square.square_index))}
					onContextMenu={(e) => {
						e.preventDefault();
						dispatch(mark(square.square_index));
					}}
				></Square>
			))}
		</Board>
	);
}

export default App;
