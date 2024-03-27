import { Board } from "@/components/Board";
import { ColorSchemeToggle } from "@/components/ColorSchemeToggle";
import { Layout } from "@/layouts/Layout";
import { connect } from "@/store/slices/connectivitySlice";
import { useAppDispatch } from "@/store/store";
import { Container } from "@design-system/jsx";
import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

const lngs = {
  en: { nativeName: "English" },
  nl: { nativeName: "Nederlands" },
} as const;

type Props = {
  roomCode: string;
  userToken: string;
};

export function App(props: Readonly<Props>) {
  const { roomCode, userToken } = props;

  const { t, i18n } = useTranslation();
  const [count, setCount] = useState(0);
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(
      connect({
        roomCode: roomCode,
        userToken: userToken,
      })
    );
  }, []);

  return (
    <Layout
      left={
        <>
          <Trans i18nKey="description.part1">
            Edit <code>src/App.js</code> and save to reload.
          </Trans>
          <div>
            {(["en", "nl"] as const).map((lng) => (
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
