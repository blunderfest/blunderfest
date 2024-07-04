import { useAppSelector } from "@/store";
import { selectActiveUsers } from "./roomSlice";

export function Room() {
  const activeUsers = useAppSelector(selectActiveUsers);
  const userId = useAppSelector((state) => state.connectivity.userId);

  return (
    <ul className="bg-black/5 dark:bg-white/10">
      {activeUsers.map((user) => (
        <li className={user === userId ? "font-extrabold" : ""} key={user}>
          {user}
        </li>
      ))}
    </ul>
  );
}
