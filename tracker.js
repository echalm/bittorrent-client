'use strict'

const dgram = require('dgram')
const Buffer = require('buffer').Buffer;
const urlParse = require('url').parse;

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
        }
    })
}