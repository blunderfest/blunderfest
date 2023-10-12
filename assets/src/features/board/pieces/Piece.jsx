import BlackBishop from "./BlackBishop.svg";
import BlackKing from "./BlackKing.svg";
import BlackKnight from "./BlackKnight.svg";
import BlackPawn from "./BlackPawn.svg";
import BlackQueen from "./BlackQueen.svg";
import BlackRook from "./BlackRook.svg";
import WhiteBishop from "./WhiteBishop.svg";
import WhiteKing from "./WhiteKing.svg";
import WhiteKnight from "./WhiteKnight.svg";
import WhitePawn from "./WhitePawn.svg";
import WhiteQueen from "./WhiteQueen.svg";
import WhiteRook from "./WhiteRook.svg";

import PropTypes from "prop-types";

const mapping = {
	black: {
		bishop: BlackBishop,
		king: BlackKing,
		knight: BlackKnight,
		pawn: BlackPawn,
		queen: BlackQueen,
		rook: BlackRook,
	},
	white: {
		bishop: WhiteBishop,
		king: WhiteKing,
		knight: WhiteKnight,
		pawn: WhitePawn,
		queen: WhiteQueen,
		rook: WhiteRook,
	},
};

/**
 * @param {Piece} props
 */
export function Piece({ piece, color }) {
	const svg = mapping[color][piece];

	return <img src={svg} width="100%" height="100%" />;
}

Piece.propTypes = {
	piece: PropTypes.string.isRequired,
	color: PropTypes.string.isRequired,
};
