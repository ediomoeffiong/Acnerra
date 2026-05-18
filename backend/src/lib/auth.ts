import { SignJWT, jwtVerify } from "jose";

const secretKey = process.env.AUTH_SECRET || "default_secret";
const key = new TextEncoder().encode(secretKey);

export const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

export async function decrypt(input: string): Promise<any> {
  try {
    const { payload } = await jwtVerify(input, key, {
      algorithms: ["HS256"],
    });
    return payload;
  } catch (error) {
    return null;
  }
}
