import SignalWifi0BarIcon from "@mui/icons-material/SignalWifi0Bar";
import SignalWifi1BarIcon from "@mui/icons-material/SignalWifi1Bar";
import SignalWifi2BarIcon from "@mui/icons-material/SignalWifi2Bar";
import SignalWifi3BarIcon from "@mui/icons-material/SignalWifi3Bar";
import SignalWifi4BarIcon from "@mui/icons-material/SignalWifi4Bar";

import { useStore } from "../store";

export const Latency = () => {
    const latency = useStore(state => state.channel.latency);

    if (latency < 200) {
        return <SignalWifi4BarIcon />;
    } else if (latency < 350) {
        return <SignalWifi3BarIcon />;
    } else if (latency < 500) {
        return <SignalWifi2BarIcon />;
    } else if (latency < 750) {
        return <SignalWifi1BarIcon />;
    } else {
        return <SignalWifi0BarIcon />;
    }
};
