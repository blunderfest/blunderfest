import { ColorSchemeToggle } from "@/components/ColorSchemeToggle";
import { ConnectionStatus } from "@/components/ConnectionStatus";

export function Toolbar() {
  return (
    <>
      <ColorSchemeToggle />
      <ConnectionStatus />
    </>
  );
}
