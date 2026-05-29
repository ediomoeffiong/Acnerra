"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authMiddleware = void 0;
const auth_1 = require("../lib/auth");
const authMiddleware = async (req, res, next) => {
    let session = req.cookies.session;
    if (!session) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            session = authHeader.substring(7);
        }
        else if (authHeader) {
            session = authHeader;
        }
    }
    if (!session) {
        return res.status(401).json({ message: "No session found. Please log in." });
    }
    const payload = await (0, auth_1.decrypt)(session);
    if (!payload) {
        return res.status(401).json({ message: "Invalid or expired session. Please log in again." });
    }
    // Attach user info to request
    req.user = payload;
    next();
};
exports.authMiddleware = authMiddleware;
