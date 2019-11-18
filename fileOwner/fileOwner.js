const fs = require('fs');
const io = require("socket.io")();

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

const main = async () => {
    const numChunks = await chunkFile()
    const [port] = process.argv.slice(2)
    io.listen(port);
    console.log(`File owner running on port: ${port}`)                 
}
main()

/*
//Merge chunks:
let promiseArray = []
for(let i = 1; i <= 40; i++){
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
    fs.writeFile("reconstructed.pdf", data, (err) => {
        //handle err
    })
})
*/
