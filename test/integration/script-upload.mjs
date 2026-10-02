import { call, check, summary, base } from "./lib.mjs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

// Build a minimal .docx (zip of three XML parts) and a PDF using repo dependencies only.
async function makeDocx(text) {
  const archiver = require("archiver");
  const chunks = [];
  const zip = archiver("zip");
  zip.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve) => zip.on("end", resolve));
  zip.append('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>', { name: "[Content_Types].xml" });
  zip.append('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>', { name: "_rels/.rels" });
  zip.append(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`, { name: "word/document.xml" });
  await zip.finalize(); await done;
  return Buffer.concat(chunks);
}
function makePdf(text) {
  const { jsPDF } = require("jspdf");
  const pdf = new jsPDF(); pdf.text(text, 10, 10);
  return Buffer.from(pdf.output("arraybuffer"));
}

const login = await call("POST", "/api/auth/login", { email: "matthew@cel.app", password: "celdemo" });
const token = login.json.token;
const pid = (await call("GET", "/api/projects", undefined, token)).json[0].id;

const upload = async (name, mime, buf) => {
  const fd = new FormData(); fd.append("file", new Blob([buf], { type: mime }), name);
  const res = await fetch(`${base}/api/projects/${pid}/scripts/upload`, { method: "POST", headers: { authorization: "Bearer " + token }, body: fd });
  return { status: res.status, json: await res.json() };
};

let r = await upload("s.md", "text/markdown", Buffer.from("# Title\n\nSome *markdown* script."));
check("markdown upload", r.status === 200 && r.json.content.includes("markdown* script"), r);
r = await upload("s.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", await makeDocx("Bingo searches for Floppy"));
check("docx upload", r.status === 200 && r.json.content.includes("Bingo searches"), r);
r = await upload("s.pdf", "application/pdf", makePdf("Hello from a PDF script"));
check("pdf upload (no page markers)", r.status === 200 && r.json.content.includes("Hello from a PDF script") && !/-- \d+ of \d+ --/.test(r.json.content), r);
check("upload does not require R2", r.json.originalKey === null || typeof r.json.originalKey === "string", r);
r = await upload("x.png", "image/png", Buffer.from("x"));
check("png rejected", r.status === 400, r);

const list = await call("GET", `/api/projects/${pid}/scripts`, undefined, token);
check("script list includes content (editor reads it)", list.json.every((s) => typeof s.content === "string"), list.json.map((s) => Object.keys(s)));

process.exit(summary() ? 1 : 0);
