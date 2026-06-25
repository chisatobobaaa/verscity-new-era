const { clearDiscordCookies, createDiscordCookie, exchangeDiscordCode, getDiscordReturnPath, validateState } = require("../lib/discord-auth");

module.exports = async function handler(request, response) {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    if (!code || !validateState(request, state)) {
      throw new Error("State Discord tidak valid. Coba login ulang.");
    }

    const user = await exchangeDiscordCode(request, code);
    const returnTo = getDiscordReturnPath(request);
    response.statusCode = 302;
    response.setHeader("Set-Cookie", [createDiscordCookie(user), ...clearDiscordCookies().slice(1)]);
    response.setHeader("Location", returnTo);
    response.end();
  } catch (error) {
    response.statusCode = 302;
    response.setHeader("Location", `/ucp.html?discord_error=${encodeURIComponent(error.message)}`);
    response.end();
  }
};
