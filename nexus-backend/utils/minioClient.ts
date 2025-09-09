import * as Minio from 'minio';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Local MinIO-like setup (simulates S3)
const minioClient = new Minio.Client({
  endPoint: 'localhost',
  port: 9000,
  useSSL: false,
  accessKey: 'minioadmin',
  secretKey: 'minioadmin'
});

export const uploadToMinio = async (file, folder = 'documents') => {
  const objectName = `${folder}/${uuidv4()}${path.extname(file.originalname)}`;

  // Save locally
  const localFolder = path.join(__dirname, '..', 'uploads', folder);
  if (!fs.existsSync(localFolder)) fs.mkdirSync(localFolder, { recursive: true });

  const filePath = path.join(localFolder, path.basename(objectName));
  fs.writeFileSync(filePath, file.buffer);

  const url = `/uploads/${folder}/${path.basename(objectName)}`;
  return { url, objectName };
};
