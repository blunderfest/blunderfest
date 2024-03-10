import { Box, Flex, Grid, GridItem } from "@blunderfest/styled-system/jsx";
import { Board } from "@blunderfest/ui/components/Board";
import { ColorSchemeToggle } from "@blunderfest/ui/components/ColorSchemeToggle";

type AppProps = {
    roomCode: string;
};

export const App = ({ roomCode }: AppProps) => {
    return (
        <Flex direction="column" height="dvh">
            <Box>
                <ColorSchemeToggle />
            </Box>
            <Grid columns={7} flexGrow={1}>
                <GridItem colSpan={3}>
                    {roomCode}
                    <Board />
                </GridItem>
                <GridItem colSpan={4}></GridItem>
            </Grid>
        </Flex>
    );
};
