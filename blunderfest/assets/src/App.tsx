import { useEffect, useState } from "react";

export const App = () => {
    const [count, setCount] = useState(0);

    useEffect(() => {
        fetch("/api/")
            .then(response => response.json())
            .then(data => console.log(data))
            .catch(error => console.error("Error", error));
    }, []);

    return <div>Hello, World!
        <button onClick={() => setCount(count + 1) }>Counter: {count}</button>
    </div>;
}
