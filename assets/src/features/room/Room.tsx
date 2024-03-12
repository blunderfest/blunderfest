import { useAppDispatch, useAppSelector } from "@blunderfest/redux";
import { select } from "@blunderfest/redux/rooms";
import { css } from "@blunderfest/styled-system/css";
import { Grid, GridItem } from "@blunderfest/styled-system/jsx";
import { Board } from "../board";

type RoomProps = {
    roomCode: string;
};

export function Room({ roomCode }: Readonly<RoomProps>) {
    const dispatch = useAppDispatch();
    const room = useAppSelector((state) => state.rooms.rooms_by_code[roomCode]);
    const games = room.games;

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
                {room.activeGame && <Board roomCode={roomCode} gameCode={room.activeGame} />}
            </GridItem>
            <GridItem colSpan={4}>
                {games.map((game) => (
                    <button key={game} onClick={() => dispatch(select(roomCode, game))}>
                        {game}
                    </button>
                ))}
            </GridItem>
        </Grid>
    );
}
