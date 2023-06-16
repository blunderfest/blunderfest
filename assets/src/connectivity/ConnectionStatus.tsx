import { useEffect, useState } from "react";

import SignalWifiOffIcon from "@mui/icons-material/SignalWifiOff";
import { IconButton } from "@mui/material";

import { useI18N } from "../hooks/use-i18n";
import { useStore } from "../store";
import { Latency } from "./Latency";

type Props = {
    roomCode: string;
};

export const ConnectionStatus = ({ roomCode }: Props) => {
    const channel = useStore(state => state.channel);
    const { t } = useI18N();
    const [autoConnect, setAutoConnect] = useState(true);

    useEffect(() => {
        if (autoConnect && channel.status === "offline") {
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
            <Latency />
        </IconButton>
    ) : (
        <IconButton
            onClick={() => setAutoConnect(true)}
            color="error"
            aria-label={t(`system:offline`)}
            title={t("system:connect")}
        >
            <SignalWifiOffIcon />
        </IconButton>
    );
};
