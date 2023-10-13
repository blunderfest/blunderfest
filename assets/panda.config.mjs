import { defineConfig, defineGlobalStyles } from "@pandacss/dev";

const globalCss = defineGlobalStyles({
	body: {
		backgroundGradient: "background",
	},
});

export default defineConfig({
	preflight: true,
	include: ["./src/**/*.{js,jsx}"],
	exclude: [],
	jsxFramework: "react",

	theme: {
		extend: {
			tokens: {
				gradients: {
					background: {
						value: {
							type: "linear",
							placement: "to bottom right",
							stops: ["{colors.slate.600}", "{colors.slate.800}"],
						},
					},
					square: {
						light: {
							value: {
								type: "linear",
								placement: "to bottom right",
								stops: ["{colors.stone.200}", "{colors.stone.300}"],
							},
						},
						dark: {
							value: {
								type: "linear",
								placement: "to bottom right",
								stops: ["{colors.violet.900}", "{colors.violet.950}"],
							},
						},
					},
				},
				colors: {
					primary: {
						value: "{colors.yellow.300}",
					},
					success: {
						value: "{colors.green.700}",
					},
					warning: {
						value: "{colors.amber.500}",
					},
					error: {
						value: "{colors.red.600}",
					},
					square: {
						selection: {
							simple: {
								value: "{colors.red.600}",
							},
							ctrl: {
								value: "{colors.green.600}",
							},
							alt: {
								value: "{colors.yellow.400}",
							},
						},
						highlight: {
							light: {
								value: "{colors.stone.200}",
							},
							dark: {
								value: "{colors.violet.900}",
							},
						},
					},
				},
			},

			semanticTokens: {},
		},
	},
	watch: true,
	poll: true,
	optimize: false,

	outdir: "styled-system",
	globalCss,
});
