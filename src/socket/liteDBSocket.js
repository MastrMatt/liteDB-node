// create a tcp socket with some additional functionality for the liteDB client

/**
 * @typedef {import('../types.js').ConnectOptions} ConnectOptions
 * @typedef {import('../types.js').LiteDBCommand} LiteDBCommand
 */

import { EventEmitter } from "events";
import { Socket } from "net";
import { Buffer } from "buffer";

import { MAX_MESSAGE_SIZE } from "../protocol.js";

export class LiteDBSocket extends EventEmitter {
	/**
	 * @param {ConnectOptions} [connectOptions]
	 * @constructor
	 */
	constructor(connectOptions) {
		super();
		this.isReady = false;
		this.writableNeedDrain = true;
		this.connectOptions = connectOptions;
		this.socket = new Socket({});
	}

	/**
	 *  Connect to the server
	 * @param {ConnectOptions} connectOptions
	 * @returns Promise<void>
	 */
	async connect(connectOptions) {
		if (this.isReady) {
			throw new Error("Already connected to the server");
		}

		return new Promise((resolve, reject) => {
			this.socket
				.connect(connectOptions.port, connectOptions.host, () => {
					console.log("Connected to the server");
					resolve(this);
				})
				.on("connect", () => {
					this.emit("connect");
				})
				.once("error", (err) => {
					reject(err);
				});

			this.socket.once("connect", () => {
				this.isReady = true;
				this.writableNeedDrain = false;

				// propagate select events by emitting them
				this.socket
					.off("error", reject)
					.on("error", (err) => {
						this.emit("error", err);
					})
					.on("drain", () => {
						this.writableNeedDrain = false;
						this.emit("drain");
					})
					.on("data", (data) => {
						this.emit("data", data);
					})
					.on("close", (hadError) => {
						this.emit("close", hadError);
					});
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
			// non recoverable error, throw an error
			this.emit("error", new Error("Data exceeds maximum size"));
		}
		return Buffer.from(data);
	}

	/**
	 * Writes a command to the server socket
	 *
	 * @param {LiteDBCommand} cmd
	 *
	 */
	writeCmd(cmd) {
		// check if the command length exceeds the maximum allowed
		if (cmd.cmdLen > MAX_MESSAGE_SIZE) {
			this.emit(
				"error",
				new Error(
					"Command length exceeds maximum string message size for server"
				)
			);
		}

		// create a buffer to hold the length of the command
		const cmdLengthBuffer = Buffer.alloc(4);
		cmdLengthBuffer.writeInt32LE(cmd.cmdLen);

		// create a buffer to hold the command string
		const cmdStrBuffer = this.createBuffer(cmd.cmdLen, cmd.cmdStr);

		// concat
		const cmdBuffer = Buffer.concat(
			[cmdLengthBuffer, cmdStrBuffer],
			4 + cmd.cmdLen
		);

		// send the command to the server
		this.socket.write(cmdBuffer);
	}

	/**
	 * Disconnect from the server
	 */
	disconnect() {
		if (!this.isReady) {
			throw new Error(
				"Want to disconnect but not connected to the server"
			);
		}

		this.isReady = false;
		this.socket.destroy();
	}
}
