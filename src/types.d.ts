// types.d.ts
export interface ClientOptions {
	host: string;
	port: number;
}

export interface RecvData {
	type: number;
	value?: number | string | any[];
}

interface CommandWaitingForReply {
	resolve(reply?: unknown): void;
	reject(err: unknown): void;
}

export interface CommandWaitingToBeSent extends CommandWaitingForReply {}
