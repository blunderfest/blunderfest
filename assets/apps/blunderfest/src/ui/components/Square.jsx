import { Box } from "@blunderfest/design-system/styled-system/jsx";
import { square } from "@blunderfest/ui/recipes";
import PropTypes from "prop-types";
import { BlackBishop } from "./pieces/BlackBishop";
import { BlackKing } from "./pieces/BlackKing";
import { BlackKnight } from "./pieces/BlackKnight";
import { BlackPawn } from "./pieces/BlackPawn";
import { BlackQueen } from "./pieces/BlackQueen";
import { BlackRook } from "./pieces/BlackRook";
import { WhiteBishop } from "./pieces/WhiteBishop";
import { WhiteKing } from "./pieces/WhiteKing";
import { WhiteKnight } from "./pieces/WhiteKnight";
import { WhitePawn } from "./pieces/WhitePawn";
import { WhiteQueen } from "./pieces/WhiteQueen";
import { WhiteRook } from "./pieces/WhiteRook";

/**
 * @param {{
 *    file: number,
 *    rank: number,
 * }} props
 * @returns
 */
export function Square(props) {
  const { file, rank } = props;

  const classes = square({
    color: file % 2 === rank % 2 ? "dark" : "light",
  });

  function Piece() {
    if (rank === 0) {
      switch (file) {
        case 0:
        case 7: {
          return <WhiteRook title="White Rook" titleId="white-rook" />;
        }
        case 1:
        case 6: {
          return <WhiteKnight title="White Knight" titleId="white-knight" />;
        }
        case 2:
        case 5: {
          return <WhiteBishop title="White Bishop" titleId="white-bishop" />;
        }
        case 3: {
          return <WhiteQueen title="White Queen" titleId="white-queen" />;
        }
        case 4: {
          return <WhiteKing title="White King" titleId="white-king" />;
        }
      }

      return null;
    } else if (rank === 1) {
      return <WhitePawn title="White Pawn" titleId="white-pawn" />;
    } else if (rank === 6) {
      return <BlackPawn title="Black Pawn" titleId="black-pawn" />;
    } else if (rank === 7) {
      switch (file) {
        case 0:
        case 7: {
          return <BlackRook title="Black Rook" titleId="black-rook" />;
        }
        case 1:
        case 6: {
          return <BlackKnight title="Black Knight" titleId="black-knight" />;
        }
        case 2:
        case 5: {
          return <BlackBishop title="Black Bishop" titleId="black-bishop" />;
        }
        case 3: {
          return <BlackQueen title="Black Queen" titleId="black-queen" />;
        }
        case 4: {
          return <BlackKing title="Black King" titleId="black-king" />;
        }
      }
      return null;
    }
    return null;
  }

  return (
    <Box className={classes.root} tabIndex={0} data-file={file} data-rank={rank}>
      <Box className={classes.overlay} tabIndex={-1}>
        {String.fromCharCode(65 + file)} {rank + 1}
      </Box>
      <Box className={classes.selected} tabIndex={-1}></Box>

      <Box className={classes.piece}>
        <Piece />
      </Box>
    </Box>
  );
}

Square.propTypes = {
  file: PropTypes.number.isRequired,
  rank: PropTypes.number.isRequired,
};
