import { Container } from "@blunderfest/design-system/styled-system/jsx";
import { useAppDispatch } from "@blunderfest/store";
import { connect } from "@blunderfest/store/slices/connectivitySlice";
import { Board, ColorSchemeToggle } from "@blunderfest/ui/components";
import { Layout } from "@blunderfest/ui/layouts";
import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";

const lngs = {
  en: { nativeName: "English" },
  nl: { nativeName: "Nederlands" },
};

/**
 * @param {{ userToken: string, roomCode: string }} props
 */

export function App(props) {
  const { roomCode, userToken } = props;

  const { t, i18n } = useTranslation();
  const [count, setCount] = useState(0);
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(
      connect({
        roomCode,
        userToken,
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

App.propTypes = {
  userToken: PropTypes.string.isRequired,
  roomCode: PropTypes.string.isRequired,
};
