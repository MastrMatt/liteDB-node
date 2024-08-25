// write tests for the commandQueue module here using jest

import { CommandQueue } from "./commandQueue.js";

/** @typedef {import('../types.js').LiteDBCommand} LiteDBCommand */

describe("CommandQueue", () => {
	test("should create a new instance of CommandQueue", () => {
		const commandQueue = new CommandQueue();
		expect(commandQueue).toBeInstanceOf(CommandQueue);
	});

	test("should add a command to the queue", () => {
		const commandQueue = new CommandQueue();

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr: "ping",
			cmdLen: 4,
		};

		commandQueue.addCommand(command);

		expect(commandQueue.waitingToBeSent.length).toBe(1);
	});

	test("should remove a command from the queue", () => {
		const commandQueue = new CommandQueue();

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr: "ping",
			cmdLen: 4,
		};

		commandQueue.addCommand(command);

		const nextCommand = commandQueue.getNextCommand();

		expect(nextCommand).toEqual(command);
		expect(commandQueue.waitingToBeSent.length).toBe(0);
		expect(commandQueue.waitingForReply.length).toBe(1);
	});

	test("remove the first command from the waiting for reply queue", () => {
		const commandQueue = new CommandQueue();

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr: "ping",
			cmdLen: 4,
		};

		commandQueue.addCommand(command);

		const nextCommand = commandQueue.getNextCommand();

		expect(nextCommand).toEqual(command);

		const shiftedCommand = commandQueue.shiftWaitingForReply();

		expect(shiftedCommand).toEqual({
			resolve: expect.any(Function),
			reject: expect.any(Function),
		});
	});
});
