import { ApiError, apiRequest, getAuthToken } from "./queryClient";

/** Where an uploaded panel image ended up: R2 (preferred) or inline base64 when R2 isn't configured. */
export type UploadedImage = { r2Key: string; imageData?: undefined } | { imageData: string; r2Key?: undefined };

// Remember a 503 from /api/uploads/presign so a batch doesn't retry the cloud path per file.
let cloudStorageUnavailable = false;

function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

async function convertHeic(file: File): Promise<UploadedImage> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch("/api/uploads/convert-heic", {
    method: "POST",
    headers: { Authorization: `Bearer ${getAuthToken() ?? ""}` },
    body: formData,
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error ?? "HEIC conversion failed");
  return body.key ? { r2Key: body.key } : { imageData: body.imageData };
}

/**
 * Upload one image for a storyboard panel. Uses a presigned R2 PUT when cloud storage is
 * configured and transparently falls back to inline base64 when it isn't (local/self-hosted).
 */
export async function uploadPanelImage(file: File): Promise<UploadedImage> {
  if (/\.hei[cf]$/i.test(file.name)) return convertHeic(file);

  if (!cloudStorageUnavailable) {
    try {
      const presignRes = await apiRequest("POST", "/api/uploads/presign", {
        filename: file.name,
        contentType: file.type || "image/png",
      });
      const { url, key, headers } = await presignRes.json();
      const upload = await fetch(url, { method: "PUT", headers: headers || {}, body: file });
      if (!upload.ok) throw new Error("Cloud storage upload failed");
      return { r2Key: key };
    } catch (err) {
      if (!(err instanceof ApiError && err.status === 503)) throw err;
      cloudStorageUnavailable = true;
    }
  }
  return { imageData: await readAsDataUrl(file) };
}
