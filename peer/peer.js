const io = require('socket.io-client');

const [fileOwnerPort, myPort, downloadPort] = process.argv.slice(2)
