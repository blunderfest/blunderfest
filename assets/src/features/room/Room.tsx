import { useAppSelector } from "@/store/hooks";
import { selectActiveUsers } from "./roomSlice";
import { shallowEqual } from "react-redux";

export function Room() {
  const activeUsers = useAppSelector(selectActiveUsers, shallowEqual);
  const userId = useAppSelector((state) => state.connectivity.userId);

  return (
    <ul className="bg-black/5 dark:bg-white/10">
      {activeUsers.map((user) => (
        <li key={user} className={user === userId ? "font-extrabold" : ""}>
          {user}
        </li>
      ))}
    </ul>
  );
}
