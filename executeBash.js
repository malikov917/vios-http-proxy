module.exports = transferFile;
const exec = require('child_process').exec;
function transferFile() {
    transfer = exec("scp -i ./virtuoso.pem rdf.rdf ec2-user@ec2-34-217-105-106.us-west-2.compute.amazonaws.com:/opt/virtuoso/data/metrics/", function(err, stdout, stderr) {
        if (err) {
            console.error(err);
        } else {
            console.log('transfer file is succeed');
        }
        console.log(stdout);
    });

    transfer.on('exit', function (code) {
        console.info('code on exit:');
        console.info(code);
    });
}
