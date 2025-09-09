import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

// Fix __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simulates S3 upload locally
export const uploadToLocal = async (file, folder = 'documents') => {
  const objectName = `${folder}/${uuidv4()}${path.extname(file.originalname)}`;

  const uploadDir = path.join(__dirname, '..', 'uploads', folder);
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, path.basename(objectName));
  fs.writeFileSync(filePath, file.buffer);

  const url = `/uploads/${folder}/${path.basename(objectName)}`; // accessible from frontend
  return { url, objectName };
};
