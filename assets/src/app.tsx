import { useTranslation } from "react-i18next";

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

export function App() {
  const { t } = useTranslation();

  const fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  const [configuration, turn, castling, enPassant, half, full] = fen.split(" ");
  const board = configuration.split("/").map((rank) => rank.replace(/\d+/g, (match) => " ".repeat(Number(match))));

  return (
    <div>
      <h1 className="bg-blue-800 text-white">{t("app.title")}</h1>;
      <pre className="bg-blue-800 font-bold text-white">{JSON.stringify(board)}</pre>
      <pre>{turn}</pre>
      <pre>{castling}</pre>
      <pre>{enPassant}</pre>
      <pre>{half}</pre>
      <pre>{full}</pre>
      <img alt="Some text" src={bb} />
      <img alt="Some text" src={bk} />
      <img alt="Some text" src={bn} />
      <img alt="Some text" src={bp} />
      <img alt="Some text" src={bq} />
      <img alt="Some text" src={br} />
      <img alt="Some text" src={wb} />
      <img alt="Some text" src={wk} />
      <img alt="Some text" src={wn} />
      <img alt="Some text" src={wp} />
      <img alt="Some text" src={wq} />
      <img alt="Some text" src={wr} />
    </div>
  );
}
