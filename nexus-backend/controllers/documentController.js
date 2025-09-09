import Document from '../models/Document.js';
import User from '../models/User.js';
import Meeting from '../models/Meeting.js';
import { upload, /*uploadToS3, generatePresignedUrl, deleteFromS3*/ } from '../utils/fileUpload.js';
import { uploadToLocal } from '../utils/localUpload.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const documentsDir = path.join(__dirname, '../uploads/documents');
if (!fs.existsSync(documentsDir)) fs.mkdirSync(documentsDir, { recursive: true });




// ✅ Upload document(s)
export const uploadDocument = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      associatedMeeting, 
      associatedUsers = [], 
      tags = [],
      expiresAt 
    } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const uploadedDocuments = [];

    for (let file of req.files) {
      // Save file to local /uploads/documents
      const documentsDir = path.join(__dirname, '../uploads/documents');
      if (!fs.existsSync(documentsDir)) fs.mkdirSync(documentsDir, { recursive: true });

      const filePath = path.join(documentsDir, file.originalname);
      fs.writeFileSync(filePath, file.buffer);

      const fileUrl = `/uploads/documents/${file.originalname}`; // public URL

      // Generate thumbnail for images
      let thumbnailUrl = null;
      if (file.mimetype.startsWith('image/')) {
        try {
          const thumbnailsDir = path.join(__dirname, '../uploads/thumbnails');
          if (!fs.existsSync(thumbnailsDir)) fs.mkdirSync(thumbnailsDir, { recursive: true });

          const thumbnailBuffer = await sharp(file.buffer)
            .resize(300, 300, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();

          const thumbPath = path.join(thumbnailsDir, `thumb_${file.originalname}.jpg`);
          fs.writeFileSync(thumbPath, thumbnailBuffer);

          thumbnailUrl = `/uploads/thumbnails/thumb_${file.originalname}.jpg`;
        } catch (thumbError) {
          console.error('Thumbnail generation failed:', thumbError);
        }
      }

      // Parse associated users
      let parsedUsers = [];
      if (associatedUsers && typeof associatedUsers === 'string') {
        try { parsedUsers = JSON.parse(associatedUsers); } catch { parsedUsers = []; }
      } else if (Array.isArray(associatedUsers)) parsedUsers = associatedUsers;

      // Parse tags
      let parsedTags = [];
      if (tags && typeof tags === 'string') {
        try { parsedTags = JSON.parse(tags); } catch { parsedTags = tags.split(',').map(tag => tag.trim()); }
      } else if (Array.isArray(tags)) parsedTags = tags;

      // Save document record
      const document = new Document({
        name: name || file.originalname,
        originalName: file.originalname,
        description,
        fileType: path.extname(file.originalname).substring(1).toLowerCase(),
        fileSize: file.size,
        fileUrl,       // ✅ public URL
        thumbnailUrl,
        uploadedBy: req.user._id,
        associatedMeeting: associatedMeeting || null,
        associatedUsers: parsedUsers.map(u => ({
          user: u.userId || u.user,
          permission: u.permission || 'view'
        })),
        tags: parsedTags,
        metadata: { dimensions: file.mimetype.startsWith('image/') ? await getImageDimensions(file.buffer) : undefined },
        expiresAt: expiresAt ? new Date(expiresAt) : null
      });
      await document.save();

      uploadedDocuments.push(document);
    }

    res.status(201).json({
      message: `${uploadedDocuments.length} document(s) uploaded successfully`,
      documents: uploadedDocuments
    });

  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Helper function to get image dimensions


// ✅ Get user's documents
export const getUserDocuments = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      status, 
      fileType, 
      tags, 
      meetingId,
      search 
    } = req.query;

    const userId = req.user._id;
    const skip = (page - 1) * limit;

    // Build query
    const query = {
      $or: [
        { uploadedBy: userId },
        { 'associatedUsers.user': userId },
        { isPublic: true }
      ]
    };

    // Add filters
    if (status) query.status = status;
    if (fileType) query.fileType = fileType;
    if (meetingId) query.associatedMeeting = meetingId;
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }
    if (search) {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
          { tags: { $in: [new RegExp(search, 'i')] } }
        ]
      });
    }

    const documents = await Document.find(query)
      .populate('uploadedBy', 'name email avatar')
      .populate('associatedUsers.user', 'name email avatar')
      .populate('associatedMeeting', 'title startTime')
      .populate('signatures.signedBy', 'name email avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalDocuments = await Document.countDocuments(query);

    // Add signature status for each document
    const documentsWithStatus = documents.map(doc => {
      const docObj = doc.toObject();
      docObj.signatureStatus = doc.getSignatureStatus();
      docObj.userPermission = doc.hasPermission(userId, 'edit') ? 'edit' : 
                             doc.hasPermission(userId, 'sign') ? 'sign' : 'view';
      return docObj;
    });

    res.json({
      documents: documentsWithStatus,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalDocuments / limit),
        totalDocuments,
        hasMore: skip + documents.length < totalDocuments
      }
    });

  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get document details with access URL
