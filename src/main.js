// @ts-check

// 1) Run the db client as an instance of the Event Emitter Class to be able to handle events when the network status changes
// 2) Look into asyc/await and promises when sending commands to the db server, want to be able to send and then await the response
// 3) Add pipeline support to the db client
// 4) Take another look at how node-redis works, will be similar to that
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
@typedef {Object} ClientOptions
@property {string} host
@property {number} port
*/

/**
 * Creates a new instance of the liteDB client
 * @param {ClientOptions} options
 * @returns {liteDBClient}
 */
function createClient(options) {
	return new liteDBClient(options);
}

class liteDBClient extends EventEmitter {
	/**
	 * Creates a new instance of the liteDB client
	 * @param {ClientOptions} options
	 * @constructor
	 *
	 * 	*/
	constructor(options) {
		super();
		this.host = options.host || DEFAULT_SERVERIP;
		this.port = options.port || DEFAULT_SERVERPORT;
		this.socket = new Socket();

		// pipeline queue
		this.commandQueue = [];
	}

	connect() {
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

			// this should be attached and detached by the db command functions
			// this.socket.on("data", (data) => {
			// 	//  come back to this later, call some
			// });
		});
	}

	/**
	 * Creates a new Buffer from the provided data, ensuring it does not exceed the specified maximum size.
	 *
	 * @param {string} data
	 * @param {number} maxSize
	 * @returns {Buffer} A Buffer containing the data
	 */
	createBuffer(data, maxSize) {
		if (Buffer.byteLength(data, "utf-8") > maxSize) {
			// throw an error if the data exceeds the maximum size
			throw new Error("Data exceeds the maximum size");
		}
		return Buffer.from(data);
	}

	/**
	 * Sends a command to the server
	 * @param {number} cmdLength
	 * @param {string} cmdString
	 * @returns {Promise}
	 */
	sendFormattedCmd(cmdLength, cmdString) {
		// create a buffer to hold the command
		let cmdBuffer = Buffer.alloc(MAX_MESSAGE_SIZE);

		// write the command length to the buffer
	}
}
