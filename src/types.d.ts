// types.d.ts

export interface ConnectOptions {
	host: string;
	port: number;
}

export interface ClientOptions {}

export interface RecvData {
	type: number;
	value?: number | string | any[];
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
