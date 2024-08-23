import { concatCommandOptions, arrayToObject } from "./utils.js";


describe("Utils", () => {
	test("should concatenate command options", () => {
		const cmdStr = "command";
		const commandOptions = { option1: "value1", option2: "value2" };
		const result = concatCommandOptions(cmdStr, commandOptions);
		expect(result).toBe("command option1=value1 option2=value2");
	});
});
