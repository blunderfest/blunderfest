import { createGlobalTheme, createThemeContract } from "@vanilla-extract/css";

export const vars = createThemeContract({
	color: {
		primary: null,
		secondary: null,
		background: null,
		surface: null,
		text: null,
		textMuted: null,
		border: null,
		board: {
			light: null,
			dark: null,
			highlight: null,
			selected: null,
		},
		piece: {
			white: null,
			black: null,
		},
	},
	spacing: {
		xs: null,
		sm: null,
		md: null,
		lg: null,
		xl: null,
	},
	font: {
		family: null,
		size: {
			xs: null,
			sm: null,
			md: null,
			lg: null,
			xl: null,
		},
		weight: {
			normal: null,
			bold: null,
		},
	},
	borderRadius: {
		sm: null,
		md: null,
		lg: null,
	},
	shadow: {
		sm: null,
		md: null,
		lg: null,
	},
});

createGlobalTheme(":root", vars, {
	color: {
		primary: "#4a90d9",
		secondary: "#6c757d",
		background: "#f8f9fa",
		surface: "#ffffff",
		text: "#212529",
		textMuted: "#6c757d",
		border: "#dee2e6",
		board: {
			light: "#f0d9b5",
			dark: "#b58863",
			highlight: "#ffff00",
			selected: "#4a90d9",
		},
		piece: {
			white: "#ffffff",
			black: "#000000",
		},
	},
	spacing: {
		xs: "4px",
		sm: "8px",
		md: "16px",
		lg: "24px",
		xl: "32px",
	},
	font: {
		family:
			"'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
		size: {
			xs: "12px",
			sm: "14px",
			md: "16px",
			lg: "18px",
			xl: "24px",
		},
		weight: {
			normal: "400",
			bold: "700",
		},
	},
	borderRadius: {
		sm: "4px",
		md: "8px",
		lg: "12px",
	},
	shadow: {
		sm: "0 1px 2px rgba(0, 0, 0, 0.1)",
		md: "0 4px 6px rgba(0, 0, 0, 0.1)",
		lg: "0 10px 15px rgba(0, 0, 0, 0.1)",
	},
});
