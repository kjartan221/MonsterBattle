// Single API choke-point: absolute base + credentialed cookie, split-origin ready.
const API_BASE = import.meta.env.VITE_API_BASE ?? '';
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, { credentials: 'include', ...init });
}
