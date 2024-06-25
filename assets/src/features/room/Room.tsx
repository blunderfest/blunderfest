import { useAppSelector } from "@/store/hooks";
import { selectActiveUsers } from "./roomSlice";
import { shallowEqual } from "react-redux";

export function Room() {
  const activeUsers = useAppSelector(selectActiveUsers, shallowEqual);

  return (
    <ul>
      {activeUsers.map((user) => (
        <li key={user}>{user}</li>
      ))}
    </ul>
  );
}
