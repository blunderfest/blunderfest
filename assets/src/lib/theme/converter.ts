import { Recursive, Token } from "@blunderfest/styled-system/types/composition";

export function convert(from: Record<string, string>, prefix: string) {
    const result: Recursive<Token<string>> = {};

    for (const key in from) {
        if (key.startsWith(prefix)) {
            const name = key.substring(prefix.length);

            result[name] = {
                value: from[key],
            };
        }
    }

    return result;
}
