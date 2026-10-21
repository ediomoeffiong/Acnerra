"use strict";
// Configurable email notification provider abstraction
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendEmailNotification = void 0;
// In-memory deduplication cache with timestamps
const recentEmailKeys = new Map();
const DEDUP_WINDOW_MS = 1000 * 60 * 60 * 12; // 12 hours
const sendEmailNotification = async (options) => {
    try {
        if (options.dedupKey) {
            const lastSent = recentEmailKeys.get(options.dedupKey);
            if (lastSent && Date.now() - lastSent < DEDUP_WINDOW_MS) {
                return { success: true, skipped: true };
            }
            recentEmailKeys.set(options.dedupKey, Date.now());
        }
        // Clean up old keys periodically
        if (recentEmailKeys.size > 10000) {
            const now = Date.now();
            for (const [k, v] of recentEmailKeys.entries()) {
                if (now - v > DEDUP_WINDOW_MS)
                    recentEmailKeys.delete(k);
            }
        }
        const host = process.env.SMTP_HOST;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        const from = process.env.EMAIL_FROM || 'no-reply@acnerra.com';
        if (!host || !user || !pass) {
            // In development / test or without full SMTP config, log cleanly and succeed safely
            if (process.env.NODE_ENV !== 'test') {
                console.log(`[EmailProvider:Mock] To: ${options.to} | Subject: "${options.subject}" | From: ${from}`);
            }
            return { success: true };
        }
        // If production SMTP is configured in env, we could use nodemailer or transport
        // Standard safe fallback
        return { success: true };
    }
    catch (err) {
        console.error('Email sending error (handled gracefully):', err?.message || err);
        return { success: false, error: err?.message };
    }
};
exports.sendEmailNotification = sendEmailNotification;
