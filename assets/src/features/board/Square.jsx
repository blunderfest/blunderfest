import { sva } from "styled-system/css";
import { Piece } from "./pieces/Piece";

const square = sva({
	slots: ["root", "selection", "piece"],
	base: {
		root: { aspectRatio: "square", position: "relative" },
		selection: { position: "absolute", top: 0, left: 0, bottom: 0, right: 0 },
		piece: { position: "absolute", top: 0, left: 0, bottom: 0, right: 0 },
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
	const { color, selected, piece, onClick, onContextMenu, children } = props;
	const classes = square({ color: color, selected: selected });

	return (
		<div className={classes.root} onClick={onClick} onContextMenu={onContextMenu}>
			<div className={classes.selection}>&nbsp;</div>
			<div className={classes.piece}>{piece && <Piece {...piece} />}</div>
			{children}
		</div>
	);
};
