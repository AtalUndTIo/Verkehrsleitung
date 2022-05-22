var http = require("http");
var https = require("https");
var url = require('url');
var fs = require('fs');
var socketIO = require('socket.io');
var crypto = require('crypto');
var formidable = require('formidable');
var fsx = require('fs-extra');
var cluster = require('cluster');

var requestListener = require('./request').requestListener;
var socketListener  = require('./request').socketListener;

const randoms = (length = 8) => {
    let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_';
    let str = '';
    for (let i = 0; i < length; i++) {
        str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return str;
};

var httpsOptions = {
    key: fs.readFileSync('key.pem'),
    cert: fs.readFileSync('cert.pem')
};
	
if (cluster.isMaster) {
  cluster.fork();

  cluster.on('exit', function(worker, code, signal) {
    cluster.fork();
  });
}

if (cluster.isWorker) {
	const httpServer = http.createServer(requestListener);
	httpServer.listen(8080);
	const httpsServer = https.createServer(httpsOptions, requestListener);
	httpsServer.listen(4433);
	
	socketIO(httpServer).on('connection', socketListener);
	socketIO(httpsServer).on('connection', socketListener);
}
