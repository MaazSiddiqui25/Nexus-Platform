import express from 'express';
import {
  uploadDocument,
  getUserDocuments,
  getDocumentById,
  addSignature,
  shareDocument
} from '../controllers/documentController.js';
import { protect } from '../middleware/authMiddleware.js';
import { upload } from '../utils/fileUpload.js';

const router = express.Router();

// All routes are protected
router.use(protect);

// ✅ POST /api/documents/upload - Upload document(s)
// router/documents.js
router.post('/upload', upload.array('documents', 10), uploadDocument);



// ✅ GET /api/documents - Get user's documents
router.get('/', getUserDocuments);

// ✅ GET /api/documents/:documentId - Get document details
router.get('/:documentId', getDocumentById);

// ✅ POST /api/documents/:documentId/signature - Add e-signature
router.post('/:documentId/signature', addSignature);

// ✅ POST /api/documents/:documentId/share - Share document
router.post('/:documentId/share', shareDocument);

export default router;