export type SquareColor = "dark" | "light";
export type PieceColor = "black" | "white";
export type PieceType = "pawn" | "knight" | "bishop" | "rook" | "queen" | "king";

export type Variation = {
    move: Move;
    position: Position;
    variations: Variation[];
};

export type Piece = {
    color: PieceColor;
    type: PieceType;
};

export type Position = {
    pieces: Array<Piece | null>;
    active_color: PieceColor;
    castling_availability: Array<{ color: PieceColor; piece: "king" | "queen" }>;
    en_passant: number | null;
    halfmove_clock: number;
    fullmove_number: number;
};

export type Move = {
    from: Square;
    to: Square;
    promotion: Piece;
};

export type Square = {
    square_index: number;
    color: SquareColor;
};

export type Game = {
    game_code: string;
    squares: Square[];
    position: Position;
};

export type Room = {
    room_code: string;
    count: number;
    games: Game[];
    games_by_code: Record<string, Game>;
    active_game: string;
};
