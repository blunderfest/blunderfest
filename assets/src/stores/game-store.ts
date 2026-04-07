import { create } from "zustand";
import type { Game, Move, Position } from "~/types/api";

interface GameStore {
	currentGame: Game | null;
	currentPosition: Position;
	currentMoveIndex: number;
	selectedSquare: string | null;
	legalMoves: Move[];

	setCurrentGame: (game: Game | null) => void;
	goToMove: (index: number) => void;
	goToStart: () => void;
	goToEnd: () => void;
	goToNext: () => void;
	goToPrevious: () => void;
	setSelectedSquare: (square: string | null) => void;
	makeMove: (move: Move) => void;
	resetBoard: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
	currentGame: null,
	currentPosition: {
		fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
		hash: 0,
		game_count: 0,
		white_wins: 0,
		black_wins: 0,
		draws: 0,
	},
	currentMoveIndex: -1,
	selectedSquare: null,
	legalMoves: [],

	setCurrentGame: (game) => {
		set({
			currentGame: game,
			currentMoveIndex: -1,
			selectedSquare: null,
			legalMoves: [],
		});
	},

	goToMove: (index) => {
		const { currentGame } = get();
		if (!currentGame || index < -1 || index >= currentGame.moves.length) {
			return;
		}
		set({ currentMoveIndex: index, selectedSquare: null, legalMoves: [] });
	},

	goToStart: () => get().goToMove(-1),

	goToEnd: () => {
		const { currentGame } = get();
		if (currentGame) {
			get().goToMove(currentGame.moves.length - 1);
		}
	},

	goToNext: () => {
		const { currentMoveIndex, currentGame } = get();
		if (currentGame && currentMoveIndex < currentGame.moves.length - 1) {
			get().goToMove(currentMoveIndex + 1);
		}
	},

	goToPrevious: () => {
		const { currentMoveIndex } = get();
		if (currentMoveIndex > 0) {
			get().goToMove(currentMoveIndex - 1);
		}
	},

	setSelectedSquare: (square) => {
		set({ selectedSquare: square, legalMoves: square ? [] : [] });
	},

	makeMove: (_move) => {
		const { currentMoveIndex } = get();
		set({
			currentMoveIndex: currentMoveIndex + 1,
			selectedSquare: null,
			legalMoves: [],
		});
	},

	resetBoard: () => {
		set({
			currentMoveIndex: -1,
			selectedSquare: null,
			legalMoves: [],
		});
	},
}));
