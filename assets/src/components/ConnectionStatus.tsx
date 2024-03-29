import { css } from "design-system/css";
import { useTranslation } from "react-i18next";
import { MdOutlineWifi, MdOutlineWifiOff } from "react-icons/md";
import { connect, disconnect } from "~/actions/joined";
import { useAppDispatch, useAppSelector } from "~/store/store";

export function ConnectionStatus() {
  const connectionStatus = useAppSelector((state) => state.connectivity.status);
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  return (
    <label aria-label={t(`connection.${connectionStatus}`)}>
      {connectionStatus === "connected" ? (
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
      )}
    </label>
  );
}
