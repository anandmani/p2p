const fs = require('fs');
const server = require("socket.io")();

const writeChunk = (chunkName, chunkData) =>  
    new Promise((resolve, reject) => {
        fs.writeFile(chunkName, chunkData, (err) => {
            //handle err
            resolve()
        })
    })

const chunkFile = async () => {
    const filename = 'test.pdf'
    
    let fileSize = await new Promise((resolve, reject) => {
        fs.stat(filename, (err, data) => {
            //handle err
            resolve(data.size)
        })
    })
    
    let numChunks = await new Promise((resolve, reject) => {
        fs.readFile(filename, async (err, data) => {
            //hanlde err
            const chunkSize = 100000
            let chunkPromises = []
            let i
            for(i = 0; i < Math.ceil(fileSize/chunkSize); i++){
                let chunkData = data.slice(i * chunkSize, i * chunkSize + chunkSize)
                chunkPromises.push(writeChunk(`${i}.blob`, chunkData))
            }
            await Promise.all(chunkPromises)
            resolve(i)
        })  
    })
    
    return numChunks
}

class ChunksHelper{
    constructor(numChunks){
        const numPeers = 2
        this.chunkNames = Array.from(Array(numChunks).keys()).map(i => `${i}.blob`)
        this.clusterSize = Math.ceil(this.chunkNames.length / numPeers)
    }
    getChunkNames(){
        return this.chunkNames.splice(0, this.clusterSize)
    }
}

const sendChunksToPeer = async (socket, chunkHelper) => {
    let chunkNames = chunkHelper.getChunkNames()
    console.log(`Sending ${chunkNames} in socket ${socket.id}`)
    let promiseArray = chunkNames.map((chunkName) => {
        return new Promise((resolve, reject) => {
            fs.readFile(chunkName, (err, data) => {
                //handle err
                resolve(data)
            })
        })
    })
    let chunkBuffers = await Promise.all(promiseArray)
    socket.emit('upload', chunkNames, chunkBuffers, (err1) => {
        //handle err
        console.log("Upload successful")
    })
}

const main = async () => {
    const numChunks = await chunkFile()
    const chunkHelper = new ChunksHelper(numChunks)
    const [port] = process.argv.slice(2)
    server.listen(port);
    console.log(`File owner running on port: ${port}`)
    
    server.on("connection", async (socket) => {
        console.log(`Peer connected [id=${socket.id}]`);
        sendChunksToPeer(socket, chunkHelper)
    })    

}
main()
