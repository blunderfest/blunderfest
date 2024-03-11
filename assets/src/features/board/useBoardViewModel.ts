import { useLandmark } from "@react-aria/landmark";
import { useRef } from "react";
import { mergeProps, useFocusWithin } from "react-aria";

export const useBoardViewModel = () => {
    const ref = useRef<HTMLDivElement>(null);
    const { landmarkProps } = useLandmark({ role: "main" }, ref);
    const { focusWithinProps } = useFocusWithin({});

    return {
        ariaProps: mergeProps(landmarkProps, focusWithinProps),
        ref: ref,
    };
};
