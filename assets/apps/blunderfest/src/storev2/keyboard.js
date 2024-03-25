import { fromEvent } from "rxjs";

/**
 * @type {import "rxjs".Observable<KeyboardEvent>}
 */
export const keyboard$ = fromEvent(window, "keydown", {
  capture: true,
});
