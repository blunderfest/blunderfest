import { useAppSelector } from "@/store";
import { circle } from "styled-system/patterns";

export function ConnectionStatus() {
  const connection = useAppSelector((state) => state.system.connectivity);

  return (
    <div
      className={circle({
        size: 5,
        backgroundColor: connection.status === "online" ? "success" : "error",
      })}
    ></div>
  );
}
