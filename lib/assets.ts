const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/** Prefix public assets when the app is served from a sub-path (e.g. GitHub project pages). */
export const asset = (src: string) =>
  BASE && src.startsWith("/") && !src.startsWith("/functions/") ? `${BASE}${src}` : src;
