import { areas, type Listing } from "@/functions/catalog";
import { amenityInfo, highlightIcons } from "@/components/icons";

const BASE = "/functions/v1/app/api/admin";
const MAX_JSON_BYTES = 4 * 1024 * 1024;
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type AdminPhoto = Listing["photos"][number] & { caption?: string };
export type AdminListing = Listing & { photos: AdminPhoto[] };
export type AdminProperty = { listing: AdminListing; published: boolean; version: number };

const messages = {
  admin_not_configured: "Setup required. Configure the private administrator password in Site Settings.",
  login_required: "Your session has expired. Sign in again to continue.",
  forbidden: "Access was denied. Check your private password or sign in again.",
  invalid_input: "Some details are invalid. Check the fields and try again.",
  payload_too_large: "This request is too large. Photos must be no larger than 5 MiB.",
  write_conflict: "This property changed elsewhere. Your edits are preserved; reload the current record before saving.",
  idempotency_conflict: "This request conflicts with an earlier operation. Reload the current record before continuing.",
  upload_pending: "The upload is not ready. It has not been added to your gallery.",
  invalid_upload: "The photo could not be accepted. Choose a JPEG, PNG or WebP file no larger than 5 MiB.",
  service_unavailable: "The service is temporarily unavailable. Please check again later.",
  too_many_attempts: "Too many attempts. Please wait before trying again.",
  network_error: "The request could not be confirmed. Check your connection and reload before repeating a write.",
  invalid_response: "The service returned an unexpected response. Reload before repeating a write.",
  request_failed: "The request could not be completed. Please check again later.",
} as const;

export type AdminErrorCode = keyof typeof messages;

export class AdminApiError extends Error {
  readonly code: AdminErrorCode;
  readonly status: number;
  readonly uncertain: boolean;

  constructor(code: string, status = 0, uncertain = false) {
    const safeCode = Object.prototype.hasOwnProperty.call(messages, code) ? code as AdminErrorCode : "request_failed";
    super(messages[safeCode]);
    this.name = "AdminApiError";
    this.code = safeCode;
    this.status = status;
    this.uncertain = uncertain;
  }
}

type RequestOptions = { method?: "GET" | "POST" | "PATCH" | "DELETE"; body?: unknown; requestId?: string };
type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);
const isText = (value: unknown, max = 12000): value is string => typeof value === "string" && value.length <= max;
const isNumber = (value: unknown, min: number, max: number, integer = false): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value));
const optional = (value: unknown, valid: (value: unknown) => boolean) => value === undefined || valid(value);
const isArray = (value: unknown, max: number, valid: (item: unknown) => boolean): value is unknown[] =>
  Array.isArray(value) && value.length <= max && value.every(valid);
const hasKey = (object: object, key: unknown) => typeof key === "string" && Object.prototype.hasOwnProperty.call(object, key);
export const isAdminSlug = (value: string) => value.length <= 100 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);

