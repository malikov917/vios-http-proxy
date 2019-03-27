const MongoClient = require('mongodb').MongoClient;
const dbConfig = require('./config/db');
let db;
process.send = process.send || function () {};
const writeRdfFile = require('./renderRdf');
const transferFile = require('./executeBash');

function shutDownApp() {
    console.log('Closing cron job...');
    db.close(function () {
        console.log('Cron job closed.');
        console.log('Mongoose default connection disconnected through app termination');
        process.exit(0);
    });
}

function updateCollection() {
    // TEST PURPOSES
    // const lastHour = new Date();
    // lastHour.setHours(lastHour.getHours() - 1);
    // db.collection(dbConfig.viosCollection).find({}, { limit: 1000 }).toArray((err, data) => {
    //     writeRdfFile(lastHour.getTime(), data);
    //     transferFile(lastHour.getTime(), shutDownApp);
    // });

    const lastHour = new Date();
    lastHour.setHours(lastHour.getHours() - 3);
    db.collection(dbConfig.viosCollection).find( { timestamp: { $gt: new Date(lastHour).getTime() } } ).toArray((err, data) => {
        writeRdfFile(lastHour.getTime(), data);
        transferFile(lastHour.getTime(), shutDownApp);
    });
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
