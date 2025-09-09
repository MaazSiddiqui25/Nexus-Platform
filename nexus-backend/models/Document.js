import mongoose from 'mongoose';

const documentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  originalName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    trim: true
  },
  fileType: {
    type: String,
    required: true,
    enum: ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'gif']
  },
  fileSize: {
    type: Number,
    required: true
  },
  fileUrl: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  associatedMeeting: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Meeting'
  },
  associatedUsers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    permission: {
      type: String,
      enum: ['view', 'edit', 'sign'],
      default: 'view'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['draft', 'shared', 'signed', 'completed', 'archived'],
    default: 'draft'
  },
  version: {
    type: Number,
    default: 1
  },
  parentDocument: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  },
  signatures: [{
    signedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    signatureImageUrl: {
      type: String,
      required: true
    },
    signedAt: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String,
    signatureData: {
      // For digital signature verification
      hash: String,
      coordinates: {
        x: Number,
        y: Number,
        width: Number,
        height: Number,
        page: Number
      }
    }
  }],
  metadata: {
    pageCount: Number,
    wordCount: Number,
    dimensions: {
      width: Number,
      height: Number
    }
  },
  tags: [String],
  isPublic: {
    type: Boolean,
    default: false
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  lastAccessedAt: Date,
  expiresAt: Date
}, {
  timestamps: true
});
documentSchema.index({ uploadedBy: 1, createdAt: -1 });
documentSchema.index({ associatedMeeting: 1 });
documentSchema.index({ status: 1 });
documentSchema.index({ tags: 1 });
documentSchema.index({ 'associatedUsers.user': 1 });

// Virtual for file extension
documentSchema.virtual('fileExtension').get(function() {
  return this.originalName.split('.').pop().toLowerCase();
});

// Method to check if user has permission
documentSchema.methods.hasPermission = function(userId, permission = 'view') {
  // Owner has all permissions
  if (this.uploadedBy.toString() === userId.toString()) {
    return true;
  }

  // Check associated users
  const userPermission = this.associatedUsers.find(
    au => au.user.toString() === userId.toString()
  );

  if (!userPermission) return false;

  const permissionLevels = { view: 1, edit: 2, sign: 3 };
  return permissionLevels[userPermission.permission] >= permissionLevels[permission];
};

// Method to get signature status
documentSchema.methods.getSignatureStatus = function() {
  const requiredSigners = this.associatedUsers.filter(au => au.permission === 'sign');
  const actualSignatures = this.signatures;

  return {
    required: requiredSigners.length,
    completed: actualSignatures.length,
    pending: requiredSigners.filter(rs => 
      !actualSignatures.some(sig => sig.signedBy.toString() === rs.user.toString())
    ),
    isComplete: requiredSigners.length > 0 && actualSignatures.length === requiredSigners.length
  };
};

const Document = mongoose.model('Document', documentSchema);
export default Document;
