'use strict';

const net = require('net');
const Buffer = require('buffer').Buffer;
const tracker = require('./tracker');
const message = require('./message');
const { Handler } = require('leaflet');

module.exports = torrent => {
    tracker.getPeers(torrent, peers => {
        // 1
        peers.forEach(peer => download(peer, torrent));
    });
};

function download(peer) {   
    const socket = net.Socket();
    socket.on('error', console.log);
    socket.connect(peer.port, peer.ip, () => {
        // 1
        socket.write(message.buildHandshake(torrent))
    });
    // 2
    onWholeMsg(socket, msg => msgHandler(msg, socket));
}

// create msgHandler here

// create isHandshake here

function onWholeMsg(socket, callback){
    let savedBuf = Buffer.alloc(0);
    let handshake = true;

    socket.on('data', recvBuf => {
        //calculates length of message
        const msgLen = () => handshake ? savedBuf.readUInt8(0) + 49 : savedBuf.readInt32BE(0) + 4;
        savedBuf = Buffer.concat([savedBuf, recvBuf]);

        while (savedBuf.lenght >= 4 && savedBuf.length >= msgLen()){
            callback(savedBuf.slice(0, msgLen()));
            savedBuf = savedBuf.slice(msgLen());
            handshake = false;
        }
    });
}