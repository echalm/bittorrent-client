'use strict';

const dgram = require('dgram');
const { Buffer } = require('buffer');
const { parse: urlParse } = require('url');
const crypto = require('crypto');
const torrentParser = require('./torrent-parser');
const util = require('./util');

module.exports.getPeers = (torrent, callback) => {
  const socket = dgram.createSocket('udp4');
  const announceUrl = torrent.announce.toString('utf8');
  const url = urlParse(announceUrl);

  // Fallback if port missing (some torrents omit it)
  const port = url.port ? Number(url.port) : 80;
  const host = url.hostname;

  console.log('[tracker] announce URL:', announceUrl);
  console.log('[tracker] parsed host/port:', host, port);

  let timeout = setTimeout(() => {
    console.error('[tracker] No UDP response from tracker after 7s. ' +
                  'Firewall/AV or malformed request are the usual causes.');
    try { socket.close(); } catch {}
  }, 7000);

  socket.on('listening', () => {
    const addr = socket.address();
    console.log(`[tracker] UDP socket listening on ${addr.address}:${addr.port}`);
  });

  socket.on('error', (err) => {
    console.error('[tracker] socket error:', err && err.message || err);
    try { socket.close(); } catch {}
  });

  socket.on('message', (resp) => {
    console.log('[tracker] received UDP packet len=', resp.length);
    const action = resp.readUInt32BE(0);
    console.log('[tracker] action:', action === 0 ? 'connect' : action === 1 ? 'announce' : action);

    if (action === 0) {
      // CONNECT RESPONSE
      const connResp = parseConnResp(resp);
      console.log('[tracker] connectionId:', connResp.connectionId.toString('hex'));

      const announceReq = buildAnnounceReq(connResp.connectionId, torrent);
      console.log('[tracker] sending ANNOUNCE...');
      udpSend(socket, announceReq, host, port);

    } else if (action === 1) {
      // ANNOUNCE RESPONSE
      clearTimeout(timeout);
      const announceResp = parseAnnounceResp(resp);
      console.log('[tracker] peers found:', announceResp.peers.length);
      callback(announceResp.peers);
      try { socket.close(); } catch {}
    }
  });

  // Bind so we can see which local port we’re using (and Windows firewall can allow it)
  socket.bind(0, () => {
    // 1) send CONNECT request after bind
    const connReq = buildConnReq();
    console.log('[tracker] sending CONNECT...');
    udpSend(socket, connReq, host, port);
  });
};

// ---- helpers ----

function udpSend(socket, message, host, port, cb = () => {}) {
  socket.send(message, 0, message.length, port, host, (err) => {
    if (err) console.error('[tracker] send error:', err.message || err);
    cb(err);
  });
}

function buildConnReq() {
  const buf = Buffer.allocUnsafe(16);
  // protocol id: 0x41727101980 split across two 32-bit words
  buf.writeUInt32BE(0x417, 0);
  buf.writeUInt32BE(0x27101980, 4);
  // action (connect)
  buf.writeUInt32BE(0, 8);
  // transaction id
  crypto.randomBytes(4).copy(buf, 12);
  return buf;
}

function parseConnResp(resp) {
  return {
    action: resp.readUInt32BE(0),
    transactionId: resp.readUInt32BE(4),
    connectionId: resp.slice(8, 16),
  };
}

function buildAnnounceReq(connectionId, torrent) {
  const infoHash  = torrentParser.infoHash(torrent); // 20 bytes
  const peerId    = util.genId();                    // 20 bytes
  const downloaded = Buffer.alloc(8);                // 0
  const left       = torrentParser.size(torrent);    // 8 bytes total size
  const uploaded   = Buffer.alloc(8);                // 0
  const event = 0;                                   // none
  const ip = 0;                                      // tracker determines
  const key = crypto.randomBytes(4).readUInt32BE(0);
  const numWant = 0xFFFFFFFF;                        // request default
  const port = 6881;                                 // placeholder client port

  const buf = Buffer.allocUnsafe(98);

  // connection id (8)
  connectionId.copy(buf, 0);
  // action (announce)
  buf.writeUInt32BE(1, 8);
  // transaction id
  crypto.randomBytes(4).copy(buf, 12);
  // info_hash (20)
  infoHash.copy(buf, 16);
  // peer_id (20)
  peerId.copy(buf, 36);
  // downloaded (8)
  downloaded.copy(buf, 56);
  // left (8)
  left.copy(buf, 64);
  // uploaded (8)
  uploaded.copy(buf, 72);
  // event (4) @80
  buf.writeUInt32BE(event, 80);
  // ip address (4) @84
  buf.writeUInt32BE(ip, 84);
  // key (4) @88
  buf.writeUInt32BE(key, 88);
  // num_want (4) @92
  buf.writeUInt32BE(numWant, 92);
  // port (2) @96
  buf.writeUInt16BE(port, 96);

  return buf;
}

function parseAnnounceResp(resp) {
  // action(0), txid(4), interval(8), leechers(12), seeders(16)
  const interval = resp.readUInt32BE(8);
  const leechers = resp.readUInt32BE(12);
  const seeders  = resp.readUInt32BE(16);

  const peersBuf = resp.slice(20);
  const peers = group(peersBuf, 6).map(addr => ({
    ip: Array.from(addr.slice(0, 4)).join('.'),
    port: addr.readUInt16BE(4),
  }));

  return { interval, leechers, seeders, peers };
}

function group(buf, size) {
  const out = [];
  for (let i = 0; i < buf.length; i += size) out.push(buf.slice(i, i + size));
  return out;
}
