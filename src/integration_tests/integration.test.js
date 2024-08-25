import { createClient, LiteDBClient } from "../main.js";
import { execSync } from "child_process";

const docker_start_cmd =
	"docker run -p 9255:9255 -d --name litedb-test-server mastrmatt/litedb:latest";

const docker_stop_cmd = "docker stop litedb-test-server";

const docker_rm_cmd = "docker rm litedb-test-server";

describe("Integration tests", () => {
	let client = createClient();

	beforeAll(async () => {
		// start the server
		try {
			execSync(docker_start_cmd);
			console.log("Server started");
		} catch (err) {
			throw new Error(
				"Unable to excute the command to start the docker server"
			);
		}
		// wait for the server to start
		await new Promise((resolve) => setTimeout(resolve, 4000));
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
		// stop the server
		try {
			execSync(docker_stop_cmd);
		} catch (err) {
			throw new Error("Unable to stop the docker server");
		}
		// remove container from docker
		try {
			execSync(docker_rm_cmd);
		} catch (err) {
			throw new Error("Unable to remove the docker server");
		}
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
});
