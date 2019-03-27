module.exports = writeRdfFile;
const fs = require('fs');
const uuidv4 = require('uuid/v4');
const path = 'rdf.rdf';
const getItemsFromObject = (obj, property) => obj && obj[property] ? obj[property] : '';
const putRecords = (records) => records.map(item => putRecordItem(item)).join('');
const infoForDescriptionUri = (item) => {
    return {
        uris: [
            ...getItemsFromObject(item, 'class'),
            ...getItemsFromObject(item, 'property'),
            ...getItemsFromObject(item, 'propertyOf'),
            ...getItemsFromObject(item, 'graph')
        ],
        uriLabels: [
            ...getItemsFromObject(item, 'classLabel'),
            ...getItemsFromObject(item, 'propertyLabel'),
            ...getItemsFromObject(item, 'propertyOfLabel'),
            ...getItemsFromObject(item, 'graphLabel')
        ],
        dataspace_uri: item.dataspace_uri
    }
};

function uniqueValuesByProperty(records, property) {
    let obj = {};
    records.forEach(x => {
        if (!obj[x[property]]) {
            obj[x[property]] = true;
        }
    });
    return Object.keys(obj);
}

function putRecordItem(item) {
    return `
        <vds:Index rdf:about="http://www.vios.network/i#${uuidv4()}">
            ${item.class && item.class.length           ? item.class.map(x =>      `<vdsidx:class rdf:resource="${x}"/>`).join('') : ''}
            ${item.property && item.property.length     ? item.property.map(x =>   `<vdsidx:field rdf:resource="${x}"/>`).join('') : ''}
            ${item.propertyOf && item.propertyOf.length ? item.propertyOf.map(x => `<vdsidx:role rdf:resource="${x}"/>`).join('') : ''}
            ${item.graph && item.graph.length           ? item.graph.map(x =>      `<vdsidx:library rdf:resource="${x}"/>`).join('') : ''}
            ${item.value && item.value.length           ? item.value.map(x =>      `<vdsidx:content rdf:datatype="${item.value}"/>`).join('') : ''}
            <vdsidx:dataserver rdf:resource="${item.dataspace_uri}"/>
            <vdsidx:timestamp>${item.timestamp}</vdsidx:timestamp>
            <vdsidx:queryId rdf:resource="http://www.vios.network/i#qid${item.qid}"/>
            <vdsidx:sourceId rdf:resource="http://www.vios.network/i#sid${item.sid}"/>
            ${item.count > -1 ? `<vdsidx:count>${item.count}</vdsidx:count>` : ''}
        </vds:Index>`;
}

function putDescriptionUris(records) {
    records = records.filter(x => x.count);
    return records.map(item => {
        const x = infoForDescriptionUri(item);
        return x.uris
            .map((uri, index) => putDescriptionUri(uri, x.uriLabels[index], x.dataspace_uri)).join('');
    }).join('');
}

function putDescriptionUri(uri, uriLabel, dataspace_uri) {
    return `
        <rdf:Description rdf:about="${uri}">
            <powder:describedby rdf:resource="${dataspace_uri}"/>
            ${!!uriLabel ? `<rdfs:label>${uriLabel}</rdfs:label>` : ''}
        </rdf:Description>`;
}

function putDescriptionLabels(records, key, value) {
    let obj = {};
    records.forEach(x => {
        if (!obj[x[key]]) {
            obj[x[key]] = x[value];
        }
    });
    if (Object.keys(obj).length) {
        return Object.keys(obj).map(y => putDescriptionLabel(y, obj[y])).join('');
    }
}

function putDescriptionLabel(uri, label) {
    return `
        <rdf:Description rdf:about="${uri}">
            <rdfs:label>${label}</rdfs:label>
        </rdf:Description>`;
}

function putDescriptionQidSidTemplate(records) {
    return records.map(record => putDescriptionQidSidItem(record)).join('');
}

function putDescriptionQidSidItem(record) {
    return `
        <rdf:Description rdf:about="http://www.vios.network/i#qid${record.qid}">
            <rdfs:label>Query ${record.qid}</rdfs:label>
        </rdf:Description>
        <rdf:Description rdf:about="http://www.vios.network/i#sid${record.sid}">
            <rdfs:label>Source ${record.sid}</rdfs:label>
        </rdf:Description>`
}

function putProfiles(records, property) {
    records = records.filter(x => x.count);
    const uniqueDataspaces = uniqueValuesByProperty(records, property);
    if (uniqueDataspaces.length) {
        return uniqueDataspaces.map(y => {
            const tt = records
                .filter(item => item.dataspace_uri === y);
            const uniqueSIDs = uniqueValuesByProperty(tt, 'qid');
            return putProfile(y, uniqueSIDs.length);
        }).join('');
    }
}

