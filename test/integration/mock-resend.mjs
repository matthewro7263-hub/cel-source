// Stand-in for Resend's POST /emails. Keeps every message so suites can read links back out.
//   GET /__sent      -> all messages so far
//   DELETE /__sent   -> clear
// Recipients starting with "fail-" are rejected, to exercise the "email is down" paths.
import http from "http";
const sent = [];
http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/__sent") {
      if (req.method === "DELETE") { sent.length = 0; return res.end("{}"); }
      return res.end(JSON.stringify(sent));
    }
    if (req.method === "POST" && req.url === "/emails") {
      if (req.headers.authorization !== "Bearer re_test_key") { res.statusCode = 401; return res.end(JSON.stringify({ message: "bad key" })); }
      const mail = JSON.parse(body);
      if (String(mail.to?.[0]).startsWith("fail-")) { res.statusCode = 422; return res.end(JSON.stringify({ message: "rejected" })); }
      sent.push({ ...mail, to: mail.to[0], at: Date.now() });
      return res.end(JSON.stringify({ id: `mock_${sent.length}` }));
    }
    res.statusCode = 404; res.end("{}");
  });
}).listen(Number(process.env.MOCK_MAIL_PORT ?? 5098), "127.0.0.1");