// Reject protocol-relative URLs, backslashes and encoded path separators before URL normalization.
export function isSameOriginPath(value: unknown): value is string {
  if (!isText(value, 8192) || !/^\/(?!\/)/.test(value) || /[\\\s\u0000-\u001f\u007f]/.test(value)) return false;
  // Signed query parameters can legitimately contain encoded slashes; only inspect the path.
  if (/%(?:2f|5c|00|0a|0d)/i.test(value.split(/[?#]/, 1)[0])) return false;
  try {
    return new URL(value, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

const isHttpsUrl = (value: unknown) => {
  if (!isText(value, 2048)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
};
const isPhoto = (value: unknown) => isObject(value) && isSameOriginPath(value.src) && isText(value.alt, 300) && optional(value.caption, (v) => isText(v, 1000));

function isListing(value: unknown): value is AdminListing {
  if (!isObject(value)) return false;
  return isText(value.slug, 100) && isAdminSlug(value.slug)
    && isText(value.name, 120) && value.name.trim().length > 0
    && typeof value.type === "string" && ["Apartment", "Penthouse", "Portion"].includes(value.type)
    && areas.some((area) => area.id === value.area)
    && isText(value.locality, 200) && isText(value.address, 400) && isText(value.mapQuery, 400)
    && optional(value.floor, (v) => isText(v, 200))
    && isNumber(value.bedrooms, 0, 20, true) && isNumber(value.bathrooms, 1, 20, true)
    && optional(value.beds, (v) => isNumber(v, 1, 50, true))
    && optional(value.maxGuests, (v) => isNumber(v, 1, 50, true))
    && isText(value.summary, 1000)
    && isArray(value.about, 12, (v) => isText(v, 4000))
    && isArray(value.space, 30, (v) => isText(v, 500))
    && isArray(value.amenities, 18, (v) => hasKey(amenityInfo, v))
    && isArray(value.highlights, 8, (v) => isObject(v) && hasKey(highlightIcons, v.icon) && isText(v.title, 100) && isText(v.text, 500))
    && optional(value.sleeping, (v) => isArray(v, 20, (row) => isObject(row) && isText(row.room, 100) && isText(row.beds, 300)))
    && optional(value.safetyNotes, (v) => isArray(v, 20, (row) => isText(row, 500)))
    && optional(value.airbnb, (v) => isObject(v) && isHttpsUrl(v.url) && isNumber(v.rating, 0, 5) && isNumber(v.reviews, 0, 100000, true) && typeof v.guestFavourite === "boolean")
    && isArray(value.photos, 30, isPhoto);
}

const isProperty = (value: unknown): value is AdminProperty =>
  isObject(value) && isListing(value.listing) && typeof value.published === "boolean" && isNumber(value.version, 0, Number.MAX_SAFE_INTEGER, true);

function validateRequest(path: string, method: string, body: unknown, requestId?: string) {
  const slug = "[a-z0-9]+(?:-[a-z0-9]+)*";
  const recordPath = new RegExp(`^/properties/${slug}$`);
  const uploadPath = new RegExp(`^/properties/${slug}/uploads$`);
  const completePath = /^\/uploads\/[a-zA-Z0-9_-]+\/complete$/;
  let valid = false;
  if (method === "GET") valid = (path === "/session" || path === "/properties") && body === undefined;
  if (method === "POST" && path === "/login") valid = isObject(body) && isText(body.password, 1024) && body.password.length > 0;
  if (method === "POST" && (path === "/logout" || completePath.test(path))) valid = isObject(body) && Object.keys(body).length === 0;
  if ((method === "POST" && path === "/properties") || (method === "PATCH" && recordPath.test(path))) {
    valid = isObject(body) && isListing(body.listing) && typeof body.published === "boolean"
      && (!body.published || (body.listing.photos.length > 0 && body.listing.about.length > 0
        && body.listing.locality.trim().length > 0 && body.listing.address.trim().length > 0
        && body.listing.mapQuery.trim().length > 0 && body.listing.summary.trim().length > 0))
      && (method !== "PATCH" || (isNumber(body.version, 0, Number.MAX_SAFE_INTEGER, true) && path === `/properties/${body.listing.slug}`));
  }
  if (method === "DELETE" && recordPath.test(path)) valid = isObject(body) && isNumber(body.version, 0, Number.MAX_SAFE_INTEGER, true);
  if (method === "POST" && uploadPath.test(path)) {
    valid = isObject(body) && isText(body.filename, 255) && body.filename.length > 0
      && isNumber(body.size, 1, MAX_PHOTO_BYTES, true) && PHOTO_MIME_TYPES.some((mime) => mime === body.mimeType);
  }
  if (!valid) throw new AdminApiError("invalid_input");
  if (requestId !== undefined && !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) throw new AdminApiError("invalid_input");
  if (method === "POST" && (path === "/properties" || uploadPath.test(path)) && !requestId) throw new AdminApiError("invalid_input");
}

function validateResponse(path: string, method: string, value: unknown): boolean {
  if (!isObject(value)) return false;
  if (path === "/session") return typeof value.authenticated === "boolean" && typeof value.configured === "boolean";
  if (path === "/login") return value.authenticated === true;
  if (path === "/logout") return value.authenticated === false;
  if (path === "/properties" && method === "GET") return isArray(value.properties, 2000, isProperty);
  if (method === "DELETE") return value.deleted === true;
  if (path.endsWith("/complete")) return isPhoto(value.photo);
  if (path.endsWith("/uploads")) return isText(value.id, 200) && /^[a-zA-Z0-9_-]+$/.test(value.id) && isSameOriginPath(value.signedUrl);
  return isProperty(value.property) && (path === "/properties" || path === `/properties/${value.property.listing.slug}`);
}

async function readJson(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") || "";
  if (!/^application\/(?:json|[a-z0-9!#$&^_.+-]+\+json)(?:\s*;|$)/i.test(contentType) || !response.body) throw new AdminApiError("invalid_response");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.byteLength;
      if (bytes > MAX_JSON_BYTES) {
        await reader.cancel();
        throw new AdminApiError("invalid_response");
      }
      text += decoder.decode(result.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof AdminApiError) throw error;
    throw new AdminApiError("invalid_response");
  } finally {
    reader.releaseLock();
  }
}

function statusCode(status: number): AdminErrorCode {
  if (status === 401) return "login_required";
  if (status === 403) return "forbidden";
  if (status === 409) return "write_conflict";
  if (status === 413) return "payload_too_large";
  if (status === 429) return "too_many_attempts";
  if (status >= 500) return "service_unavailable";
  return "request_failed";
}

/** Single attempt only. All error text is fixed locally; no server message is exposed. */
export async function adminRequest<T>(path: string, { method = "GET", body, requestId }: RequestOptions = {}): Promise<T> {
  validateRequest(path, method, body, requestId);
  const write = method !== "GET";
  let serialized: string | undefined;
  try {
    serialized = body === undefined ? undefined : JSON.stringify(body);
  } catch {
    throw new AdminApiError("invalid_input");
  }
  if (serialized && new TextEncoder().encode(serialized).byteLength > MAX_JSON_BYTES) throw new AdminApiError("payload_too_large");
  let response: Response;
  try {
    response = await fetch(BASE + path, {
      method,
      body: serialized,
      credentials: "same-origin",
      redirect: "error",
      cache: "no-store",
      headers: { Accept: "application/json", ...(serialized !== undefined ? { "Content-Type": "application/json" } : {}), ...(requestId ? { "idempotency-key": requestId } : {}) },
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new AdminApiError("network_error", 0, write);
  }
  let value: unknown;
  try {
    value = await readJson(response);
  } catch {
    if (!response.ok) throw new AdminApiError(statusCode(response.status), response.status, write && (response.status === 408 || response.status >= 500));
    throw new AdminApiError("invalid_response", response.status, write);
  }
  if (!response.ok) {
    const code = isObject(value) && isObject(value.error) && typeof value.error.code === "string" ? value.error.code
      : isObject(value) && typeof value.code === "string" ? value.code
      : isObject(value) && typeof value.error === "string" ? value.error : statusCode(response.status);
    throw new AdminApiError(code, response.status, write && (response.status === 408 || response.status >= 500));
  }
  if (!validateResponse(path, method, value)) throw new AdminApiError("invalid_response", response.status, write);
  return value as T;
}

/** Reserve, PUT, complete: none of these requests is retried automatically. */
export async function uploadPhoto(slug: string, file: File): Promise<AdminPhoto> {
  if (!isAdminSlug(slug) || !PHOTO_MIME_TYPES.some((mime) => mime === file.type) || file.size < 1 || file.size > MAX_PHOTO_BYTES || file.name.length > 255) throw new AdminApiError("invalid_upload");
  const upload = await adminRequest<{ id: string; signedUrl: string }>(`/properties/${slug}/uploads`, {
    method: "POST",
    requestId: crypto.randomUUID(),
    body: { filename: file.name, size: file.size, mimeType: file.type },
  });
  if (!isSameOriginPath(upload.signedUrl)) throw new AdminApiError("invalid_upload");
  let response: Response;
  try {
    response = await fetch(upload.signedUrl, {
      method: "PUT",
      credentials: "same-origin",
      redirect: "error",
      headers: { "Content-Type": file.type },
      body: file,
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new AdminApiError("network_error", 0, true);
  }
  if (!response.ok) throw new AdminApiError(response.status === 413 ? "payload_too_large" : "invalid_upload", response.status, response.status >= 500);
  const result = await adminRequest<{ photo: AdminPhoto }>(`/uploads/${upload.id}/complete`, { method: "POST", body: {} });
  return result.photo;
}
