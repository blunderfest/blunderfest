import { sva } from "styled-system/css";

export const squareRecipe = sva({
	slots: ["root", "selection", "piece"],
	base: {
		root: { aspectRatio: "square", position: "relative" },
		selection: { position: "absolute", top: 0, left: 0, bottom: 0, right: 0 },
		piece: { position: "absolute", top: 0, left: 0, bottom: 0, right: 0 },
	},
	variants: {
		color: {
			dark: {
				root: {
					backgroundGradient: "square.dark",
				},
			},
			light: {
				root: {
					backgroundGradient: "square.light",
				},
			},
		},
		selected: {
			none: {},
			simple: {
				selection: {
					backgroundColor: "square.selection.simple",
					filter: "opacity(0.8)",
				},
			},
			ctrl: {
				selection: {
					backgroundColor: "square.selection.ctrl",
					filter: "opacity(0.8)",
				},
			},
			alt: {
				selection: {
					backgroundColor: "square.selection.alt",
					filter: "opacity(0.8)",
				},
			},
			highlighted: {},
		},
	},
	compoundVariants: [
		{
			selected: "highlighted",
			color: "light",
			css: {
				selection: {
					backgroundColor: "square.highlight.light",
					filter: "brightness(120%) opacity(0.8)",
				},
			},
		},
		{
			selected: "highlighted",
			color: "dark",
			css: {
				selection: {
					backgroundColor: "square.highlight.dark",
					filter: "brightness(140%) opacity(0.8)",
				},
			},
		},
	],
});
