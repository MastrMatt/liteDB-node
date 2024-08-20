// 1) Run the db client as an instance of the Event Emitter Class to be able to handle events when the network status changes
// 2) Look into asyc/await and promises when sending commands to the db server, want to be able to send and then await the response
// 3) Add pipeline support to the db client
// 4) Take another look at how node-redis works, will be similar to that
// 5) don't forgot to generate the .d.ts to support library users who use typescript
// See how to store objects in the db, hashSet or a string as json.stringify?

import { EventEmitter } from "events";
import { Buffer } from "buffer";
import { Socket } from "net";

import {
	MAX_MESSAGE_SIZE,
	MAX_ARGS,
	DEFAULT_SERVERPORT,
	DEFAULT_SERVERIP,
	SER_VALUES,
} from "./protocol.js";

/**
 * @typedef {import('./types.d.ts').ClientOptions} ClientOptions
 * @typedef {import('./types.d.ts').RecvData} RecvData
 */

/**
 * Creates a new instance of the liteDB client
 * @param {ClientOptions} [options] - The options to use when creating the client
 * @returns {liteDBClient}
 */
function createClient(options) {
	return new liteDBClient(options);
}

class liteDBClient extends EventEmitter {
	/**
	 * @param {ClientOptions} [options]
	 * @constructor
	 */
	constructor(options) {
		super();
		this.host = options?.host || DEFAULT_SERVERIP;
		this.port = options?.port || DEFAULT_SERVERPORT;
		this.socket = new Socket();

		// pipeline queue
		this.commandQueue = [];
	}

	async connect() {
		return new Promise((resolve, reject) => {
			this.socket.connect(this.port, this.host, () => {
				this.emit("connect");
				console.log("Connected to the server");

				// resolve and return instance of the client
				resolve(this);
			});

			// propagate the socket error as a liteDB client error
			this.socket.on("error", (err) => {
				// emit an error and also reject the promise, so the caller can handle the error either way they want
				this.emit("error", err);
				reject(err);
			});
		});
	}

	/**
	 * Creates a new Buffer from the provided data, ensuring it does not exceed the specified maximum size.
	 *
	 * @param {number} maxSize
	 * @param {string} data
	 *
	 * @returns {Buffer} A Buffer containing the data
	 */
	createBuffer(maxSize, data) {
		if (Buffer.byteLength(data, "utf-8") > maxSize) {
			// throw an error if the data exceeds the maximum size
			this.emit("error", new Error("Data exceeds maximum size"));
		}
		return Buffer.from(data);
	}

	/**
	 * Sends a command to the server
	 * @param {number} cmdLength
	 * @param {string} cmdString
	 */
	sendCmd(cmdLength, cmdString) {
		// check if the command length exceeds the maximum allowed
		if (cmdLength > MAX_MESSAGE_SIZE) {
			this.emit(
				"error",
				new Error(
					"Command length exceeds maximum string message size for server"
				)
			);
		}

		// create a buffer to hold the length of the command
		const cmdLengthBuffer = Buffer.alloc(4);
		cmdLengthBuffer.writeInt32LE(cmdLength);

		// create a buffer to hold the command string
		const cmdBuffer = this.createBuffer(cmdLength, cmdString);

		// concat
		const cmd = Buffer.concat([cmdLengthBuffer, cmdBuffer], 4 + cmdLength);

		// send the command to the server
		this.socket.write(cmd);
	}
}

// test the client
const client = await createClient()
	.on("error", (err) => {
		console.error("Connection error occured");
	})
	.connect();

client.sendCmd(4, "PING");
client.sendCmd(6, "PINGER");
