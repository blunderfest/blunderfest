import { Grid } from "@blunderfest/styled-system/jsx";

type BoardProps = {
    roomCode: string;
    gameCode: string;
};

export function Board(props: Readonly<BoardProps>) {
    const { gameCode } = props;

    return (
        <>
            <h1>{gameCode}</h1>
            <Grid
                tabIndex={-1}
                aspectRatio="square"
                gap="0"
                columns={8}
                borderColor={{
                    _light: "gray.light.8",
                    _dark: "gray.dark.8",
                }}
                borderStyle="solid"></Grid>
        </>
    );
}
