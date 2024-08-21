// command queue for hadling commands

// 1) Queue for commands to be sent to the server, should be an object containing cmdstring and optional arguments
// 2) Queue for command waiting for a response from the server, these should have the resolve and reject functions attached to them
// 3) A mechanism to send the commands to the server and add to the waiting queue
// 4) A mechanism to handle the response from the server and resolve the promise
// 5) Then the user can await the cmd call ex:  await dbClient.set("key", "value)

import { Yallist } from "yallist";
import { CMDQUEUEMAXSIZE } from "./protocol.js";

/**
 * @typedef {import('./types.d.ts').CommandWaitingToBeSent} CommandWaitingToBeSent
 * @typedef {import('./types.d.ts').CommandWaitingForReply} CommandWaitingForReply
 * @typedef {import('./types.d.ts').LiteDBCommand} LiteDBCommand
 */

export class CommandQueue {
	/**
	 * @param {number} [maxLength]
	 * @constructor
	 */
	constructor(maxLength) {
		this.maxLength = maxLength || CMDQUEUEMAXSIZE;

		/** @type {Yallist<CommandWaitingToBeSent>} */
		this.waitingToBeSent = new Yallist();

		/** @type {Yallist<CommandWaitingForReply>} */
		this.waitingForReply = new Yallist();
	}

	/**
	 * Add a command to the queue to be sent to the server
	 * @param {LiteDBCommand} cmd - The command object to add to the queue
	 * @returns Promise<any> - The promise that will be resolved when the command if fully processed, it contains the server response
	 */
	addCommand(cmd) {
		if (
			this.waitingToBeSent.length + this.waitingForReply.length >=
			this.maxLength
		) {
			return Promise.reject(new Error("Queue is full"));
		}

		return new Promise((resolve, reject) => {
			// add to the command to the end of the queue
			this.waitingToBeSent.push({
				cmd,
				resolve,
				reject,
			});
		});
	}

	/**
	 * Send the next command in the queue to the server
	 * @returns {LiteDBCommand | undefined} - The next command to be sent
	 */

	getNextCommand() {
		const nextCmd = this.waitingToBeSent.shift();
		if (!nextCmd) return;

		// add the command to the waiting for reply queue
		this.waitingForReply.push({
			resolve: nextCmd.resolve,
			reject: nextCmd.reject,
		});

		return nextCmd.cmd;
	}

	/**
	 * Handles the data buffer received from the server
	 *
	 * @param {Buffer} data - The data buffer received from the server
	 * @returns {void}
	 */

	handleData(data) {
		// see if the data is enough to resolve the first command
		const firstCmd = this.waitingForReply.shift();

		if (!firstCmd) {
			// Server does not send random data, error somewhere
			throw new Error(
				"Received data from server with no command waiting"
			);
		}

		// ! Parse response based on the command and see if sufficient data has been received
	}
}
