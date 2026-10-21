import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const UPLOAD_DIR = path.resolve(__dirname, '../../uploads/evidence');

// Ensure directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const sanitizeFilename = (filename: string): string => {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
};

export const saveEvidenceFile = async (
  buffer: Buffer,
  originalFilename: string,
  mimeType: string
): Promise<{ storageKey: string; filename: string; size: number }> => {
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error('Unsupported file type. Only images, PDFs, and documents are permitted.');
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error('File exceeds maximum size limit of 10MB.');
  }

  const ext = path.extname(originalFilename).toLowerCase();
  const safeRandom = crypto.randomBytes(16).toString('hex');
  const storageKey = `${Date.now()}-${safeRandom}${ext}`;
  const targetPath = path.join(UPLOAD_DIR, storageKey);

  await fs.promises.writeFile(targetPath, buffer);

  return {
    storageKey,
    filename: sanitizeFilename(originalFilename),
    size: buffer.length,
  };
};

export const getEvidenceFilePath = (storageKey: string): string | null => {
  // Prevent directory traversal
  const safeKey = path.basename(storageKey);
  const targetPath = path.join(UPLOAD_DIR, safeKey);
  if (fs.existsSync(targetPath)) {
    return targetPath;
  }
  return null;
};

export const deleteEvidenceFile = async (storageKey: string): Promise<boolean> => {
  const targetPath = getEvidenceFilePath(storageKey);
  if (targetPath) {
    try {
      await fs.promises.unlink(targetPath);
      return true;
    } catch {
      return false;
    }
  }
  return false;
};
