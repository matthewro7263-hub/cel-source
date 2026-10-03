import http from "http";
http.createServer((req, res) => {
  let body = ""; req.on("data", c => body += c); req.on("end", () => {
    const j = JSON.parse(body);
    // Vision requests (image_url parts) are the asset auto-tagger; "mock/text-only" rejects them like a non-vision model would.
    const last = j.messages?.[j.messages.length - 1];
    if (Array.isArray(last?.content)) {
      res.setHeader("content-type", "application/json");
      if (j.model === "mock/text-only") { res.statusCode = 400; return res.end(JSON.stringify({ error: { message: "model does not support image input" } })); }
      const name = last.content.find((p) => p.type === "text")?.text ?? "";
      return res.end(JSON.stringify({ choices: [{ message: { content: 'Sure! ```json\n{"tags": ["Mock Tag", "cartoon", "' + name.replace(/^File name:\s*/, "").replace(/[^a-z]/gi, "").slice(0, 8).toLowerCase() + '"]}\n```' } }] }));
    }
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
