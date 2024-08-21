// types.d.ts

export interface ClientOptions {}

export interface ConnectOptions {
	host: string;
	port: number;
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

export interface ResponseData {
	type: number;
	length: number;
	data?: number | string | any[];
}
