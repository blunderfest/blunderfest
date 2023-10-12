import { useEffect } from "react";

import { Board } from "./features/board/Board";

function App() {
	useEffect(() => {
		const disableContextMenu = (/** @type {MouseEvent} */ e) => e.preventDefault();
		document.addEventListener("contextmenu", disableContextMenu);

		return () => document.removeEventListener("contextmenu", disableContextMenu);
	});

	return <Board />;
}

export default App;
