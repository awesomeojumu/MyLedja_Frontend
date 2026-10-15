import type { Destination } from "../design";

export function activeFromPath(pathname: string): Destination {
  if (pathname.includes("transactions")) return "transactions";
  if (pathname.includes("/plan")) return "plan";
  if (pathname.includes("accounts")) return "accounts";
  if (pathname.includes("more")) return "more";
  return "home";
}
