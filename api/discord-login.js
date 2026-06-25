const { makeDiscordLoginUrl } = require("../lib/discord-auth");

module.exports = async function handler(request, response) {
  try {
    const login = makeDiscordLoginUrl(request);
    response.statusCode = 302;
    response.setHeader("Set-Cookie", login.cookies);
    response.setHeader("Location", login.url);
    response.end();
  } catch (error) {
    response.statusCode = 500;
    response.setHeader("Content-Type", "text/plain; charset=utf-8");
    response.end(error.message);
  }
};
