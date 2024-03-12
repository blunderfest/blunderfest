import { useAppDispatch } from "@blunderfest/redux";
import { Square, mark as markAction, select as selectAction } from "@blunderfest/redux/games";
import { useCallback, useEffect, useRef } from "react";
import { mergeProps, useFocusManager, useFocusRing, useKeyboard, useLongPress, usePress } from "react-aria";

export const useSquareViewModel = (roomCode: string, gameCode: string, square: Square) => {
    const dispatch = useAppDispatch();

    const file = square.square_index % 8;
    const rank = square.square_index >> 3;
    const marked = square.marked;
    const selected = square.selected;

    const mark = useCallback(
        () => dispatch(markAction(roomCode, gameCode, file, rank)),
        [roomCode, gameCode, file, rank, dispatch]
    );
    const select = () => dispatch(selectAction(roomCode, gameCode, file, rank));

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
                mark();
            } else {
                select();
            }
        },
    });

    const { longPressProps } = useLongPress({
        onLongPress: () => mark(),
    });

    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const current = ref.current;
        if (current) {
            current.addEventListener("contextmenu", mark);

            return () => current?.removeEventListener("contextmenu", mark);
        }
    }, [mark]);

    return {
        ariaProps: mergeProps(focusProps, pressProps, longPressProps, keyboardProps),
        focussed: isFocused,
        ref,
        color: rank % 2 === file % 2 ? ("dark" as const) : ("light" as const),
        marked,
        selected,
        rank,
        file,
    };
};
