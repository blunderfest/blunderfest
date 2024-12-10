import bb from "./assets/black_bishop.svg";
import bk from "./assets/black_king.svg";
import bn from "./assets/black_knight.svg";
import bp from "./assets/black_pawn.svg";
import bq from "./assets/black_queen.svg";
import br from "./assets/black_rook.svg";
import wb from "./assets/white_bishop.svg";
import wk from "./assets/white_king.svg";
import wn from "./assets/white_knight.svg";
import wp from "./assets/white_pawn.svg";
import wq from "./assets/white_queen.svg";
import wr from "./assets/white_rook.svg";
import "./ExampleChannel";
export function App() {
  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const [configuration, turn, castling, enPassant, half, full] = fen.split(" ");
  const board = configuration
    .split("/")
    .map((rank) => rank.replace(/\d+/g, (match) => " ".repeat(Number(match))));

  return (
    <div>
      <pre className="bg-blue-800 text-white font-bold">
        {JSON.stringify(board)}
      </pre>
      <pre>{turn}</pre>
      <pre>{castling}</pre>
      <pre>{enPassant}</pre>
      <pre>{half}</pre>
      <pre>{full}</pre>
      <img src={bb} />
      <img src={bk} />
      <img src={bn} />
      <img src={bp} />
      <img src={bq} />
      <img src={br} />
      <img src={wb} />
      <img src={wk} />
      <img src={wn} />
      <img src={wp} />
      <img src={wq} />
      <img src={wr} />
    </div>
  );
}
