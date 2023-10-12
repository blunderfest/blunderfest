import { Square } from "@/recipes/square-recipe";
import { useState } from "react";
import { Board } from "styled-system/jsx";

function App() {
	const files = [...Array.from({ length: 8 }).keys()];
	const ranks = [...Array.from({ length: 8 }).keys()].reverse();

	const [board, setBoard] = useState(
		/** @type Board */ ({
			squares: files.flatMap((file) =>
				ranks.map((rank) => ({
					square_index: file + rank * 8,
					color: file % 2 === rank % 2 ? "light" : "dark",
				})),
			),
			selectedSquare: undefined,
			markedSquares: [],
		}),
	);

	const selectSquare = (/** @type {number} */ index) => {
		if (board.selectedSquare === index || board.markedSquares.length) {
			setBoard({ ...board, selectedSquare: undefined, markedSquares: [] });
		} else {
			setBoard({ ...board, selectedSquare: index, markedSquares: [] });
		}
	};

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
					onClick={() => selectSquare(square.square_index)}
					onContextMenu={(e) => {
						e.preventDefault();
						setBoard(
							board.markedSquares.includes(square.square_index)
								? {
										...board,
										selectedSquare:
											board.selectedSquare === square.square_index
												? undefined
												: board.selectedSquare,
										markedSquares: board.markedSquares.filter(
											(s) => s !== square.square_index,
										),
								  }
								: {
										...board,
										selectedSquare:
											board.selectedSquare === square.square_index
												? undefined
												: board.selectedSquare,

										markedSquares: [
											...board.markedSquares,

											square.square_index,
										],
								  },
						);
					}}
				></Square>
			))}
		</Board>
	);
}

export default App;
