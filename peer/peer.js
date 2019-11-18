const io = require('socket.io-client');

const [fileOwnerPort, myPort, downloadPort] = process.argv.slice(2)
const socket = io.connect(`http://localhost:${fileOwnerPort}`)
