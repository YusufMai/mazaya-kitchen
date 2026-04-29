import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, addDoc, updateDoc, doc, serverTimestamp, orderBy, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { Users, Plus, Target, CheckCircle2, History, Banknote, X, Save, TrendingUp, UserCheck, Pencil } from 'lucide-react';
import { cn } from '../lib/utils';

interface AdasheGroup {
  id: string;
  name: string;
  contributionAmount: number;
  frequency: 'Daily' | 'Weekly' | 'Monthly';
  members: string[]; // Customer IDs
  status: 'Active' | 'Completed';
  createdAt: any;
}

interface AdasheContribution {
  id: string;
  groupId: string;
  memberId: string;
  amount: number;
  staffId: string;
  createdAt: any;
}

interface Customer {
  id: string;
  name: string;
}

export default function AdminAdashe() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<AdasheGroup[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [contributions, setContributions] = useState<AdasheContribution[]>([]);
  
  // Modals
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = useState(false);
  
  // Selection
  const [selectedGroup, setSelectedGroup] = useState<AdasheGroup | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [newMemberId, setNewMemberId] = useState('');
  const [editingGroup, setEditingGroup] = useState<AdasheGroup | null>(null);
  const [payAmount, setPayAmount] = useState('');

  // Form states
  const [gName, setGName] = useState('');
  const [gAmount, setGAmount] = useState('');
  const [gFreq, setGFreq] = useState<'Daily' | 'Weekly' | 'Monthly'>('Daily');

  useEffect(() => {
    const qGroups = query(collection(db, 'adashe_groups'), orderBy('createdAt', 'desc'));
    const unsubscribeGroups = onSnapshot(qGroups, (snapshot) => {
      const data: AdasheGroup[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as AdasheGroup));
      setGroups(data);
    }, (error) => {
      console.error("Adashe Groups Error:", error);
    });

    const qCus = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubscribeCus = onSnapshot(qCus, (snapshot) => {
      const data: Customer[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(data);
    }, (error) => {
      console.error("Adashe Customers Error:", error);
    });

    return () => {
      unsubscribeGroups();
      unsubscribeCus();
    };
  }, []);

  const fetchContributions = async (groupId: string) => {
    const q = query(collection(db, 'adashe_contributions'), where('groupId', '==', groupId), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    const data: AdasheContribution[] = [];
    snap.forEach(doc => data.push({ id: doc.id, ...doc.data() } as AdasheContribution));
    setContributions(data);
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gName || !gAmount) return;
    try {
      if (editingGroup) {
        await updateDoc(doc(db, 'adashe_groups', editingGroup.id), {
          name: gName,
          contributionAmount: parseFloat(gAmount),
          frequency: gFreq,
        });
      } else {
        await addDoc(collection(db, 'adashe_groups'), {
          name: gName,
          contributionAmount: parseFloat(gAmount),
          frequency: gFreq,
          members: [],
          status: 'Active',
          createdAt: serverTimestamp()
        });
      }
      setIsGroupModalOpen(false);
      setEditingGroup(null);
      setGName('');
      setGAmount('');
    } catch (err) {
      alert("Failed to save group");
    }
  };

  const openEditGroup = (group: AdasheGroup) => {
    setEditingGroup(group);
    setGName(group.name);
    setGAmount(group.contributionAmount.toString());
    setGFreq(group.frequency);
    setIsGroupModalOpen(true);
  };

  const handleAddContribution = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !selectedMemberId || !user || !payAmount) return;
    try {
      await addDoc(collection(db, 'adashe_contributions'), {
        groupId: selectedGroup.id,
        memberId: selectedMemberId,
        amount: parseFloat(payAmount),
        staffId: user.uid,
        createdAt: serverTimestamp()
      });
      setIsPayModalOpen(false);
      setSelectedMemberId('');
      setPayAmount('');
      fetchContributions(selectedGroup.id);
    } catch (err) {
      alert("Contribution failed");
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGroup || !newMemberId) return;
    
    if (selectedGroup.members.includes(newMemberId)) {
      alert("This customer is already a member of this group.");
      return;
    }

    try {
      const gRef = doc(db, 'adashe_groups', selectedGroup.id);
      const updatedMembers = [...selectedGroup.members, newMemberId];
      await updateDoc(gRef, {
        members: updatedMembers
      });
      
      // Update local state for immediate feedback
      setSelectedGroup({ ...selectedGroup, members: updatedMembers });
      setIsAddMemberModalOpen(false);
      setNewMemberId('');
    } catch (err) {
      alert("Failed to add member");
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto font-sans">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Adashe Savings</h2>
          <p className="text-slate-500 font-medium italic">Manage group rotation contributions.</p>
        </div>
        <button 
          onClick={() => {
            setEditingGroup(null);
            setGName('');
            setGAmount('');
            setGFreq('Daily');
            setIsGroupModalOpen(true);
          }}
          className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center hover:bg-indigo-700 transition-all shadow-md shadow-indigo-200"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create New Group
        </button>
      </div>

      <div className="grid lg:grid-cols-4 gap-8">
        {/* Groups List */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 px-2">Active Groups</h3>
          <div className="space-y-3">
            {groups.map(group => (
              <button 
                key={group.id}
                onClick={() => { setSelectedGroup(group); fetchContributions(group.id); }}
                className={cn(
                  "w-full text-left p-5 rounded-3xl border-2 transition-all",
                  selectedGroup?.id === group.id 
                    ? "border-indigo-500 bg-white shadow-xl shadow-indigo-100 ring-2 ring-indigo-50" 
                    : "border-slate-100 bg-white hover:border-slate-300"
                )}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-slate-900">{group.name}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-tighter",
                    group.status === 'Active' ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"
                  )}>
                    {group.status}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-2xl font-black text-indigo-600">₦{group.contributionAmount.toLocaleString()}</span>
                  <span className="text-xs text-slate-400 italic">Frequency: {group.frequency}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Group Details */}
        <div className="lg:col-span-3">
          {selectedGroup ? (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full min-h-[600px]">
              <div className="p-8 border-b border-slate-100 bg-slate-50/30 flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                    <TrendingUp className="w-7 h-7" />
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-black text-slate-900">{selectedGroup.name}</h3>
                      <button 
                        onClick={() => openEditGroup(selectedGroup)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="Edit Group"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-bold text-slate-500 flex items-center"><Target className="w-3 h-3 mr-1" /> Target: ₦{selectedGroup.contributionAmount}</span>
                      <span className="text-xs font-bold text-slate-500 flex items-center"><UserCheck className="w-3 h-3 mr-1" /> {selectedGroup.members.length} Members</span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setPayAmount(selectedGroup.contributionAmount.toString());
                    setIsPayModalOpen(true);
                  }}
                  className="bg-green-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center hover:bg-green-700 transition-all shadow-md shadow-green-100"
                >
                  <Banknote className="w-4 h-4 mr-2" />
                  New Contribution
                </button>
              </div>

              <div className="flex-1 grid md:grid-cols-2 divide-x divide-slate-100">
                {/* Members/Stats */}
                <div className="p-8 space-y-6">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Current Members</h4>
                    <button 
                      onClick={() => setIsAddMemberModalOpen(true)}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-full transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add Member
                    </button>
                  </div>
                  <div className="space-y-3">
                    {selectedGroup.members.length === 0 ? (
                      <div className="p-4 rounded-2xl border-2 border-dashed border-slate-200 text-center text-slate-400 text-sm font-bold italic">
                        No members assigned yet.
                      </div>
                    ) : (
                      selectedGroup.members.map(mId => {
                        const cus = customers.find(c => c.id === mId);
                        return (
                          <div key={mId} className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="font-bold text-slate-900">{cus?.name || 'Unknown'}</span>
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* History */}
                <div className="p-8 space-y-6 flex flex-col">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <History className="w-4 h-4" /> Contribution History
                  </h4>
                  <div className="flex-1 overflow-y-auto space-y-3">
                    {contributions.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-slate-300 italic py-12">
                         <History className="w-12 h-12 opacity-10 mb-2" />
                         No payments recorded.
                      </div>
                    ) : (
                      contributions.map(c => (
                        <div key={c.id} className="p-4 border-b border-slate-50 flex justify-between items-center group hover:bg-slate-50 rounded-xl transition-colors">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-sm">{customers.find(cus => cus.id === c.memberId)?.name || 'Guest'}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{c.createdAt?.toDate?.().toLocaleString() || 'Just now'}</span>
                          </div>
                          <span className="font-black text-indigo-600">₦{c.amount.toLocaleString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[600px] flex flex-col items-center justify-center bg-white rounded-[2rem] border-2 border-dashed border-slate-200 text-slate-400 space-y-4">
              <Users className="w-16 h-16 opacity-10 animate-bounce" />
              <p className="font-black text-xl italic tracking-tighter">Select an Adashe Group to manage</p>
            </div>
          )}
        </div>
      </div>

      {/* New Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 text-slate-900 border font-bold">
              <h3 className="font-black text-xl">{editingGroup ? 'Edit Adashe Group' : 'New Adashe Group'}</h3>
              <button 
                onClick={() => {
                  setIsGroupModalOpen(false);
                  setEditingGroup(null);
                }}
                className="p-2 text-slate-400 hover:text-slate-900 bg-white rounded-xl border border-slate-200 shadow-sm transition-colors"
                id="close-group-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveGroup} className="p-8 space-y-6">
              <div className="space-y-2 text-slate-500 font-bold text-sm">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Group Name</label>
                <input 
                  required 
                  value={gName} 
                  onChange={e => setGName(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-slate-900"
                  placeholder="e.g. Monday Circle"
                />
              </div>
              <div className="space-y-2 text-slate-500 font-bold text-sm">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Per Session Amount (₦)</label>
                <input 
                  required 
                  type="number" 
                  value={gAmount} 
                  onChange={e => setGAmount(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all font-black text-2xl text-slate-900"
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Frequency</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Daily', 'Weekly', 'Monthly'] as const).map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setGFreq(f)}
                      className={cn(
                        "py-3 rounded-xl font-bold text-xs uppercase transition-all border-2",
                        gFreq === f ? "border-indigo-600 bg-indigo-50 text-indigo-700" : "border-slate-100 bg-slate-50 text-slate-400"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full py-4 bg-black text-white rounded-2xl font-black text-lg hover:bg-slate-800 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2">
                <Save className="w-5 h-5" /> {editingGroup ? 'Save Changes' : 'Start Group'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New Contribution Modal */}
      {isPayModalOpen && selectedGroup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-5 border-b border-slate-100 bg-green-50/50 flex justify-between items-center text-slate-900 font-bold border-b-2">
              <div className="flex flex-col">
                <h3 className="font-black text-xl">Add Contribution</h3>
                <span className="text-xs font-bold text-slate-500 italic uppercase">{selectedGroup.name} Group</span>
              </div>
              <button 
                onClick={() => setIsPayModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-900 bg-white rounded-xl border border-slate-200 shadow-sm transition-colors"
                id="close-pay-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddContribution} className="p-8 space-y-6">
              <div className="bg-indigo-50 p-4 rounded-2xl border-2 border-indigo-100 flex justify-between items-center">
                <span className="text-sm font-bold text-indigo-700 uppercase">Default Due</span>
                <span className="text-xl font-black text-indigo-900">₦{selectedGroup.contributionAmount.toLocaleString()}</span>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Select Member</label>
                  <select 
                    required 
                    value={selectedMemberId} 
                    onChange={e => setSelectedMemberId(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-slate-900 appearance-none"
                  >
                    <option value="">Choose a person...</option>
                    {customers.filter(c => selectedGroup.members.includes(c.id)).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                    {selectedGroup.members.length === 0 && (
                      <option disabled>No members in group yet</option>
                    )}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Amount Given (₦)</label>
                  <input 
                    required 
                    type="number"
                    step="0.01"
                    value={payAmount}
                    onChange={e => setPayAmount(e.target.value)}
                    className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all font-black text-2xl text-slate-900"
                    placeholder="0.00"
                  />
                  <p className="text-[10px] text-slate-400 italic">Enter the specific amount the member paid today.</p>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={selectedGroup.members.length === 0}
                className="w-full py-4 bg-green-600 text-white rounded-2xl font-black text-lg hover:bg-green-700 transition-all shadow-xl shadow-green-100 flex items-center justify-center gap-2 uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <TrendingUp className="w-5 h-5" /> Record Contribution
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {isAddMemberModalOpen && selectedGroup && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="px-6 py-5 border-b border-slate-100 bg-indigo-50/50 flex justify-between items-center text-slate-900 font-bold border-b-2">
              <div className="flex flex-col">
                <h3 className="font-black text-xl">Add Group Member</h3>
                <span className="text-xs font-bold text-slate-500 italic uppercase">For {selectedGroup.name}</span>
              </div>
              <button 
                onClick={() => setIsAddMemberModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-900 bg-white rounded-xl border border-slate-200 shadow-sm transition-colors"
                id="close-member-modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="p-8 space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400">Select Customer</label>
                <select 
                  required 
                  value={newMemberId} 
                  onChange={e => setNewMemberId(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-indigo-500 focus:bg-white outline-none transition-all font-bold text-slate-900 appearance-none"
                >
                  <option value="">Choose a customer...</option>
                  {customers.filter(c => !selectedGroup.members.includes(c.id)).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 italic mt-1">Only customers NOT already in the group are shown.</p>
              </div>

              <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 flex items-center justify-center gap-2 uppercase tracking-widest">
                <UserCheck className="w-5 h-5" /> Add to Group
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
