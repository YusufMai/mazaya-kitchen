import { useState, useEffect, useMemo, useRef } from 'react';
import { collection, onSnapshot, query, addDoc, serverTimestamp, writeBatch, doc, getDoc, updateDoc, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { ShoppingCart, Plus, Minus, X, Check, Search, User, CreditCard, Printer, Receipt as ReceiptIcon } from 'lucide-react';
import { cn } from '../lib/utils';

interface Product {
  id: string;
  name: string;
  category: string;
  sellingPrice: number;
  stock: number;
  imageUrl?: string;
}

interface CartItem extends Product {
  quantity: number;
}

interface Customer {
  id: string;
  name: string;
  totalDebt: number;
}

export default function POS() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Transfer' | 'Debt'>('Cash');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState(false);
  const [search, setSearch] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<{
    id: string;
    items: CartItem[];
    total: number;
    paymentMethod: string;
    customerName?: string;
    date: Date;
    staffName: string;
  } | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Product[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(data);
    }, (error) => {
      console.error("POS Products Error:", error);
    });

    const qCus = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubscribeCus = onSnapshot(qCus, (snapshot) => {
      const data: Customer[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Customer);
      });
      setCustomers(data);
    }, (error) => {
      console.error("POS Customers Error:", error);
    });

    return () => {
      unsubscribe();
      unsubscribeCus();
    };
  }, []);

  const filteredProducts = useMemo(() => {
    return products.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  }, [products, search]);

  const addToCart = (product: Product) => {
    if (product.stock === 0) return;
    setCart((prev) => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) => prev.map(item => {
      if (item.id === id) {
        const newQ = item.quantity + delta;
        if (newQ < 1) return item;
        const product = products.find(p => p.id === id);
        if (product && newQ > product.stock) return item;
        return { ...item, quantity: newQ };
      }
      return item;
    }));
  };

  const handleExactQuantity = (id: string, value: string) => {
    const qty = parseInt(value, 10);
    if (isNaN(qty)) return;
    
    setCart((prev) => prev.map(item => {
      if (item.id === id) {
        if (qty < 1) return item;
        const product = products.find(p => p.id === id);
        if (product && qty > product.stock) {
          return { ...item, quantity: product.stock };
        }
        return { ...item, quantity: qty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter(item => item.id !== id));
  };

  const total = cart.reduce((sum, item) => sum + (item.sellingPrice * item.quantity), 0);

  const handlePrint = () => {
    const printContent = receiptRef.current;
    if (!printContent) return;

    // Create a hidden iframe for printing to avoid popup blockers and work better in iframes
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) return;

    doc.write('<html><head><title>Receipt</title><style>');
    doc.write(`
      @page { size: 58mm auto; margin: 0; }
      body { 
        font-family: "Courier New", Courier, monospace; 
        width: 58mm; 
        padding: 2mm; 
        font-size: 16px; 
        line-height: 1.1; 
        margin: 0;
        color: #000;
        background: #fff;
        font-weight: 700;
      }
      .center { text-align: center; }
      .bold { font-weight: 900; }
      .divider { border-top: 2px dashed #000; margin: 8px 0; width: 100%; }
      table { width: 100%; border-collapse: collapse; margin: 8px 0; }
      th { text-align: left; border-bottom: 2px solid #000; font-size: 14px; padding-bottom: 4px; font-weight: 900; }
      td { padding: 6px 0; vertical-align: top; font-weight: 700; }
      .price-col { text-align: right; }
      .qty-col { text-align: center; width: 50px; }
      .total-row { border-top: 2px solid #000; padding-top: 8px; margin-top: 8px; font-weight: 900; font-size: 20px; display: flex; justify-content: space-between; }
      .footer { text-align: center; margin-top: 20px; font-size: 12px; font-weight: 900; line-height: 1.4; }
      * { box-sizing: border-box; }
      h2 { margin: 0; font-size: 24px; font-weight: 900; }
    `);
    doc.write('</style></head><body>');
    doc.write(printContent.innerHTML);
    doc.write('</body></html>');
    doc.close();

    // Small delay to ensure styles are applied
    setTimeout(() => {
      if (iframe.contentWindow) {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      }
      // Keep iframe a bit longer to ensure print dialog finishes
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }, 800);
  };

  const processSale = async () => {
    if (cart.length === 0 || !user || isProcessing) return;
    if (paymentMethod === 'Debt' && !selectedCustomerId) {
      alert("Please select a customer for debt payment.");
      return;
    }
    
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Transaction Doc
      const txRef = doc(collection(db, 'transactions'));
      const txData = {
        staffId: user.uid,
        staffName: user.name || user.email,
        paymentMethod,
        customerId: paymentMethod === 'Debt' ? selectedCustomerId : null,
        totalAmount: total,
        items: cart.map(item => ({
          productId: item.id,
          name: item.name,
          quantity: item.quantity,
          sellingPrice: item.sellingPrice,
          subtotal: item.sellingPrice * item.quantity
        })),
        createdAt: serverTimestamp()
      };
      batch.set(txRef, txData);

      // 2. Adjust Stock
      // ... (rest of stock logic stays the same) ...
      for (const item of cart) {
        const product = products.find(p => p.id === item.id);
        if (!product || product.stock < item.quantity) {
           throw new Error(`Insufficient stock for ${item.name}`);
        }
        const pRef = doc(db, 'products', item.id);
        batch.update(pRef, {
          stock: product.stock - item.quantity,
          updatedAt: serverTimestamp()
        });
      }

      // 3. Update Customer Debt if applicable
      if (paymentMethod === 'Debt') {
        const customer = customers.find(c => c.id === selectedCustomerId);
        if (customer) {
          const cRef = doc(db, 'customers', selectedCustomerId);
          batch.update(cRef, {
            totalDebt: (customer.totalDebt || 0) + total
          });
        }
      }

      await batch.commit();
      
      // Success - State for receipt
      const customer = customers.find(c => c.id === selectedCustomerId);
      setLastSale({
        id: txRef.id,
        items: [...cart],
        total: total,
        paymentMethod: paymentMethod,
        customerName: customer?.name,
        date: new Date(),
        staffName: user.name || user.email
      });

      setCart([]);
      setSelectedCustomerId('');
      setPaymentMethod('Cash');
      setSuccessMsg(true);
      setShowReceipt(true);
      setTimeout(() => setSuccessMsg(false), 3000);
      
    } catch (error: any) {
      alert("Checkout failed: " + error.message);
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row flex-1 w-full h-full p-6 gap-6 overflow-hidden bg-slate-50">
      {/* Products Grid */}
      <section className="flex-[3] flex flex-col gap-4 overflow-hidden">
        <div className="bg-white p-3 rounded-2xl border border-slate-200 flex items-center shadow-sm">
          <Search className="w-5 h-5 text-slate-400 mr-2" />
          <input 
            type="text" 
            placeholder="Search products by name..." 
            className="flex-1 bg-transparent border-none outline-none font-medium text-slate-700"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto content-start h-full pr-2 pb-6">
          {filteredProducts.map((product) => {
            const inCart = cart.find(c => c.id === product.id)?.quantity || 0;
            const isOutOfStock = product.stock === 0;
            const remaining = product.stock - inCart;
            const disabled = isOutOfStock || remaining === 0;

            return (
              <button
                key={product.id}
                disabled={disabled}
                onClick={() => addToCart(product)}
                className={cn(
                  "p-4 flex flex-col items-center text-center transition-colors relative group",
                  disabled 
                    ? "bg-slate-100 border-2 border-slate-200 opacity-60 rounded-xl cursor-not-allowed shadow-none" 
                    : "bg-white border-2 border-slate-200 rounded-xl cursor-pointer hover:border-indigo-500 shadow-sm"
                )}
              >
                {inCart > 0 && (
                  <div className="absolute top-2 right-2 bg-indigo-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-lg">
                    {inCart}
                  </div>
                )}
                
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="w-24 h-24 rounded-lg mb-3 object-cover shadow-sm border border-slate-200/50" />
                ) : (
                  <div className="w-24 h-24 bg-slate-100 rounded-lg mb-3 flex items-center justify-center text-3xl font-black text-slate-300 border border-slate-200/50 flex-shrink-0">
                    {product.name.charAt(0).toUpperCase()}
                  </div>
                )}
                
                <h3 className="font-bold text-slate-900 leading-tight mb-2 flex-1">{product.name}</h3>
                
                <p className={cn("font-bold text-lg", disabled ? "text-slate-500" : "text-indigo-600")}>
                  ₦{product.sellingPrice.toFixed(2)}
                </p>

                {isOutOfStock ? (
                  <div className="mt-2 bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tighter">OUT OF STOCK</div>
                ) : disabled ? (
                  <div className="mt-2 bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-tighter">MAX REACHED</div>
                ) : (
                  <div className="mt-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold uppercase">
                    {product.stock} IN STOCK
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* Sidebar Cart */}
      <aside className="w-full md:w-96 flex-[1] max-w-sm bg-white border border-slate-200 rounded-2xl shadow-lg flex flex-col overflow-hidden shrink-0">
        <div className="p-5 border-b border-slate-100 bg-slate-50">
          <h2 className="font-bold text-lg flex justify-between items-center text-slate-900">
            <span className="flex items-center"><ShoppingCart className="w-5 h-5 mr-2 text-slate-500" /> Current Order</span>
          </h2>
        </div>

        <div className="flex-1 p-5 space-y-4 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
               <ShoppingCart className="w-12 h-12 opacity-20 text-slate-400" />
               <p className="font-medium">No items in order</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.id} className="flex justify-between items-center bg-indigo-50 p-3 rounded-lg border border-indigo-100">
                <div className="flex flex-col flex-1 min-w-0 pr-2">
                  <strong className="text-slate-900 truncate">{item.name}</strong>
                  <div className="flex items-center mt-1">
                    <small className="text-slate-500 italic font-medium mr-2">@ ₦{item.sellingPrice.toFixed(2)}</small>
                    <div className="flex items-center space-x-1 bg-white rounded border border-indigo-200 px-1 py-0.5 shadow-sm">
                      <button onClick={() => updateQuantity(item.id, -1)} className="p-0.5 text-slate-500 hover:text-indigo-600 transition-colors"><Minus className="w-3 h-3" /></button>
                      <input 
                        type="number" 
                        min="1" 
                        max={products.find(p => p.id === item.id)?.stock || 1} 
                        value={item.quantity} 
                        onChange={(e) => handleExactQuantity(item.id, e.target.value)}
                        className="w-10 text-center text-sm font-bold text-slate-900 border-none outline-none appearance-none focus:ring-0 bg-transparent"
                        style={{ MozAppearance: 'textfield' }} 
                      />
                      <button onClick={() => updateQuantity(item.id, 1)} className="p-0.5 text-slate-500 hover:text-indigo-600 transition-colors"><Plus className="w-3 h-3" /></button>
                    </div>
                  </div>
                </div>
                <div className="flex items-center">
                  <span className="font-bold text-slate-900">₦{(item.sellingPrice * item.quantity).toFixed(2)}</span>
                  <button onClick={() => removeFromCart(item.id)} className="ml-2 p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-white border-t-2 border-slate-100 space-y-4 shrink-0">
          <div className="flex justify-between text-2xl font-black text-slate-900 py-2">
            <span>Total</span>
            <span>₦{total.toFixed(2)}</span>
          </div>

          <div className="grid grid-cols-3 gap-1.5 mt-4">
            {(['Cash', 'Transfer', 'Debt'] as const).map(method => (
              <button
                key={method}
                onClick={() => setPaymentMethod(method)}
                className={cn(
                  "py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-tighter transition-all border-2",
                  paymentMethod === method 
                    ? "border-indigo-600 bg-indigo-50 text-indigo-700 shadow-sm" 
                    : "border-slate-100 text-slate-400 hover:bg-slate-50"
                )}
              >
                {method === 'Debt' && <CreditCard className="w-3 h-3 mx-auto mb-1" />}
                {method}
              </button>
            ))}
          </div>

          {paymentMethod === 'Debt' && (
            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="relative">
                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-red-50 border-2 border-red-100 rounded-xl font-bold text-sm text-red-900 focus:outline-none focus:border-red-500 appearance-none transition-colors"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name} (₦{c.totalDebt.toFixed(2)})</option>
                  ))}
                </select>
                <User className="absolute left-3 top-3.5 w-4 h-4 text-red-400" />
              </div>
              <p className="mt-1.5 text-[10px] text-red-500 font-bold italic text-center">Selecting a customer adds this total to their debt profile.</p>
            </div>
          )}

          {successMsg ? (
            <div className="w-full py-4 rounded-xl flex items-center justify-center bg-green-50 text-green-700 font-bold uppercase tracking-widest border border-green-200">
              <Check className="w-5 h-5 mr-2" />
              Sale Completed
            </div>
          ) : (
            <button
              onClick={processSale}
              disabled={cart.length === 0 || isProcessing || (paymentMethod === 'Debt' && !selectedCustomerId)}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:text-slate-500 text-white py-4 rounded-xl font-bold text-lg shadow-md transition-all uppercase tracking-widest disabled:cursor-not-allowed"
            >
              {isProcessing ? "PROCESSING..." : "Complete Sale"}
            </button>
          )}
        </div>
      </aside>

      {/* Receipt Modal */}
      {showReceipt && lastSale && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-black text-lg text-slate-900 flex items-center gap-2">
                <ReceiptIcon className="w-5 h-5 text-indigo-600" /> Receipt
              </h3>
              <button 
                onClick={() => setShowReceipt(false)}
                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
              {/* Printable Area */}
              <div ref={receiptRef} className="bg-slate-50 p-4 rounded-xl border-2 border-dashed border-slate-200 font-mono text-base font-bold text-slate-800">
                <div className="center">
                  <div style={{ fontSize: '22px', fontWeight: '900' }}>MAZAYA STORE</div>
                  <div style={{ fontSize: '12px', marginTop: '2px', fontWeight: '800' }}>PREMIUM QUALITY ITEMS</div>
                  <div className="divider"></div>
                </div>

                <div style={{ fontSize: '14px', margin: '12px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Date:</span> <span>{lastSale.date.toLocaleString()}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Tx ID:</span> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '120px' }}>{lastSale.id}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Staff:</span> <span>{lastSale.staffName}</span></div>
                  {lastSale.customerName && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Customer:</span> <span>{lastSale.customerName}</span></div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>Payment:</span> <span className="bold">{lastSale.paymentMethod}</span></div>
                </div>

                <div className="divider"></div>
                
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="qty-col">Qty</th>
                      <th className="price-col">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastSale.items.map((item, idx) => (
                      <tr key={idx}>
                        <td>{item.name}</td>
                        <td className="qty-col">x{item.quantity}</td>
                        <td className="price-col">₦{item.sellingPrice.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="total-row" style={{ fontSize: '18px' }}>
                  <span>TOTAL</span>
                  <span>₦{lastSale.total.toFixed(2)}</span>
                </div>

                <div className="footer" style={{ fontSize: '12px' }}>
                  THANK YOU FOR YOUR PATRONAGE!
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button 
                  onClick={() => setShowReceipt(false)}
                  className="flex-1 py-3 px-4 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  Close
                </button>
                <button 
                  onClick={handlePrint}
                  className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"
                >
                  <Printer className="w-5 h-5" /> Print
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
