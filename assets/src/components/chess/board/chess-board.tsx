import type React from "react";
import * as styles from "./chess-board.css";

interface ChessBoardProps {
	orientation?: "white" | "black";
	onMove?: (from: string, to: string) => void;
	selectedSquare?: string | null;
	onSquareClick?: (square: string) => void;
}

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1];

export const ChessBoard: React.FC<ChessBoardProps> = ({
	orientation = "white",
	selectedSquare,
	onSquareClick,
}) => {
	const files = orientation === "white" ? FILES : [...FILES].reverse();
	const ranks = orientation === "white" ? RANKS : [...RANKS].reverse();

	const getSquareColor = (
		fileIdx: number,
		rankIdx: number,
	): "light" | "dark" => {
		const isLight = (fileIdx + rankIdx) % 2 === 0;
		return isLight ? "light" : "dark";
	};

	return (
		<div className={styles.boardContainer}>
			<div className={styles.board}>
				{ranks.map((rank, rankIdx) => (
					<div key={rank} className={styles.row}>
						{files.map((file, fileIdx) => {
							const square = `${file}${rank}`;
							const isSelected = selectedSquare === square;
							const color = getSquareColor(fileIdx, rankIdx);

							return (
								<div
									key={square}
									className={`${styles.square} ${color === "light" ? styles.light : styles.dark} ${isSelected ? styles.selected : ""}`}
									onClick={() => onSquareClick?.(square)}
									data-square={square}
								>
									<span className={styles.coordinateLabel}>
										{fileIdx === 0 && (
											<span className={styles.rankLabel}>{rank}</span>
										)}
										{rankIdx === 7 && (
											<span className={styles.fileLabel}>{file}</span>
										)}
									</span>
								</div>
							);
						})}
					</div>
				))}
			</div>
		</div>
	);
};

export default ChessBoard;
