import type { Destination } from "@/design";

export function isTabRoot(pathname: string, id: Destination): boolean {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (id === "home") return path === "/" || path === "/index";
  if (id === "accounts") return path === "/accounts";
  if (id === "transactions") return path === "/transactions";
  if (id === "budget") return path === "/budget";
  if (id === "plan") return path === "/plan";
  if (id === "more") return path === "/more";
  return false;
}

/** Phone bar only on the four tab roots — not Settings or other nested pages. */
export function showPhoneBar(pathname: string): boolean {
  return isTabRoot(pathname, activeFromPath(pathname));
}

export function activeFromPath(pathname: string): Destination {
  if (pathname.includes("transactions")) return "transactions";
  // Only the Budget tab itself: Plan's own budget screens live under /plan.
  if (pathname === "/budget" || pathname.startsWith("/budget/")) return "budget";
  if (pathname.includes("/plan")) return "plan";
  if (pathname.includes("accounts")) return "accounts";
  if (pathname.includes("more")) return "more";
  return "home";
}
