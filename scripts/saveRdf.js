const fs = require('fs');
function writeRdfFile() {
    fs.writeFileSync(`../rdf/rdf.txt`, 'asf');
}

writeRdfFile()