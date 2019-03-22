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
    db.collection(dbConfig.viosCollection).find({}, { limit: 1 }).toArray((err, data) => {
        [{"value": "",
        "text": "pizza",
        "dataspace_uri": "http://dbpedia.org",
        "count": 15,
        "timestamp": 1553164484852,
        "qid": "-1550053275"}].filter(i => i.dataspace_uri === '')
        writeRdfFile(data);
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
