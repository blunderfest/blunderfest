import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import SignalWifiOffIcon from "@mui/icons-material/SignalWifiOff";
import { Box, IconButton, Typography } from "@mui/material";

import { useStore } from "../store";
import { Latency } from "./Latency";

type Props = {
    roomCode: string;
};

export const ConnectionStatus = ({ roomCode }: Props) => {
    const channel = useStore(state => state.channel);
    const { t } = useTranslation();
    const [autoConnect, setAutoConnect] = useState(true);

    const i18n = {
        online: t("system:online"),
        offline: t("system:offline"),
        connect: t("system:connect"),
        disconnect: t("system:disconnect"),
    };

    useEffect(() => {
        if (autoConnect && channel.status === "offline") {
            channel.connect(roomCode);
        }
    }, [channel, autoConnect, roomCode]);

    return channel.status === "online" ? (
        <Box sx={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <IconButton
                onClick={() => {
                    channel.disconnect();
                    setAutoConnect(false);
                }}
                color="success"
                aria-label={i18n.online}
                title={i18n.disconnect}
            >
                <Latency />
            </IconButton>
            <Typography variant="caption" component="div" sx={{ textAlign: "center" }}>
                {channel.latency}ms
            </Typography>
        </Box>
    ) : (
        <IconButton onClick={() => setAutoConnect(true)} color="error" aria-label={i18n.offline} title={i18n.connect}>
            <SignalWifiOffIcon />
        </IconButton>
    );
};
