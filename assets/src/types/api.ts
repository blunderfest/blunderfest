export interface Game {
	id: number;
	white: Player;
	black: Player;
	event: string;
	site: string;
	date: string | null;
	round: string | null;
	result: "1-0" | "0-1" | "1/2-1/2" | "*";
	eco: string | null;
	moves: Move[];
}

export interface Player {
	id: number;
	name: string;
	elo: number | null;
	title: string | null;
}

export interface Move {
	from: number;
	to: number;
	piece: string;
	san: string;
	captured?: string;
	promotion?: string;
	flags: string[];
}

export interface Position {
	fen: string;
	hash: number;
	game_count: number;
	white_wins: number;
	black_wins: number;
	draws: number;
}

export interface Opening {
	eco: string;
	name: string;
	moves: string[];
	stats?: OpeningStats;
}

export interface OpeningStats {
	total_games: number;
	white_wins: number;
	black_wins: number;
	draws: number;
	white_win_rate: number;
	draw_rate: number;
}

export interface SearchParams {
	white?: string;
	black?: string;
	eco?: string[];
	year_from?: number;
	year_to?: number;
	result?: string[];
	limit?: number;
	offset?: number;
}

export interface ApiResponse<T> {
	success: boolean;
	data: T;
	error?: {
		code: string;
		message: string;
	};
}
