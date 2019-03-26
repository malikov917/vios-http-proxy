const proxy = require('express-http-proxy');
const express = require('express');
const app = express();
const MongoClient = require('mongodb').MongoClient;
const dbConfig = require('./config/db');
const defaultTarget = 'linkeddata.uriburner.com';
let target = defaultTarget;
process.send = process.send || function () {};
global.db;

const xpath = require('xpath');
const dom = require('xmldom').DOMParser;
const getNodeValues = (array) => array.map(item => item.nodeValue);
const getXmlFromBuffer = (buffer) => {
    try {
        return new dom().parseFromString(buffer.toString());
    } catch (e) {
        console.error(e);
        return '';
    }
};
const disableOptionRequest = (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    if (!req.headers['x-vios-type']) {
        next();
    }
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
};
const selectProxyTarget = (req, res, next) => {
    // if (!req.headers['x-vios-type']) {
    //     next();
    // } else {
        const pathname = req.url;
        const params = pathname.split("/");
        const protocol = params[1];
        const targetUrl = params[2];
        if (protocol === 'http' || protocol === 'https') {
            target = protocol + '://' + targetUrl;
            next();
        } else {
            console.error("Protocol wasn't specified");
            res.status(400).json({"Proxy app error": "Protocol wasn't specified"});
        }
    // }
};
const setCutomHeaders = (req, res, next) => {
    if (!req.headers['x-vios-type']) {
        next();
    } else {
        req.url = req.url.substring(target.length - 1);
        req.headers['Content-Type'] = 'text/xml';
        next();
    }
};
const shutDownApp = () => {
    console.log('Closing all connections...');
    global.db.close(function () {
        console.log('Mongoose default connection disconnected through app termination');
        process.exit(0);
    });
};
const insertRecord = (item) => {
    const db = global.db;
    db.collection(dbConfig.viosCollection).insertOne(item, (err, res) => {
        if (err) {
            console.error('Inserting data to collection error');
            console.error(err);
        }
    });
};
app.use('/', disableOptionRequest);
app.use('/', selectProxyTarget);
app.use('/', setCutomHeaders);
app.use('/', proxy(() => target, {
    proxyReqBodyDecorator: function(reqBody, srcReq) {
        if (!!srcReq.headers['x-vios-type']) {
            srcReq.reqBody = reqBody;
        }
        return reqBody;
    },
    proxyErrorHandler: function(err, res, next) {
        console.error('Proxy Error Handler:');
        console.error(err);
        next(err);
    },
    userResDecorator: function(proxyRes, proxyResData, userReq, userRes) {
        return new Promise(function (resolve) {
            let item = {};

            if (userReq.headers['x-vios-type'] === 'sparql') {
                const query = userReq.query.query;
                const myRegexp = /<(.*?)>/s;
                const match = myRegexp.exec(query);
                if (match && match[1]) {
                    // НУЖНО ИГНОРИТЬ ВСЕ ОСТАЛЬНЫЕ !!
                    if (query && query.includes('select distinct')) {
                        item.type = 'distinct';
                        item.count = 1;
                    } else if (query && query.includes('select count')) {
                        const doc = getXmlFromBuffer(proxyResData);
                        const el = xpath.select("//*", doc).find(x => x.nodeName === 'literal');
                        item.type = 'count';
                        item.count = el ? el.childNodes[0].nodeValue : 0;
                    }
                    item = {
                        ...item,
                        dataspace_uri: target,
                        uri: match[1],
                        timestamp: +new Date(),
                        qid: userReq.headers['x-vios-qid'],
                        sid: userReq.headers['x-vios-sid'],
                        bid: userReq.headers['x-vios-bid'],
                        dataspaceLabel: userReq.headers['x-vios-dataspace-label']
                    };
                    insertRecord(item);
                }
            } else if (userReq.headers['x-vios-type'] === 'fct') {
                const resData = getXmlFromBuffer(proxyResData);
                const reqBody = getXmlFromBuffer(userReq.reqBody);
                const check = xpath.select("//query//view/@type", reqBody);
                const count = xpath.select("//*", resData).filter(x => x.nodeName === 'fct:row').length;

                if (check.length && check[0].nodeValue && check[0].nodeValue === 'list-count') {
                    item = {
                        class: xpath.select("//query//class/@iri", reqBody).length ? getNodeValues(xpath.select("//query//class/@iri", reqBody)) : '',
                        classLabel: xpath.select("//query//class/@label", reqBody).length ? getNodeValues(xpath.select("//query//class/@label", reqBody)) : '',
                        property: xpath.select("//query//property/@iri", reqBody).length ? getNodeValues(xpath.select("//query//property/@iri", reqBody)) : '',
                        propertyLabel: xpath.select("//query//property/@label", reqBody).length ? getNodeValues(xpath.select("//query//property/@label", reqBody)) : '',
                        propertyOf: xpath.select("//query//property-of/@iri", reqBody).length ? getNodeValues(xpath.select("//query//property-of/@iri", reqBody)) : '',
                        propertyOfLabel: xpath.select("//query//property-of/@label", reqBody).length ? getNodeValues(xpath.select("//query//property-of/@label", reqBody)) : '',
                        graph: xpath.select("//query/@graph", reqBody).length ? getNodeValues(xpath.select("//query/@graph", reqBody)) : '',
                        graphLabel: xpath.select("//query/@graphLabel", reqBody).length ? getNodeValues(xpath.select("//query/@graphLabel", reqBody)) : '',
                        value: xpath.select("//query//value/text()", reqBody).length ? getNodeValues(xpath.select("//query//value/text()", reqBody)) : '',
                        text: xpath.select("//query//text/text()", reqBody).length ? xpath.select("//query//text/text()", reqBody)[0].nodeValue : '',
                        dataspace_uri: target,
                        count: count !== undefined ? count : 0,
                        timestamp: +new Date(),
                        qid: userReq.headers['x-vios-qid'],
                        sid: userReq.headers['x-vios-sid'],
                        bid: userReq.headers['x-vios-bid'],
                        dataspaceLabel: userReq.headers['x-vios-dataspace-label']
                    };
                    insertRecord(item);
                }
            }
            if (userReq.headers['x-vios-type']) {
                delete userReq.headers['x-vios-type'];
                delete userReq.headers['x-vios-qid'];
                delete userReq.headers['x-vios-sid'];
                delete userReq.headers['x-vios-dataspace-label'];
            }
            resolve(proxyResData);
        });
    }
}));

app.listen(8002, () => {
    console.log("listening 8002 port");
    MongoClient.connect(dbConfig.url, function(err, client) {
        const db = client.db('mongodbtest');
        global.db = db;
        process.send('ready');
        console.log("mongodb connection is done");
    });
});

process.on('SIGINT', (msg) => {
    shutDownApp();
});

process.on('message', function(msg) {
    if (msg === 'shutdown') {
        shutDownApp();
    }
});