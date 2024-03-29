import { ColorSchemeToggle } from "@/components/ColorSchemeToggle";
import { ConnectionStatus } from "@/components/ConnectionStatus";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Toolbar() {
  return (
    <>
      <LanguageSwitcher />,
      <ConnectionStatus />
      <ColorSchemeToggle />
    </>
  );
}
