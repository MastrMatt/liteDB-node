// 1) Run the db client as an instance of the Event Emitter Class to be able to handle events when the network status changes
// 2) Look into asyc/await and promises when sending commands to the db server, want to be able to send and then await the response
// 3) Add pipeline support to the db client
// 4) Take another look at how node-redis works, will be similar to that
// todo : 5) don't forgot to generate the .d.ts to support library users who use typescript

// todo: Setup workflows for CI/CD and npm

// Todo:  Work on testing and documentation, may need to refactor some code to make it more testable if time permits, unit test utils,commandqueue,decoder, integration test the rest

// Todo: Deploy to npm

import {
	DEFAULT_SERVERPORT,
	DEFAULT_SERVERIP,
	MAX_ARGS,
	SER_VALUES,
} from "./protocol.js";

import { EventEmitter } from "events";
import { CommandQueue } from "./commandQueue/commandQueue.js";
import { LiteDBSocket } from "./socket/liteDBSocket.js";
import { LiteDBDecoder } from "./decoder/decoder.js";
import { concatCommandOptions, arrayToObject } from "./utils/utils.js";

/**
 * @typedef {import('./types.js').ClientOptions} ClientOptions
 * @typedef {import('./types.js').LiteDBCommand} LiteDBCommand
 * @typedef {import('./types.js').ConnectOptions} ConnectOptions
 * @typedef {import('./types.js').ResponseData} ResponseData
 */

/**
 * Creates a new instance of the liteDB client
 * @param {ClientOptions} [clientOptions] - The options to use when creating the client
 * @returns {LiteDBClient}
 */
function createClient(clientOptions) {
	return new LiteDBClient(clientOptions);
}

class LiteDBClient extends EventEmitter {
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
	 * Disconnects the client from the server, fully flushing the command queue and closing the socket
	 *
	 */

	async disconnect() {
		// wait for the command queue to fully flush
		await this.commandQueue.waitToBeFullyFlushed();

		// close the socket
		this.liteDBSocket.disconnect();
	}

