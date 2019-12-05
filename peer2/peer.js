const client = require('socket.io-client');
const server = require("socket.io")();
const fs = require('fs');

let NUM_CHUNKS = Number.MAX_SAFE_INTEGER
const [FILE_OWNER_PORT, MY_PORT, DOWNLOAD_PEER_PORT] = process.argv.slice(2)
const chunkList = []

const log2 = (str) => console.log(`[${MY_PORT}]: ${str}`)

const fileOwnerSocket = client.connect(`http://localhost:${FILE_OWNER_PORT}`)
fileOwnerSocket.on('error', function(error){
    console.error(error)
    process.exit()
});
fileOwnerSocket.on('connect_error', function(error){
    console.error(`Unable to connect to fileOwner on port ${FILE_OWNER_PORT}`)
})
fileOwnerSocket.on('connect', async function(){
    log2(`Connected to fileOwner running on port ${FILE_OWNER_PORT}`)
})
fileOwnerSocket.on('upload', async (numChunks, chunkNames, chunkBuffers, cb) => {
    NUM_CHUNKS = numChunks
    log2(`Receving files ${chunkNames.toString()} from [FILE OWNER]`)
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


const downloadPeerSocket = client.connect(`http://localhost:${DOWNLOAD_PEER_PORT}`)
downloadPeerSocket.on('error', function(error){
    console.error(error)
    process.exit()
});
downloadPeerSocket.on('connect_error', function(error){
    console.error(`Unable to connect to downloadPeer on port ${DOWNLOAD_PEER_PORT}`)
})
downloadPeerSocket.on('connect', async function(){
    log2(`Connected to downloadPeer running on port ${DOWNLOAD_PEER_PORT}`)
    while(chunkList.length < NUM_CHUNKS){
        let getChunkListPromise = new Promise((resolve, reject) => {
            downloadPeerSocket.emit('get_chunk_list', function(peerChunkList){
                // log2(`Receving CHUNK_LIST from [DOWNLOAD PEER]`)
                resolve(peerChunkList.filter(chunk => chunkList.indexOf(chunk) == -1))
            })
        })
        let newChunkNames = await getChunkListPromise
        if(!newChunkNames.length){
            continue;
        }
        let getChunksPromise = new Promise((resolve, reject) => {
            downloadPeerSocket.emit('get_chunks', newChunkNames, async (buffers) => {
                //handle err
                log2(`Receving FILES ${newChunkNames.toString()} from [DOWNLOAD PEER]`)
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
    // log2(chunkList)
    log2("========================\nReceived all chunks. Reconstructing source file \n========================")
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
server.listen(MY_PORT);
log2(`Listening on port ${MY_PORT}`)
server.on("connection", async (socket) => {
    log2(`Upload neighbour connected [id=${socket.id}]`);
    socket.on('get_chunk_list', (cb) => {
        // log2("Sending CHUNK_LIST to [UPLOAD NEIGHBOUR]")
        cb(chunkList)
    })
    socket.on('get_chunks', async (chunkNames, cb) => {
        log2(`Sending ${chunkNames} to [UPLOAD NEIGHBOUR]`)
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