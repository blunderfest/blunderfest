import type { ReactNode } from "react";
import "./app.css";

interface AppProps {
	children?: ReactNode;
}

function App({ children }: AppProps) {
	return (
		<div className="app">
			<header className="app-header">
				<h1>Blunderfest</h1>
				<p>High-Performance Chess Database</p>
			</header>
			<main className="app-main">
				{children || (
					<div className="welcome">
						<h2>Welcome to Blunderfest</h2>
						<p>Your distributed chess database engine</p>
					</div>
				)}
			</main>
		</div>
	);
}

export default App;
