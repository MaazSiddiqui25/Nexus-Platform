import dotenv from 'dotenv';
dotenv.config();

// Add this validation
if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is required. Please check your .env file.');
}
import Stripe from 'stripe';
import Transaction from '../models/Payment.js';
import Wallet from '../models/Wallet.js';
import User from '../models/User.js';

// Initialize Stripe with test key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20', // specify latest API version
});

// Helper function to calculate fees
const calculateFee = (amount, type, method) => {
  let feeRate = 0;
  
  switch (method) {
    case 'stripe_card':
      feeRate = 0.029; // 2.9% + 30¢
      return Math.max(amount * feeRate + 0.30, 0.30);
    case 'stripe_bank':
      feeRate = 0.008; // 0.8%
      return amount * feeRate;
    case 'paypal':
      feeRate = 0.034; // 3.4% + 30¢
      return Math.max(amount * feeRate + 0.30, 0.30);
    case 'bank_transfer':
      return type === 'withdraw' ? 5.00 : 0; // $5 withdrawal fee
    default:
      return 0;
  }
};

// ✅ Create Payment Intent (Deposit)
export const createDeposit = async (req, res) => {
  try {
    const { amount, currency = 'USD', method = 'stripe_card' } = req.body;
    const userId = req.user._id;

    // Validate amount
    if (!amount || amount < 1) {
      return res.status(400).json({ message: 'Amount must be at least $1' });
    }

    // Calculate fee
    const fee = calculateFee(amount, 'deposit', method);
    const netAmount = amount - fee;

    // Create transaction record
    const transaction = new Transaction({
      userId,
      type: 'deposit',
      amount,
      currency,
      method,
      description: `Deposit via ${method}`,
      fee,
      netAmount,
      status: 'pending'
    });

    let paymentIntent = null;

    if (method.startsWith('stripe')) {
      // Create Stripe Payment Intent
      paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        payment_method_types: method === 'stripe_card' ? ['card'] : ['us_bank_account'],
        metadata: {
          userId: userId.toString(),
          transactionId: transaction._id.toString(),
          type: 'deposit'
        }
      });

      transaction.stripePaymentIntentId = paymentIntent.id;
    }

    await transaction.save();

    res.status(201).json({
      success: true,
      transaction: {
        id: transaction._id,
        amount,
        fee,
        netAmount,
        status: transaction.status,
        method
      },
      ...(paymentIntent && {
        paymentIntent: {
          id: paymentIntent.id,
          client_secret: paymentIntent.client_secret
        }
      })
    });

  } catch (error) {
    console.error('Deposit creation error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Confirm Deposit (Stripe Webhook or Manual)
export const confirmDeposit = async (req, res) => {
  try {
    const { transactionId, paymentIntentId } = req.body;

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Verify with Stripe if payment intent exists
    if (paymentIntentId) {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        transaction.status = 'failed';
        transaction.errorMessage = 'Payment not completed';
        await transaction.save();
        return res.status(400).json({ message: 'Payment not completed' });
      }
    }

    // Find or create wallet
    let wallet = await Wallet.findOne({ userId: transaction.userId });
    if (!wallet) {
      wallet = new Wallet({ userId: transaction.userId });
    }

    // Add balance to wallet
    await wallet.addBalance(transaction.netAmount, 'deposit');
    
    // Update transaction status
    transaction.status = 'completed';
    await transaction.save();

    res.json({
      success: true,
      message: 'Deposit completed successfully',
      newBalance: wallet.balance
    });

  } catch (error) {
    console.error('Deposit confirmation error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Create Withdrawal Request
export const createWithdrawal = async (req, res) => {
  try {
    const { amount, method = 'bank_transfer', bankDetails } = req.body;
    const userId = req.user._id;

    // Get user wallet
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({ message: 'Wallet not found' });
    }

    // Calculate fee
    const fee = calculateFee(amount, 'withdraw', method);
    const totalDeducted = amount + fee;
    const netAmount = amount;

    // Check if withdrawal is allowed
    if (!wallet.canWithdraw(totalDeducted)) {
      return res.status(400).json({ 
        message: 'Insufficient balance or withdrawal limit exceeded',
        availableBalance: wallet.balance,
        dailyRemaining: wallet.dailyWithdrawLimit - wallet.dailyWithdrawn.amount,
        monthlyRemaining: wallet.monthlyWithdrawLimit - wallet.monthlyWithdrawn.amount
      });
    }

    // Validate bank details for bank transfers
    if (method === 'bank_transfer' && (!bankDetails || !bankDetails.accountNumber)) {
      return res.status(400).json({ message: 'Bank details required for bank transfer' });
    }

    // Create transaction
    const transaction = new Transaction({
      userId,
      type: 'withdraw',
      amount: totalDeducted,
      currency: wallet.currency,
      method,
      description: `Withdrawal via ${method}`,
      fee,
      netAmount,
      status: 'processing',
      bankDetails: method === 'bank_transfer' ? bankDetails : undefined
    });

    // Deduct from wallet
    await wallet.deductBalance(totalDeducted, 'withdraw');
    await transaction.save();

    // In a real app, you'd integrate with actual payment processors here
    // For now, we'll simulate processing
    setTimeout(async () => {
      try {
        const tx = await Transaction.findById(transaction._id);
        // Simulate 90% success rate
        tx.status = Math.random() > 0.1 ? 'completed' : 'failed';
        
        if (tx.status === 'failed') {
          // Refund to wallet if failed
          await wallet.addBalance(totalDeducted, 'refund');
          tx.errorMessage = 'Bank transfer failed - insufficient funds';
        }
        
        await tx.save();
      } catch (error) {
        console.error('Background withdrawal processing error:', error);
      }
    }, 5000); // Simulate 5 second processing time

    res.status(201).json({
      success: true,
      message: 'Withdrawal request created',
      transaction: {
        id: transaction._id,
        amount: totalDeducted,
        netAmount,
        fee,
        status: transaction.status,
        estimatedCompletion: '1-3 business days'
      },
      remainingBalance: wallet.balance
    });

  } catch (error) {
    console.error('Withdrawal creation error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Transfer Between Users
export const createTransfer = async (req, res) => {
  try {
    const { recipientEmail, amount, description = 'Transfer' } = req.body;
    const userId = req.user._id;

    // Find recipient
    const recipient = await User.findOne({ email: recipientEmail });
    if (!recipient) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    if (recipient._id.toString() === userId.toString()) {
      return res.status(400).json({ message: 'Cannot transfer to yourself' });
    }

    // Get sender wallet
    const senderWallet = await Wallet.findOne({ userId });
    if (!senderWallet || senderWallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    // Find or create recipient wallet
    let recipientWallet = await Wallet.findOne({ userId: recipient._id });
    if (!recipientWallet) {
      recipientWallet = new Wallet({ userId: recipient._id });
      await recipientWallet.save();
    }

    // Create transaction
    const transaction = new Transaction({
      userId,
      recipientId: recipient._id,
      type: 'transfer',
      amount,
      currency: senderWallet.currency,
      method: 'wallet',
      description,
      fee: 0, // No fee for transfers
      netAmount: amount,
      status: 'completed'
    });

    // Perform transfer
    await senderWallet.deductBalance(amount, 'transfer');
    await recipientWallet.addBalance(amount, 'transfer');
    await transaction.save();

    res.json({
      success: true,
      message: 'Transfer completed successfully',
      transaction: {
        id: transaction._id,
        recipient: recipient.name,
        amount,
        status: 'completed'
      },
      remainingBalance: senderWallet.balance
    });

  } catch (error) {
    console.error('Transfer error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get Transaction History
export const getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { 
      page = 1, 
      limit = 10, 
      type, 
      status, 
      startDate, 
      endDate 
    } = req.query;

    // Build query
    const query = {
      $or: [
        { userId },
        { recipientId: userId } // Include transfers received
      ]
    };

    if (type) query.type = type;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Execute query with pagination
    const transactions = await Transaction.find(query)
      .populate('userId', 'name email')
      .populate('recipientId', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(query);

    res.json({
      success: true,
      transactions,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Transaction history error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get Wallet Details
export const getWallet = async (req, res) => {
  try {
    const userId = req.user._id;

    let wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      wallet = new Wallet({ userId });
      await wallet.save();
    }

    // Get recent transactions
    const recentTransactions = await Transaction.find({
      $or: [{ userId }, { recipientId: userId }]
    })
      .populate('userId', 'name')
      .populate('recipientId', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      wallet: {
        balance: wallet.balance,
        formattedBalance: wallet.formattedBalance,
        currency: wallet.currency,
        totalDeposited: wallet.totalDeposited,
        totalWithdrawn: wallet.totalWithdrawn,
        totalInvested: wallet.totalInvested,
        limits: {
          dailyWithdraw: wallet.dailyWithdrawLimit,
          monthlyWithdraw: wallet.monthlyWithdrawLimit,
          dailyRemaining: wallet.dailyWithdrawLimit - wallet.dailyWithdrawn.amount,
          monthlyRemaining: wallet.monthlyWithdrawLimit - wallet.monthlyWithdrawn.amount
        },
        status: {
          isActive: wallet.isActive,
          isFrozen: wallet.isFrozen,
          isVerified: wallet.isVerified
        }
      },
      recentTransactions
    });

  } catch (error) {
    console.error('Wallet fetch error:', error);
    res.status(500).json({ message: error.message });
  }
};

// ✅ Get Payment Methods
export const getPaymentMethods = async (req, res) => {
  try {
    const methods = [
      {
        id: 'stripe_card',
        name: 'Credit/Debit Card',
        type: 'card',
        fee: '2.9% + $0.30',
        processingTime: 'Instant',
        supported: ['deposit'],
        icon: '💳'
      },
      {
        id: 'stripe_bank',
        name: 'Bank Account (ACH)',
        type: 'bank',
        fee: '0.8%',
        processingTime: '1-3 business days',
        supported: ['deposit'],
        icon: '🏦'
      },
      {
        id: 'paypal',
        name: 'PayPal',
        type: 'paypal',
        fee: '3.4% + $0.30',
        processingTime: 'Instant',
        supported: ['deposit', 'withdraw'],
        icon: '📱'
      },
      {
        id: 'bank_transfer',
        name: 'Wire Transfer',
        type: 'wire',
        fee: '$5 (withdrawals only)',
        processingTime: '1-3 business days',
        supported: ['deposit', 'withdraw'],
        icon: '💸'
      },
      {
        id: 'wallet',
        name: 'Nexus Wallet',
        type: 'internal',
        fee: 'Free',
        processingTime: 'Instant',
        supported: ['transfer'],
        icon: '👛'
      }
    ];

    res.json({
      success: true,
      methods
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✅ Stripe Webhook Handler
export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      await confirmDeposit({
        body: {
          paymentIntentId: paymentIntent.id,
          transactionId: paymentIntent.metadata.transactionId
        }
      }, { json: () => {} });
      break;

    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      const failedTransaction = await Transaction.findById(failedPayment.metadata.transactionId);
      if (failedTransaction) {
        failedTransaction.status = 'failed';
        failedTransaction.errorMessage = 'Payment failed';
        await failedTransaction.save();
      }
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
};