import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Receipt, Calendar, Filter, Search as SearchIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface TransactionItem {
  productId: string;
  name: string;
  quantity: number;
  sellingPrice: number;
  subtotal: number;
}

interface Transaction {
  id: string;
  staffId: string;
  staffName: string;
  paymentMethod: string;
  totalAmount: number;
  items: TransactionItem[];
  createdAt: any;
}

export default function AdminTransactions() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentFilter, setPaymentFilter] = useState<string>('All');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    // Increased limit to 200 for better local filtering coverage
    const q = query(collection(db, 'transactions'), orderBy('createdAt', 'desc'), limit(200));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Transaction[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Transaction);
      });
      setTransactions(data);
    }, (error) => {
      console.error("Transactions Log Error:", error);
    });
    return () => unsubscribe();
  }, []);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      const searchLower = search.toLowerCase();
      const matchesSearch = (tx.staffName || '').toLowerCase().includes(searchLower) || 
                           (tx.id || '').toLowerCase().includes(searchLower) ||
                           tx.items.some(item => (item.name || '').toLowerCase().includes(searchLower));
      
      if (!matchesSearch) return false;

      if (paymentFilter !== 'All' && tx.paymentMethod !== paymentFilter) return false;

      if (startDate || endDate) {
        if (!tx.createdAt?.toDate) return false; // In case of pending writes or missing dates
        const txDate = tx.createdAt.toDate();
        
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (txDate < start) return false;
        }
        
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (txDate > end) return false;
        }
      }

      return true;
    });
  }, [transactions, paymentFilter, startDate, endDate, search]);

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Accountability Log</h2>
          <p className="text-gray-500 text-sm mt-1">Non-editable history of all sales transactions.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 mb-6 shadow-sm border border-slate-200 flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-[2] w-full sm:w-auto">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><SearchIcon className="w-3.5 h-3.5"/> Search</label>
          <input 
            type="text"
            placeholder="Staff name or Tx ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700"
          />
        </div>

        <div className="flex-1 w-full sm:w-auto">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Filter className="w-3.5 h-3.5"/> Payment Method</label>
          <select 
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700"
          >
            <option value="All">All Methods</option>
            <option value="Cash">Cash</option>
            <option value="Transfer">Transfer</option>
            <option value="Debt">Debt (Credit)</option>
          </select>
        </div>
        
        <div className="flex-1 w-full sm:w-auto">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> Start Date</label>
          <input 
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700"
          />
        </div>

        <div className="flex-1 w-full sm:w-auto">
          <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5"/> End Date</label>
          <input 
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-medium text-slate-700"
          />
        </div>
        
        { (paymentFilter !== 'All' || startDate || endDate || search) && (
           <button 
             onClick={() => { setPaymentFilter('All'); setStartDate(''); setEndDate(''); setSearch(''); }}
             className="px-4 py-2 text-sm text-slate-500 hover:text-slate-900 font-bold transition-colors border border-transparent hover:bg-slate-100 rounded-lg h-[38px]"
           >
             Clear Filters
           </button>
        )}
      </div>

      <div className="space-y-4">
        {filteredTransactions.length === 0 ? (
          <div className="bg-white rounded-2xl py-12 text-center text-slate-500 border border-slate-200 font-medium">
            No transactions found matching your filters.
          </div>
        ) : (
          filteredTransactions.map((tx) => (
            <div key={tx.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-200 flex flex-col md:flex-row md:items-start gap-6">
              
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center border border-gray-100">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 leading-tight">Tx ID: {tx.id.slice(0,8).toUpperCase()}</h3>
                    <p className="text-sm text-gray-400 font-mono">
                       {tx.createdAt?.toDate ? tx.createdAt.toDate().toLocaleString() : 'Just now'}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-gray-400 tracking-wider">
                      <tr>
                        <th className="text-left font-medium pb-2">Item</th>
                        <th className="text-center font-medium pb-2">Qty</th>
                        <th className="text-right font-medium pb-2">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {tx.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2 font-medium text-gray-900">{item.name}</td>
                          <td className="py-2 text-center text-gray-500 font-mono">{item.quantity}</td>
                          <td className="py-2 text-right font-mono text-gray-900">₦{item.subtotal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="w-full md:w-64 bg-gray-50/50 rounded-xl p-5 border border-gray-100 space-y-4 shrink-0">
                <div>
                   <p className="text-xs uppercase text-gray-400 font-semibold tracking-wider mb-1">Total Amount</p>
                   <p className="text-3xl font-bold font-mono text-gray-900">₦{tx.totalAmount.toFixed(2)}</p>
                </div>
                <div className="h-px bg-gray-200 w-full" />
                <div>
                   <p className="text-xs uppercase text-gray-400 font-semibold tracking-wider mb-1">Payment Method</p>
                   <span className={cn(
                     "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium uppercase tracking-wider",
                     tx.paymentMethod === 'Cash' ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"
                   )}>
                     {tx.paymentMethod}
                   </span>
                </div>
                <div>
                   <p className="text-xs uppercase text-gray-400 font-semibold tracking-wider mb-1">Staff Member</p>
                   <p className="font-medium text-gray-900">{tx.staffName || tx.staffId}</p>
                </div>
              </div>

            </div>
          ))
        )}
      </div>
    </div>
  );
}
