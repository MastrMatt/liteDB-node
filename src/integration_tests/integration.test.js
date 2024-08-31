// If running locally, make sure to have the docker server running, github actions will start up the docker server before running the tests

import { createClient, LiteDBClient } from "../main.js";

describe("Integration tests", () => {
	let client = createClient();

	beforeAll(async () => {
		// connect to the server
		try {
			await client.connect();
		} catch (err) {
			throw new Error(
				"Unable to connect to the server, is the docker server running?"
			);
		}
	});
	afterEach(async () => {
		await client.flushall();
	});
	afterAll(async () => {
		await client.disconnect();
	});

	test("connect to server", async () => {
		let testConnect = createClient().connect();
		expect(testConnect).resolves.toBeInstanceOf(LiteDBClient);
	});

	test("disconnect from server", async () => {
		let testClient = await createClient().connect();
		let testDisconnect = testClient.disconnect();
		expect(testDisconnect).resolves.toBeUndefined();
	});

	test("ping", async () => {
		let value = await client.ping();
		expect(value).toBe("PONG");
	});

	test("exists", async () => {
		await client.set("key", "value");

		let falseValue = await client.exists("key1");
		let value = await client.exists("key");

		expect(falseValue).toBe(0);
		expect(value).toBe(1);
	});

	test("Set and Get", async () => {
		await client.set("key", "value");
		let value = await client.get("key");
		expect(value).toBe("value");
	});
	test("Del", async () => {
		await client.set("key", "value");
		let value = await client.del("key");
		expect(value).toBe(1);
	});
	test("Keys", async () => {
		await client.set("key1", "value1");
		await client.set("key2", "value2");
		let keys = await client.keys();
		expect(keys).toEqual(["key1", "key2"]);
	});
	test("Flushall", async () => {
		await client.set("key1", "value1");
		await client.set("key2", "value2");
		await client.flushall();
		let keys = await client.keys();
		expect(keys).toEqual([]);
	});

	test("Hexists", async () => {
		await client.hSet("hash", "field", "value");
		let falseValue = await client.hExists("hash", "field1");
		let value = await client.hExists("hash", "field");

		expect(falseValue).toBe(0);
		expect(value).toBe(1);
	});

	test("Hset and Hget", async () => {
		await client.hSet("hash", "field", "value");
		let value = await client.hGet("hash", "field");
		expect(value).toBe("value");
	});
	test("Hdel", async () => {
		await client.hSet("hash", "field", "value");
		let value = await client.hDel("hash", "field");
		expect(value).toBe(1);
	});
	test("Hgetall", async () => {
		await client.hSet("hash", "field1", "value1");
		await client.hSet("hash", "field2", "value2");
		let value = await client.hGetAll("hash");
		expect(value).toEqual({ field1: "value1", field2: "value2" });
	});

	test("LEXISTS", async () => {
		await client.lPush("list", "value1");

		let falseValue = await client.lExists("list", "value2");
		let value = await client.lExists("list", "value1");

		expect(falseValue).toBe(0);
		expect(value).toBe(1);
	});

	test("LPUSH and RPUSH", async () => {
		await client.lPush("list", "value1");
		await client.rPush("list", "value2");
		let value = await client.lLen("list");
		expect(value).toBe(2);
		value = await client.lRange("list", 0, 0);
		expect(value).toEqual(["value1"]);
		value = await client.lRange("list", 1, 1);
		expect(value).toEqual(["value2"]);
	});

	test("LPOP and RPOP", async () => {
		await client.lPush("list", "value1");
		await client.rPush("list", "value2");
		await client.rPush("list", "value3");

		let value = await client.lPop("list");
		expect(value).toBe("value1");

		value = await client.lRange("list", 0, 0);
		expect(value).toEqual(["value2"]);

		value = await client.rPop("list");
		expect(value).toBe("value3");

		value = await client.lRange("list", 0, 0);
		expect(value).toEqual(["value2"]);

		value = await client.lLen("list");
		expect(value).toBe(1);
	});

	test("LREM", async () => {
		await client.lPush("list", "value1");
		await client.lPush("list", "value1");
		await client.rPush("list", "value2");
		await client.rPush("list", "value2");
		await client.rPush("list", "value1");

		let value = await client.lRem("list", 2, "value1");
		expect(value).toBe(2);

		let response = await client.lRange("list", 0, 1);

		expect(response).toEqual(["value2", "value2"]);

		value = await client.lRem("list", -1, "value1");

		expect(value).toBe(1);

		response = await client.lRange("list", -1, -1);

		expect(response).toEqual(["value2"]);

		value = await client.lRem("list", 0, "value2");

		expect(value).toBe(2);
		expect(await client.lLen("list")).toBe(0);
	});

	test("LLEN", async () => {
		await client.lPush("list", "value1");
		await client.rPush("list", "value2");
		let value = await client.lLen("list");
		expect(value).toBe(2);
	});

	test("LRANGE", async () => {
		await client.lPush("list", "value1");
		await client.rPush("list", "value2");
		await client.rPush("list", "value3");
		let value = await client.lRange("list", 1, 2);
		expect(value).toEqual(["value2", "value3"]);
	});

	test("lTrim", async () => {
		await client.lPush("list", "value1");
		await client.rPush("list", "value2");
		await client.rPush("list", "value3");
		await client.rPush("list", "value4");
		await client.lTrim("list", 1, 2);
		let value = await client.lRange("list", 0, 1);
		expect(value).toEqual(["value2", "value3"]);
	});

	test("lSet", async () => {
		await client.lPush("list", "value1");
		await client.rPush("list", "value2");
		await client.rPush("list", "value3");
		await client.lSet("list", 1, "value4");
		await client.lSet("list", 2, "value5");

		let value = await client.lRange("list", 0, 2);
		expect(value).toEqual(["value1", "value4", "value5"]);
	});

	test("zAdd and zQuery", async () => {
		await client.zAdd("zset", 1, "value1");
		await client.zAdd("zset", 2, "value2");
		await client.zAdd("zset", 3, "value3");
		let value = await client.zQuery("zset", 1, "value1", 0, 1);
		expect(value).toEqual({
			value1: 1,
		});

		value = await client.zQuery("zset", 1, "value1", 0, 2);
		expect(value).toEqual({
			value1: 1,
			value2: 2,
		});

		value = await client.zQuery("zset", 1, "value1", 0, 3);
		expect(value).toEqual({
			value1: 1,
			value2: 2,
			value3: 3,
		});

		//zQuery by score
		value = await client.zQuery("zset", 1, '""', 0, 2);
		expect(value).toEqual({
			value1: 1,
			value2: 2,
		});

		//zQuery by rank
		value = await client.zQuery("zset", -Infinity, '""', 1, 2);

		expect(value).toEqual({
			value2: 2,
			value3: 3,
		});
	});

	test("zRem", async () => {
		await client.zAdd("zset", 1, "value1");
		await client.zAdd("zset", 2, "value2");
		await client.zAdd("zset", 3, "value3");
		let value = await client.zRem("zset", "value2");
		expect(value).toBe(1);

		value = await client.zQuery("zset", 1, "value1", 0, 2);
		expect(value).toEqual({
			value1: 1,
			value3: 3,
		});
	});

	test("zScore", async () => {
		await client.zAdd("zset", 1, "value1");

		let value = await client.zScore("zset", "value1");
		expect(value).toBe(1);
	});
});
