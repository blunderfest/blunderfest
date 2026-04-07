import ky from "ky";

const API_BASE_URL =
	(typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
	"http://localhost:8080/api/v1";

export const api = ky.create({
	prefix: API_BASE_URL,
	headers: {
		"Content-Type": "application/json",
	},
	hooks: {
		beforeRequest: [
			(request: unknown) => {
				const token = localStorage.getItem("auth_token");
				if (
					token &&
					typeof request === "object" &&
					request !== null &&
					"headers" in request
				) {
					(request.headers as Headers).append(
						"Authorization",
						`Bearer ${token}`,
					);
				}
			},
		],
	},
});
