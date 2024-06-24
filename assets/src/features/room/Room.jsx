import { useAppSelector } from "@/store";
import { selectActiveUsers } from "./roomSlice";

export function Room() {
  const activeUsers = useAppSelector((state) => selectActiveUsers(state));

  return (
    <ul>
      {activeUsers.map((user) => (
        <li key={user}>{user}</li>
      ))}
    </ul>
  );
}
