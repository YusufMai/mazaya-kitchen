import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth, UserRole } from '../hooks/useAuth';
import { ShieldAlert, ShieldCheck, UserCheck, Plus, Trash2, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface UserRecord {
  id: string; // The email acts as the ID
  uid?: string;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt?: any;
}

export default function AdminStaff() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Form State
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: UserRecord[] = [];
      snapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() } as UserRecord);
      });
      setUsers(data);
    }, (error) => {
      console.error("Staff List Error:", error);
    });
    return () => unsubscribe();
  }, []);

  const openAddModal = () => {
    setEmail('');
    setName('');
    setRole('staff');
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const openEditModal = (u: UserRecord) => {
    setEmail(u.email || u.id);
    setName(u.name || '');
    setRole(u.role);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSaving(true);

    try {
      const emailId = email.toLowerCase().trim();
      
      // Prevent modifying the super admin accidentally
      if (emailId === 'dev.yusufmai@gmail.com') {
         alert("Super Admin cannot be modified here.");
         setIsSaving(false);
         return;
      }

      // If a non-super-admin tries to create an admin
      if (role === 'admin' && currentUser?.role !== 'super_admin') {
         alert("Only Super Admins can promote someone to Admin.");
         setIsSaving(false);
         return;
      }

      const userRef = doc(db, 'users', emailId);

      if (isEditing) {
        await updateDoc(userRef, {
          name,
          role
        });
      } else {
        await setDoc(userRef, {
          email: emailId,
          name,
          role,
          uid: null // Will be populated upon their first login
        });
      }
      
      setIsModalOpen(false);
    } catch (error: any) {
      alert("Failed to save user: " + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (u: UserRecord) => {
    if (u.id === 'dev.yusufmai@gmail.com') {
      alert("Cannot delete the Super Admin.");
      return;
    }
    if (currentUser?.role !== 'super_admin') {
      alert("Only Super Admins can delete personnel records.");
      return;
    }
    if (confirm(`Are you sure you want to revoke access for ${u.email}?`)) {
      await deleteDoc(doc(db, 'users', u.id));
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Personnel & Roles</h2>
          <p className="text-gray-500 text-sm mt-1">Pre-authorize staff accounts, promote admins, or revoke access.</p>
        </div>
        <button 
          onClick={openAddModal}
          className="bg-black text-white px-5 py-2.5 rounded-xl font-medium flex items-center hover:bg-gray-900 transition-colors shadow-sm"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Personnel
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium">
            <tr>
              <th className="px-6 py-4 rounded-tl-2xl">Name</th>
              <th className="px-6 py-4">Account Email</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Auth Privilege</th>
              <th className="px-6 py-4 text-right rounded-tr-2xl">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-400">
                  No personnel found.
                </td>
              </tr>
            ) : (
              users.map((u) => {
                const isSuper = u.role === 'super_admin';
                const isAdmin = u.role === 'admin';
                
                return (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      {u.name || <span className="text-gray-400 italic">Pending Setup</span>}
                    </td>
                    <td className="px-6 py-4 font-mono text-gray-500">
                      {u.email}
                    </td>
                    <td className="px-6 py-4">
                      {u.uid ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Active User
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                          Invite Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      <div className="flex items-center gap-1.5">
                        {isSuper ? <ShieldAlert className="w-4 h-4 text-indigo-600" /> : isAdmin ? <ShieldCheck className="w-4 h-4 text-blue-600" /> : <UserCheck className="w-4 h-4 text-gray-400" />}
                        <span className={cn("font-medium capitalize", isSuper ? "text-indigo-600" : isAdmin ? "text-blue-600" : "text-gray-600")}>
                          {isSuper ? 'Super Admin' : u.role}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                       {/* Hide edit and delete for super admin, unless current user is super admin - but even then, editing super admin is blocked by rules/logic above */}
                       {u.id !== 'dev.yusufmai@gmail.com' && (
                         <>
                           <button onClick={() => openEditModal(u)} className="text-gray-400 hover:text-black font-semibold text-xs px-2 py-1 rounded transition-colors uppercase tracking-wider">
                             Edit
                           </button>
                           {currentUser?.role === 'super_admin' && (
                             <button onClick={() => handleDelete(u)} className="p-1 px-2 text-gray-400 hover:text-red-600 font-semibold text-xs rounded transition-colors uppercase tracking-wider">
                               Revoke
                             </button>
                           )}
                         </>
                       )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="font-bold text-lg">{isEditing ? 'Edit Access' : 'Authorize New Personnel'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-black bg-white rounded-full border border-gray-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Google Email Address</label>
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={isEditing} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed" placeholder="colleague@gmail.com" />
                {!isEditing && <p className="text-[10px] text-gray-400 mt-1.5 uppercase tracking-wide">Must match their Google Login exactly.</p>}
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Display Name (Optional)</label>
                <input value={name} onChange={e => setName(e.target.value)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all" placeholder="Sarah Jenkins" />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Assign Privilege</label>
                <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-black focus:border-transparent outline-none transition-all font-medium text-gray-700">
                  <option value="staff">Standard Staff (POS terminal access only)</option>
                  {currentUser?.role === 'super_admin' && (
                    <option value="admin">Full Admin (Inventory & Reports)</option>
                  )}
                </select>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="w-full py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <span className="flex items-center gap-2 italic text-sm">Processing...</span>
                  ) : isEditing ? 'Save Changes' : 'Authorize User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
