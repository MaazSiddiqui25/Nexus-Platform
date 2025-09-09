import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['deposit', 'withdraw', 'transfer', 'investment', 'refund'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0.01
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'PKR']
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'processing'],
    default: 'pending'
  },
  method: {
    type: String,
    enum: ['stripe_card', 'stripe_bank', 'paypal', 'bank_transfer', 'wallet'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  
  // For transfers between users
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return this.type === 'transfer';
    }
  },
  
  // Payment gateway specific data
  stripePaymentIntentId: String,
  paypalPaymentId: String,
  
  // Bank details for withdrawals
  bankDetails: {
    accountNumber: String,
    routingNumber: String,
    bankName: String,
    accountHolderName: String
  },
  
  // Fee information
  fee: {
    type: Number,
    default: 0
  },
  netAmount: {
    type: Number,
    required: true
  },
  
  // Error details if failed
  errorMessage: String,
  errorCode: String,
  
  // Additional metadata
  metadata: {
    type: Map,
    of: String,
    default: {}
  }
}, {
  timestamps: true
});

// Indexes for better query performance
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ type: 1 });
transactionSchema.index({ stripePaymentIntentId: 1 });

// Virtual for formatted amount
transactionSchema.virtual('formattedAmount').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency
  }).format(this.amount);
});

transactionSchema.set('toJSON', { virtuals: true });

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;