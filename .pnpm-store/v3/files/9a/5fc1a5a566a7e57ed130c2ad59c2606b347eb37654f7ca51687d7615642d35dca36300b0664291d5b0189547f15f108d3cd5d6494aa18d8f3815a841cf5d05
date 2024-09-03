var Connection, EventEmitter, Net, Parser, Promise, debug, dump, execFile,
  extend = function(child, parent) { for (var key in parent) { if (hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  hasProp = {}.hasOwnProperty;

Net = require('net');

Promise = require('bluebird');

debug = require('debug')('adb:connection');

EventEmitter = require('events').EventEmitter;

execFile = require('child_process').execFile;

Parser = require('./parser');

dump = require('./dump');

Connection = (function(superClass) {
  extend(Connection, superClass);

  function Connection(options1) {
    this.options = options1;
    this.socket = null;
    this.parser = null;
    this.triedStarting = false;
  }

  Connection.prototype.connect = function() {
    this.socket = Net.connect(this.options);
    this.socket.setNoDelay(true);
    this.parser = new Parser(this.socket);
    this.socket.on('connect', (function(_this) {
      return function() {
        return _this.emit('connect');
      };
    })(this));
    this.socket.on('end', (function(_this) {
      return function() {
        return _this.emit('end');
      };
    })(this));
    this.socket.on('drain', (function(_this) {
      return function() {
        return _this.emit('drain');
      };
    })(this));
    this.socket.on('timeout', (function(_this) {
      return function() {
        return _this.emit('timeout');
      };
    })(this));
    this.socket.on('close', (function(_this) {
      return function(hadError) {
        return _this.emit('close', hadError);
      };
    })(this));
    return new Promise((function(_this) {
      return function(resolve, reject) {
        _this.socket.once('connect', resolve);
        return _this.socket.once('error', reject);
      };
    })(this))["catch"]((function(_this) {
      return function(err) {
        if (err.code === 'ECONNREFUSED' && !_this.triedStarting) {
          debug("Connection was refused, let's try starting the server once");
          _this.triedStarting = true;
          return _this.startServer().then(function() {
            return _this.connect();
          });
        } else {
          _this.end();
          throw err;
        }
      };
    })(this)).then((function(_this) {
      return function() {
        _this.socket.on('error', function(err) {
          if (_this.socket.listenerCount('error') === 1) {
            return _this.emit('error', err);
          }
        });
        return _this;
      };
    })(this));
  };

  Connection.prototype.end = function() {
    this.socket.end();
    return this;
  };

  Connection.prototype.write = function(data, callback) {
    this.socket.write(dump(data), callback);
    return this;
  };

  Connection.prototype.startServer = function() {
    var args, port;
    port = this.options.port;
    args = port ? ['-P', port, 'start-server'] : ['start-server'];
    debug("Starting ADB server via '" + this.options.bin + " " + (args.join(' ')) + "'");
    return this._exec(args, {});
  };

  Connection.prototype._exec = function(args, options) {
    debug("CLI: " + this.options.bin + " " + (args.join(' ')));
    return Promise.promisify(execFile)(this.options.bin, args, options);
  };

  Connection.prototype._handleError = function(err) {};

  return Connection;

})(EventEmitter);

module.exports = Connection;
