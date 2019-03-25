const MongoClient = require('mongodb').MongoClient;
const dbConfig = require('./config/db');
let db;
process.send = process.send || function () {};
const writeRdfFile = require('./renderRdf');

function shutDownApp() {
    console.log('Closing cron job...');
    db.close(function () {
        console.log('Cron job closed.');
        console.log('Mongoose default connection disconnected through app termination');
        process.exit(0);
    });
}

function updateCollection() {
    db.collection(dbConfig.viosCollection).find({}, { limit: 1000 }).toArray((err, data) => {
        writeRdfFile(data);
    });

    // const lastHour = new Date();
    // lastHour.setHours(lastHour.getHours() - 1);
    // db.collection(dbConfig.viosCollection).find( { timestamp: { $gt: new Date(lastHour).getTime() } } ).toArray((err, data) => {
    //     console.log(data);
    // });
}

MongoClient.connect(dbConfig.url, function(err, client) {
    db = client.db('mongodbtest');
    process.send('ready');
    updateCollection();
});

process.on('SIGINT', () => {
    shutDownApp();
});
process.on('message', function(msg) {
    if (msg === 'shutdown') {
        shutDownApp();
    }
});
