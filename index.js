'use strict'

const fs = require('fs');
const bencode = require('bencode')
const tracker = require('./tracker');
const torrentParser = require('./torrent-parser');

const torrent = torrentParser.open('puppy.torrent');
// override dead tracker:
torrent.announce = Buffer.from('udp://tracker.opentrackr.org:1337/announce');
console.log('[index] opened torrent, announce =', torrent.announce.toString('utf8'));

tracker.getPeers(torrent, peers => {
    console.log('list of peers: ', peers);
});