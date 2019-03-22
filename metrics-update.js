const MongoClient = require('mongodb').MongoClient;
let db;
process.send = process.send || function () {};

function shutDownApp() {
    console.log('Closing cron job...');
    db.close(function () {
        console.log('Cron job closed.');
        console.log('Mongoose default connection disconnected through app termination');
        process.exit(0);
    });
}

function updateCollection() {
    const nodes = {test: 'Success!', timestamp: + new Date()};
    db.collection('test3').insertOne(nodes, (err, res) => {
        if (err) {
            console.error('Inserting data to collection error');
            console.error(err);
        } else {
            console.info('Inserting data to collection success!');
            shutDownApp();
        }
    });
}

MongoClient.connect('mongodb://administrator:administrator@ds119533.mlab.com:19533/mongodbtest', function(err, client) {
    db = client.db('mongodbtest');
    process.send('ready');
    // updateCollection();
});

process.on('SIGINT', () => {
    shutDownApp();
});
process.on('message', function(msg) {
    if (msg === 'shutdown') {
        shutDownApp();
    }
});
