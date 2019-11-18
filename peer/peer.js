const client = require('socket.io-client');
const server = require("socket.io")();
const fs = require('fs');

const [fileOwnerPort, myPort, downloadPeerPort] = process.argv.slice(2)

const fileOwnerSocket = client.connect(`http://localhost:${fileOwnerPort}`)
fileOwnerSocket.on('error', function(error){
    console.error(error)
    process.exit()
});
fileOwnerSocket.on('connect_error', function(error){
    console.error(`Unable to connect to fileOwner on port ${fileOwnerPort}`)
})
fileOwnerSocket.on('connect', async function(){
    console.log(`Connected to fileOwner running on port ${fileOwnerPort}`)
})
fileOwnerSocket.on('upload', async (chunkNames, chunkBuffers, cb) => {
    console.log(`Receving files ${chunkNames.toString()} from fileOwner`)
    let promiseArray = chunkNames.map((chunkName, index) => {
        return new Promise((resolve, reject) => {
            fs.writeFile(chunkName, chunkBuffers[index], (err) => {
                //hanlde err
                resolve()
            })
        })
    })
    await Promise.all(promiseArray)
    cb()
})


const downloadPeerSocket = client.connect(`http://localhost:${downloadPeerPort}`)
downloadPeerSocket.on('error', function(error){
    console.error(error)
    process.exit()
});
downloadPeerSocket.on('connect_error', function(error){
    console.error(`Unable to connect to downloadPeer on port ${downloadPeerPort}`)
})
downloadPeerSocket.on('connect', async function(){
    console.log(`Connected to downloadPeer running on port ${downloadPeerPort}`)
})

//Start server
server.listen(myPort);
console.log(`Listening on port ${myPort}`)  