// write tests for the commandQueue module here using jest

import { CommandQueue } from "./commandQueue.js";

describe("CommandQueue", () => {
	test("should create a new instance of CommandQueue", () => {
		const commandQueue = new CommandQueue();
		expect(commandQueue).toBeInstanceOf(CommandQueue);
	});
});

export {};
