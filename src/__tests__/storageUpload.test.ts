import { describe, it, expect } from "vitest";
import {
  resolveFileMimeType,
  isAllowedFileType,
  getFileType,
  formatFileSize,
} from "@/lib/storageUpload";

describe("storageUpload helpers", () => {
  it("normalizes image/jpg and empty mimeType from filename extension", () => {
    expect(resolveFileMimeType({ name: "photo.JPG", type: "image/jpg" })).toBe("image/jpeg");
    expect(resolveFileMimeType({ name: "IMG_001.HEIC", type: "" })).toBe("image/heic");
    expect(resolveFileMimeType({ name: "scan.png", type: "" })).toBe("image/png");
    expect(resolveFileMimeType({ name: "doc.pdf", type: "" })).toBe("application/pdf");
    expect(resolveFileMimeType({ name: "unknown.bin", type: "" })).toBe("application/octet-stream");
  });

  it("allows normalized image and document types and classifies image vs file", () => {
    const heicMime = resolveFileMimeType({ name: "photo.heic", type: "" });
    expect(isAllowedFileType(heicMime)).toBe(true);
    expect(getFileType(heicMime)).toBe("image");

    expect(isAllowedFileType("application/pdf")).toBe(true);
    expect(getFileType("application/pdf")).toBe("file");
    expect(isAllowedFileType("application/octet-stream")).toBe(false);
  });

  it("formats file size cleanly", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe("2.5 MB");
  });
});
