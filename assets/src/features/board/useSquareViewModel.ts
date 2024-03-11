import { mark, select, useAppDispatch } from "@blunderfest/redux";
import { mergeProps, useFocusManager, useFocusRing, useKeyboard, useLongPress, usePress } from "react-aria";

export const useSquareViewModel = (file: number, rank: number) => {
    const dispatch = useAppDispatch();

    const focusManager = useFocusManager();

    const focusSquare = (nextFile: number, nextRank: number) => {
        focusManager?.focusNext({
            wrap: true,

            accept(node) {
                const element = node as HTMLElement;

                const shouldFocus = element.dataset["file"] === String(nextFile) && element.dataset["rank"] === String(nextRank);

                return shouldFocus;
            },
        });
    };

    const { keyboardProps } = useKeyboard({
        onKeyDown: (e) => {
            switch (e.key) {
                case "ArrowUp":
                    if (e.ctrlKey) {
                        focusSquare(file, 7);
                    } else {
                        focusSquare(file, (rank + 1) % 8);
                    }
                    break;
                case "ArrowDown":
                    if (e.ctrlKey) {
                        focusSquare(file, 0);
                    } else {
                        focusSquare(file, (rank + 7) % 8);
                    }
                    break;
                case "ArrowLeft":
                    if (e.ctrlKey) {
                        focusSquare(0, rank);
                    } else {
                        focusSquare((file + 7) % 8, rank);
                    }
                    break;
                case "ArrowRight":
                    if (e.ctrlKey) {
                        focusSquare(7, rank);
                    } else {
                        focusSquare((file + 1) % 8, rank);
                    }
                    break;
                case "End":
                    focusSquare(7, 0);
                    break;
                case "Home":
                    focusSquare(0, 7);
                    break;
            }
        },
    });

    const { focusProps, isFocused } = useFocusRing({
        autoFocus: true,
        within: true,
    });

    const { pressProps } = usePress({
        onPress: (e) => {
            if (e.pointerType === "keyboard" && e.ctrlKey) {
                dispatch(mark(file, rank));
            } else {
                focusSquare(file, rank);
                dispatch(select(file, rank));
            }
        },
    });

    const { longPressProps } = useLongPress({
        onLongPress: () => {
            dispatch(mark(file, rank));
        },
    });

    return {
        ariaProps: mergeProps(focusProps, pressProps, longPressProps, keyboardProps),
        isFocused,
    };
};
