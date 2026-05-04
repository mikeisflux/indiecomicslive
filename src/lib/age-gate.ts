import { cookies } from "next/headers";

const COOKIE = "age_ok";
const MAX_AGE = 60 * 60 * 24 * 30;

export async function hasAgeGatePassed(): Promise<boolean> {
  const c = await cookies();
  return c.get(COOKIE)?.value === "1";
}

export async function setAgeGatePassed() {
  const c = await cookies();
  c.set(COOKIE, "1", {
    maxAge: MAX_AGE,
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export const AGE_GATE_COOKIE = COOKIE;
