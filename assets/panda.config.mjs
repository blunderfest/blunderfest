import { defineConfig, defineGlobalStyles } from "@pandacss/dev";

const globalCss = defineGlobalStyles({
	body: {
		backgroundColor: "background",
	},
});

export default defineConfig({
	// Whether to use css reset
	preflight: true,

	// Where to look for your css declarations
	include: ["./src/**/*.{js,jsx}"],

	// Files to exclude
	exclude: [],

	jsxFramework: "react",

	// Useful for theme customization
	theme: {
		extend: {
			tokens: {
				colors: {
					background: {
						value: "{colors.slate.950}",
					},
					lightSquare: {
						value: "{colors.slate.200}",
					},
					darkSquare: {
						value: "{colors.blue.900}",
					},
					primary: {
						value: "{colors.yellow.300}",
					},
				},
			},
		},
	},

	// The output directory for your css system
	outdir: "styled-system",
	globalCss,
});
