import { Box, Flex } from "@blunderfest/styled-system/jsx";
import { ColorSchemeToggle } from "./components/ColorSchemeToggle";
import { Room } from "./features/room";
import { useStore } from "./store";

export const App = () => {
    const store = useStore();

    return (
        <Flex direction="column" height="dvh">
            <Box>
                <ColorSchemeToggle />
            </Box>
            {store.connectivity.status === "online" && <Room room={store.room} />}
        </Flex>
    );
};
