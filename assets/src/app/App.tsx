import { Board } from "@blunderfest/features/board";
import { css } from "@blunderfest/styled-system/css";
import { Box, Flex, Grid, GridItem } from "@blunderfest/styled-system/jsx";
import { ColorSchemeToggle } from "@blunderfest/ui/components/ColorSchemeToggle";
import { useLandmark } from "@react-aria/landmark";
import { useRef } from "react";

type AppProps = {
    roomCode: string;
};

export const App = ({ roomCode }: AppProps) => {
    const toolbarRef = useRef<HTMLDivElement>(null);

    const { landmarkProps: toolbarProps } = useLandmark({ role: "navigation" }, toolbarRef);

    return (
        <Flex direction="column" height="dvh">
            <Box ref={toolbarRef} {...toolbarProps}>
                <ColorSchemeToggle />
            </Box>
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
                    <Board roomCode={roomCode} />
                </GridItem>
                <GridItem colSpan={4}></GridItem>
            </Grid>
        </Flex>
    );
};
