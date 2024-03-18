import { fromEvent } from "rxjs";

/**
 * @type {import "rxjs".Observable<KeyboardEvent>}
 */
export const keyboard$ = fromEvent(document, "keydown", {
  capture: true,
});
