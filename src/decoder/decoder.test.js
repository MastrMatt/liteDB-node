import { LiteDBDecoder } from "./decoder.js";

describe("Decoder", () => {
	test("should create a new instance of Decoder", () => {
		const decoder = new LiteDBDecoder();
		expect(decoder).toBeInstanceOf(LiteDBDecoder);
	});
});
