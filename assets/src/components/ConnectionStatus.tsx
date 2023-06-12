import { useEffect, useState } from "react";

import WifiIcon from "@mui/icons-material/Wifi";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import { IconButton } from "@mui/material";

import { useI18N } from "../i18n";
import { useStore } from "../store";

type Props = {
    roomCode: string;
};

export const ConnectionStatus = ({ roomCode }: Props) => {
    const channel = useStore(state => state.channel);
    const { t } = useI18N();
    const [autoConnect, setAutoConnect] = useState(true);

    useEffect(() => {
        if (autoConnect) {
            channel.connect(roomCode);
        }
    }, [channel, autoConnect, roomCode]);

    return channel.status === "online" ? (
        <IconButton
            onClick={() => {
                channel.disconnect();
                setAutoConnect(false);
            }}
            color="success"
            aria-label={t(`system:online`)}
            title={t("system:disconnect")}
        >
            <WifiIcon />
        </IconButton>
    ) : (
        <IconButton
            onClick={() => {
                channel.connect(roomCode);
                setAutoConnect(true);
            }}
            color="error"
            aria-label={t(`system:offline`)}
            title={t("system:connect")}
        >
            <WifiOffIcon />
        </IconButton>
    );
};
