import { API_URL } from "./config";

export const api = async (endpoint: string, method = "GET", body?: any, token?: string) => {
  const headers: any = {};

  // Only set Content-Type for JSON (not for FormData)
  if (!(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  if (token) headers["Authorization"] = `Bearer ${token}`;

  console.log('API Request:', {
    url: `${API_URL}${endpoint}`,
    method,
    headers: { ...headers, Authorization: token ? 'Bearer ***' : undefined },
    body: body instanceof FormData ? 'FormData' : body
  });

  const res = await fetch(`${API_URL}${endpoint}`, {
    method,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined
  });

  const data = await res.json();

  console.log('API Response:', {
    url: `${API_URL}${endpoint}`,
    ok: res.ok,
    status: res.status,
    data: { ...data, token: data.token ? '***' : undefined }
  });

  if (!res.ok) throw new Error(data.message || "API error");
  return data;
};
