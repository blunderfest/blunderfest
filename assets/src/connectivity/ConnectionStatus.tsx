import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import NetworkWifi1BarIcon from "@mui/icons-material/NetworkWifi1Bar";
import NetworkWifi2BarIcon from "@mui/icons-material/NetworkWifi2Bar";
import NetworkWifi3BarIcon from "@mui/icons-material/NetworkWifi3Bar";
import SignalWifi0BarIcon from "@mui/icons-material/SignalWifi0Bar";
import SignalWifi4BarIcon from "@mui/icons-material/SignalWifi4Bar";
import SignalWifiOffIcon from "@mui/icons-material/SignalWifiOff";
import { IconButton } from "@mui/material";

import { useStore } from "../store";

type Props = {
    roomCode: string;
};

export const ConnectionStatus = ({ roomCode }: Props) => {
    const { t } = useTranslation();
    const channel = useStore(state => state.channel);
    const latency = Math.floor((channel.latency * 2) / 300);
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
        <IconButton
            onClick={() => {
                channel.disconnect();
                setAutoConnect(false);
            }}
            color="success"
            aria-label={i18n.online}
            title={i18n.disconnect}
        >
            {latency === 0 && <SignalWifi4BarIcon />}
            {latency === 1 && <NetworkWifi3BarIcon />}
            {latency === 2 && <NetworkWifi2BarIcon />}
            {latency === 3 && <NetworkWifi1BarIcon />}
            {latency > 3 && <SignalWifi0BarIcon />}
        </IconButton>
    ) : (
        <IconButton onClick={() => setAutoConnect(true)} color="error" aria-label={i18n.offline} title={i18n.connect}>
            <SignalWifiOffIcon />
        </IconButton>
    );
};
