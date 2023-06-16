import SignalWifi0BarIcon from "@mui/icons-material/SignalWifi0Bar";
import SignalWifi1BarIcon from "@mui/icons-material/SignalWifi1Bar";
import SignalWifi2BarIcon from "@mui/icons-material/SignalWifi2Bar";
import SignalWifi3BarIcon from "@mui/icons-material/SignalWifi3Bar";
import SignalWifi4BarIcon from "@mui/icons-material/SignalWifi4Bar";

// import { useI18N } from "../hooks/use-i18n";
import { useStore } from "../store";

export const Latency = () => {
    const latency = useStore(state => state.channel.latency);
    // const { t } = useI18N();

    if (latency < 10) {
        return <SignalWifi4BarIcon />;
    } else if (latency < 20) {
        return <SignalWifi3BarIcon />;
    } else if (latency < 30) {
        return <SignalWifi2BarIcon />;
    } else if (latency < 40) {
        return <SignalWifi1BarIcon />;
    } else {
        return <SignalWifi0BarIcon />;
    }
};
