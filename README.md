# zmq-mock-server

A local mock of the `sip_player` service for development and testing. It listens for ZeroMQ commands, replies immediately, and simulates call playback in the background.

## Build and start

Requires [Node.js](https://nodejs.org/).

```bash
npm install
node server.js
```

On startup it binds two local sockets:

- **Commands (REQ/REP):** `tcp://127.0.0.1:5555`
- **Info (PUB):** `tcp://127.0.0.1:5556`

Registration state is kept in memory only and resets when the process stops.

## Commands and logging

Send plain-text commands to the REP socket on port **5555**. Each command gets an immediate reply on the same socket. Call commands also publish progress messages on the PUB socket on port **5556**.

| Command | Reply | Extra behavior |
|---|---|---|
| `status` | `status: registered (...)` or `status: unregistered` | — |
| `register:<account>` | `ACK: registered as <account>` | Account is stored in memory |
| `unregister:<account>` | `ACK: unregistered <account>` | Removes one account |
| `unregister` | `ACK: all accounts unregistered` | Clears all accounts |
| `call:...` | `ACK: call:...` | Simulates audio playback (see below) |
| anything else | `ACK: <command>` | — |

### Call simulation

Commands starting with `call:` trigger a background simulation. Duration defaults to **5 seconds**, or is parsed from the filename (e.g. `10s.wav` → 10 seconds).

While a call runs, the PUB socket sends:

1. `sending call command`
2. `Confirmation: starting call`
3. *(wait for duration)*
4. `Finishing way: audio was fully streamed`

### Console output

Every log line is prefixed with an ISO timestamp.

On startup and when OBIS registers:

```
[2026-07-16T09:07:00.123Z] Mock sip_player listening locally on:
[2026-07-16T09:07:00.124Z]  - Commands (REP): tcp://127.0.0.1:5555
[2026-07-16T09:07:00.124Z]  - Info (PUB): tcp://127.0.0.1:5556

[2026-07-16T09:07:05.456Z] [IN]  unregister
[2026-07-16T09:07:05.457Z] [OUT] ACK: all accounts unregistered

[2026-07-16T09:07:05.458Z] [IN]  codec:PCMU/8000/1
[2026-07-16T09:07:05.458Z] [OUT] ACK: codec:PCMU/8000/1

[2026-07-16T09:07:05.459Z] [IN]  init_silence:200
[2026-07-16T09:07:05.459Z] [OUT] ACK: init_silence:200

[2026-07-16T09:07:05.460Z] [IN]  register:127.0.0.1:1001:1001:5060
[2026-07-16T09:07:05.460Z] [OUT] ACK: registered as 127.0.0.1

[2026-07-16T09:07:05.461Z] [IN]  status
[2026-07-16T09:07:05.461Z] [OUT] status: registered (127.0.0.1)
```

During call simulation (status polls may continue while audio plays):

```
[2026-07-16T09:07:10.789Z] [IN]  call:allzones:/tmp/mock1_5s.wav:0.5
[2026-07-16T09:07:10.789Z] [OUT] ACK: call:allzones:/tmp/mock1_5s.wav:0.5

[2026-07-16T09:07:10.791Z] [STATE] Starting call simulation for: call:allzones:/tmp/mock1_5s.wav:0.5
[2026-07-16T09:07:10.842Z] [STATE] Audio is playing. Line is busy for 5 seconds...
[2026-07-16T09:07:11.842Z] [IN]  status
[2026-07-16T09:07:11.843Z] [OUT] status: registered (127.0.0.1)

[2026-07-16T09:07:12.843Z] [IN]  status
[2026-07-16T09:07:12.843Z] [OUT] status: registered (127.0.0.1)

[2026-07-16T09:07:13.843Z] [IN]  status
[2026-07-16T09:07:13.843Z] [OUT] status: registered (127.0.0.1)

[2026-07-16T09:07:14.843Z] [IN]  status
[2026-07-16T09:07:14.843Z] [OUT] status: registered (127.0.0.1)

[2026-07-16T09:07:15.843Z] [IN]  status
[2026-07-16T09:07:15.843Z] [OUT] status: registered (127.0.0.1)

[2026-07-16T09:07:15.844Z] [STATE] Audio finished. Line is now free.
```

Errors are logged as `[ERROR] ...`, for example:

```
[2026-07-16T09:07:30.000Z] [ERROR] Audio simulation failed: ...
```
