import { useAppSelector } from "@/store/hooks";
import { selectActiveUsers } from "./roomSlice";
import { shallowEqual } from "react-redux";
import clsx from "clsx";

export function Room() {
  const activeUsers = useAppSelector(selectActiveUsers, shallowEqual);
  const userId = useAppSelector((state) => state.connectivity.userId);

  return (
    <ul className="bg-black/5 dark:bg-white/10">
      {activeUsers.map((user) => (
        <li
          key={user}
          className={clsx({
            "font-extrabold": user === userId,
          })}>
          {user}
        </li>
      ))}
    </ul>
  );
}
