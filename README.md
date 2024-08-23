# liteDB-node

liteDB-node is a Node.js client for the [liteDB](https://github.com/MastrMatt/liteDB) server.

## Overview

The Node.js client for LiteDB facilitates communication between your applications and the LiteDB server. It handles the serialization and deserialization of commands and responses according to the LiteDB protocol, providing a seamless integration experience.

## Getting Started

1. Install and run an instance of the [liteDB](https://github.com/MastrMatt/liteDB) server

2. Install liteDB-node in your Node.js application

```
npm install liteDB-node

```

## Usage

### Basic Example:

```js
import { createClient } from "litedb-node";

const client = await createClient()
	.on("error", (err) => console.log("Redis Client Error", err))
	.connect();

await client.set("key", "value");
const value = await client.get("key");
await client.disconnect();
```

The above code connects to localhost on port 9255 since no connect options were provided to connect() call, To specify the connection options pass an object:

```js
const client = await createClient()
  .on('error', err => console.log('Redis Client Error', err))
  .connect({
    host: host ip,
    port: port number
  });
```

To check if the client has sucessfully connected to the db and is ready to used, acess the property `client.isReady`

### Commands

litedb-node supports all litedb commands with some additions: [supported commands](#supported-commands), command options are passed in as an object after the command args:

```js
await client.set("key", "value", {
	//specifies the time to live for the key
	ttl: 10,
});
```

All replies from the server are turned into useful data structures:

```js
await client.set("setKey", "setValue"); // null
await client.hGetAll("hash"); // { field1: 'value1', field2: 'value2' }
await client.keys(); // ['setKey', 'hash']
```

### Disconnect

Disconneting from the server is simple:

```js
await client.disconnect();
```

-The disconnect function waits for all commands that have been initiated to be fully processed and thier responses returned from the server. Then socket socketion is closed. If the disconnection was sucessful a close event is emitted

## Supported Commands

liteDB-node supports all liteDB commands with some additions:

-hSetObject sets the key-value pairs of a javascript object to a liteDB hash. ex:

```js
hSetObject("key", {
	a: "1",
	b: "2",
	c: "2",
});
```

## Key features

-**Auto-Pipelining**: All commands made in the same cycle are automatically pipelined. For example,

```js
client.set("key", "value");
client.get("key");
```

-**Event-driven Architecture** : Built on top of Node.js's EventEmitter class, allowing for easy integration with other parts of your application.

-**Useful Data Structure**: liteDB-node automatically structures server responses into useful js data structures such as arrays, objects, etc.

## Events

The liteDB client is a Node.js EventEmitter, therefore it emits events:

| Name    | Trigger                                                                     | Listener Args  |
| ------- | --------------------------------------------------------------------------- | -------------- |
| connect | Emitted when the client has sucessfully connected to the liteDB server      | none           |
| close   | Emitted when the client has sucessfully disconnected from the liteDB server | none           |
| error   | Emitted when some recoverable error has occured, usually on the server      | (error: Error) |

## Planned Features

-   Create some simulated ORM (liteDB is not relational but can simulate a relational db)
-   Integrate Docker into the build and deploy step

## Author

Matthew Neba / [@MastrMatt](https://github.com/MastrMatt)

## License

This project is licensed under the [MIT License](LICENSE).

## Main Sources

-   [Redis](https://redis.io/)
-   [node-redis](https://github.com/redis/node-redis)

## Contributing

Contributions to this project are welcome Please submit pull requests or open issues to discuss potential improvements or report bugs.

```

```
