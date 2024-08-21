// types.d.ts

export interface ConnectOptions {
	host: string;
	port: number;
}

export interface ClientOptions {}

export interface Response {
	data?: ResponseData;
	newDataBuffer: Buffer;
}

export interface ResponseData {
	type: number;
	length: number;
	data?: number | string | any[];
}

export interface LiteDBCommand {
	cmdStr: string;
	cmdLen: number;
}

export interface CommandWaitingForReply {
	resolve(reply?: unknown): void;
	reject(err: unknown): void;
}

export interface CommandWaitingToBeSent extends CommandWaitingForReply {
	cmd: LiteDBCommand;
}
