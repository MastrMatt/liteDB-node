import { LiteDBDecoder } from "./decoder.js";
import { SER_VALUES } from "../protocol.js";

describe("Decoder", () => {
	test("should create a new instance of Decoder", () => {
		const decoder = new LiteDBDecoder();
		expect(decoder).toBeInstanceOf(LiteDBDecoder);
	});

	test("should add data to the decoder buffer", () => {
		const decoder = new LiteDBDecoder();
		const data = Buffer.from("test");
		decoder.addData(data);
		decoder.addData(data);
		expect(decoder.dataBuffer).toEqual(Buffer.concat([data, data]));
	});

	test("should parse nil", () => {
		const decoder = new LiteDBDecoder();

		const data = Buffer.alloc(1 + 4);
		data.writeInt8(SER_VALUES.SER_NIL, 0);

		// write the length of nil
		data.writeInt32LE(0, 1);

		decoder.addData(data);

		const response = decoder.processCommand();
		expect(response).toEqual({
			type: SER_VALUES.SER_NIL,
			length: 0,
		});
	});

	test("should parse error", () => {
		const decoder = new LiteDBDecoder();

		const data = Buffer.alloc(1 + 4 + 5);
		data.writeInt8(SER_VALUES.SER_ERR, 0);
		data.writeInt32LE(5, 1);
		data.write("error", 5);

		decoder.addData(data);

		const response = decoder.processCommand();
		expect(response).toEqual({
			type: SER_VALUES.SER_ERR,
			length: 5,
			data: "error",
		});
	});

	test("should parse string", () => {
		const decoder = new LiteDBDecoder();

		const data = Buffer.alloc(1 + 4 + 5);
		data.writeInt8(SER_VALUES.SER_STR, 0);
		data.writeInt32LE(5, 1);
		data.write("hello", 5);

		decoder.addData(data);

		const response = decoder.processCommand();
		expect(response).toEqual({
			type: SER_VALUES.SER_STR,
			length: 5,
			data: "hello",
		});
	});

	test("should parse int", () => {
		const decoder = new LiteDBDecoder();

		const data = Buffer.alloc(1 + 4 + 4);
		data.writeInt8(SER_VALUES.SER_INT, 0);

		// write the length of integer
		data.writeInt32LE(4, 1);

		// write the integer value
		data.writeInt32LE(123, 5);

		decoder.addData(data);

		const response = decoder.processCommand();
		expect(response).toEqual({
			type: SER_VALUES.SER_INT,
			length: 4,
			data: 123,
		});
	});

	test("should parse float", () => {
		const decoder = new LiteDBDecoder();

		const data = Buffer.alloc(1 + 4 + 4);
		data.writeInt8(SER_VALUES.SER_FLOAT, 0);

		// write the length of float
		data.writeInt32LE(4, 1);

		// write the float value
		data.writeFloatLE(123.45, 5);

		decoder.addData(data);

		const response = decoder.processCommand();
		expect(response?.type).toEqual(SER_VALUES.SER_FLOAT);
		expect(response?.length).toEqual(4);
		expect(response?.data).toBeCloseTo(123.45);
	});

	test("should parse array", () => {
		const decoder = new LiteDBDecoder();

		const data = Buffer.alloc(1 + 4 + 9 + 9 + 9);

		data.writeInt8(SER_VALUES.SER_ARR, 0);
		data.writeInt32LE(3, 1);
		data.writeInt8(SER_VALUES.SER_INT, 5);
		data.writeInt32LE(4, 6);
		data.writeInt32LE(123, 10);
		data.writeInt8(SER_VALUES.SER_INT, 14);
		data.writeInt32LE(4, 15);
		data.writeInt32LE(124, 19);
		data.writeInt8(SER_VALUES.SER_STR, 23);
		data.writeInt32LE(4, 24);
		data.write("test", 28);

		decoder.addData(data);

		const response = decoder.processCommand();

		expect(response?.type).toEqual(SER_VALUES.SER_ARR);
		expect(response?.length).toEqual(3);
		expect(response?.data).toEqual([
			{ type: SER_VALUES.SER_INT, length: 4, data: 123 },
			{ type: SER_VALUES.SER_INT, length: 4, data: 124 },
			{ type: SER_VALUES.SER_STR, length: 4, data: "test" },
		]);
	});

	test("should return undefined if there's not enough data to parse", () => {
		const decoder = new LiteDBDecoder();

		const data = Buffer.alloc(1 + 4);
		data.writeInt8(SER_VALUES.SER_INT, 0);

		// write the length of integer
		data.writeInt32LE(4, 1);

		decoder.addData(data);

		const response = decoder.processCommand();

		expect(response).toBeUndefined();
	});

	test("multiple commands should be parsed", () => {
		const decoder = new LiteDBDecoder();

		const data = Buffer.alloc(1 + 4 + 4 + 1 + 4 + 5);
		data.writeInt8(SER_VALUES.SER_INT, 0);
		data.writeInt32LE(4, 1);
		data.writeInt32LE(123, 5);
		data.writeInt8(SER_VALUES.SER_STR, 9);
		data.writeInt32LE(5, 10);
		data.write("hello", 14);

		decoder.addData(data);

		const response1 = decoder.processCommand();
		expect(response1).toEqual({
			type: SER_VALUES.SER_INT,
			length: 4,
			data: 123,
		});

		const response2 = decoder.processCommand();
		expect(response2).toEqual({
			type: SER_VALUES.SER_STR,
			length: 5,
			data: "hello",
		});
	});
});
