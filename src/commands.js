// the commands for the liteDB client, parse the commands into a cmd string, maybe use a util function here

import { SER_VALUES } from "./protocol.js";

/** @typedef {import('./types.d.ts').ResponseData} ResponseData
 * @typedef {import('./types.d.ts').Response} Response
 */

/**
 * Parses a single element from the data buffer
 *
 * @param {number} serialType The type of the element
 * @param {Buffer} dataBuffer The buffer to parse the element from
 * @param {number} offset The offset to start parsing the element from
 *
 * @returns {ResponseData | undefined} The response data parsed from the data buffer
 */

function parseElement(serialType, dataBuffer, offset) {
	// Check if there's enough data left in the buffer
	const remainingBytes = dataBuffer.length - offset;
	if (remainingBytes < 5) {
		return;
	}

	const type = dataBuffer.readInt8(offset);
	const responseLength = dataBuffer.readInt32LE(offset + 1);

	switch (serialType) {
		case SER_VALUES.SER_NIL:
			return {
				type: SER_VALUES.SER_NIL,
				length: responseLength,
			};
			break;

		case SER_VALUES.SER_ERR:
			if (remainingBytes < 5 + responseLength) {
				return;
			}

			const errorString = dataBuffer.toString(
				"utf-8",
				5 + offset,
				5 + responseLength + offset
			);

			// return the error string
			return {
				type: SER_VALUES.SER_ERR,
				length: responseLength,
				data: errorString,
			};

			break;

		case SER_VALUES.SER_STR:
			if (remainingBytes < 5 + responseLength) {
				return;
			}

			const str = dataBuffer.toString(
				"utf-8",
				5 + offset,
				5 + responseLength + offset
			);

			// return the string
			return {
				type: SER_VALUES.SER_STR,
				length: responseLength,
				data: str,
			};

			break;

		case SER_VALUES.SER_INT:
			if (remainingBytes < 5 + responseLength) {
				return;
			}

			const int = dataBuffer.readInt32LE(5 + offset);

			// return the integer
			return {
				type: SER_VALUES.SER_INT,
				length: responseLength,
				data: int,
			};

			break;

		case SER_VALUES.SER_FLOAT:
			if (remainingBytes < 5 + responseLength) {
				return;
			}

			const float = dataBuffer.readFloatLE(5 + offset);

			// return the float
			return {
				type: SER_VALUES.SER_FLOAT,
				length: responseLength,
				data: float,
			};

			break;

		case SER_VALUES.SER_ARR:
			// error, responses cannot have nested arrays
			throw new Error(
				"Server does not support nested arrays but received one, error on client side"
			);
			break;

		default:
			// error, unknown type
			throw new Error("Unknown type received from server");
			break;
	}
}

/**
 * Parses a single command from the data buffer
 *
 * @param {Buffer} dataBuffer The buffer to parse the command from
 * @returns {Response} An object containing the parsed response data and the modified buffer
 */
function processCommand(dataBuffer) {
	/**@type {ResponseData | undefined} */
	let responseData;

	// Check if there's enough data left in the buffer
	if (dataBuffer.length < 5) {
		// not enough data to parse
		return { data: undefined, newDataBuffer: dataBuffer };
	}

	const type = dataBuffer.readInt8(0);
	const responseLength = dataBuffer.readInt32LE(1);

	if (type !== SER_VALUES.SER_ARR) {
		responseData = parseElement(type, dataBuffer, 0);
		if (!responseData) {
			// not enough data to parse
			return { data: undefined, newDataBuffer: dataBuffer };
		}

		// remove the parsed element from the buffer
		dataBuffer = dataBuffer.subarray(5 + responseData.length);

		return { data: responseData, newDataBuffer: dataBuffer };
	}

	// create an array to store the elements
	let elements = [];

	// loop through the buffer and parse each element
	let offset = 5;
	for (let i = 0; i < responseLength; i++) {
		const element = parseElement(type, dataBuffer, offset);
		if (!element) {
			// not enough data to parse
			return { data: undefined, newDataBuffer: dataBuffer };
		}

		elements.push(element);

		// increment the offset
		offset += 5 + element.length;
	}

	// remove the parsed elements from the buffer

	// remove type and length
	dataBuffer = dataBuffer.subarray(5);

	// remove the parsed elements
	for (let i = 0; i < elements.length; i++) {
		dataBuffer = dataBuffer.subarray(5 + elements[i].length);
	}

	// return the response data
	responseData = {
		type: SER_VALUES.SER_ARR,
		length: responseLength,
		data: elements,
	};

	return { data: responseData, newDataBuffer: dataBuffer };
}

export { processCommand };
