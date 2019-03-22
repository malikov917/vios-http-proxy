module.exports = writeRdfFile;
const fs = require('fs');
const uuidv1 = require('uuid/v1');
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
        <vds:Index rdf:about="http://www.vios.network/i#${item.qid}"> <!-- {insert-GUID-hash} = hash of a generic GUID -->
            <!-- optional properties, but each Index record must have at least one of these -->
            ${item.class && item.class.length           ? item.class.map(x =>      `<vdsidx:class rdf:resource="${x}"/>`).join('') : ''}
            ${item.property && item.property.length     ? item.property.map(x =>   `<vdsidx:field rdf:resource="${x}"/>`).join('') : ''}
            ${item.propertyOf && item.propertyOf.length ? item.propertyOf.map(x => `<vdsidx:role rdf:resource="${x}"/>`).join('') : ''}
            ${item.graph && item.graph.length           ? item.graph.map(x =>      `<vdsidx:library rdf:resource="${x}"/>`).join('') : ''}
            <vdsidx:content xmls:datatype="${item.value}"/> <!--//query//value/text() or //query//text/text() -->
            <vdsidx:dataserver rdf:resource="${item.dataspace_uri}"/>
            <!-- not optional - each Index record must have all of these -->
            <vdsidx:timestamp>${item.timestamp}</vdsidx:timestamp>
            <vdsidx:queryId rdf:resource="http://www.vios.network/i#qid${item.qid}"/> <!-- {insert-qid} = value extracted from X-VIOS-QID header -->
            <vdsidx:sourceId rdf:resource="http://www.vios.network/i#sid${item.sid}"/> <!-- {insert-ip_hash} = the hash of the IP Address -->
            <vdsidx:count rdf:resource="http://www.vios.network/i#sid${item.count}"/> <!-- {insert-count} = the count value -->
        </vds:Index>`;
}

function putDescriptionUris(records) {
    return records.map(item => {
        const x = infoForDescriptionUri(item);
        return x.uris
            .map(y => putDescriptionUri(y, x.dataspace_uri)).join('');
    }).join('');
}

function putDescriptionUri(uri, dataspace_uri) {
    return `
        <!-- not optional - one of these for each URI value -->
        <rdf:Description rdf:about="${uri}"> <!-- one for each extracted uri -->
            <powder:describedby rdf:resource="${dataspace_uri}"/> <!-- insert data server uri -->
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
        <rdf:Description rdf:about="${uri}"> <!-- one for each extracted data server -->
            <rdfs:label>${label}</rdfs:label> <!-- insert data server label -->
        </rdf:Description>`;
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
        <vo:Profile rdf:about="http://www.vios.network/i#${uuidv1()}"> 
            <dcterms:subject rdf:resource="${uri}"/>
            <vdspfl:performance>${performance}</vo:performance>
        </vo:Profile>`;
}

function putProfileLongHandler(records) {
    records = records.filter(x => x.count);
    records.map(item => {
        const x = infoForDescriptionUri(item);
        const tt = x.uris
            .map(y => {
                let allMatchedRecords = records.map(z => {
                    if (!!(z.class && (z.class.indexOf(y) > -1)) ||
                        !!(z.property && (z.property.indexOf(y) > -1)) ||
                        !!(z.propertyOf && (z.propertyOf.indexOf(y) > -1)) ||
                        !!(z.graph && (z.graph.indexOf(y) > -1))) {
                        return z;
                    }
                }).filter(z => z);
                const uniqueDataspacesCount = uniqueValuesByProperty(allMatchedRecords, 'dataspace_uri').length;
                const uniqueGraphCount = uniqueValuesByProperty(allMatchedRecords, 'graph').length;
                const uniqueSourceIdCount = uniqueValuesByProperty(allMatchedRecords, 'dataspace_uri').length;
            });
    }).join('');
}

function putProfileLongTemplate(uri, dataspace_uri) {
    return `
        <!-- metrics: run the queries over the last hour of data only -->
        <vo:Profile rdf:about="http://www.vios.network/i#${uuidv1()}"> 
            <dcterms:subject rdf:resource="${uri}"/> <!-- one for each extracted uri -->
            <powder:describedby rdf:resource="${dataspace_uri}"/> <!-- insert data server uri -->
            <vdspfl:idn rdf:resource="http://www.vios.network/i#${uuidv1()}"/> <!-- dummy value - insert hash of a generic GUID -->
            <!-- {insert-metric-prevalance} = prevalance, where (pseudo code)
                    var a = select count(DISTINCT DATASPACE) where ( VALUE=URI OR GRAPH=URI OR CLASS=URI OR PROPERTY=URI OR PROPERTY-OF=URI ) AND COUNT > 0
                    var b = 1; // all URIs live in root graph by default, so all receive at least 1 graph point
                    try b = select count(DISTINCT GRAPH) where ( VALUE=URI OR GRAPH=URI OR CLASS=URI OR PROPERTY=URI OR PROPERTY-OF=URI ) AND COUNT > 0
                    var prevalance = a * (b*0.02); // disparatenss of occurances across named graphs should boost the prevalance rating
            -->
            <vdspfl:prevelance>{insert-metric-prevalance}</vo:prevelance> 
            <!-- {insert-metric-performance} = performance, where (pseudo code)
                var performance = select count(DISTINCT SOURCEID) where ( VALUE=URI OR GRAPH=URI OR CLASS=URI OR PROPERTY=URI OR PROPERTY-OF=URI ) AND COUNT > 0
            -->
            <vdspfl:performance>{insert-metric-performance}</vo:performance>
            <vdsidx:timestamp>${(new Date()).getTime()}</vdsidx:timestamp> <!-- when was this profile generated -->
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
         ${putProfiles(data.records, 'dataspace_uri')}
         ${putProfileLongHandler(data.records)}
    </rdf:RDF>`;
}

function writeRdfFile(data) {
    fs.writeFileSync(path, renderRdf(data), (err) => {
        if (err) throw err;
        consol.info('Write .rdf file is succeed!');
    });
} 
