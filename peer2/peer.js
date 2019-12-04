const client = require('socket.io-client');
const server = require("socket.io")();
const fs = require('fs');

const [fileOwnerPort, myPort, downloadPeerPort] = process.argv.slice(2)
const chunkList = []

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
                chunkList.push(chunkName)
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
    while(chunkList.length < 40){
        let getChunkListPromise = new Promise((resolve, reject) => {
            downloadPeerSocket.emit('get_chunk_list', function(peerChunkList){
                resolve(peerChunkList.filter(chunk => chunkList.indexOf(chunk) == -1))
            })
        })
        let newChunkNames = await getChunkListPromise
        let getChunksPromise = new Promise((resolve, reject) => {
            downloadPeerSocket.emit('get_chunks', newChunkNames, async (buffers) => {
                //handle err
                resolve(buffers)
            })
        })
        let chunkBuffers = await getChunksPromise
        let promiseArray = newChunkNames.map((chunkName, index) => {
            return new Promise((resolve, reject) => {
                fs.writeFile(chunkName, chunkBuffers[index], (err) => {
                    //hanlde err
                    chunkList.push(chunkName)
                    resolve()
                })
            })
        })
        await Promise.all(promiseArray)
    }
    console.log(chunkList)
    console.log("Received all chunks. Reconstructing source file")
    let promiseArray = []
    for(let i = 0; i < 40; i++){
        let promise = new Promise((resolve, reject) => {
            fs.readFile(`${i}.blob`, (err, data) => {
                //handle err
                resolve(data)
            })
        })
        promiseArray.push(promise)
    }
    Promise.all(promiseArray).then((bufferArray) => {
        let data = Buffer.concat(bufferArray)
        fs.writeFile("test.pdf", data, (err) => {
            //handle err
        })
    })
})


//Start server
server.listen(myPort);
console.log(`Listening on port ${myPort}`)
server.on("connection", async (socket) => {
    console.log(`Upload neighbour connected [id=${socket.id}]`);
    socket.on('get_chunk_list', (cb) => {
        console.log("Sending chunk list to upload neighbour")
        cb(chunkList)
    })
    socket.on('get_chunks', async (chunkNames, cb) => {
        console.log(`Sending ${chunkNames} to upload neighbour`)
        let promiseArray = chunkNames.map((chunkName) => {
            return new Promise((resolve, reject) => {
                fs.readFile(chunkName, (err, data) => {
                    //handle err
                    resolve(data)
                })
            })
        })
        let chunkBuffers = await Promise.all(promiseArray)
        cb(chunkBuffers)
    })
})