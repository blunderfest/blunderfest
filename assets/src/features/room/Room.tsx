import { useAppSelector } from "@blunderfest/redux";
import { css } from "@blunderfest/styled-system/css";
import { Grid, GridItem } from "@blunderfest/styled-system/jsx";
import { useState } from "react";
import { Board } from "../board";

type RoomProps = {
    roomCode: string;
};

export function Room({ roomCode }: Readonly<RoomProps>) {
    const games = useAppSelector((state) => state.rooms.rooms_by_code[roomCode].games);
    const [game, setGame] = useState<string | undefined>();

    return (
        <Grid columns={7} flexGrow={1}>
            <GridItem colSpan={3}>
                <p
                    className={css({
                        color: {
                            _dark: "gray.dark.11",
                            _light: "gray.light.11",
                        },
                    })}>
                    {roomCode}
                </p>
                {game && <Board roomCode={roomCode} gameCode={game} />}
            </GridItem>
            <GridItem colSpan={4}>
                {games.map((game) => (
                    <button key={game} onClick={() => setGame(game)}>
                        {game}
                    </button>
                ))}
            </GridItem>
        </Grid>
    );
}
