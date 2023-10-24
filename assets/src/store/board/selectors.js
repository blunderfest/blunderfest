import { createSelector } from "@reduxjs/toolkit";

const selectMarks = (/** @type {import("@/store").RootState} */ state) => state.board.marks;

export const selectHasMarks = createSelector(selectMarks, (marks) => marks.findIndex((mark) => mark !== "none") !== -1);
