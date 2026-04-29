import { useState, useEffect } from 'react';
import { collection, onSnapshot, query } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TrendingUp, PackageSearch, Activity, Settings2 } from 'lucide-react';

interface Product {
  id: string;
  name: string;
  stock: number;
}

export default function AdminDashboard() {
  const [totalSales, setTotalSales] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalDebt, setTotalDebt] = useState(0);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockThreshold, setStockThreshold] = useState(10);

  useEffect(() => {
    // Real-time listener for transactions
    const txQuery = query(collection(db, 'transactions'));
    const unsubscribeTx = onSnapshot(txQuery, (snapshot) => {
      let rev = 0;
      snapshot.forEach(doc => {
        rev += doc.data().totalAmount || 0;
      });
      setTotalSales(rev);
      setTotalOrders(snapshot.size);
    }, (error) => {
      console.error("Dashboard Transaction Error:", error);
    });

    // Real-time listener for customers (Debt)
    const cusQuery = query(collection(db, 'customers'));
    const unsubscribeCus = onSnapshot(cusQuery, (snapshot) => {
      let debt = 0;
      snapshot.forEach(doc => {
        debt += doc.data().totalDebt || 0;
      });
      setTotalDebt(debt);
    }, (error) => {
      console.error("Dashboard Customer Error:", error);
    });

    // Real-time listener for products
    const prodQuery = query(collection(db, 'products'));
    const unsubscribeProd = onSnapshot(prodQuery, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach(doc => {
        prods.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(prods);
    }, (error) => {
      console.error("Dashboard Product Error:", error);
    });

    return () => {
      unsubscribeTx();
      unsubscribeCus();
      unsubscribeProd();
    };
  }, []);

  const lowStockProducts = products.filter(p => p.stock < stockThreshold);
  const lowStockCount = lowStockProducts.length;

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      <h2 className="text-3xl font-bold text-gray-900 mb-8 tracking-tight">Overview</h2>

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4">
            <TrendingUp className="w-6 h-6" />
          </div>
          <p className="text-gray-500 font-medium mb-1">Total Revenue</p>
          <h3 className="text-4xl font-light tracking-tight font-mono">₦{totalSales.toFixed(2)}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100 ring-2 ring-red-50">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
            <TrendingUp className="w-6 h-6 rotate-180" />
          </div>
          <p className="text-gray-500 font-medium mb-1">Outstanding Debt</p>
          <h3 className="text-4xl font-light tracking-tight font-mono text-red-600">₦{totalDebt.toFixed(2)}</h3>
        </div>
        
        <div className="bg-white p-6 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
            <Activity className="w-6 h-6" />
          </div>
          <p className="text-gray-500 font-medium mb-1">Sales Completed</p>
          <h3 className="text-4xl font-light tracking-tight font-mono">{totalOrders}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100">
          <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center mb-4">
            <PackageSearch className="w-6 h-6" />
          </div>
          <p className="text-gray-500 font-medium mb-1">Low Stock Items</p>
          <h3 className="text-4xl font-light tracking-tight font-mono">{lowStockCount}</h3>
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100">
           <div className="flex items-center justify-between mb-4">
             <h3 className="font-semibold text-lg flex items-center gap-2">
               <Settings2 className="w-5 h-5 text-gray-400" />
               Low Stock Threshold
             </h3>
           </div>
           <p className="text-gray-500 mb-4 text-sm">
             Alert when less than configured quantity remains in stock.
           </p>
           <div className="flex items-center space-x-3">
             <input 
               type="number" 
               min="0"
               value={stockThreshold} 
               onChange={(e) => setStockThreshold(parseInt(e.target.value) || 0)}
               className="w-24 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl font-mono text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
             />
             <span className="text-sm font-medium text-gray-600 uppercase tracking-wider">Units</span>
           </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] border border-gray-100">
           <h3 className="font-semibold text-lg mb-4">Low Stock Warning list</h3>
           {lowStockCount === 0 ? (
             <p className="text-gray-500 text-sm">All products are adequately stocked.</p>
           ) : (
             <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
               {lowStockProducts.map(p => (
                 <div key={p.id} className="flex justify-between items-center text-sm border-b border-gray-50 pb-2 last:border-0">
                   <span className="font-medium text-gray-800">{p.name}</span>
                   <span className="text-orange-600 font-mono font-bold bg-orange-50 px-2 py-0.5 rounded-md">
                     {p.stock} left
                   </span>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
