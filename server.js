const zmq = require('zeromq')

const originalLog = console.log
console.log = (...args) => originalLog(`[${new Date().toISOString()}]`, ...args)

const originalError = console.error
console.error = (...args) => originalError(`[${new Date().toISOString()}]`, ...args)

// Helper to simulate audio playback time
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// 1. Persisted Registration State (Clears on restart/shutdown)
// Changed to an empty array to handle multiple registrations. 
// Starting empty ensures a restart results in an "unregistered" state.
let registeredAccounts = [] 

// 2. Extracted background task to prevent blocking the ZMQ loop
async function simulateAudioPlayback(command, publisher) {
  try {
    console.log(`[STATE] Starting call simulation for: ${command}`)
    
    // Tell the client we are starting the call.
    await publisher.send('sending call command')
    await sleep(50) // Tiny delay to simulate network/processing
    await publisher.send('Confirmation: starting call')

    // Simulate the audio playing for 5 seconds.
    console.log('[STATE] Audio is playing. Line is busy for 5 seconds...')
    await sleep(5000)

    // Tell the client the call is done.
    console.log('[STATE] Audio finished. Line is now free.')
    await publisher.send('Finishing way: audio was fully streamed')
  } catch (err) {
    console.error('[ERROR] Audio simulation failed:', err)
  }
}

async function runServer() {
  const sipPlayerResponder = new zmq.Reply()
  const sipPlayerPublisher = new zmq.Publisher()

  await sipPlayerResponder.bind('tcp://127.0.0.1:5555')
  await sipPlayerPublisher.bind('tcp://127.0.0.1:5556')

  console.log('Mock sip_player listening locally on:')
  console.log(' - Commands (REP): tcp://127.0.0.1:5555')
  console.log(' - Info (PUB): tcp://127.0.0.1:5556')
  originalLog() // Add a blank line after startup text

  // Main Event Loop
  for await (const [msg] of sipPlayerResponder) {
    const command = msg.toString()
    let responseMsg = ''

    // Determine the response based on the command
    if (command === 'status') {
      if (registeredAccounts.length > 0) {
        // Join the array so you can see all registered accounts
        responseMsg = `status: registered (${registeredAccounts.join(', ')})`
      } else {
        responseMsg = `status: unregistered`
      }
    } 
    else if (command.startsWith('register:')) {
      const account = command.split(':')[1] || 'unknown'
      
      // Add to array only if it isn't already registered
      if (!registeredAccounts.includes(account)) {
        registeredAccounts.push(account)
      }
      
      responseMsg = `ACK: registered as ${account}`
    }
    else if (command.startsWith('unregister')) {
      // Handle both specific unregisters ("unregister:account1") or wiping everything ("unregister")
      if (command.includes(':')) {
        const accountToRemove = command.split(':')[1]
        registeredAccounts = registeredAccounts.filter(acc => acc !== accountToRemove)
        responseMsg = `ACK: unregistered ${accountToRemove}`
      } else {
        registeredAccounts = [] // Wipe all
        responseMsg = 'ACK: all accounts unregistered'
      }
    }
    else {
      // Default fallback for calls or unknown commands
      responseMsg = `ACK: ${command}`
    }

    // Log what came in, what goes out, and a blank line
    console.log(`[IN]  ${command}`)
    console.log(`[OUT] ${responseMsg}`)
    originalLog()

    // Send the constructed reply to satisfy ZMQ REP requirements
    await sipPlayerResponder.send(responseMsg)

    // 3. Fire the audio simulation in the background without awaiting it!
    if (command.startsWith('call:')) {
      simulateAudioPlayback(command, sipPlayerPublisher)
    }
  }
}

runServer().catch(err => {
  console.error('Server died:', err)
  process.exit(1)
})