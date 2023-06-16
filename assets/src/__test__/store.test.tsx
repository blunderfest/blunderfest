import { useEffect } from "react";
import { vi } from "vitest";

import { render } from "@testing-library/react";

import { StoreType, useStore } from "../store";

function TestComponent({ selector, effect }: { selector: (state: StoreType) => unknown; effect: (items: any) => void }) {
    const items = useStore(selector);

    useEffect(() => effect(items), [effect, items]);

    return null;
}

test("sample", () => {
    const selector = (store: StoreType) => store.count;
    const effect = vi.fn();
    render(<TestComponent selector={selector} effect={effect} />);

    expect(effect).toHaveBeenCalledWith(expect.objectContaining({ count: 0 }));
});

test("sample 2", () => {
    const selector = (store: StoreType) => store.count;
    const effect = vi.fn();
    render(<TestComponent selector={selector} effect={effect} />);

    expect(effect).toHaveBeenCalledWith(expect.objectContaining({ count: 0 }));
});
