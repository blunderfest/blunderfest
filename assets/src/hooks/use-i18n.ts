import { useTranslation } from "react-i18next";

export const useI18N = () => {
    const { t } = useTranslation();
    const translate = (key: string) => t(key);

    return { t: translate };
};
