import { useFocusManager as useFocusManagerAria, useKeyboard } from "react-aria";

/**
 * @param {{
 *   accept: (node: Element) => boolean,
 *   onFocus?: (node: Element) => void,
 *   amountUp: number,
 *   amountDown: number
 * }} options
 */
export function useFocusManager(options) {
  const focusManager = useFocusManagerAria();

  const { accept, onFocus = () => {}, amountUp, amountDown } = options;
  const focusOptions = {
    accept: accept,
    wrap: true,
    tabbable: true,
  };

  /**
   * @param {number} amount
   * @returns {Element | undefined | null}
   */
  function next(amount) {
    if (amount) {
      const element = focusManager?.focusNext(focusOptions);
      return next(amount - 1) ?? element;
    }

    return undefined;
  }

  /**
   * @param {number} amount
   * @returns {Element | undefined | null}
   */
  function previous(amount) {
    if (amount) {
      const element = focusManager?.focusPrevious(focusOptions);
      return previous(amount - 1) ?? element;
    }

    return undefined;
  }

  function first() {
    return focusManager?.focusFirst(focusOptions);
  }

  function last() {
    return focusManager?.focusLast(focusOptions);
  }

  const { keyboardProps } = useKeyboard({
    onKeyDown: (e) => {
      let element;
      if (e.key === "ArrowUp") {
        element = previous(amountUp);
      } else if (e.key === "ArrowDown") {
        element = next(amountDown);
      } else if (e.key === "ArrowLeft") {
        element = previous(1);
      } else if (e.key === "ArrowRight") {
        element = next(1);
      } else if (e.key === "Home") {
        element = first();
      } else if (e.key === "End") {
        element = last();
      } else {
        e.continuePropagation();
        return;
      }

      if (element) {
        onFocus(element);
      }
    },
  });

  return {
    first,
    next,
    previous,
    last,
    keyboardProps,
  };
}