function putProfile(uri, performance) {
    return `
        <vo:Profile rdf:about="http://www.vios.network/i#${uuidv4()}"> 
            <dcterms:subject rdf:resource="${uri}"/>
            <vdspfl:performance>${performance}</vdspfl:performance>
        </vo:Profile>`;
}

function putProfileLongHandler(records) {
    records = records.filter(x => x.count);
    const filter = {};
    return records.map(item => {
        const x = infoForDescriptionUri(item);
        return x.uris
            .map(uri => {
                if (!filter[uri]) {
                    filter[uri] = true;
                    return uri;
                } else {
                    return false;
                }
            })
            .map((uri, index) => {
                if (!uri) return;
                const allMatchedRecords = records.map(record => {
                    if (!!(record.class && (record.class.indexOf(uri) > -1)) ||
                        !!(record.property && (record.property.indexOf(uri) > -1)) ||
                        !!(record.propertyOf && (record.propertyOf.indexOf(uri) > -1)) ||
                        !!(record.graph && (record.graph.indexOf(uri) > -1))) {
                        return record;
                    }
                }).filter(record => record);
                const uniqueDataspacesCount = uniqueValuesByProperty(allMatchedRecords, 'dataspace_uri').length;
                const uniqueGraphCount = uniqueValuesByProperty(allMatchedRecords, 'graph').length;
                const uniqueSourceIdCount = uniqueValuesByProperty(allMatchedRecords, 'sid').length;
                return putProfileLongTemplate(uri, item.dataspace_uri, x.uriLabels[index], uniqueDataspacesCount, uniqueGraphCount, uniqueSourceIdCount);
            }).join('');
    }).join('');
}

function putProfileLongTemplate(uri, dataspace_uri, itemLabel, uniqueDataspacesCount, uniqueGraphCount, uniqueSourceIdCount) {
    return `
        <vo:Profile rdf:about="http://www.vios.network/i#${uuidv4()}">
            ${!!itemLabel ? `<rdfs:label>${itemLabel} Profile</rdfs:label>` : ''}
            <dcterms:subject rdf:resource="${uri}"/>
            <powder:describedby rdf:resource="${dataspace_uri}"/>
            <vdspfl:idn rdf:resource="http://www.vios.network/i#${uuidv4()}"/>
            <vdspfl:prevelance>${uniqueDataspacesCount * (uniqueGraphCount * 0.2)}</vdspfl:prevelance> 
            <vdspfl:performance>${uniqueSourceIdCount}</vdspfl:performance>
            <vdsidx:timestamp>${(new Date()).getTime()}</vdsidx:timestamp>
        </vo:Profile>`;
}

function renderRdf(records) {
    if (!records.length) return; 
    const data = {
        records: records
    };
    return `<?xml version="1.0"?>
    <rdf:RDF xmlns="http://www.vios.network/o/"
         xml:base="http://www.vios.network/o"
         xmlns:owl="http://www.w3.org/2002/07/owl#"
         xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
         xmlns:xml="http://www.w3.org/XML/1998/namespace"
         xmlns:xsd="http://www.w3.org/2001/XMLSchema#"
         xmlns:dcat="http://www.w3.org/ns/dcat#"
         xmlns:foaf="http://xmlns.com/foaf/0.1/"
         xmlns:dcterms="http://purl.org/dc/terms/"
         xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
         xmlns:vo="http://www.vios.network/o/"
         xmlns:vds="http://www.vios.network/o/DataServer/"
         xmlns:vdsidx="http://www.vios.network/o/DataServer/Index/"
         xmlns:vdspfl="http://www.vios.network/o/Profile/"
         xmlns:vi="http://www.vios.network/i#"
         xmlns:oplwebsrv="http://www.openlinksw.com/ontology/webservices#"
         xmlns:opla="http://www.openlinksw.com/schema/attribution#"
         xmlns:powder="https://www.w3.org/2007/05/powder-s#">
         ${putRecords(data.records)}
         ${putDescriptionUris(data.records)}
         ${putDescriptionLabels(data.records, 'dataspace_uri', 'dataspaceLabel')}
         ${putDescriptionQidSidTemplate(data.records)}
         ${putProfiles(data.records, 'dataspace_uri')}
         ${putProfileLongHandler(data.records)}
    </rdf:RDF>`;
}

function writeRdfFile(fileName, data) {
    fs.writeFileSync(`./rdf/${fileName}.rdf`, renderRdf(data), (err) => {
        if (err) throw err;
    });
}

