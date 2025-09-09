import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';
import React, { useState, useEffect } from 'react';
import { 
  CreditCard, 
  DollarSign, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Send, 
  History,
  Wallet,
  AlertCircle,
  CheckCircle,
  Clock,
  X
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import { Button } from '../../components/ui/Button';

interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  fee: string;
  processingTime: string;
  supported: string[];
  icon: string;
}

interface Transaction {
  _id: string;
  type: 'deposit' | 'withdraw' | 'transfer';
  amount: number;
  currency: string;
  method: string;
  description: string;
  fee: number;
  netAmount: number;
  status: 'pending' | 'completed' | 'failed' | 'processing' | 'cancelled';
  createdAt: string;
  userId: {
    name: string;
    email: string;
  };
  recipientId?: {
    name: string;
    email: string;
  };
}

interface WalletData {
  balance: number;
  formattedBalance: string;
  currency: string;
  totalDeposited: number;
  totalWithdrawn: number;
  totalInvested: number;
  limits: {
    dailyWithdraw: number;
    monthlyWithdraw: number;
    dailyRemaining: number;
    monthlyRemaining: number;
  };
  status: {
    isActive: boolean;
    isFrozen: boolean;
    isVerified: boolean;
  };
}

interface Stats {
  period: string;
  summary: {
    totalDeposits: number;
    totalWithdrawals: number;
    totalTransfers: number;
    depositCount: number;
    withdrawalCount: number;
    transferCount: number;
  };
}

type ActiveTab = 'wallet' | 'deposit' | 'withdraw' | 'transfer' | 'history' | 'stats';

const stripePromise = loadStripe('your-publishable-key-here');

export const PaymentsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('wallet');
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  // Form states
  const [depositAmount, setDepositAmount] = useState('');
  const [depositMethod, setDepositMethod] = useState('stripe_card');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawMethod, setWithdrawMethod] = useState('bank_transfer');
  const [transferAmount, setTransferAmount] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [transferDescription, setTransferDescription] = useState('');
  const [bankDetails, setBankDetails] = useState({
    accountNumber: '',
    routingNumber: '',
    accountHolderName: ''
  });

  // Check if user is investor
  const isInvestor = user && (user as any).role === 'investor';

  useEffect(() => {
    if (isInvestor) {
      loadInitialData();
    }
  }, [user, isInvestor]);

  const getToken = () => {
    const token = localStorage.getItem('business_nexus_token');
    if (!token) {
      setError('No authentication token found');
      return null;
    }
    return token;
  };

  const loadInitialData = async () => {
    const token = getToken();
    if (!token) return;

    try {
      setLoading(true);
      setError(null);

      // Load wallet, payment methods, and recent transactions
      const [walletRes, methodsRes, transactionsRes] = await Promise.all([
        api('/payments/wallet', 'GET', undefined, token),
        api('/payments/methods', 'GET'),
        api('/payments/transactions?limit=5', 'GET', undefined, token)
      ]);

      setWallet(walletRes.wallet);
      setPaymentMethods(methodsRes.methods);
      setTransactions(transactionsRes.transactions);

    } catch (err: any) {
      console.error('Failed to load payment data:', err);
      setError(err.message || 'Failed to load payment data');
    } finally {
      setLoading(false);
    }
  };

  const loadTransactionHistory = async () => {
    const token = getToken();
    if (!token) return;

    try {
      setActionLoading(true);
      const response = await api('/payments/transactions', 'GET', undefined, token);
      setTransactions(response.transactions);
    } catch (err: any) {
      setError(err.message || 'Failed to load transactions');
    } finally {
      setActionLoading(false);
    }
  };

  const loadStats = async () => {
    const token = getToken();
    if (!token) return;

    try {
      setActionLoading(true);
      const response = await api('/payments/stats?period=30', 'GET', undefined, token);
      setStats(response.stats);
    } catch (err: any) {
      setError(err.message || 'Failed to load stats');
    } finally {
      setActionLoading(false);
    }
  };
  

