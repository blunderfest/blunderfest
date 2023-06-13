// https://github.com/mui/material-ui/issues/10739#issuecomment-1484828925
import { useMediaQuery, useTheme } from "@mui/material";

export default function useAppBarHeight(): number {
    const {
        mixins: { toolbar },
        breakpoints,
    } = useTheme();

    const queryDesktop = breakpoints.up("sm");
    const queryLandscape = `${breakpoints.up("xs")} and (orientation: landscape)`;

    const isDesktop = useMediaQuery(queryDesktop);
    const isLandscape = useMediaQuery(queryLandscape);

    const cssToolbar = toolbar[isDesktop ? queryDesktop : isLandscape ? queryLandscape : ""];

    return ((cssToolbar ?? toolbar) as { minHeight: number })?.minHeight ?? 0;
}
