const crypto = require("crypto");

const DISCORD_COOKIE = "verscity_discord";
const DISCORD_STATE_COOKIE = "verscity_discord_state";
const DISCORD_RETURN_COOKIE = "verscity_discord_return";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const DISCORD_API = "https://discord.com/api/v10";

function getBaseUrl(request) {
  return process.env.PUBLIC_BASE_URL || `http://${request.headers.host}`;
}

function getRedirectUri(request) {
  return process.env.DISCORD_REDIRECT_URI || `${getBaseUrl(request).replace(/\/$/, "")}/api/discord-callback`;
}

function getDiscordConfig() {
  return {
    clientId: process.env.DISCORD_CLIENT_ID || "",
    clientSecret: process.env.DISCORD_CLIENT_SECRET || ""
  };
}

function parseCookies(request) {
  return String(request.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((cookies, part) => {
      const index = part.indexOf("=");
      if (index === -1) return cookies;
      cookies[part.slice(0, index)] = decodeURIComponent(part.slice(index + 1));
      return cookies;
    }, {});
}

function cookie(name, value, maxAge, httpOnly = true) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const httpOnlyPart = httpOnly ? "; HttpOnly" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=${maxAge}${httpOnlyPart}${secure}`;
}

function sign(value) {
  const secret = process.env.DISCORD_COOKIE_SECRET || process.env.ADMIN_SECRET || "verscity-discord";
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

function makeSession(discordUser) {
  const payload = Buffer.from(JSON.stringify({
    id: discordUser.id,
    username: discordUser.username,
    globalName: discordUser.global_name || discordUser.username,
    avatar: discordUser.avatar || "",
    exp: Date.now() + COOKIE_MAX_AGE_SECONDS * 1000
  })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function readDiscordSession(request) {
  const token = parseCookies(request)[DISCORD_COOKIE];
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || signature !== sign(payload)) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.id || Number(data.exp) <= Date.now()) return null;
    return data;
  } catch (error) {
    return null;
  }
}

function avatarUrl(user) {
  if (!user || !user.avatar) return "";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`;
}

function makeDiscordLoginUrl(request) {
  const { clientId } = getDiscordConfig();
  if (!clientId) {
    throw new Error("DISCORD_CLIENT_ID belum diisi.");
  }

  const state = crypto.randomBytes(18).toString("hex");
  const requestUrl = new URL(request.url, getBaseUrl(request));
  const returnTo = requestUrl.searchParams.get("return") || "/ucp.html";
  const safeReturnTo = returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/ucp.html";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(request),
    response_type: "code",
    scope: "identify",
    state,
    prompt: "consent"
  });

  return {
    url: `https://discord.com/oauth2/authorize?${params.toString()}`,
    cookies: [
      cookie(DISCORD_STATE_COOKIE, state, 10 * 60),
      cookie(DISCORD_RETURN_COOKIE, safeReturnTo, 10 * 60)
    ]
  };
}

async function exchangeDiscordCode(request, code) {
  const { clientId, clientSecret } = getDiscordConfig();
  if (!clientId || !clientSecret) {
    throw new Error("DISCORD_CLIENT_ID dan DISCORD_CLIENT_SECRET wajib diisi.");
  }

  const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(request)
    })
  });

  const token = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !token.access_token) {
    throw new Error(token.error_description || token.error || "Login Discord gagal.");
  }

  const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
    headers: {
      Authorization: `Bearer ${token.access_token}`
    }
  });
  const user = await userResponse.json().catch(() => ({}));
  if (!userResponse.ok || !user.id) {
    throw new Error("Gagal mengambil akun Discord.");
  }

  return user;
}

function validateState(request, state) {
  return Boolean(state && parseCookies(request)[DISCORD_STATE_COOKIE] === state);
}

function createDiscordCookie(user) {
  return cookie(DISCORD_COOKIE, makeSession(user), COOKIE_MAX_AGE_SECONDS);
}

function clearDiscordCookies() {
  return [
    cookie(DISCORD_COOKIE, "", 0),
    cookie(DISCORD_STATE_COOKIE, "", 0),
    cookie(DISCORD_RETURN_COOKIE, "", 0)
  ];
}

function getDiscordReturnPath(request) {
  const returnTo = parseCookies(request)[DISCORD_RETURN_COOKIE] || "/ucp.html";
  return returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/ucp.html";
}

module.exports = {
  avatarUrl,
  clearDiscordCookies,
  createDiscordCookie,
  exchangeDiscordCode,
  getDiscordReturnPath,
  makeDiscordLoginUrl,
  readDiscordSession,
  validateState
};
