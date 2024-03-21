import { Container } from "@blunderfest/design-system/styled-system/jsx";
import { useConnectivity } from "@blunderfest/store/useConnectivity";
import { Board, ColorSchemeToggle } from "@blunderfest/ui/components";
import { Layout } from "@blunderfest/ui/layouts";
import { useState } from "react";
import { Trans, useTranslation } from "react-i18next";

const lngs = {
  en: { nativeName: "English" },
  nl: { nativeName: "Nederlands" },
};

const userId = document?.querySelector("meta[name='user_id']")?.getAttribute("content");
const roomCode = document?.querySelector("meta[name='room_code']")?.getAttribute("content");

export function App() {
  const { t, i18n } = useTranslation();
  const [count, setCount] = useState(0);
  const x = useConnectivity(userId, roomCode);
  x.connect();

  return (
    <Layout
      left={
        <>
          <Trans i18nKey="description.part1">
            Edit <code>src/App.js</code> and save to reload.
          </Trans>
          <div>
            {Object.keys(lngs).map((lng) => (
              <button
                key={lng}
                style={{ fontWeight: i18n.resolvedLanguage === lng ? "bold" : "normal" }}
                type="submit"
                onClick={() => {
                  i18n.changeLanguage(lng);
                  setCount(count + 1);
                }}>
                {lngs[lng].nativeName}
              </button>
            ))}
          </div>
        </>
      }
      right={
        <>
          <a className="App-link" href="https://reactjs.org" target="_blank" rel="noopener noreferrer">
            {t("description.part2")}
          </a>
          <p>
            <i>{t("counter", { count })}</i>
          </p>
        </>
      }
      toolbar={<ColorSchemeToggle />}>
      <Container>
        <Board />
      </Container>
    </Layout>
  );
}
