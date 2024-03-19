import { useEffect, useState } from "react";

export const useObservable =
  /**
   * @template T
   * @param {(import("rxjs").Observable<T>)} observable
   */
  (observable) => {
    const [value, setValue] = useState(/** @type {T} */ (undefined));

    useEffect(() => {
      const subscription = observable.subscribe((v) => {
        setValue(v);
      });

      return () => {
        subscription.unsubscribe();
      };
    }, [observable]);

    return value;
  };
