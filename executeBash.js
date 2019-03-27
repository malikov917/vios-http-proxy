module.exports = transferFile;
const exec = require('child_process').exec;
function transferFile(fileName, callback) {
    transfer = exec(`scp -i ./virtuoso.pem ./rdf/${fileName}.rdf ec2-user@ec2-54-70-178-6.us-west-2.compute.amazonaws.com:/opt/virtuoso/data/metrics/`, function(err, stdout, stderr) {
        if (err) {
            console.error(err);
        } else {
            console.log('transfer file is succeed');
        }
        console.log(stdout);
        callback();
    });
}
