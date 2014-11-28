var fs = require('fs');
var nodepath = require('path');
var async = require('async');
var mime = require('mime');
var request = require('nep-request');
var isUtf8 = require('is-utf8');

module.exports = function(req, res, next, data) {

    var asset, files, extname, getters;

    asset = new AssetRequest(req, data.options);

    files = asset.getRequestFiles();
    extname = nodepath.extname(files[0]) || '.js';

    files = asset.sortRequestFiles(files);

    if(files.length == 1 && files[0].type == 'local'){
        sendSingleFile(files[0].path, res);
        return;
    }

    res.set('content-type', mime.lookup(extname));
    getters = asset.makeGetter(files);
    async.parallel(getters, function(err, results) {
        if (err) {

        }
        results.forEach(function(result) {
            res.write(result);
        });
        res.end();
    });
}

function sendSingleFile(file, res){
    var charset;
    var buf = fs.readFileSync(file);
    
    if(isUtf8(buf)){
        charset = 'utf-8';
    }
    else{
        charset = 'gbk';
    }
    res.set('content-type', mime.lookup(file)+'; charset='+charset);
    res.send(buf);
}



function AssetRequest(req, options) {

    this.req = req;
    this.options = options;

    var hostArr = req.headers.host.split(':');
    var hostname = hostArr[0];
    var port = hostArr[1];

    this.host = req.protocol + '://' + hostname;

    if (port && port != '80') {
        this.host += ':' + port;
    }
}

AssetRequest.prototype.getRequestFiles = function() {
    var req = this.req;
    var url = req.url;
    var query = req.query;
    var path = req.path;
    var files = [];
    var name, pieces;

    if (url.indexOf('??') === -1) {
        files.push(path);
        return files;
    }
    for (name in query) {
        if (name.charAt(0) == '?') {
            name = name.slice(1);
            name = name.replace(/\?.*$/, '');
            pieces = name.split(',');
            pieces.forEach(function(piece, i) {
                pieces[i] = nodepath.join(path, piece);
            });
            files = files.concat(pieces);
        }
    }

    return files;

};

AssetRequest.prototype.sortRequestFiles = function(files) {
    var ret = [];
    var options = this.options;
    var host = this.host;
    var asset = this;

    files.forEach(function(file) {
        var path = asset.getLocalPath(file, options);
        if (path) {
            ret.push({
                type: 'local',
                path: path
            });
        }
        else {
            ret.push({
                type: 'web',
                path: host + file
            });
        }
    });

    return ret;
};


AssetRequest.prototype.getLocalPath = function(file) {
    var options = this.options;

    for (var name in options) {
        if (file.indexOf(name) == 0) {
            file = file.replace(name, options[name]);
            return file;
        }
    }
};


AssetRequest.prototype.makeGetter = function(files) {
    var ret = [];

    files.forEach(function(file) {
        if (file.type == 'local') {
            ret.push(makeLocalGetter(file.path));
        }
        else if (file.type == 'web') {
            ret.push(makeWebGetter(file.path));
        }
    });

    return ret;
};


function makeLocalGetter(file) {
    return function(callback) {
        var buffer = fs.readFileSync(file);
        callback(null, buffer);
    }
}


function makeWebGetter(file) {
    return function(callback) {
        request({
            url: file
        }, function(error, buffer, proxyRes) {
            if (!error) {
                callback(null, buffer);
            }
        })
    }
}