import { Room } from "@blunderfest/features/room";
import { useAppSelector } from "@blunderfest/redux";
import { Box, Flex } from "@blunderfest/styled-system/jsx";
import { ColorSchemeToggle } from "@blunderfest/ui/components/ColorSchemeToggle";
import { useLandmark } from "@react-aria/landmark";
import { useRef } from "react";

type AppProps = {
    roomCode: string;
};

export const App = ({ roomCode }: AppProps) => {
    const toolbarRef = useRef<HTMLDivElement>(null);

    const { landmarkProps: toolbarProps } = useLandmark({ role: "navigation" }, toolbarRef);
    const userId = useAppSelector((state) => state.connectivity.userId);
    const room = useAppSelector((state) => state.rooms.rooms_by_code[roomCode]);

    return (
        <Flex direction="column" height="dvh">
            <Box ref={toolbarRef} {...toolbarProps}>
                <ColorSchemeToggle />
                {userId}
            </Box>
            {room && <Room roomCode={roomCode} />}
        </Flex>
    );
};
