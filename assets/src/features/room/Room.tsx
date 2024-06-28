import { useAppSelector } from "@/store/hooks";
import { selectActiveUsers } from "./roomSlice";

export function Room() {
  const activeUsers = useAppSelector(selectActiveUsers);
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
