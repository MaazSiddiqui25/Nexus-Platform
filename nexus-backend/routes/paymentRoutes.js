import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import Transaction from '../models/Payment.js';
import Wallet from '../models/Wallet.js';


import {
  createDeposit,
  confirmDeposit,
  createWithdrawal,
  createTransfer,
  getTransactionHistory,
  getWallet,
  getPaymentMethods,
  handleStripeWebhook
} from '../controllers/paymentController.js';

const router = express.Router();

// ✅ Public Routes
// Stripe webhook (needs to be before express.json() middleware)
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook);

// Get available payment methods (public)
router.get('/methods', getPaymentMethods);

// ✅ Protected Routes (require authentication)
// Wallet management
router.get('/wallet', protect, getWallet);

// Deposit operations
router.post('/deposit', protect, createDeposit);
router.post('/deposit/confirm', protect, confirmDeposit);

// Withdrawal operations
router.post('/withdraw', protect, createWithdrawal);

// Transfer operations
router.post('/transfer', protect, createTransfer);

// Transaction history
router.get('/transactions', protect, getTransactionHistory);

// Get specific transaction
router.get('/transactions/:id', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      $or: [{ userId }, { recipientId: userId }]
    })
      .populate('userId', 'name email')
      .populate('recipientId', 'name email');

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json({
      success: true,
      transaction
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Cancel pending transaction
router.patch('/transactions/:id/cancel', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const transaction = await Transaction.findOne({
      _id: req.params.id,
      userId,
      status: 'pending'
    });

    if (!transaction) {
      return res.status(404).json({ 
        message: 'Transaction not found or cannot be cancelled' 
      });
    }

    transaction.status = 'cancelled';
    await transaction.save();

    // Refund if amount was already deducted (for withdrawals)
    if (transaction.type === 'withdraw') {
      const wallet = await Wallet.findOne({ userId });
      if (wallet) {
        await wallet.addBalance(transaction.amount, 'refund');
      }
    }

    res.json({
      success: true,
      message: 'Transaction cancelled successfully',
      transaction
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get transaction statistics
router.get('/stats', protect, async (req, res) => {
  try {
    const userId = req.user._id;
    const { period = '30' } = req.query; // days

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    const stats = await Transaction.aggregate([
      {
        $match: {
          userId: userId,
          createdAt: { $gte: startDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: '$type',
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      }
    ]);

    const formattedStats = {
      period: `${period} days`,
      summary: {
        totalDeposits: 0,
        totalWithdrawals: 0,
        totalTransfers: 0,
        depositCount: 0,
        withdrawalCount: 0,
        transferCount: 0
      }
    };

    stats.forEach(stat => {
      switch (stat._id) {
        case 'deposit':
          formattedStats.summary.totalDeposits = stat.totalAmount;
          formattedStats.summary.depositCount = stat.count;
          break;
        case 'withdraw':
          formattedStats.summary.totalWithdrawals = stat.totalAmount;
          formattedStats.summary.withdrawalCount = stat.count;
          break;
        case 'transfer':
          formattedStats.summary.totalTransfers = stat.totalAmount;
          formattedStats.summary.transferCount = stat.count;
          break;
      }
    });

    res.json({
      success: true,
      stats: formattedStats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;