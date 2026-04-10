"use client";

const getApiUrl = () => process.env.NEXT_PUBLIC_API_URL ?? "";

export async function backendFetch(endpoint: string, options: RequestInit = {}) {
  const url = `${getApiUrl()}${endpoint}`;
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> ?? {}),
  };
  const backendToken = typeof window !== "undefined" ? localStorage.getItem("backend_token") : null;
  if (backendToken) {
    headers["Authorization"] = `Bearer ${backendToken}`;
  }
  try {
    const res = await fetch(url, { ...options, headers });
    return res;
  } catch (err: any) {
    console.error("Backend fetch error:", err);
    throw err;
  }
}

export async function backendLogin(email: string, password: string) {
  const formData = new URLSearchParams();
  formData.append("username", email);
  formData.append("password", password);
  const res = await fetch(`${getApiUrl()}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });
  if (!res?.ok) throw new Error("Backend login failed");
  const data = await res.json();
  if (typeof window !== "undefined" && data?.access_token) {
    localStorage.setItem("backend_token", data.access_token);
    if (data?.refresh_token) localStorage.setItem("backend_refresh_token", data.refresh_token);
  }
  return data;
}

export async function backendRegister(email: string, password: string, name: string) {
  const res = await fetch(`${getApiUrl()}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, full_name: name }),
  });
  return res;
}

export function clearBackendTokens() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("backend_token");
    localStorage.removeItem("backend_refresh_token");
  }
}
