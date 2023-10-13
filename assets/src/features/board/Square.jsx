import { Piece } from "./pieces/Piece";
import { squareRecipe } from "./squareRecipe";

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
	const classes = squareRecipe({ color: color, selected: selected });

	return (
		<div className={classes.root} onClick={onClick} onContextMenu={onContextMenu}>
			<div className={classes.selection}>&nbsp;</div>
			<div className={classes.piece}>{piece && <Piece {...piece} />}</div>
			{children}
		</div>
	);
};
