var http = require("http");
var https = require("https");
var url = require('url');
var fs = require('fs');
var socketIO = require('socket.io');
var crypto = require('crypto');
var formidable = require('formidable');
var fsx = require('fs-extra');

const randoms = (length = 32) => {
    let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let str = '';
    for (let i = 0; i < length; i++) {
        str += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return str;
};
