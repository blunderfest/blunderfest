import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { connect, disconnect } from "@/store/slices/connectivitySlice";
import { useTranslation } from "react-i18next";
import { MdOutlineWifi, MdOutlineWifiOff } from "react-icons/md";

export function ConnectionStatus() {
  const connectionStatus = useAppSelector((state) => state.connectivity.status);
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  return (
    <label aria-label={t(`connection.${connectionStatus}`)}>
      {connectionStatus === "connected" ? (
        <MdOutlineWifi
          className="cursor-pointer text-3xl text-green-500 dark:text-green-800"
          onClick={() => dispatch(disconnect())}
        />
      ) : (
        <MdOutlineWifiOff
          className="cursor-pointer text-3xl text-red-500 dark:text-red-800"
          onClick={() => dispatch(connect())}
        />
      )}
    </label>
  );
}
