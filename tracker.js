'use strict'

const dgram = require('dgram')
const Buffer = require('buffer').Buffer;
const urlParse = require('url').parse;
const crypto = require('crypto');
const { buffer } = require('stream/consumers');

module.exports.getPeers = (torrent, callback) => {
    const socket = dgram.createSocket('udp4');
    const url = torrent.announce.toString('utf8');

    //1. send connect request
    udpSend(socket, buildConnReq(), url);

    socket.on('message', response => {
        if (respType(response) === 'connect') {
            //2. recieve and parse connect response
            const connResp = parseConnResp(response);
            //3. send announce request
            const announceReq = buildAnnounceReq(connResp.connection.id);
            udpSend(socket, announceReq, url);
        } else if (respType(response) === 'announce') {
            //4. parse announce request
            const announceResp = parseAnnounceResp(response);
            //5. pass peers to callback
            callback(announceResp.peers);
        }
    });
};

function udpSend(socket, message, rawUrl, callback=()=>{}) {
    const url = urlParse(rawUrl);
    socket.send(message, 0, message.length, url.port, url.host, callback);
}

function respType(resp) {
  // ...
}

function buildConnReq() {
  const buf = Buffer.alloc(16);

  // connection id
  buf.writeUInt32BE(0x417, 0);
  buf.writeUint32BE(0x27101980, 4);
  // action
  buf.writeUint32BE(0, 8);
  // transaction id
  crypto.randomBytes(4).copy(buf, 12);

  return buf;
}

function parseConnResp(resp) {
  return{
    action: resp.readUInt32BE(0),
    transactionId: resp.readUInt32BE(4),
    connectionId: resp.slice(8)
  }
}

function buildAnnounceReq(connId) {
  // ...
}

function parseAnnounceResp(resp) {
  // ...
}