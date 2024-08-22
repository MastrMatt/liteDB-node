// the commands for the liteDB client, parse the commands into a cmd string, maybe use a util function here
import { MAX_ARGS } from "./protocol.js";

/**  @typedef {import('./types.d.ts').LiteDBCommand} LiteDBCommand */

/**
 *
 * @param {string} cmdStr
 * @param {Object} commandOptions
 * @returns {string} The new command string with the options appended
 */
export function concatCommandOptions(cmdStr, commandOptions) {
	Object.entries(commandOptions).forEach(([key, value]) => {
		cmdStr += ` ${key}=${value}`;
	});

	return cmdStr;
}
