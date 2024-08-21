import { SER_VALUES } from "./protocol.js";

/** @typedef {import('./types.d.ts').ResponseData} ResponseData */

class LiteDBDecoder {
	constructor() {
		// buffer to store incoming data
		this.dataBuffer = Buffer.alloc(0);
	}

	/**
	 * Adds data to the internal buffer
	 * @param {Buffer} data
	 *
	 */
	addData(data) {
		this.dataBuffer = Buffer.concat([this.dataBuffer, data]);
	}

	/**
	 * Parses a single element from the data buffer
	 *
	 * @param {number} offset The offset to start parsing the element from
	 *
	 * @returns {ResponseData | undefined} The response data parsed from the data buffer
	 */

	parseElement(offset) {
		// Check if there's enough data left in the buffer
		const remainingBytes = this.dataBuffer.length - offset;
		if (remainingBytes < 5) {
			return;
		}

		const type = this.dataBuffer.readInt8(offset);
		const responseLength = this.dataBuffer.readInt32LE(offset + 1);

		switch (type) {
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

				const errorString = this.dataBuffer.toString(
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

				const str = this.dataBuffer.toString(
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

				const int = this.dataBuffer.readInt32LE(5 + offset);

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

				const float = this.dataBuffer.readFloatLE(5 + offset);

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
	 * @returns {ResponseData | undefined} An object containing the parsed response data and the modified buffer
	 */
	processCommand() {
		/**@type {ResponseData | undefined} */
		let responseData;

		// Check if there's data to get the type
		if (this.dataBuffer.length < 1) {
			// not enough data to parse type
			return;
		}
		const type = this.dataBuffer.readInt8(0);

		if (type !== SER_VALUES.SER_ARR) {
			responseData = this.parseElement(0);
			if (!responseData) {
				// not enough data to parse
				return;
			}

			// remove the parsed element from the buffer
			this.dataBuffer = this.dataBuffer.subarray(5 + responseData.length);

			return responseData;
		}

		// Parse arrays now
		let elements = [];
		if (this.dataBuffer.length < 5) {
			// not enough data to parse
			return;
		}
		const responseLength = this.dataBuffer.readInt32LE(1);

		let offset = 5;
		for (let i = 0; i < responseLength; i++) {
			const element = this.parseElement(offset);
			if (!element) {
				// not enough data to parse
				return;
			}

			elements.push(element);

			offset += 5 + element.length;
		}

		// remove type and length
		this.dataBuffer = this.dataBuffer.subarray(5);

		// remove the parsed elements
		for (let i = 0; i < elements.length; i++) {
			this.dataBuffer = this.dataBuffer.subarray(5 + elements[i].length);
		}

		responseData = {
			type: SER_VALUES.SER_ARR,
			length: responseLength,
			data: elements,
		};

		return responseData;
	}
}

export { LiteDBDecoder };
