import { css } from "@blunderfest/styled-system/css";
import { Grid, GridItem } from "@blunderfest/styled-system/jsx";
import { Room } from "@blunderfest/types";

type RoomProps = {
    room: Room;
};

export function Room({ room }: Readonly<RoomProps>) {
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
                    {room.room_code}
                </p>
            </GridItem>
            <GridItem colSpan={4}></GridItem>
        </Grid>
    );
}
