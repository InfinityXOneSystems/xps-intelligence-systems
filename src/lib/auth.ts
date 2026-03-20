export interface User {
  id: string;
  email: string;
  role: "employee" | "sales_staff" | "manager" | "owner" | "admin";
}

export function getUser(): User | null {
  const raw = localStorage.getItem("xps_user");
  if (!raw) return null;
  try { return JSON.parse(raw) as User; } catch { return null; }
}

export function setUser(user: User, token: string): void {
  localStorage.setItem("xps_user", JSON.stringify(user));
  localStorage.setItem("xps_token", token);
}

export function clearAuth(): void {
  localStorage.removeItem("xps_user");
  localStorage.removeItem("xps_token");
}

export function isAuthenticated(): boolean {
  return !!localStorage.getItem("xps_token");
}

export function hasRole(user: User | null, ...roles: User["role"][]): boolean {
  if (!user) return false;
  return roles.includes(user.role);
}
