import http from "http";
http.createServer((req, res) => {
  let body = ""; req.on("data", c => body += c); req.on("end", () => {
    const j = JSON.parse(body);
    if (!j.stream) { res.setHeader("content-type","application/json"); return res.end(JSON.stringify({ choices: [{ message: { content: "mock feedback" } }] })); }
    res.setHeader("content-type", "text/event-stream");
    const ev = (o) => `data: ${JSON.stringify(o)}\n\n`;
    const full = ev({ choices: [{ delta: { content: "Hello " } }] }) + ev({ choices: [{ delta: { content: "world" } }] }) +
      ev({ choices: [{ delta: { tool_calls: [{ index: 0, id: "t1", function: { name: "edit_script_passage", arguments: '{"original_text":"a",' } }] } }] }) +
      ev({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"replacement_text":"b"}' } }] } }] }) + "data: [DONE]\n\n";
    // split into awkward 7-byte chunks to exercise buffering
    let i = 0; const t = setInterval(() => { if (i >= full.length) { clearInterval(t); res.end(); return; } res.write(full.slice(i, i + 7)); i += 7; }, 2);
  });
}).listen(Number(process.env.MOCK_PORT ?? 5099), "127.0.0.1");
