import { globalStyle, style } from "@vanilla-extract/css";
import { vars } from "~/styles/design-tokens.css";

export const boardContainer = style({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	padding: vars.spacing.lg,
});

export const board = style({
	display: "flex",
	flexDirection: "column",
	border: `2px solid ${vars.color.border}`,
	borderRadius: vars.borderRadius.md,
	overflow: "hidden",
	boxShadow: vars.shadow.lg,
});

export const row = style({
	display: "flex",
});

export const square = style({
	width: "64px",
	height: "64px",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	cursor: "pointer",
	position: "relative",
	transition: "background-color 0.15s ease",
});

globalStyle(`${square}:hover`, {
	filter: "brightness(1.1)",
});

export const light = style({
	backgroundColor: vars.color.board.light,
});

export const dark = style({
	backgroundColor: vars.color.board.dark,
});

export const selected = style({
	boxShadow: `inset 0 0 0 4px ${vars.color.board.selected}`,
});

export const coordinateLabel = style({
	position: "absolute",
	fontSize: "10px",
	fontWeight: vars.font.weight.bold,
	color: "inherit",
	opacity: 0.7,
	userSelect: "none",
	pointerEvents: "none",
});

export const rankLabel = style({
	top: "2px",
	left: "4px",
});

export const fileLabel = style({
	bottom: "2px",
	right: "4px",
});

globalStyle(`${square} .light ${coordinateLabel}`, {
	color: vars.color.board.dark,
});

globalStyle(`${square} .dark ${coordinateLabel}`, {
	color: vars.color.board.light,
});
