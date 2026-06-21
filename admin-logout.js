const { clearAdminCookie } = require("../lib/admin-auth");

module.exports = function handler(request, response) {
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("Set-Cookie", clearAdminCookie());
  response.end(JSON.stringify({ ok: true }));
};
