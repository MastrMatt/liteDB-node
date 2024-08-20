// command queue for hadling commands

// 1) Queue for commands to be sent to the server, should contain cmdstring and optional arguments
// 2) Queue for command waiting for a response from the server, these should have the resolve and reject functions attached to them
// 3) A mechanism to send the commands to the server and add to the waiting queue
// 4) A mechanism to handle the response from the server and resolve the promise
// 5) Then the user can await the cmd call ex:  await dbClient.set("key", "value)

import { Yallist } from "yallist";
import { CMDQUEUEMAXSIZE } from "./protocol.js";

/**
 * @typedef {import('./types.d.ts').ClientOptions} CommandWaitingForReply
 * @typedef {import('./types.d.ts').RecvData} CommandWaitingToBeSent
 */

export class CommandQueue {
	/**
	 * @param {number} [maxLength]
	 * @constructor
	 */
	constructor(maxLength) {
		this.maxLength = maxLength || CMDQUEUEMAXSIZE;
		this.waitingToBeSent = new Yallist();
		this.waitingForReply = new Yallist();
	}

	/**
	 * Add a command to the queue to be sent to the server
	 * @param {string} cmd - The command string to send to the server
	 * @returns Promise
	 */
	addCommandToQueue(cmd) {
		if (
			this.waitingToBeSent.length + this.waitingForReply.length >=
			this.maxLength
		) {
			return Promise.reject(new Error("Queue is full"));
		}

		return new Promise((resolve, reject) => {
			// ! Read rest of the nodejs commands queue

            
		});
	}
}
