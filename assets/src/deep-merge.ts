// https://amitd.co/code/typescript/recursively-deep-merging-objects
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Props = Record<string, any>;

export const deepMerge = <T extends Props>(target: T, ...sources: T[]): T => {
    if (!sources.length) {
        return target;
    }

    Object.entries(sources.shift() ?? []).forEach(([key, value]) => {
        if (value) {
            if (!target[key]) {
                Object.assign(target, { [key]: {} });
            }

            if (value.constructor === Object || (value.constructor === Array && value.find(v => v.constructor === Object))) {
                deepMerge(target[key], value);
            } else if (value.constructor === Array) {
                Object.assign(target, {
                    [key]: value.find(v => v.constructor === Array)
                        ? target[key].concat(value)
                        : [...new Set([...target[key], ...value])],
                });
            } else {
                Object.assign(target, { [key]: value });
            }
        }
    });

    return target;
};
