"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEvidenceFile = exports.getEvidenceFilePath = exports.saveEvidenceFile = exports.sanitizeFilename = exports.MAX_FILE_SIZE = exports.ALLOWED_MIME_TYPES = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const UPLOAD_DIR = path_1.default.resolve(__dirname, '../../uploads/evidence');
// Ensure directory exists
if (!fs_1.default.existsSync(UPLOAD_DIR)) {
    fs_1.default.mkdirSync(UPLOAD_DIR, { recursive: true });
}
exports.ALLOWED_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);
exports.MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const sanitizeFilename = (filename) => {
    return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
};
exports.sanitizeFilename = sanitizeFilename;
const saveEvidenceFile = async (buffer, originalFilename, mimeType) => {
    if (!exports.ALLOWED_MIME_TYPES.has(mimeType)) {
        throw new Error('Unsupported file type. Only images, PDFs, and documents are permitted.');
    }
    if (buffer.length > exports.MAX_FILE_SIZE) {
        throw new Error('File exceeds maximum size limit of 10MB.');
    }
    const ext = path_1.default.extname(originalFilename).toLowerCase();
    const safeRandom = crypto_1.default.randomBytes(16).toString('hex');
    const storageKey = `${Date.now()}-${safeRandom}${ext}`;
    const targetPath = path_1.default.join(UPLOAD_DIR, storageKey);
    await fs_1.default.promises.writeFile(targetPath, buffer);
    return {
        storageKey,
        filename: (0, exports.sanitizeFilename)(originalFilename),
        size: buffer.length,
    };
};
exports.saveEvidenceFile = saveEvidenceFile;
const getEvidenceFilePath = (storageKey) => {
    // Prevent directory traversal
    const safeKey = path_1.default.basename(storageKey);
    const targetPath = path_1.default.join(UPLOAD_DIR, safeKey);
    if (fs_1.default.existsSync(targetPath)) {
        return targetPath;
    }
    return null;
};
exports.getEvidenceFilePath = getEvidenceFilePath;
const deleteEvidenceFile = async (storageKey) => {
    const targetPath = (0, exports.getEvidenceFilePath)(storageKey);
    if (targetPath) {
        try {
            await fs_1.default.promises.unlink(targetPath);
            return true;
        }
        catch {
            return false;
        }
    }
    return false;
};
exports.deleteEvidenceFile = deleteEvidenceFile;
