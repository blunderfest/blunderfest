import ky from "ky";

const API_BASE_URL =
	(typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
	"http://localhost:8080/api/v1";

export const api = ky.create({
	prefixUrl: API_BASE_URL,
	headers: {
		"Content-Type": "application/json",
	},
	hooks: {
		beforeRequest: [
			(request) => {
				const token = localStorage.getItem("auth_token");
				if (token) {
					request.headers.set("Authorization", `Bearer ${token}`);
				}
			},
		],
	},
});
