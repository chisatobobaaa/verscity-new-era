const crypto = require("crypto");

const COOKIE_NAME = "verscity_admin";
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASS = process.env.ADMIN_PASS || "verscity123";
const ADMIN_SECRET = process.env.ADMIN_SECRET || `${ADMIN_USER}:${ADMIN_PASS}:verscity`;
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function base64Url(value) {
  return Buffer.from(value).toString("base64url");
}

function sign(value) {
  return crypto.createHmac("sha256", ADMIN_SECRET).update(value).digest("base64url");
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

function makeCookie(value, maxAge = SESSION_MAX_AGE_SECONDS) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE_NAME}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

function createAdminCookie(username, password) {
  if (username !== ADMIN_USER || password !== ADMIN_PASS) return "";

  const payload = base64Url(JSON.stringify({
    user: username,
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  }));
  return makeCookie(`${payload}.${sign(payload)}`);
}

function clearAdminCookie() {
  return makeCookie("", 0);
}

function isAdminRequest(request) {
  const token = parseCookies(request)[COOKIE_NAME];
  if (!token) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature || signature !== sign(payload)) return false;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.user === ADMIN_USER && Number(data.exp) > Date.now();
  } catch (error) {
    return false;
  }
}

module.exports = {
  createAdminCookie,
  clearAdminCookie,
  isAdminRequest
};
