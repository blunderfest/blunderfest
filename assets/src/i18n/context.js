import { createContext, useContext } from 'solid-js';
import { createStore } from "solid-js/store";

/**
 * @type {import('solid-js').Context<I18n | undefined>}
 */
export const I18nContext = createContext();

export function useI18n() {
    const context = useContext(I18nContext);

    if (!context) {
        throw new ReferenceError('I18nContext');
    }

    return context;
}

/**
 * @param {I18n} i18n
 * 
 * @returns {[I18n, (i18n: I18n) => void]}
 */
export function createI18n(i18n) {
    const [store, setStore] = createStore({
        ...i18n,
        t: i18n.t.bind({}),
    });
    /**
     * @param {import("i18next").i18n} i18n
     */
    const updateStore = (i18n) => {
        setStore({
            ...i18n,
            t: i18n.t.bind({}),
        });
    }
    return [store, updateStore];
}