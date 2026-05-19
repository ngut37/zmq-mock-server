const zmq = require('zeromq')

async function runServer() {
  const sipPlayerResponder = new zmq.Reply()
  const sipPlayerPublisher = new zmq.Publisher()

  await sipPlayerResponder.bind('tcp://127.0.0.1:5555')
  await sipPlayerPublisher.bind('tcp://127.0.0.1:5556')

  console.log('Mock sip_player listening locally on:')
  console.log(' - Commands (REP): tcp://127.0.0.1:5555')
  console.log(' - Info (PUB): tcp://127.0.0.1:5556')

  // Helper to simulate audio playback time
  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

  for await (const [msg] of sipPlayerResponder) {
    const command = msg.toString()
    console.log(`[LOG] Received command from client: ${command}`)

    // 1. Reply to REQ commands
    if (command === 'status') {
      // Must return 'status: registered' so the client knows it can start making calls
      await sipPlayerResponder.send('status: registered')
    } else {
      await sipPlayerResponder.send(`ACK: ${command}`)
    }

    // 2. Simulate the State Machine for 'call' commands
    if (command.startsWith('call:')) {
      console.log(`[STATE] Starting call simulation for: ${command}`)
      
      // Tell the client we are starting the call. This sets lineStatusStore.setLineBusy(true)
      await sipPlayerPublisher.send('sending call command')
      await sleep(50) // Tiny delay to simulate network/processing
      await sipPlayerPublisher.send('Confirmation: starting call')

      // Simulate the audio playing for 5 seconds.
      // During this time, the line is busy! The audioQueueManager will NOT send the next 'call:' command.
      console.log('[STATE] Audio is playing. Line is busy for 5 seconds...')
      await sleep(5000)

      // Tell the client the call is done. This sets lineStatusStore.setLineBusy(false)
      // and triggers the queue to drain the next item.
      console.log('[STATE] Audio finished. Line is now free.')
      await sipPlayerPublisher.send('Finishing way: audio was fully streamed')
    }
  }
}

runServer().catch(err => {
  console.error('Server died:', err)
  process.exit(1)
})