// PaymentsPageWrapper should be exported after PaymentsPage component definition, not inside it.

  const handleDeposit = async () => {
    const token = getToken();
    if (!token || !depositAmount) return;

    try {
      setActionLoading(true);
      setError(null);

      const response = await api('/payments/deposit', 'POST', {
        amount: parseFloat(depositAmount),
        currency: 'USD',
        method: depositMethod
      }, token);

      // For demo purposes, auto-confirm the deposit
      if (response.transaction) {
        setTimeout(async () => {
          try {
            await api('/payments/deposit/confirm', 'POST', {
              transactionId: response.transaction.id,
              paymentIntentId: response.paymentIntent?.id
            }, token);
            
            setDepositAmount('');
            loadInitialData();
            alert('Deposit completed successfully!');
          } catch (err) {
            console.error('Deposit confirmation failed:', err);
          }
        }, 2000);
      }

      alert('Deposit initiated successfully!');

    } catch (err: any) {
      setError(err.message || 'Deposit failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async () => {
    const token = getToken();
    if (!token || !withdrawAmount) return;

    try {
      setActionLoading(true);
      setError(null);

      const withdrawData = {
        amount: parseFloat(withdrawAmount),
        method: withdrawMethod,
        ...(withdrawMethod === 'bank_transfer' && { bankDetails })
      };

      await api('/payments/withdraw', 'POST', withdrawData, token);

      setWithdrawAmount('');
      setBankDetails({ accountNumber: '', routingNumber: '', accountHolderName: '' });
      loadInitialData();
      alert('Withdrawal request submitted successfully!');

    } catch (err: any) {
      setError(err.message || 'Withdrawal failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTransfer = async () => {
    const token = getToken();
    if (!token || !transferAmount || !recipientEmail) return;

    try {
      setActionLoading(true);
      setError(null);

      await api('/payments/transfer', 'POST', {
        recipientEmail,
        amount: parseFloat(transferAmount),
        description: transferDescription || 'Transfer'
      }, token);

      setTransferAmount('');
      setRecipientEmail('');
      setTransferDescription('');
      loadInitialData();
      alert('Transfer completed successfully!');

    } catch (err: any) {
      setError(err.message || 'Transfer failed');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="text-green-600" size={16} />;
      case 'pending':
      case 'processing':
        return <Clock className="text-yellow-600" size={16} />;
      case 'failed':
      case 'cancelled':
        return <X className="text-red-600" size={16} />;
      default:
        return <Clock className="text-gray-600" size={16} />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'deposit':
        return <ArrowDownCircle className="text-green-600" size={16} />;
      case 'withdraw':
        return <ArrowUpCircle className="text-red-600" size={16} />;
      case 'transfer':
        return <Send className="text-blue-600" size={16} />;
      default:
        return <DollarSign className="text-gray-600" size={16} />;
    }
  };

  useEffect(() => {
    if (activeTab === 'history' && transactions.length === 0) {
      loadTransactionHistory();
    }
    if (activeTab === 'stats' && !stats) {
      loadStats();
    }
  }, [activeTab]);

  if (!isInvestor) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          <div className="flex items-center">
            <AlertCircle className="mr-2" size={20} />
            <span>Access restricted to investors only.</span>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-gray-600">Manage your wallet and transactions</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-6">
          <div className="flex items-center">
            <AlertCircle className="mr-2" size={20} />
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="border-b">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'wallet', label: 'Wallet', icon: Wallet },
              { id: 'deposit', label: 'Deposit', icon: ArrowDownCircle },
              { id: 'withdraw', label: 'Withdraw', icon: ArrowUpCircle },
              { id: 'transfer', label: 'Transfer', icon: Send },
              { id: 'history', label: 'History', icon: History },
              { id: 'stats', label: 'Stats', icon: DollarSign }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id as ActiveTab)}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Icon className="mr-2" size={16} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'wallet' && wallet && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-lg">
                  <h3 className="text-sm font-medium mb-2">Current Balance</h3>
                  <p className="text-3xl font-bold">{wallet.formattedBalance}</p>
                </div>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Total Deposited</h3>
                  <p className="text-2xl font-bold text-gray-900">${wallet.totalDeposited.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Total Withdrawn</h3>
                  <p className="text-2xl font-bold text-gray-900">${wallet.totalWithdrawn.toFixed(2)}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Withdrawal Limits</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Daily Remaining:</span>
                      <span className="font-medium">${wallet.limits.dailyRemaining.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Monthly Remaining:</span>
                      <span className="font-medium">${wallet.limits.monthlyRemaining.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-3">Account Status</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Active:</span>
                      <span className={`font-medium ${wallet.status.isActive ? 'text-green-600' : 'text-red-600'}`}>
                        {wallet.status.isActive ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Verified:</span>
                      <span className={`font-medium ${wallet.status.isVerified ? 'text-green-600' : 'text-yellow-600'}`}>
                        {wallet.status.isVerified ? 'Yes' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'deposit' && (
            <div className="max-w-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (USD)
                </label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="100.00"
                  min="1"
                  step="0.01"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={depositMethod}
                  onChange={(e) => setDepositMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {paymentMethods.filter(m => m.supported.includes('deposit')).map(method => (
                    <option key={method.id} value={method.id}>
                      {method.name} - {method.fee}
                    </option>
                  ))}
                </select>
              </div>

              <Button onClick={handleDeposit} disabled={actionLoading || !depositAmount}>
                {actionLoading ? 'Processing...' : 'Deposit Funds'}
              </Button>
            </div>
          )}

          {activeTab === 'withdraw' && (
            <div className="max-w-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (USD)
                </label>
                <input
                  type="number"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="50.00"
                  min="1"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Withdrawal Method
                </label>
                <select
                  value={withdrawMethod}
                  onChange={(e) => setWithdrawMethod(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  {paymentMethods.filter(m => m.supported.includes('withdraw')).map(method => (
                    <option key={method.id} value={method.id}>
                      {method.name} - {method.fee}
                    </option>
                  ))}
                </select>
              </div>

              {withdrawMethod === 'bank_transfer' && (
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Account Holder Name"
                    value={bankDetails.accountHolderName}
                    onChange={(e) => setBankDetails(prev => ({ ...prev, accountHolderName: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <input
                    type="text"
                    placeholder="Account Number"
                    value={bankDetails.accountNumber}
                    onChange={(e) => setBankDetails(prev => ({ ...prev, accountNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                  <input
                    type="text"
                    placeholder="Routing Number"
                    value={bankDetails.routingNumber}
                    onChange={(e) => setBankDetails(prev => ({ ...prev, routingNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              )}

              <Button onClick={handleWithdraw} disabled={actionLoading || !withdrawAmount}>
                {actionLoading ? 'Processing...' : 'Withdraw Funds'}
              </Button>
            </div>
          )}

          {activeTab === 'transfer' && (
            <div className="max-w-md space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="recipient@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (USD)
                </label>
                <input
                  type="number"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="25.00"
                  min="1"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (Optional)
                </label>
                <input
                  type="text"
                  value={transferDescription}
                  onChange={(e) => setTransferDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Payment for services"
                />
              </div>

              <Button onClick={handleTransfer} disabled={actionLoading || !transferAmount || !recipientEmail}>
                {actionLoading ? 'Processing...' : 'Send Transfer'}
              </Button>
            </div>
          )}

          {activeTab === 'history' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Transaction History</h3>
                <Button variant="outline" onClick={loadTransactionHistory} disabled={actionLoading}>
                  {actionLoading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
              
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <CreditCard size={48} className="mx-auto mb-4 text-gray-300" />
                  <p>No transactions found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {transactions.map((transaction) => (
                    <div key={transaction._id} className="flex items-center p-4 border rounded-lg">
                      <div className="flex items-center mr-4">
                        {getTypeIcon(transaction.type)}
                        {getStatusIcon(transaction.status)}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">{transaction.description}</h4>
                            <p className="text-sm text-gray-600">
                              {new Date(transaction.createdAt).toLocaleDateString()} - {transaction.method}
                            </p>
                            {transaction.recipientId && (
                              <p className="text-sm text-gray-600">
                                To: {transaction.recipientId.name}
                              </p>
                            )}
                          </div>
                          <div className="text-right">
                            <p className={`font-medium ${
                              transaction.type === 'deposit' ? 'text-green-600' : 
                              transaction.type === 'withdraw' ? 'text-red-600' : 
                              'text-blue-600'
                            }`}>
                              {transaction.type === 'deposit' ? '+' : '-'}${transaction.amount.toFixed(2)}
                            </p>
                            <p className="text-sm text-gray-500 capitalize">{transaction.status}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium">Statistics (30 Days)</h3>
                <Button variant="outline" onClick={loadStats} disabled={actionLoading}>
                  {actionLoading ? 'Loading...' : 'Refresh'}
                </Button>
              </div>
              
              {stats ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-green-50 p-6 rounded-lg">
                    <h4 className="text-sm font-medium text-green-700 mb-2">Deposits</h4>
                    <p className="text-2xl font-bold text-green-900">${stats.summary.totalDeposits.toFixed(2)}</p>
                    <p className="text-sm text-green-600">{stats.summary.depositCount} transactions</p>
                  </div>
                  <div className="bg-red-50 p-6 rounded-lg">
                    <h4 className="text-sm font-medium text-red-700 mb-2">Withdrawals</h4>
                    <p className="text-2xl font-bold text-red-900">${stats.summary.totalWithdrawals.toFixed(2)}</p>
                    <p className="text-sm text-red-600">{stats.summary.withdrawalCount} transactions</p>
                  </div>
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-700 mb-2">Transfers</h4>
                    <p className="text-2xl font-bold text-blue-900">${stats.summary.totalTransfers.toFixed(2)}</p>
                    <p className="text-sm text-blue-600">{stats.summary.transferCount} transactions</p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No statistics available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )};   
    
  export const PaymentsPageWrapper: React.FC = () => (
    <Elements stripe={stripePromise}>
      <PaymentsPage />
    </Elements>
  );