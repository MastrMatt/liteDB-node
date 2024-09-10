# liteDB-node

liteDB-node is a Node.js client for the [liteDB](https://github.com/MastrMatt/liteDB) database.

## Overview

The Node.js client for liteDB facilitates communication between your applications and the LiteDB server. It handles the serialization and deserialization of commands and responses according to the LiteDB protocol.

## Getting Started

1. Spin up a liteDB server

If docker is installed locally, run:

```bash

docker run -p your_desired_port_number:9255 -it mastrmatt/litedb:latest

```

Else, view [liteDB](https://github.com/MastrMatt/liteDB) for spinning up a new server

2. Install liteDB-node in your Node.js application

```
npm install litedb-node

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

To check if the client has sucessfully connected to the liteDB database and is ready to be used, acess the property `client.isReady`, or simply await the promise as shown above.

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
await client.hSetObject("hash", {
	field1: "value1",
	field2: "value2",
}); //null

await client.hGetAll("hash"); // { field1: 'value1', field2: 'value2' }
await client.keys(); // ['setKey', 'hash']
```

### Disconnect

Disconneting from the server is simple:

```js
await client.disconnect();
```

-The disconnect function waits for all commands that have been initiated to be fully processed and thier responses returned from the server. Then the connection to the server is closed. If the disconnection was sucessful a close event is emitted

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

## Errors

-   All command/(s) that modify the state of the db emit an error response with the corresponding error message if they were unsucessful in doing so.

-   All query commands either return the equivalent empty response ( 0 , []) or the null response if they was an error in retrieving the data.

-   Error evenrs are also emitted for all commands if the format of the command is incorrect or some internal error occurs on the db server.

-   Make sure an event listener for the "error" event is attacted to the liteDBClient, this permits the ability to catch the error events. If this is not done, the emitted erors will not be handled and will throw new Errors. This is the specified behavior of Nodejs Event Emitters [Error Events](https://nodejs.org/api/events.html#error-events)

```js
import { createClient } from "litedb-node";

const client = await createClient().on("error", (err) =>
	console.log("Redis Client Error", err)
); //ensure this error event listener is present
```

## Planned Features

-   Create some simulated ORM (liteDB is not relational but can simulate a relational db)

## Author

Matthew Neba / [@MastrMatt](https://github.com/MastrMatt)

## License

This project is licensed under the [MIT License](LICENSE).

## Main Sources

-   [Redis](https://redis.io/)
-   [node-redis](https://github.com/redis/node-redis)

## Contributing

Contributions to this project are welcome Please submit pull requests or open issues to discuss potential improvements or report bugs.

