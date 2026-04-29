import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, updateDoc, doc, serverTimestamp, orderBy, deleteDoc, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { UserPlus, Search, Phone, History, Banknote, Save, X, PlusCircle, Edit2, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface Customer {
  id: string;
  name: string;
  phone?: string;
  totalDebt: number;
  createdAt: any;
}

interface DebtPayment {
  id: string;
  customerId: string;
  amount: number;
  paymentMethod: 'Cash' | 'Transfer';
  staffId: string;
  createdAt: any;
}

export default function AdminDebt() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAddDebtModalOpen, setIsAddDebtModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [search, setSearch] = useState('');

  // Form states
  const [cusName, setCusName] = useState('');
  const [cusPhone, setCusPhone] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [addDebtAmount, setAddDebtAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'Cash' | 'Transfer'>('Cash');

  useEffect(() => {
    const qCus = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubscribeCus = onSnapshot(qCus, (snapshot) => {
      const data: Customer[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(data);
    }, (error) => {
      console.error("Debt Customer Error:", error);
    });

    const qPay = query(collection(db, 'debt_payments'), orderBy('createdAt', 'desc'));
    const unsubscribePay = onSnapshot(qPay, (snapshot) => {
      const data: DebtPayment[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as DebtPayment));
      setPayments(data);
    }, (error) => {
      console.error("Debt Payment Error:", error);
    });

    return () => {
      unsubscribeCus();
      unsubscribePay();
    };
  }, []);

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cusName) return;
    try {
      if (isEditingCustomer && selectedCustomer) {
        await updateDoc(doc(db, 'customers', selectedCustomer.id), {
          name: cusName,
          phone: cusPhone,
        });
      } else {
        await addDoc(collection(db, 'customers'), {
          name: cusName,
          phone: cusPhone,
          totalDebt: 0,
          createdAt: serverTimestamp()
        });
      }
      setIsCustomerModalOpen(false);
      setIsEditingCustomer(false);
      setSelectedCustomer(null);
      setCusName('');
      setCusPhone('');
    } catch (err) {
      alert("Failed to save customer");
    }
  };

  const handleDeleteCustomer = async () => {
    if (!customerToDelete) return;
    try {
      await deleteDoc(doc(db, 'customers', customerToDelete.id));
      // Optional: Delete associated payments
      const q = query(collection(db, 'debt_payments'), where('customerId', '==', customerToDelete.id));
      const snapshot = await getDocs(q);
      const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
      await Promise.all(deletePromises);

      setIsDeleteModalOpen(false);
      setCustomerToDelete(null);
    } catch (err) {
      alert("Failed to delete customer");
    }
  };

  const openEditCustomer = (cus: Customer) => {
    setIsEditingCustomer(true);
    setSelectedCustomer(cus);
    setCusName(cus.name);
    setCusPhone(cus.phone || '');
    setIsCustomerModalOpen(true);
  };

  const confirmDeleteCustomer = (cus: Customer) => {
    setCustomerToDelete(cus);
    setIsDeleteModalOpen(true);
  };

  const handleDeletePayment = async (payment: DebtPayment) => {
    if (!confirm(`Delete this repayment of ₦${payment.amount.toFixed(2)}? This will increase the customer's debt.`)) return;
    try {
      const cus = customers.find(c => c.id === payment.customerId);
      if (cus) {
        await updateDoc(doc(db, 'customers', cus.id), {
          totalDebt: (cus.totalDebt || 0) + payment.amount
        });
      }
      await deleteDoc(doc(db, 'debt_payments', payment.id));
    } catch (err) {
      alert("Failed to delete payment");
    }
  };

  const handleRepayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !payAmount || !user) return;
    const amount = parseFloat(payAmount);
    if (amount <= 0) return;

    try {
      // 1. Record Payment
      await addDoc(collection(db, 'debt_payments'), {
        customerId: selectedCustomer.id,
        amount,
        paymentMethod: payMethod,
        staffId: user.uid,
        createdAt: serverTimestamp()
      });

      // 2. Update Customer Balance
      const cusRef = doc(db, 'customers', selectedCustomer.id);
      await updateDoc(cusRef, {
        totalDebt: selectedCustomer.totalDebt - amount
      });

      setIsPaymentModalOpen(false);
      setPayAmount('');
      setSelectedCustomer(null);
    } catch (err) {
      alert("Payment failed");
    }
  };

  const handleManualAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !addDebtAmount || !user) return;
    const amount = parseFloat(addDebtAmount);
    if (amount <= 0) return;

    try {
      const cusRef = doc(db, 'customers', selectedCustomer.id);
      await updateDoc(cusRef, {
        totalDebt: (selectedCustomer.totalDebt || 0) + amount
      });

      setIsAddDebtModalOpen(false);
      setAddDebtAmount('');
      setSelectedCustomer(null);
    } catch (err) {
      alert("Failed to add debt");
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone?.includes(search)
  );

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Customer Debt Ledger</h2>
          <p className="text-slate-500 font-medium italic">Track credit sales and record repayments.</p>
        </div>
        <button 
          onClick={() => {
            setIsEditingCustomer(false);
            setSelectedCustomer(null);
            setCusName('');
            setCusPhone('');
            setIsCustomerModalOpen(true);
          }}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
        >
          <UserPlus className="w-5 h-5 mr-2" />
          Add Customer
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Search Table */}
          <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center bg-slate-50/50">
              <Search className="w-5 h-5 text-slate-400 mr-2" />
              <input 
                type="text" 
                placeholder="Search customers by name or phone..." 
                className="flex-1 bg-transparent border-none outline-none font-medium placeholder:text-slate-400"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 text-slate-500 text-xs font-black uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Total Debt</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-medium">
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-6 py-12 text-center text-slate-400 italic">No customers found.</td>
                    </tr>
                  ) : (
                    filteredCustomers.map(cus => (
                      <tr key={cus.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-5">
                          <div className="flex flex-col">
                            <span className="text-slate-900 font-bold">{cus.name}</span>
                            <span className="text-slate-400 text-sm flex items-center italic">
                              <Phone className="w-3 h-3 mr-1" /> {cus.phone || 'No phone'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className={cn(
                            "px-3 py-1.5 rounded-full text-sm font-black",
                            cus.totalDebt > 0 ? "bg-red-50 text-red-600 border border-red-100" : "bg-green-50 text-green-600 border border-green-100"
                          )}>
                            ₦{cus.totalDebt.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-right space-x-2">
                          <button 
                            onClick={() => openEditCustomer(cus)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                            title="Edit Customer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => confirmDeleteCustomer(cus)}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                            title="Delete Customer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <div className="inline-block w-px h-6 bg-slate-200 mx-1 align-middle" />
                          <button 
                            onClick={() => { setSelectedCustomer(cus); setIsAddDebtModalOpen(true); }}
                            className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm hover:bg-slate-900 transition-colors inline-flex items-center gap-2"
                          >
                            <PlusCircle className="w-4 h-4" /> Add Debt
                          </button>
                          <button 
                            onClick={() => { setSelectedCustomer(cus); setIsPaymentModalOpen(true); }}
                            className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-sm shadow-green-200 hover:bg-green-700 transition-colors inline-flex items-center gap-2"
                          >
                            <Banknote className="w-4 h-4" /> Record Repayment
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Recent Repayment History */}
        <div className="space-y-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center px-2">
            <History className="w-5 h-5 mr-2 text-indigo-600" /> Recent Repayments
          </h3>
          <div className="space-y-3">
            {payments.slice(0, 5).map(pay => {
              const cus = customers.find(c => c.id === pay.customerId);
              return (
                <div key={pay.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex justify-between items-center group hover:border-indigo-200 transition-colors">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900">{cus?.name || 'Unknown'}</span>
                    <span className="text-xs text-slate-400 italic">via {pay.paymentMethod}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-green-600 font-black">+₦{pay.amount.toFixed(2)}</span>
                    <button 
                      onClick={() => handleDeletePayment(pay)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                      title="Delete Payment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Customer Modal */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-black text-xl text-slate-900">{isEditingCustomer ? 'Edit Customer' : 'New Customer'}</h3>
              <button 
                onClick={() => {
                  setIsCustomerModalOpen(false);
                  setIsEditingCustomer(false);
                  setSelectedCustomer(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-900 bg-white rounded-xl border border-slate-200 shadow-sm transition-colors"
                id="close-customer-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCustomer} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Full Name</label>
                <input 
                  required 
                  value={cusName} 
                  onChange={e => setCusName(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all font-medium text-slate-900"
                  placeholder="e.g. John Doe"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Phone Number</label>
                <input 
                  type="tel" 
                  value={cusPhone} 
                  onChange={e => setCusPhone(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all font-mono"
                  placeholder="e.g. +234..."
                />
              </div>
              <button type="submit" className="w-full py-4 bg-black text-white rounded-2xl font-black text-lg hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2">
                <Save className="w-5 h-5" /> {isEditingCustomer ? 'Save Changes' : 'Save Customer'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && customerToDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[110]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Customer?</h3>
              <p className="text-slate-500 text-sm mb-8">
                Are you sure you want to delete <span className="font-black text-slate-900">"{customerToDelete.name}"</span>? This will also remove their repayment history.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteCustomer}
                  className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Repayment Modal */}
      {isPaymentModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-5 border-b border-slate-100 bg-green-50/50 flex justify-between items-center">
              <div className="flex flex-col">
                <h3 className="font-black text-xl text-slate-900">Record Repayment</h3>
                <span className="text-xs font-bold text-slate-500 italic uppercase">For {selectedCustomer.name}</span>
              </div>
              <button 
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-900 bg-white rounded-xl border border-slate-200 shadow-sm transition-colors"
                id="close-payment-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleRepayment} className="p-8 space-y-6">
              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-500">Current Debt</span>
                <span className="text-lg font-black text-red-600">₦{selectedCustomer.totalDebt.toFixed(2)}</span>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Payment Amount (₦)</label>
                <input 
                  required 
                  type="number" 
                  step="0.01"
                  min="0.01"
                  max={selectedCustomer.totalDebt}
                  value={payAmount} 
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-green-500 focus:bg-white outline-none transition-all font-black text-2xl text-slate-900 text-center"
                  placeholder="0.00"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {(['Cash', 'Transfer'] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setPayMethod(m)}
                    className={cn(
                      "py-4 rounded-2xl font-black text-sm uppercase transition-all border-2",
                      payMethod === m ? "border-green-600 bg-green-50 text-green-700" : "border-slate-100 bg-slate-50 text-slate-400 hover:bg-slate-100"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>

              <button type="submit" className="w-full py-4 bg-green-600 text-white rounded-2xl font-black text-lg hover:bg-green-700 transition-all shadow-xl shadow-green-100 flex items-center justify-center gap-2 uppercase tracking-widest">
                <PlusCircle className="w-5 h-5" /> Confirm Repayment
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Manual Add Debt Modal */}
      {isAddDebtModalOpen && selectedCustomer && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-5 border-b border-slate-100 bg-red-50/50 flex justify-between items-center text-slate-900 font-bold border-b-2">
              <div className="flex flex-col">
                <h3 className="font-black text-xl">Increase Debt</h3>
                <span className="text-xs font-bold text-slate-500 italic uppercase">For {selectedCustomer.name}</span>
              </div>
              <button 
                onClick={() => setIsAddDebtModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-900 bg-white rounded-xl border border-slate-200 shadow-sm transition-colors"
                id="close-add-debt-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleManualAddDebt} className="p-8 space-y-6">
              <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 flex justify-between items-center">
                <span className="text-sm font-bold text-slate-500">Current Debt</span>
                <span className="text-lg font-black text-red-600">₦{selectedCustomer.totalDebt.toFixed(2)}</span>
              </div>
              
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Increase Amount (₦)</label>
                <input 
                  required 
                  type="number" 
                  step="0.01"
                  min="0.01"
                  value={addDebtAmount} 
                  onChange={e => setAddDebtAmount(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-red-500 focus:bg-white outline-none transition-all font-black text-2xl text-slate-900 text-center"
                  placeholder="0.00"
                />
              </div>

              <button type="submit" className="w-full py-4 bg-red-600 text-white rounded-2xl font-black text-lg hover:bg-red-700 transition-all shadow-xl shadow-red-100 flex items-center justify-center gap-2 uppercase tracking-widest">
                <PlusCircle className="w-5 h-5" /> Confirm Debt Increase
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