export const getDocumentById = async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.user._id;

    const document = await Document.findById(documentId)
      .populate('uploadedBy', 'name email avatar')
      .populate('associatedUsers.user', 'name email avatar')
      .populate('associatedMeeting', 'title startTime')
      .populate('signatures.signedBy', 'name email avatar');

    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check permissions
    if (!document.hasPermission(userId)) {
      return res.status(403).json({ message: 'You do not have permission to access this document' });
    }

    // Generate presigned URL for file access
    const s3Key = document.fileUrl.split('/').slice(-2).join('/'); // Extract key from URL
    const accessUrl = await generatePresignedUrl(s3Key, 3600); // 1 hour

    // Generate thumbnail access URL if exists
    let thumbnailAccessUrl = null;
    if (document.thumbnailUrl) {
      const thumbnailKey = document.thumbnailUrl.split('/').slice(-2).join('/');
      thumbnailAccessUrl = await generatePresignedUrl(thumbnailKey, 3600);
    }

    // Update last accessed time and download count
    document.lastAccessedAt = new Date();
    document.downloadCount += 1;
    await document.save();

    const documentResponse = {
      ...document.toObject(),
      accessUrl,
      thumbnailAccessUrl,
      signatureStatus: document.getSignatureStatus(),
      userPermission: document.hasPermission(userId, 'edit') ? 'edit' : 
                     document.hasPermission(userId, 'sign') ? 'sign' : 'view'
    };

    res.json({ document: documentResponse });

  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Add electronic signature
export const addSignature = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { signatureImage, coordinates } = req.body;
    const userId = req.user._id;

    if (!signatureImage) {
      return res.status(400).json({ message: 'Signature image is required' });
    }

    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check if user has signing permission
    if (!document.hasPermission(userId, 'sign')) {
      return res.status(403).json({ message: 'You do not have permission to sign this document' });
    }

    // Check if user has already signed
    const existingSignature = document.signatures.find(
      sig => sig.signedBy.toString() === userId.toString()
    );

    if (existingSignature) {
      return res.status(400).json({ message: 'You have already signed this document' });
    }

    // Upload signature image to S3
    const signatureBuffer = Buffer.from(signatureImage.split(',')[1], 'base64');
    const signatureFile = {
      buffer: signatureBuffer,
      originalname: `signature_${userId}_${Date.now()}.png`,
      mimetype: 'image/png'
    };

    const s3Result = await uploadToS3(signatureFile, 'signatures');

    // Add signature to document
    const signature = {
      signedBy: userId,
      signatureImageUrl: s3Result.url,
      signedAt: new Date(),
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      signatureData: {
        hash: generateSignatureHash(document._id, userId, s3Result.url),
        coordinates: coordinates || { x: 0, y: 0, width: 100, height: 50, page: 1 }
      }
    };

    document.signatures.push(signature);

    // Update document status if all required signatures are collected
    const signatureStatus = document.getSignatureStatus();
    if (signatureStatus.isComplete) {
      document.status = 'signed';
    }

    await document.save();

    await document.populate([
      { path: 'uploadedBy', select: 'name email avatar' },
      { path: 'signatures.signedBy', select: 'name email avatar' }
    ]);

    res.json({
      message: 'Document signed successfully',
      document: {
        ...document.toObject(),
        signatureStatus: document.getSignatureStatus()
      }
    });

  } catch (error) {
    console.error('Add signature error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Share document with users
export const shareDocument = async (req, res) => {
  try {
    const { documentId } = req.params;
    const { users, message } = req.body; // users: [{ userId, permission }]
    const userId = req.user._id;

    const document = await Document.findById(documentId);
    if (!document) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // Check if user is owner or has edit permission
    if (!document.hasPermission(userId, 'edit')) {
      return res.status(403).json({ message: 'You do not have permission to share this document' });
    }

    // Add new users (avoid duplicates)
    for (let userShare of users) {
      const existingUser = document.associatedUsers.find(
        au => au.user.toString() === userShare.userId
      );

      if (!existingUser) {
        document.associatedUsers.push({
          user: userShare.userId,
          permission: userShare.permission || 'view',
          addedAt: new Date()
        });
      } else {
        // Update permission if user already exists
        existingUser.permission = userShare.permission || existingUser.permission;
      }
    }

    document.status = 'shared';
    await document.save();

    await document.populate([
      { path: 'uploadedBy', select: 'name email avatar' },
      { path: 'associatedUsers.user', select: 'name email avatar' }
    ]);

    // TODO: Send notification to shared users
    // await sendDocumentShareNotification(document, users, message);

    res.json({
      message: 'Document shared successfully',
      document
    });

  } catch (error) {
    console.error('Share document error:', error);
    res.status(500).json({ message: error.message });
  }
};

// Helper functions
async function getImageDimensions(buffer) {
  try {
    const metadata = await sharp(buffer).metadata();
    return { width: metadata.width, height: metadata.height };
  } catch (error) {
    return null;
  }
}

function generateSignatureHash(documentId, userId, signatureUrl) {
  const crypto = require('crypto');
  const data = `${documentId}${userId}${signatureUrl}${Date.now()}`;
  return crypto.createHash('sha256').update(data).digest('hex');
}