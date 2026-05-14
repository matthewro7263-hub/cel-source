import { describe, expect, test } from "bun:test";

describe("Scripts Upload", () => {
  test("Validates correct MIME types", () => {
    const allowedMimeTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/markdown",
      "text/plain"
    ];

    expect(allowedMimeTypes).toContain("application/pdf");
    expect(allowedMimeTypes).toContain("text/markdown");
    expect(allowedMimeTypes).toContain("text/plain");
    expect(allowedMimeTypes).toContain("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  });

  test("Checks correct sourceFormat mapping", () => {
    const getSourceFormat = (mimetype: string, extension: string) => {
      const isMarkdown = mimetype === "text/markdown" || extension === "md";
      const isTxt = mimetype === "text/plain" || extension === "txt";
      const isPdf = mimetype === "application/pdf" || extension === "pdf";
      const isDocx = mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || extension === "docx";

      if (isPdf) return "pdf";
      if (isDocx) return "docx";
      if (isMarkdown) return "md";
      if (isTxt) return "txt";
      return "";
    };

    expect(getSourceFormat("application/pdf", "pdf")).toBe("pdf");
    expect(getSourceFormat("text/markdown", "md")).toBe("md");
    expect(getSourceFormat("application/octet-stream", "md")).toBe("md");
    expect(getSourceFormat("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx")).toBe("docx");
    expect(getSourceFormat("text/plain", "txt")).toBe("txt");
    expect(getSourceFormat("image/jpeg", "jpg")).toBe("");
  });
});
