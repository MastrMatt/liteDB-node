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

/**
 *  Converts an array to an object. Assumes the array is in the format [key1, value1, key2, value2, ...]
 *
 * @param {Array<string>} arr
 */
export function arrayToObject(arr) {
	/** @type any */
	let obj = {};

	for (let i = 0; i < arr.length; i += 2) {
		const key = arr[i];
		const value = arr[i + 1];

		obj[key] = value;
	}

	return obj;
}
