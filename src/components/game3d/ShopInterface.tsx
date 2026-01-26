import { useState } from 'react';
import { DollarSign, PiggyBank, ShoppingCart, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ShopInterfaceProps {
  cash: number;
  credits: number;
  bank: number;
  level: number;
  onConvert: (type: 'credits_to_cash' | 'cash_to_credits', amount: number) => boolean;
  onDeposit: (amount: number) => boolean;
  onWithdraw: (amount: number) => boolean;
  onClose: () => void;
}

export default function ShopInterface({
  cash,
  credits,
  bank,
  level,
  onConvert,
  onDeposit,
  onWithdraw,
  onClose,
}: ShopInterfaceProps) {
  const [activeTab, setActiveTab] = useState<'shop' | 'bank' | 'exchange'>('shop');
  const [convertAmount, setConvertAmount] = useState(0);
  const [bankAmount, setBankAmount] = useState(0);

  const handleConvertCredits = () => {
    if (convertAmount > 0 && onConvert('credits_to_cash', convertAmount)) {
      setConvertAmount(0);
    }
  };

  const handleConvertCash = () => {
    if (convertAmount > 0 && onConvert('cash_to_credits', convertAmount)) {
      setConvertAmount(0);
    }
  };

  const handleDeposit = () => {
    if (bankAmount > 0 && onDeposit(bankAmount)) {
      setBankAmount(0);
    }
  };

  const handleWithdraw = () => {
    if (bankAmount > 0 && onWithdraw(bankAmount)) {
      setBankAmount(0);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/70">
      <div className="bg-gray-900 border-2 border-cyan-500 rounded-lg w-full max-w-2xl mx-4 shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gray-950 border-b border-cyan-500 p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-cyan-400">London City Services</h1>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          <button
            onClick={() => setActiveTab('shop')}
            className={`flex-1 py-3 px-4 font-bold transition-colors ${
              activeTab === 'shop'
                ? 'border-b-2 border-cyan-500 text-cyan-400 bg-gray-800'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <ShoppingCart className="w-5 h-5 inline mr-2" />
            Shop
          </button>
          <button
            onClick={() => setActiveTab('exchange')}
            className={`flex-1 py-3 px-4 font-bold transition-colors ${
              activeTab === 'exchange'
                ? 'border-b-2 border-cyan-500 text-cyan-400 bg-gray-800'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <DollarSign className="w-5 h-5 inline mr-2" />
            Exchange
          </button>
          <button
            onClick={() => setActiveTab('bank')}
            className={`flex-1 py-3 px-4 font-bold transition-colors ${
              activeTab === 'bank'
                ? 'border-b-2 border-cyan-500 text-cyan-400 bg-gray-800'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <PiggyBank className="w-5 h-5 inline mr-2" />
            Bank
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Player Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-900/30 border border-green-600 rounded-lg p-4 text-center">
              <div className="text-green-400 text-sm font-bold mb-1">Cash</div>
              <div className="text-3xl font-bold text-green-400">${cash.toLocaleString()}</div>
            </div>
            <div className="bg-blue-900/30 border border-blue-600 rounded-lg p-4 text-center">
              <div className="text-blue-400 text-sm font-bold mb-1">Credits</div>
              <div className="text-3xl font-bold text-blue-400">{credits}</div>
            </div>
            <div className="bg-cyan-900/30 border border-cyan-600 rounded-lg p-4 text-center">
              <div className="text-cyan-400 text-sm font-bold mb-1">Bank</div>
              <div className="text-3xl font-bold text-cyan-400">${bank.toLocaleString()}</div>
            </div>
          </div>

          {/* Shop Tab */}
          {activeTab === 'shop' && (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-white">Available Items</h2>
              <div className="space-y-3">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-white">Armor Vest</p>
                    <p className="text-sm text-gray-400">Increases protection</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-400">$2,500</p>
                    <button className={`text-sm px-3 py-1 rounded ${cash >= 2500 ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}>
                      Buy
                    </button>
                  </div>
                </div>
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <p className="font-bold text-white">Health Pack</p>
                    <p className="text-sm text-gray-400">Restore 50 health</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-400">$500</p>
                    <button className={`text-sm px-3 py-1 rounded ${cash >= 500 ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-700 text-gray-400 cursor-not-allowed'}`}>
                      Buy
                    </button>
                  </div>
                </div>
              </div>
              <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
                <p className="text-blue-400 text-sm">💡 Earn more cash by completing jobs around the city!</p>
              </div>
            </div>
          )}

          {/* Exchange Tab */}
          {activeTab === 'exchange' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white">Currency Exchange</h2>

              {/* Credits to Cash */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
                <h3 className="font-bold text-cyan-400">CF Credits → In-Game Cash</h3>
                <p className="text-sm text-gray-400">Rate: 1 Credit = 1,000 Cash</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    max={credits}
                    value={convertAmount}
                    onChange={(e) => setConvertAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="Amount of credits"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                  <button
                    onClick={handleConvertCredits}
                    disabled={convertAmount <= 0 || convertAmount > credits}
                    className={`px-6 py-2 rounded font-bold transition-colors ${
                      convertAmount > 0 && convertAmount <= credits
                        ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Convert
                  </button>
                </div>
                {convertAmount > 0 && (
                  <p className="text-sm text-green-400">
                    You will receive: ${(convertAmount * 1000).toLocaleString()}
                  </p>
                )}
              </div>

              {/* Cash to Credits */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
                <h3 className="font-bold text-cyan-400">In-Game Cash → CF Credits</h3>
                <p className="text-sm text-gray-400">Rate: 1,000 Cash = 1 Credit</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    max={cash}
                    step="1000"
                    value={convertAmount}
                    onChange={(e) => setConvertAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="Amount of cash"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                  <button
                    onClick={handleConvertCash}
                    disabled={convertAmount <= 0 || convertAmount > cash}
                    className={`px-6 py-2 rounded font-bold transition-colors ${
                      convertAmount > 0 && convertAmount <= cash
                        ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Convert
                  </button>
                </div>
                {convertAmount > 0 && (
                  <p className="text-sm text-blue-400">
                    You will receive: {Math.floor(convertAmount / 1000)} Credits
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Bank Tab */}
          {activeTab === 'bank' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-white">Bank Vault</h2>

              {/* Deposit */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
                <h3 className="font-bold text-cyan-400">Deposit Cash</h3>
                <p className="text-sm text-gray-400">Available: ${cash.toLocaleString()}</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    max={cash}
                    value={bankAmount}
                    onChange={(e) => setBankAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="Amount"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                  <button
                    onClick={handleDeposit}
                    disabled={bankAmount <= 0 || bankAmount > cash}
                    className={`px-6 py-2 rounded font-bold transition-colors ${
                      bankAmount > 0 && bankAmount <= cash
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Deposit
                  </button>
                </div>
              </div>

              {/* Withdraw */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
                <h3 className="font-bold text-cyan-400">Withdraw Cash</h3>
                <p className="text-sm text-gray-400">Available: ${bank.toLocaleString()}</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    max={bank}
                    value={bankAmount}
                    onChange={(e) => setBankAmount(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="Amount"
                    className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  />
                  <button
                    onClick={handleWithdraw}
                    disabled={bankAmount <= 0 || bankAmount > bank}
                    className={`px-6 py-2 rounded font-bold transition-colors ${
                      bankAmount > 0 && bankAmount <= bank
                        ? 'bg-blue-600 hover:bg-blue-700 text-white'
                        : 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Withdraw
                  </button>
                </div>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
                <p className="text-yellow-400 text-sm">🏦 Safely store your cash in the bank vault. It's protected 24/7!</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
