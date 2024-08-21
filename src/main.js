// 1) Run the db client as an instance of the Event Emitter Class to be able to handle events when the network status changes
// 2) Look into asyc/await and promises when sending commands to the db server, want to be able to send and then await the response
// 3) Add pipeline support to the db client
// 4) Take another look at how node-redis works, will be similar to that
// 5) don't forgot to generate the .d.ts to support library users who use typescript
// See how to store objects in the db, hashSet or a string as json.stringify?

// ! Very important to record and handle errors properly, there is alot going on, do some more tommorow

import { DEFAULT_SERVERPORT, DEFAULT_SERVERIP } from "./protocol.js";

import { EventEmitter } from "events";
import { CommandQueue } from "./commandQueue.js";
import { LiteDBSocket } from "./liteDBSocket.js";
import { LiteDBDecoder } from "./decoder.js";

/**
 * @typedef {import('./types.js').ClientOptions} ClientOptions
 * @typedef {import('./types.js').LiteDBCommand} LiteDBCommand
 * @typedef {import('./types.js').ConnectOptions} ConnectOptions
 * @typedef {import('./types.js').ResponseData} ResponseData
 */

/**
 * Creates a new instance of the liteDB client
 * @param {ClientOptions} [clientOptions] - The options to use when creating the client
 * @returns {liteDBClient}
 */
function createClient(clientOptions) {
	return new liteDBClient(clientOptions);
}

class liteDBClient extends EventEmitter {
	/**
	 * @param {ClientOptions} [clientOptions]
	 * @constructor
	 */
	constructor(clientOptions) {
		super();
		this.liteDBSocket = new LiteDBSocket();
		this.commandQueue = new CommandQueue();
		this.decoder = new LiteDBDecoder();
	}

	/**
	 * @param {ConnectOptions} [connectOptions]
	 */
	async connect(connectOptions) {
		if (!connectOptions) {
			connectOptions = {
				host: DEFAULT_SERVERIP,
				port: DEFAULT_SERVERPORT,
			};
		}

		this.liteDBSocket
			.on("connect", () => {
				this.emit("connect");
			})
			.on("close", () => {
				this.emit("close");
			})
			.on("end", () => {
				this.emit("end");
			})
			.on("error", (err) => {
				this.emit("error", err);
			})
			.on("drain", () => {
				this.tick();
			})
			.on("data", (data) => {
				try {
					this.handleData(data);
				} catch (err) {
					this.emit("error", err);
				}
			});

		await this.liteDBSocket.connect(connectOptions);
		return this;
	}

	/**
	 *  Ticks the command queue to send the next command to the server
	 *
	 * @returns {void}
	 *
	 */
	tick() {
		// if the socket write buffer is full and waiting for a drain event, return, dont want to potentially overflow the in-memory buffer queue since the kernel buffer is full
		if (this.liteDBSocket.writableNeedDrain) {
			return;
		}

		while (!this.liteDBSocket.writableNeedDrain) {
			// get the next command to send
			const nextCmd = this.commandQueue.getNextCommand();

			// if there are no more commands to send, break out of the loop
			if (!nextCmd) {
				break;
			}

			// write the command to the server socket
			this.liteDBSocket.writeCmd(nextCmd);
		}
	}

	/**
	 * Sends a command to the server and return a promise that resolves when the command is fully processed and contains the server responsee
	 * @param {LiteDBCommand} cmd
	 * @returns Promise<any> - The promise that will be resolved when the command if fully processed, it contains the server response
	 */
	sendCmd(cmd) {
		if (!this.liteDBSocket.isReady) {
			// non recoverable error, throw an error
			throw new Error(
				"Trying to send cmd to server when client not ready"
			);
		}

		// add the command to the queue
		const retPromise = this.commandQueue.addCommand(cmd);

		// tick the command queue, to attempt to immediately send the command
		this.tick();

		return retPromise;
	}

	/**
	 * Process as many commands as possible and resolve thier promises
	 * @returns {void}
	 */
	replyToCommands() {
		/** @type {ResponseData | undefined} */
		let response;

		while ((response = this.decoder.processCommand())) {
			const nextCmd = this.commandQueue.shiftWaitingForReply();
			if (!nextCmd) {
				// Server does not send random data and since there is no command waiting, error occured somewhere
				throw new Error(
					"Received data from server with no command waiting"
				);
			}

			// resolve the promise with the response data
			nextCmd.resolve(response);
		}
	}

	/**
	 * Handles the data buffer received from the server
	 *
	 * @param {Buffer} data - The data buffer received from the server
	 * @returns {void}
	 */

	handleData(data) {
		const waitingReplyLength = this.commandQueue.waitingForReply.length;
		if (waitingReplyLength < 1) {
			// Server does not send random data and since there is no command waiting, error occured somewhere
			throw new Error(
				"Received data from server with no command waiting"
			);
		}

		// append the data to the decoder
		this.decoder.addData(data);

		// attempt to reply to commands waiting for a response
		this.replyToCommands();
	}
}

// test the client
const client = await createClient()
	.on("error", (err) => {
		// print the error
		console.error(err);
	})
	.connect();

let cmdStr1 = "keys";

let cmd1 = {
	cmdStr: cmdStr1,
	cmdLen: cmdStr1.length,
};

let cmdStr2 = "get a";
let cmd2 = {
	cmdStr: cmdStr2,
	cmdLen: cmdStr2.length,
};

let cmdStr3 = "keys a";
let cmd3 = {
	cmdStr: cmdStr3,
	cmdLen: cmdStr3.length,
};

console.log(await client.sendCmd(cmd1));
console.log(await client.sendCmd(cmd2));
console.log(await client.sendCmd(cmd3));
