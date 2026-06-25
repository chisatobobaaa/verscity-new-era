const { clearDiscordCookies } = require("../lib/discord-auth");
const { sendJson } = require("../lib/http-utils");

module.exports = async function handler(request, response) {
  response.setHeader("Set-Cookie", clearDiscordCookies());
  sendJson(response, 200, { ok: true });
};
