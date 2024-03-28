import { connect, disconnect } from "@/actions/joined";
import { useAppDispatch, useAppSelector } from "@/store/store";
import { css } from "@design-system/css";
import { MdOutlineWifi, MdOutlineWifiOff } from "react-icons/md";

export function ConnectionStatus() {
  const connectionStatus = useAppSelector((state) => state.connectivity.status);
  const dispatch = useAppDispatch();

  return connectionStatus === "online" ? (
    <MdOutlineWifi
      className={css({
        fontSize: "3xl",
        cursor: "pointer",
        color: {
          _dark: "radix.green.10.dark",
          _light: "radix.green.10.light",
        },
      })}
      onClick={() => dispatch(disconnect())}
    />
  ) : (
    <MdOutlineWifiOff
      className={css({
        fontSize: "3xl",
        cursor: "pointer",
        color: {
          _dark: "radix.red.10.dark",
          _light: "radix.red.10.light",
        },
      })}
      onClick={() => dispatch(connect())}
    />
  );
}
