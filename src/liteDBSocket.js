// create a tcp socket with some additional functionality for the liteDB client

/**
 * @typedef {import('./types.js').ConnectOptions} ConnectOptions
 */

import { EventEmitter } from "events";
import { Socket } from "net";
import { Buffer } from "buffer";

export class liteDBSocket extends EventEmitter {
	/**
	 *
	 * @constructor
	 */
	constructor() {
		super();
		this.isReady = false;
		this.writableNeedDrain = false;
		this.socket = new Socket({});
	}

	/**
	 *  Handles the connection to the server
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
				.once("error", (err) => {
					reject(err);
				});

			this.socket.once("connect", () => {
				this.isReady = true;

				// propagate the socket error as a liteDB client error
				this.socket
					.off("error", reject)
					.on("error", (err) => {
						// emit an error and also reject the promise, so the caller can handle the error either way they want
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
}
