const { avatarUrl, readDiscordSession } = require("../lib/discord-auth");
const { sendJson } = require("../lib/http-utils");

module.exports = async function handler(request, response) {
  const user = readDiscordSession(request);
  if (!user) {
    sendJson(response, 200, { ok: true, user: null });
    return;
  }

  sendJson(response, 200, {
    ok: true,
    user: {
      id: user.id,
      username: user.username,
      globalName: user.globalName,
      avatar: avatarUrl(user)
    }
  });
};
