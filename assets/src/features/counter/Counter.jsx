import { decrement, increment, incrementByAmount } from "@/store/actions";
import { useAppDispatch, useAppSelector } from "@/store";

export function Counter() {
  const count = useAppSelector((state) => state.counter.value);
  const dispatch = useAppDispatch();

  return (
    <div>
      <div>
        <button aria-label="Increment value" onClick={() => dispatch(increment())}>
          Increment
        </button>
        <button aria-label="Increment value" onClick={() => dispatch(incrementByAmount(4))}>
          Increment by 4
        </button>
        <span>{count}</span>
        <button aria-label="Decrement value" onClick={() => dispatch(decrement())}>
          Decrement
        </button>
      </div>
    </div>
  );
}
