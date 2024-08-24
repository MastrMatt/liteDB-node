// ! Test the client as a whole here, make sure server is running before doing these tests, If i want to setup fully automated tests, will either need to mock the liteDB server or find a way (Docker?) to spin up a new sever during tests

import { createClient } from "../main.js";

describe("Integration tests", () => {
	let client = createClient();

	beforeAll(async () => {
		await client.connect();
	});

	afterEach(async () => {
		await client.flushall();
	});

	afterAll(async () => {
		await client.disconnect();
	});

	// test connection
	test("connect to server", async () => {
		return;
	});
});
