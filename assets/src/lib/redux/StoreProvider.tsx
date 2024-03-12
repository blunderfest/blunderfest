import React from "react";
import { Provider } from "react-redux";
import { store } from "./store";

type Props = React.PropsWithChildren;

export function StoreProvider(props: Readonly<Props>) {
    const { children } = props;

    return <Provider store={store}>{children}</Provider>;
}
