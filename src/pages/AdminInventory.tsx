import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { Plus, Edit2, Trash2, X, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface Product {
  id: string;
  name: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  imageUrl?: string;
}

export default function AdminInventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [stock, setStock] = useState('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isImageUploading, setIsImageUploading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Product[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as Product);
      });
      setProducts(data);
    }, (error) => {
      console.error("Inventory Fetch Error:", error);
    });
    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setName('');
    setCategory('');
    setCostPrice('');
    setSellingPrice('');
    setStock('');
    setImageUrl('');
    setImageFile(null);
    setEditingId(null);
  };

  const openAddModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingId(p.id);
    setName(p.name);
    setCategory(p.category);
    setCostPrice(p.costPrice.toString());
    setSellingPrice(p.sellingPrice.toString());
    setStock(p.stock.toString());
    setImageUrl(p.imageUrl || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isImageUploading) {
      alert("Please wait for the image to finish uploading.");
      return;
    }
    
    setIsUploading(true);
    try {
      const productData: any = {
        name,
        category,
        costPrice: Number(costPrice),
        sellingPrice: Number(sellingPrice),
        stock: parseInt(stock, 10),
        imageUrl: imageUrl || null
      };
      
      if (editingId) {
        await updateDoc(doc(db, 'products', editingId), {
           ...productData,
           updatedAt: serverTimestamp()
        });
      } else {
        await addDoc(collection(db, 'products'), {
          ...productData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
    } catch (err: any) {
      alert("Error saving: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) { // allow up to 10MB original but we compress it
      alert("Image is too large. Please select an image under 10MB.");
      return;
    }

    // Client-side compression to speed up upload
    const compressImage = (file: File): Promise<File> => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
          const img = new Image();
          img.src = event.target?.result as string;
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            const MAX_HEIGHT = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width *= MAX_HEIGHT / height;
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            
            canvas.toBlob((blob) => {
              if (blob) {
                const compressedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
              } else {
                resolve(file);
              }
            }, 'image/jpeg', 0.7); // 70% quality compression
          };
        };
      });
    };

    try {
      const compressed = await compressImage(file);
      // Immediately start background upload
      setIsImageUploading(true);
      const storageRef = ref(storage, `products/${Date.now()}_${compressed.name}`);
      await uploadBytes(storageRef, compressed);
      const finalUrl = await getDownloadURL(storageRef);
      
      setImageFile(compressed);
      setImageUrl(finalUrl);
      setIsImageUploading(false);
    } catch (err) {
      console.error("Image upload error:", err);
      setIsImageUploading(false);
      alert("Failed to upload image. Please try again.");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, 'products', deleteId));
      setIsDeleteModalOpen(false);
      setDeleteId(null);
    } catch (err: any) {
      alert("Error deleting: " + err.message);
    }
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setIsDeleteModalOpen(true);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Inventory Management</h2>
          <p className="text-gray-500 text-sm mt-1">Manage your products, set pricing and track stock levels.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-black text-white px-5 py-2.5 rounded-xl font-medium flex items-center hover:bg-gray-900 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Product
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium">
            <tr>
              <th className="px-6 py-4 rounded-tl-2xl">Product Name</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Cost Price</th>
              <th className="px-6 py-4">Selling Price</th>
              <th className="px-6 py-4">Stock</th>
              <th className="px-6 py-4 text-right rounded-tr-2xl">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {products.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                  No products found. Click "Add Product" to create one.
                </td>
              </tr>
            ) : (
              products.map((product) => (
                <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900 flex items-center gap-3">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="w-10 h-10 rounded-lg object-cover border border-gray-100" />
                    ) : (
                      <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-400">
                        {product.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    {product.name}
                  </td>
                  <td className="px-6 py-4 text-gray-500">
                    <span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-medium uppercase tracking-wider">{product.category}</span>
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-500">₦{product.costPrice.toFixed(2)}</td>
                  <td className="px-6 py-4 font-mono font-medium text-gray-900">₦{product.sellingPrice.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className={cn("w-2 h-2 rounded-full mr-2", product.stock === 0 ? 'bg-red-500' : product.stock < 10 ? 'bg-yellow-500' : 'bg-green-500')}></div>
                      <span className="font-mono">{product.stock}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <button onClick={() => openEditModal(product)} className="p-2 text-gray-400 hover:text-black hover:bg-gray-100 rounded-lg transition-colors">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => confirmDelete(product.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Delete Product?</h3>
              <p className="text-gray-500 text-sm mb-8">
                Are you sure you want to delete this product? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDelete}
                  className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh] overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 shrink-0">
              <h3 className="font-bold text-lg">{editingId ? 'Edit Product' : 'New Product'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-black bg-white rounded-full border border-gray-200 shadow-sm">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto flex flex-col">
              <div className="p-6 space-y-5 flex-1">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Product Name</label>
                  <input required value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" placeholder="e.g. Non-stick Pan" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Category</label>
                  <input required value={category} onChange={e => setCategory(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" placeholder="e.g. Pots" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Cost Price (₦)</label>
                    <input required type="number" min="0" step="0.01" value={costPrice} onChange={e => setCostPrice(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-mono" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Selling Price (₦)</label>
                    <input required type="number" min="0" step="0.01" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-mono" placeholder="0.00" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Initial Stock</label>
                  <input required type="number" min="0" value={stock} onChange={e => setStock(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-mono" placeholder="0" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Product Image</label>
                  <div className="flex flex-col items-center">
                    <div 
                      onClick={() => !isImageUploading && document.getElementById('image-upload')?.click()}
                      className={cn(
                        "w-full h-48 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all overflow-hidden relative group",
                        imageUrl ? "border-gray-200 bg-white" : "border-gray-300 bg-gray-50 hover:bg-gray-100/50 hover:border-gray-400",
                        isImageUploading && "opacity-50 cursor-wait"
                      )}
                    >
                      {isImageUploading ? (
                        <div className="flex flex-col items-center text-gray-400">
                          <Loader2 className="w-8 h-8 animate-spin mb-2" />
                          <span className="text-sm font-semibold italic">Uploading...</span>
                        </div>
                      ) : imageUrl ? (
                        <>
                          <img src={imageUrl} alt="Preview" className="w-full h-full object-contain" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold text-sm">
                            Click to Change Image
                          </div>
                          <button 
                            type="button" 
                            onClick={(e) => { e.stopPropagation(); setImageUrl(''); setImageFile(null); }} 
                            className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm text-red-500 hover:text-red-700 rounded-full shadow-lg p-2 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <div className="flex flex-col items-center text-gray-400">
                          <Plus className="w-8 h-8 mb-2" />
                          <span className="text-sm font-semibold">Select an image to upload</span>
                          <span className="text-[10px] mt-1 uppercase tracking-widest px-2 py-0.5 border border-gray-200 rounded">PNG, JPG up to 5MB</span>
                        </div>
                      )}
                    </div>
                    <input 
                      id="image-upload"
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      className="hidden" 
                    />
                  </div>
                </div>
              </div>
              <div className="p-6 pt-4 border-t border-gray-100 bg-gray-50/50 shrink-0">
                <button type="submit" disabled={isUploading} className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-900 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
                  {isUploading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isUploading ? 'Saving...' : editingId ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
