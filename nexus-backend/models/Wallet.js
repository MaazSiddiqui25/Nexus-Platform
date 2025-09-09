import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  currency: {
    type: String,
    default: 'USD',
    enum: ['USD', 'EUR', 'GBP', 'PKR']
  },
  
  // For investment tracking
  totalInvested: {
    type: Number,
    default: 0
  },
  totalWithdrawn: {
    type: Number,
    default: 0
  },
  totalDeposited: {
    type: Number,
    default: 0
  },
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  isFrozen: {
    type: Boolean,
    default: false
  },
  
  // KYC verification status
  isVerified: {
    type: Boolean,
    default: false
  },
  
  // Daily/Monthly limits
  dailyWithdrawLimit: {
    type: Number,
    default: 1000
  },
  monthlyWithdrawLimit: {
    type: Number,
    default: 10000
  },
  
  // Track daily/monthly usage
  dailyWithdrawn: {
    amount: { type: Number, default: 0 },
    date: { type: Date, default: Date.now }
  },
  monthlyWithdrawn: {
    amount: { type: Number, default: 0 },
    month: { type: Number, default: () => new Date().getMonth() },
    year: { type: Number, default: () => new Date().getFullYear() }
  }
}, {
  timestamps: true
});

// Reset daily limit if it's a new day
walletSchema.pre('save', function(next) {
  const today = new Date();
  const lastWithdrawDate = new Date(this.dailyWithdrawn.date);
  
  if (today.toDateString() !== lastWithdrawDate.toDateString()) {
    this.dailyWithdrawn.amount = 0;
    this.dailyWithdrawn.date = today;
  }
  
  // Reset monthly limit if it's a new month
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  if (currentMonth !== this.monthlyWithdrawn.month || currentYear !== this.monthlyWithdrawn.year) {
    this.monthlyWithdrawn.amount = 0;
    this.monthlyWithdrawn.month = currentMonth;
    this.monthlyWithdrawn.year = currentYear;
  }
  
  next();
});

// Methods
walletSchema.methods.canWithdraw = function(amount) {
  if (!this.isActive || this.isFrozen) return false;
  if (amount > this.balance) return false;
  if (amount > (this.dailyWithdrawLimit - this.dailyWithdrawn.amount)) return false;
  if (amount > (this.monthlyWithdrawLimit - this.monthlyWithdrawn.amount)) return false;
  return true;
};

walletSchema.methods.addBalance = function(amount, type = 'deposit') {
  this.balance += amount;
  
  if (type === 'deposit') {
    this.totalDeposited += amount;
  }
  
  return this.save();
};

walletSchema.methods.deductBalance = function(amount, type = 'withdraw') {
  if (!this.canWithdraw(amount)) {
    throw new Error('Insufficient balance or limit exceeded');
  }
  
  this.balance -= amount;
  
  if (type === 'withdraw') {
    this.totalWithdrawn += amount;
    this.dailyWithdrawn.amount += amount;
    this.monthlyWithdrawn.amount += amount;
  } else if (type === 'investment') {
    this.totalInvested += amount;
  }
  
  return this.save();
};

// Virtual for formatted balance
walletSchema.virtual('formattedBalance').get(function() {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: this.currency
  }).format(this.balance);
});

walletSchema.set('toJSON', { virtuals: true });

const Wallet = mongoose.model('Wallet', walletSchema);

export default Wallet;