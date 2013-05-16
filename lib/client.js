/**
 * Module dependencies
 */

var url = require('url'),
    dgram = require('dgram'),
    formats = require('./formats'),
    inherit = require('util').inherits,
    EventEmitter = require('events').EventEmitter;

/**
 * Expose `Client`
 */

module.exports = Client;

/**
 * Client object
 *  facilitates the sending of messages across the socket connection
 *
 * @param {String} address
 */

function Client(address) {
  if(!(this instanceof Client)) return new Client(address);
  if(typeof address === 'number') address = 'localhost:' + address;

  EventEmitter.call(this);
  this.peers = [];
  this.address = url.parse('udp://' + address);
  this.socket = dgram.createSocket('udp4');
  return this.bind();
}

/**
 * Inherit from `EventEmitter`
 */

inherit(Client, EventEmitter);

/**
 * Bind the socket to the `this.address`
 */

Client.prototype.bind = function() {
  var port = this.address.port,
      address = this.address.hostname;

  this.socket.bind(port, address);
  this.socket.on('message', listener.bind(this));
  return this;
};

/**
 * Send a message to peers we are connected to or just one peer if `peer` is passed
 *
 * @param {Object|Buffer|String} message
 * @param {String|Number} peer optional peer to send `message` to
 */

Client.prototype.send = function(message, peer) {
  var i, len,
      m = zip(message),
      peers = this.peers;

  if(peer) {
    if(typeof peer === 'number') peer = 'localhost' + peer;
    peer = url.parse('udp://' + peer);
    this.socket.send(m, 0, m.length, peer.port, peer.hostname);
  } else {
    for(i = 0, len = peers.length; i < len; i = i + 1) {
      this.socket.send(m, 0, m.length, peers[i].port, peers[i].address);
    }
  }
};

/**
 * Send a request to the peer to that a client has connected.
 *
 * @param {String|Number} ...
 */

Client.prototype.connect = function() {
  var i, len, peer,
      m = new Buffer(1),
      args = Array.prototype.slice.call(arguments);

  m.writeUInt8(formats.CONNECT, 0);

  for(i = 0, len = args.length; i < len; i = i + 1) {
    if(typeof args[i] === 'number') args[i] = 'localhost:' + args[i];

    peer = url.parse('udp://' + args[i]);
    this.socket.send(m, 0, m.length, peer.port, peer.hostname);
    manage(this.peers, formats.CONNECT, {
      address: peer.hostname,
      port: peer.port
    });
  }

  return this;
};

/**
 * Send a request to the peer to remove this client from known clients
 *
 * @param {String|Number} ...
 */

Client.prototype.disconnect = function() {
  var i, len, peer,
      m = new Buffer(1),
      args = Array.prototype.slice.call(arguments);

  m.writeUInt8(formats.DISCONNECT, 0);

  for(i = 0, len = args.length; i < len; i = i + 1) {
    if(typeof args[i] === 'number') args[i] = 'localhost:' + args[i];

    peer = url.parse('udp://' + args[i]);
    this.socket.send(m, 0, m.length, peer.port, peer.hostname);
    manage(this.peers, formats.DISCONNECT, {
      address: peer.hostname,
      port: peer.port
    });
  }

  return this;
};

/**
 * Send a disconnect to the server and close the connection
 */

Client.prototype.close = function() {
  disconnect(this.socket, this.server);
  this.socket.close();
};

/**
 * Message handler for the socket's `message` event
 *
 * @param {Buffer} message
 * @param {Object} info
 */

function listener(message, info) {
  var f = format(message);

  if(f === formats.CONNECT || f === formats.DISCONNECT) {
    manage(this.peers, f, info);
  } else {
    this.emit('message', unzip(f, message), info);
  }
}

/**
 * Returns the format for `message`
 *
 * @param {Buffer} message
 */

function format(message) {
  return message.readUInt8(0);
}

/**
 * Package the message into a Buffer with the proper leading format byte
 *
 * @param {Object|Buffer|String} message
 * @return {Buffer}
 */

function zip(message) {
  var f, buffer;

  if(Buffer.isBuffer(message)) {
    f = formats.BUFFER;
    message = message.toString();
  } else if(typeof message === 'string') {
    f = formats.STRING;
  } else {
    f = formats.OBJECT;
    message = JSON.stringify(message);
  }

  buffer = new Buffer(Buffer.byteLength(message) + 1);
  buffer.writeUInt8(f, 0);
  buffer.write(message, 1);
  return buffer;
}

/**
 * Unpackage the message into the previous data
 *
 * @param {Number} f
 * @param {Buffer} m
 * @return {Buffer|String|Object}
 */

function unzip(f, m) {
  m = m.slice(1);

  if(f === formats.STRING) return m.toString();
  if(f === formats.BUFFER) return m;
  return JSON.parse(m.toString());
}

/**
 * Adds or removes a client from the `peers` array
 *
 * @param {Array} peers
 * @param {Number} format
 * @param {Object} info
 */

function manage(peers, format, info) {
  var i = 0,
      len = peers.length,
      connect = format === formats.CONNECT;

  for(; i < len; i = i + 1) {
    if(peers[i].address === info.address && peers[i].port === info.port) {
      if(!connect) peers.splice(i, 1);
      return;
    }
  }

  peers.push({address: info.address, port: info.port});
  return;
}