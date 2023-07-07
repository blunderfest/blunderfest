import type {} from "@mui/material/themeCssVarsAugmentation";

export module "@mui/material" {
    export interface Palette {
        board: {
            light: string;
            dark: string;
        };
    }

    export interface PaletteOptions {
        board: {
            light: string;
            dark: string;
        };
    }
}
