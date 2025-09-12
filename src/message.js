'use strict';

const Buffer = require('buffer').Buffer;
const torrentParser = require('./torrent-parser');

module.exports.buildHandshake = torrent => {
    const buf = Buffer.alloc(68);
    //pstrLen
    buf.writeUInt8(19, 0);
    //pstr
    buf.write('BitTorrent protocol', 1);
    //reserved
    buf.writeUint32BE(0, 20);
    buf.writeUint32BE(0, 24);
    //info hash
    torrentParser.infoHash(torrent).copy(buf,  28);
    //peer id
    buf.write(util.genId());
    return buf;
};