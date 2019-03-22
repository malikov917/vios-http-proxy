var fs = require('fs');
var path = 'rdf.rdf';

function putRecords(records) {
    return records.map(item => putRecordItem(item)).join('');
}

function putRecordItem(item) {
    return `
        <vds:Index rdf:about="http://www.vios.network/i#{insert-qid}"> <!-- {insert-GUID-hash} = hash of a generic GUID -->
            <!-- optional properties, but each Index record must have at least one of these -->
            <vdsidx:class rdf:resource="{insert-class}"/> <!-- {insert-class} = data extracted from //query//class/@iri-->
            <vdsidx:field rdf:resource="{insert-field}"/> <!-- //query//property/@iri -->
            <vdsidx:role rdf:resource="{insert-role}"/> <!--//query//property-of/@iri-->
            <vdsidx:library rdf:resource="{insert-library}"/> <!--//query/@graph-->
            <vdsidx:content xmls:datatype="{insert-data}"/> <!--//query//value/text() or //query//text/text() -->
            <vdsidx:dataserver rdf:resource="{insert-dataserver-uri}"/>
            <!-- not optional - each Index record must have all of these -->
            <vdsidx:timestamp>{insert-timestamp}</vdsidx:timestamp>
            <vdsidx:queryId rdf:resource="http://www.vios.network/i#qid{insert-qid}"/> <!-- {insert-qid} = value extracted from X-VIOS-QID header -->
            <vdsidx:sourceId rdf:resource="http://www.vios.network/i#sid{insert-ip_hash}"/> <!-- {insert-ip_hash} = the hash of the IP Address -->
            <vdsidx:count rdf:resource="http://www.vios.network/i#sid{insert-count}"/> <!-- {insert-count} = the count value -->
        </vds:Index>`;
}

function putDescriptionUri() {
    return `<!-- not optional - one of these for each URI value -->
        <rdf:Description rdf:about="{insert-uri}"> <!-- one for each extracted uri -->
            <powder:describedby rdf:resource="{insert-dataserver-uri}"/> <!-- insert data server uri -->
        </rdf:Description>`;
}

function putDescriptionLabel() {
    return `<rdf:Description rdf:about="{insert-dataserver-uri}"> <!-- one for each extracted data server -->
            <rdfs:label>{insert-dataserver-label}</rdfs:label> <!-- insert data server label -->
        </rdf:Description>`;
}

function putProfile() {
    return `<vo:Profile rdf:about="http://www.vios.network/i#{insert-GUID-hash}"> 
            <dcterms:subject rdf:resource="{insert-dataserver-uri}"/>
            <!-- {insert-metric-performance} = performance, where (pseudo code)
                var performance = select count(DISTINCT QID) where ( DATASERVER=DATASERVER-URI ) AND COUNT > 0
            -->
            <vdspfl:performance>{insert-metric-performance}</vo:performance>
        </vo:Profile>`;
}

function putProfileLong() {
    return `<!-- metrics: run the queries over the last hour of data only -->
        <vo:Profile rdf:about="http://www.vios.network/i#{insert-GUID-hash}"> 
            <dcterms:subject rdf:resource="{insert-uri}"/> <!-- one for each extracted uri -->
            <powder:describedby rdf:resource="{insert-dataserver-uri}"/> <!-- insert data server uri -->
            <vdspfl:idn rdf:resource="http://www.vios.network/i#{insert-idnId}"/> <!-- dummy value - insert hash of a generic GUID -->
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

const renderRdf = (mongoDbObject) => {
    mongoDbObject = {
        records: [0, 1, 2, 3]
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
         ${putRecords(mongoDbObject.records)}
         ${putDescriptionUri()}
         ${putDescriptionLabel()}
         ${putProfile()}
         ${putProfileLong()}
    </rdf:RDF>`;
};

fs.writeFileSync(path, renderRdf({}), (err) => {
    if (err) throw err;
    console.log('Lyric saved!');
});