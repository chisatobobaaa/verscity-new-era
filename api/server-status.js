const dgram = require("dgram");
const dns = require("dns").promises;

const SAMP_HOST = process.env.SAMP_HOST || "127.0.0.1";
const SAMP_PORT = Number(process.env.SAMP_PORT || 7777);

function readString(buffer, offset) {
  const length = buffer.readUInt32LE(offset);
  const start = offset + 4;
  const end = start + length;
  return {
    value: buffer.toString("latin1", start, end),
    offset: end
  };
}

async function resolveIpv4(host) {
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return host;
  const records = await dns.lookup(host, { family: 4 });
  return records.address;
}

async function querySampServer(host, port, timeoutMs = 1400) {
  const ip = await resolveIpv4(host);
  const ipParts = ip.split(".").map(Number);
  const packet = Buffer.alloc(11);
  packet.write("SAMP", 0, "ascii");
  ipParts.forEach((part, index) => packet.writeUInt8(part, 4 + index));
  packet.writeUInt16LE(port, 8);
  packet.write("i", 10, "ascii");

  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket("udp4");
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("SA-MP query timeout"));
    }, timeoutMs);

    socket.once("message", (message) => {
      clearTimeout(timer);
      socket.close();

      if (message.length < 20 || message.toString("ascii", 0, 4) !== "SAMP") {
        reject(new Error("Invalid SA-MP query response"));
        return;
      }

      let offset = 11;
      const passworded = Boolean(message.readUInt8(offset));
      offset += 1;
      const players = message.readUInt16LE(offset);
      offset += 2;
      const maxplayers = message.readUInt16LE(offset);
      offset += 2;
      const hostname = readString(message, offset);
      offset = hostname.offset;
      const gamemode = readString(message, offset);
      offset = gamemode.offset;
      const language = readString(message, offset);

      resolve({
        online: true,
        host,
        port,
        passworded,
        players,
        maxplayers,
        hostname: hostname.value,
        gamemode: gamemode.value,
        mapname: "San Andreas",
        language: language.value
      });
    });

    socket.once("error", (error) => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });

    socket.send(packet, port, host);
  });
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

module.exports = async function handler(request, response) {
  try {
    const status = await querySampServer(SAMP_HOST, SAMP_PORT);
    sendJson(response, 200, {
      hostname: status.hostname || "Verscity Roleplay | NewEra",
      mapname: status.mapname || "San Andreas",
      language: status.language || "Bahasa English/Indonesia",
      maxplayers: status.maxplayers || 250,
      ...status
    });
  } catch (error) {
    sendJson(response, 200, {
      online: false,
      host: SAMP_HOST,
      port: SAMP_PORT,
      players: 0,
      maxplayers: 250,
      hostname: "Verscity Roleplay | NewEra",
      gamemode: "VRP 3.0",
      mapname: "San Andreas",
      language: "Bahasa English/Indonesia",
      error: error.message
    });
  }
};
