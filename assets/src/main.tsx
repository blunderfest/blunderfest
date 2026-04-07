import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { ChessBoard } from "~/components/chess/board/chess-board";
import { useGameStore } from "~/stores/game-store";
import "~/styles/design-tokens.css";

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 1000 * 60 * 5,
			retry: 1,
		},
	},
});

const App: React.FC = () => {
	const { selectedSquare, setSelectedSquare } = useGameStore();

	return (
		<div style={{ padding: "20px" }}>
			<h1>Blunderfest</h1>
			<p>High-performance distributed chess database engine</p>
			<ChessBoard
				selectedSquare={selectedSquare}
				onSquareClick={(square) => setSelectedSquare(square)}
			/>
		</div>
	);
};

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<QueryClientProvider client={queryClient}>
			<App />
		</QueryClientProvider>
	</React.StrictMode>,
);
