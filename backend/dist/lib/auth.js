"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SESSION_DURATION = void 0;
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const jose_1 = require("jose");
const secretKey = process.env.AUTH_SECRET || "default_secret";
const key = new TextEncoder().encode(secretKey);
exports.SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
async function encrypt(payload) {
    return await new jose_1.SignJWT(payload)
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(key);
}
async function decrypt(input) {
    try {
        const { payload } = await (0, jose_1.jwtVerify)(input, key, {
            algorithms: ["HS256"],
        });
        return payload;
    }
    catch (error) {
        return null;
    }
}
