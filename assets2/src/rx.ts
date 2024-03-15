import { BehaviorSubject } from "rxjs";

export const keyboard$ = new BehaviorSubject<string>("");
window.addEventListener("keydown", (e) => keyboard$.next(e.key));
