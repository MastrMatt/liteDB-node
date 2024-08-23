import { LiteDBSocket } from "./liteDBSocket.js";

describe("LiteDBSocket", () => {
	test("should create a new instance of LiteDBSocket", () => {
		const liteDBSocket = new LiteDBSocket();
		expect(liteDBSocket).toBeInstanceOf(LiteDBSocket);
	});
});
