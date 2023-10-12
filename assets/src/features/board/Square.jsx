import PropTypes from "prop-types";
import { sva } from "styled-system/css";
import { Piece } from "./pieces/Piece";

const square = sva({
	slots: ["root", "selection", "piece"],
	base: {
		root: { aspectRatio: "square", position: "relative" },
		selection: { width: "100%", height: "100%" },
		piece: {},
	},
	variants: {
		color: {
			dark: {
				root: {
					backgroundColor: "darkSquare",
				},
			},
			light: {
				root: {
					backgroundColor: "lightSquare",
				},
			},
		},
		selected: {
			none: {
				selection: {
					background: "transparent",
				},
			},
			simple: {
				selection: {
					backgroundColor: "red.500",
					filter: "opacity(0.9)",
				},
			},
			ctrl: {
				selection: {
					backgroundColor: "green.500",
					filter: "opacity(0.9)",
				},
			},
			alt: {
				selection: {
					backgroundColor: "yellow.500",
					filter: "opacity(0.9)",
				},
			},
			highlighted: {},
		},
	},
	compoundVariants: [
		{
			selected: "highlighted",
			color: "light",
			css: {
				selection: {
					backgroundColor: "lightSquare",
					filter: "brightness(120%) opacity(0.8)",
				},
			},
		},
		{
			selected: "highlighted",
			color: "dark",
			css: {
				selection: {
					backgroundColor: "darkSquare",
					filter: "brightness(150%) opacity(0.8)",
				},
			},
		},
	],
});

/**
 * @param {{
 *     color: "dark" | "light";
 *     selected: "none" | "simple" | "ctrl" | "alt" | "highlighted";
 *     children?: Children | undefined;
 *     piece?: Piece
 *     onClick?: import("react").MouseEventHandler<HTMLDivElement>;
 *     onContextMenu?: import("react").MouseEventHandler<HTMLDivElement>
 * }} props
 * @returns
 */

export const Square = (props) => {
	const { color, selected, piece, onClick, onContextMenu } = props;
	const classes = square({ color: color, selected: selected });

	return (
		<div className={classes.root} onClick={onClick} onContextMenu={onContextMenu}>
			<div className={classes.selection}>
				<div className={classes.piece}></div>
				{piece && <Piece {...piece} />}
			</div>
		</div>
	);
};

Square.propTypes = {
	color: PropTypes.string.isRequired,
	selected: PropTypes.string.isRequired,
	piece: PropTypes.any.isRequired,
	onClick: PropTypes.func,
	onContextMenu: PropTypes.func,
};
