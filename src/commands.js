// the commands for the liteDB client, parse the commands into a cmd string, maybe use a util function here
import { MAX_ARGS } from "./protocol.js";

/**  @typedef {import('./types.d.ts').LiteDBCommand} LiteDBCommand */

/**
 *
 * @param {string} cmdStr
 * @param {Object} commandOptions
 * @returns {string} The new command string with the options appended
 */
function concatCommandOptions(cmdStr, commandOptions) {
	Object.entries(commandOptions).forEach(([key, value]) => {
		cmdStr += ` ${key}=${value}`;
	});

	return cmdStr;
}

/**
 * Constructs a LiteDB 'delete' command.
 *
 * @param {string} key - The key of the item to delete.
 * @param {Object} commandOptions - Additional options for the command.
 * @returns {LiteDBCommand} The constructed command object.
 * @throws Will throw an error if too many arguments are passed.
 */
function del(key, commandOptions) {
	if (1 + Object.keys(commandOptions).length > MAX_ARGS) {
		throw new Error("Too many arguments");
	}

	let cmdStr = `del ${key}`;
	cmdStr = concatCommandOptions(cmdStr, commandOptions);

	return {
		cmdStr,
		cmdLen: cmdStr.length,
	};
}

/**
 * Constructs a LiteDB 'keys' command.
 *
 * @param {Object} commandOptions - Additional options for the command.
 * @returns {LiteDBCommand} The constructed command object.
 * @throws Will throw an error if too many arguments are passed.
 */
function keys(commandOptions) {
	if (0 + Object.keys(commandOptions).length > MAX_ARGS) {
		throw new Error("Too many arguments");
	}

	let cmdStr = "keys";
	cmdStr = concatCommandOptions(cmdStr, commandOptions);

	return {
		cmdStr,
		cmdLen: cmdStr.length,
	};
}

/**
 * Constructs a LiteDB 'flushall' command.
 *
 * @param {Object} commandOptions - Additional options for the command.
 * @returns {LiteDBCommand} The constructed command object.
 * @throws Will throw an error if too many arguments are passed.
 */
function flushall(commandOptions) {
	if (0 + Object.keys(commandOptions).length > MAX_ARGS) {
		throw new Error("Too many arguments");
	}

	let cmdStr = "flushall";
	cmdStr = concatCommandOptions(cmdStr, commandOptions);

	return {
		cmdStr,
		cmdLen: cmdStr.length,
	};
}

/**
 *
 * @param {string} key
 * @param {Object} commandOptions
 * @returns {LiteDBCommand} The command object
 */
function get(key, commandOptions) {
	if (1 + Object.keys(commandOptions).length > MAX_ARGS) {
		throw new Error("Too many arguments");
	}

	let cmdStr = `get ${key}`;
	cmdStr = concatCommandOptions(cmdStr, commandOptions);

	return {
		cmdStr,
		cmdLen: cmdStr.length,
	};
}

/**
 * Constructs a LiteDB 'set' command.
 *
 * @param {string} key - The key of the item to set.
 * @param {*} value - The value to set for the given key.
 * @param {Object} commandOptions - Additional options for the command.
 * @returns {LiteDBCommand} The constructed command object.
 * @throws Will throw an error if too many arguments are passed.
 */
function set(key, value, commandOptions) {
	if (2 + Object.keys(commandOptions).length > MAX_ARGS) {
		throw new Error("Too many arguments");
	}

	let cmdStr = `set ${key} ${value}`;
	cmdStr = concatCommandOptions(cmdStr, commandOptions);

	return {
		cmdStr,
		cmdLen: cmdStr.length,
	};
}


