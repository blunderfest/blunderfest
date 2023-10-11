import { WebsocketProvider } from "@/connectivity/use-websocket";
import { I18nProvider } from "@/i18n";
import { For, createSignal } from "solid-js";
import { Board } from "styled-system/jsx";
import { Square } from "./recipes/square-recipe";

export function App() {
	const files = [...Array.from({ length: 8 }).keys()];
	const ranks = [...Array.from({ length: 8 }).keys()].reverse();

	/**
	 * @type {Square[]}
	 */
	const squares = files.flatMap((file) =>
		ranks.map((rank) => ({
			square_index: file + rank * 8,
			color: file % 2 === rank % 2 ? "light" : "dark",
			rank: rank,
			file: file,
		})),
	);

	const [selectedSquare, setSelectedSquare] = createSignal(
		/** @type {number|undefined} */ (undefined),
	);

	return (
		<I18nProvider>
			<WebsocketProvider>
				<Board>
					<For each={squares}>
						{(square) => (
							<Square
								color={square.color}
								selected={square.square_index === selectedSquare()}
								onClick={() =>
									setSelectedSquare((current) =>
										current === square.square_index
											? undefined
											: square.square_index,
									)
								}
							></Square>
						)}
					</For>
				</Board>
			</WebsocketProvider>
		</I18nProvider>
	);
}
