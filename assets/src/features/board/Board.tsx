import { useAppSelector } from "@blunderfest/redux";
import { Grid } from "@blunderfest/styled-system/jsx";
import { FocusScope } from "react-aria";
import { Square } from "./Square";
import { useBoardViewModel } from "./useBoardViewModel";

type BoardProps = {
    roomCode: string;
    gameCode: string;
};

export function Board(props: Readonly<BoardProps>) {
    const { roomCode, gameCode } = props;

    const { ref, ariaProps } = useBoardViewModel();
    const game = useAppSelector((state) => state.games.games_by_code[gameCode]);

    return (
        <FocusScope restoreFocus>
            <h1>{gameCode}</h1>
            <Grid
                ref={ref}
                {...ariaProps}
                tabIndex={-1}
                aspectRatio="square"
                gap="0"
                columns={8}
                borderColor={{
                    _light: "gray.light.8",
                    _dark: "gray.dark.8",
                }}
                borderStyle="solid">
                {game.squares.map((square) => (
                    <Square key={String(square.square_index)} roomCode={roomCode} gameCode={gameCode} square={square} />
                ))}
            </Grid>
        </FocusScope>
    );
}