	/**
	 *  Removes as many commands are possible from the waiting to be sent queue and sends it to the server
	 *
	 * @returns {void}
	 *
	 */
	tick() {
		// if the socket write buffer is full and waiting for a drain event, return, dont want to potentially overflow the in-memory buffer queue since the kernel buffer is full
		if (this.liteDBSocket.writableNeedDrain || !this.liteDBSocket.isReady) {
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

	/**
	 *
	 *  Parses the response data object that was created by the decoder into usable data structures for javascript
	 *
	 * @param {ResponseData} responseData
	 */
	parseResponseData(responseData) {
		if (responseData.type === SER_VALUES.SER_NIL) {
			return null;
		} else if (responseData.type === SER_VALUES.SER_ERR) {
			// parse the response data
			const errorString = responseData?.data?.toString();
			throw new Error(errorString);
		} else if (responseData.type == SER_VALUES.SER_STR) {
			return responseData.data;
		} else if (responseData.type == SER_VALUES.SER_INT) {
			const intString = responseData?.data?.toString();
			if (!intString) {
				throw new Error("Invalid int string");
			}
			return parseInt(intString);
		} else if (responseData.type == SER_VALUES.SER_FLOAT) {
			const floatString = responseData?.data?.toString();
			if (!floatString) {
				throw new Error("Invalid float string");
			}
			return parseFloat(floatString);
		} else if (responseData.type == SER_VALUES.SER_ARR) {
			if (!responseData.data || !Array.isArray(responseData.data)) {
				throw new Error("Invalid array data");
			}

			let elements = [];
			for (let i = 0; i < responseData.data.length; i++) {
				// Assuming responseData.data is now known to be an array
				const data = responseData.data[i];

				if (data.type === SER_VALUES.SER_STR) {
					elements.push(data.data);
				} else if (data.type === SER_VALUES.SER_INT) {
					// convert the data to an integer
					const intString = data.data?.toString();
					if (!intString) {
						throw new Error("Invalid int string");
					}
					elements.push(parseInt(intString));
				} else if (data.type === SER_VALUES.SER_FLOAT) {
					// convert the data to a float
					const floatString = data.data?.toString();
					if (!floatString) {
						throw new Error("Invalid float string");
					}
					elements.push(parseFloat(floatString));
				}
			}

			return elements;
		}
	}

	/**
	 * Deletes the value specified by key. Returns the amount of keys deleted
	 *
	 * @param {string} key - The key of the item to delete.
	 * @param {Object} [commandOptions] - Additional options for the command.
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async del(key, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}

		if (1 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `del ${key}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 * Returns all the key:value pairs in the database
	 *
	 * @param {Object} [commandOptions] - Additional options for the command.
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async keys(commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}

		if (0 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = "keys";
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 * Removes all the key:value pairs in the database. Returns null
	 *
	 * @param {Object} [commandOptions] - Additional options for the command.
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async flushall(commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}

		if (0 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = "flushall";
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 *	 Get the value of a key, it the key does not exist emit an error. Returns the value
	 *
	 * @param {string} key
	 * @param {Object} [commandOptions]
	 * @returns {Promise<any>} The command object
	 */
	async get(key, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (1 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `get ${key}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 *  Sets a new key:value pair in the db, it the key already exists emit an error. Returns null
	 *
	 * @param {string} key - The key of the item to set.
	 * @param {*} value - The value to set for the given key.
	 * @param {Object} [commandOptions] - Additional options for the command.
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async set(key, value, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (2 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `set ${key} ${value}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 *	 Sets a field:value pair in the hash specified by key. If the key does not exist, it will create it. It the field already exists, it overrides the previous value. Returns null
	 *
	 * @param {string} key
	 * @param {string} field
	 * @param {string} value
	 * @param {Object} [commandOptions]
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async hSet(key, field, value, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (3 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `hset ${key} ${field} ${value}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 * Sets a series of field:value pairs specified by the values object in the hash specified by key. If the key does not exist, it will create it. It any of the fields already exists, it overrides the previous value. Returns null
	 *
	 *
	 * @param {string} key
	 * @param {Object} values
	 * @param {Object} [commandOptions]
	 */
	async hSetObject(key, values, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (1 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		// Don't sequentially await, await all promises at once to take advantage of parallelism, especially useful for IO bound tasks like network requests
		await Promise.all(
			Object.entries(values).map(([field, value]) => {
				return this.hSet(key, field, value, commandOptions);
			})
		);

		return null;
	}

	/**
	 * Gets the value of field from the hash specified by key. Returns the value
	 *
	 * @param {string} key
	 * @param {string} field
	 * @param {Object} [commandOptions]
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async hGet(key, field, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (2 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `hget ${key} ${field}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 *  Deletes a field from the hash specified by key. Returns an integer for how many elements were removed
	 *
	 * @param {string} key
	 * @param {string} field
	 * @param {Object} [commandOptions]
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async hDel(key, field, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (1 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `hdel ${key} ${field}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 * Returns all fields and values of the hash specified by key.
	 *
	 * @param {string} key
	 * @param {Object} [commandOptions]
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async hGetAll(key, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (1 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `hgetall ${key}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			const reponseArray = this.parseResponseData(responseData);
			if (!Array.isArray(reponseArray)) {
				throw new Error(
					"Invalid response data, should be getting an array for hGetAll"
				);
			}

			return arrayToObject(reponseArray);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 *	Adds value to the list specified by key. If key does not exist, a new list is created. Returns an integer for how many elements were added
	 *
	 * @param {string} key
	 * @param {string} value
	 * @param {Object} [commandOptions]
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async lPush(key, value, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (2 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `lpush ${key} ${value}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 *	Adds value to the list specified by key. If key does not exist, a new list is created. Returns an integer for how many elements were added
	 *
	 * @param {string} key
	 * @param {string} value
	 * @param {Object} [commandOptions]
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async rPush(key, value, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (2 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `rpush ${key} ${value}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 *	 Removes and returns the corresponding element of the list specified by key. Returns an integer for how many elements were removed
	 *
	 * @param {string} key
	 * @param {Object} [commandOptions]
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async lPop(key, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (1 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `lpop ${key}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 *	 Removes and returns the corresponding element of the list specified by key. Returns an integer for how many elements were removed
	 *
	 * @param {string} key
	 * @param {Object} [commandOptions]
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async rPop(key, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (1 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `rpop ${key}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 * Returns the length of the list specified by key
	 *
	 * @param {string} key - The key of the list to get the length of.
	 * @param {Object} [commandOptions] - Additional options for the command.
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async lLen(key, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (1 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `llen ${key}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 * Returns values from index start up to and including index stop from the list. The list is specified by key.
	 *
	 * @param {string} key - The key of the list to get the range of.
	 * @param {number} start - The start index of the range.
	 * @param {number} stop - The stop index of the range.
	 * @param {Object} [commandOptions] - Additional options for the command.
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async lRange(key, start, stop, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (3 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `lrange ${key} ${start} ${stop}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 *  Trims a list from index start up to and including index stop. The list is specified by key. Returns null
	 *
	 * @param {string} key - The key of the list to get the index of.
	 * @param {number} start - The start index of the list.
	 * @param {number} stop - The stop index of the list.
	 * @param {Object} [commandOptions] - Additional options for the command.
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async lTrim(key, start, stop, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (3 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `ltrim ${key} ${start} ${stop}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 *  Sets the index of the list to contain value. The list is specified by the key. Returns null
	 *
	 * @param {string} key - The key of the list to set the index of.
	 * @param {number} index - The index of the list to set.
	 * @param {string} value - The value to set the index to.
	 * @param {Object} [commandOptions] - Additional options for the command.
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async lSet(key, index, value, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (3 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `lset ${key} ${index} ${value}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 * Adds (score, name) to the set specified by key. If the key does not exist, it is created. If (score, name) already exists , it is updated. Returns the number of elements inserted or updated.
	 *
	 * @param {string} key - The key of the sorted set to add the value to.
	 * @param {number} score - The score of the value to add to the sorted set.
	 * @param {string} name - The name of the value to add to the sorted set.
	 * @param {Object} [commandOptions] - Additional options for the command.
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async zAdd(key, score, name, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (3 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `zadd ${key} ${score} ${name}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 * Removes the element from the sorted set with the specified name. The sorted set is specified by key. Returns the number of elements removed.

	 *
	 * @param {string} key - The key of the sorted set to remove the value from.
	 * @param {string} name - The name of the value to remove from the sorted set.
	 * @param {Object} [commandOptions] - Additional options for the command.
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async zRem(key, name, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (2 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `zrem ${key} ${name}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 * Returns the score of the element with the specified name from the sorted set specified by key.
	 *
	 * @param {string} key - The key of the sorted set to get the score of the value from.
	 * @param {string} name - The name of the value to get the score of from the sorted set.
	 * @param {Object} [commandOptions] - Additional options for the command.
	 * @returns {Promise<any>} The constructed command object.
	 * @throws Will throw an error if too many arguments are passed.
	 */
	async zScore(key, name, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (2 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `zscore ${key} ${name}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			return this.parseResponseData(responseData);
		} catch (err) {
			this.emit("error", err);
		}
	}

	/**
	 * General query command meant to combine various typical Redis sorted cmds into one. ZrangeByScore: ZQUERY with (key score "" offset limit), Zrange by rank: ZQUERY with (key -inf "" offset limit). Returns all the elements that match the query.
	 *
	 * @param {string} key - The key of the sorted set to query.
	 * @param {number} score - The score to query the sorted set with.
	 * @param {string} name - The name of the value to query the sorted set with.
	 * @param {number} offset - The offset to query the sorted set with.
	 * @param {number} limit - The limit to query the sorted set with.
	 * @param {Object} [commandOptions] - Additional options for the command.
	 * @returns {Promise<any>} The constructed command object.
	 */
	async zQuery(key, score, name, offset, limit, commandOptions) {
		if (commandOptions === undefined) {
			commandOptions = {};
		}
		if (5 + Object.keys(commandOptions).length > MAX_ARGS) {
			throw new Error("Too many arguments");
		}

		let cmdStr = `zquery ${key} ${score} ${name} ${offset} ${limit}`;
		cmdStr = concatCommandOptions(cmdStr, commandOptions);

		/** @type {LiteDBCommand} */
		const command = {
			cmdStr,
			cmdLen: cmdStr.length,
		};

		const responseData = await this.sendCmd(command);

		try {
			const responseArray = this.parseResponseData(responseData);
			if (!Array.isArray(responseArray)) {
				throw new Error(
					"Invalid response data, should be getting an array for zQuery"
				);
			}

			return arrayToObject(responseArray);
		} catch (err) {
			this.emit("error", err);
		}
	}
}

// test the client
const client = await createClient()
	.on("error", (err) => {
		// print the error
		console.error(err);
	})
	.connect();

await client.lPush("list", "one");
await client.rPush("list", "two");
console.log(await client.lRange("list", 0, 0));
console.log(await client.lRange("list", 1, 1));

// console.log(await client.hSetObject("test", { a: 1, b: 2, c: 3 }));
// await client.zAdd("zset", 1, "one");
// await client.zAdd("zset", 2, "two");
// console.log(await client.zQuery("zset", 1, "one", 0, 100));
// console.log(await client.hGetAll("test"));
// await client.disconnect();
// await client.connect();

export { createClient, LiteDBClient };
