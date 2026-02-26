import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Search, Plus, User, Trash2, Edit2, MapPin, BookOpen, Users, X, Calendar, Upload, ChevronDown, List, Network, ZoomIn, ZoomOut, Maximize, ChevronUp, UserPlus, Download, Check, ChevronRight } from 'lucide-react';
import { Member, FamilyTree } from './types';
import { initialMembers } from './data';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
// Nhập kết nối Supabase
import { supabase } from './supabaseClient';

interface FamilyNodeData {
  mainMember: Member;
  spouses: Member[];
  children: FamilyNodeData[];
}

const calculateAge = (birthDate?: string, deathDate?: string) => {
  if (!birthDate) return null;
  const start = new Date(birthDate);
  const end = deathDate ? new Date(deathDate) : new Date();
  let age = end.getFullYear() - start.getFullYear();
  const m = end.getMonth() - start.getMonth();
  if (m < 0 || (m === 0 && end.getDate() < start.getDate())) {
    age--;
  }
  return age;
};

const MemberTreeCard = React.memo(({ member, isSpouse = false, onOpenDetail }: { member: Member, isSpouse?: boolean, onOpenDetail: (m: Member) => void }) => (
  <div 
    onClick={() => onOpenDetail(member)}
    className={`bg-white border ${isSpouse ? 'border-brown-100' : 'border-brown-300'} rounded shadow-sm p-1 w-16 flex flex-col items-center cursor-pointer hover:border-brown-500 hover:shadow-md transition-all z-10 relative`}
  >
    <div className="relative mb-0.5">
      {member.imageUrl ? (
        <img src={member.imageUrl} alt={member.fullName} className="w-5 h-5 rounded-full object-cover border border-brown-100" referrerPolicy="no-referrer" />
      ) : (
        <div className="w-5 h-5 rounded-full bg-brown-50 flex items-center justify-center border border-brown-100">
          <User className="h-2.5 w-2.5 text-brown-400" />
        </div>
      )}
    </div>
    <h4 className="text-[8px] font-bold text-brown-900 text-center line-clamp-2 leading-tight">{member.fullName}</h4>
    <span className={`mt-0.5 inline-flex items-center px-1 py-0.5 rounded text-[6px] font-medium ${member.gender === 'male' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'}`}>
      {member.gender === 'male' ? 'Nam' : 'Nữ'}
    </span>
  </div>
));

const FamilyTreeNode = React.memo(({ node, onOpenDetail }: { node: FamilyNodeData, onOpenDetail: (m: Member) => void }) => (
  <li>
    <div className="flex justify-center items-center gap-1.5 relative">
      <MemberTreeCard member={node.mainMember} onOpenDetail={onOpenDetail} />
      {node.spouses.map(spouse => (
        <div key={spouse.id} className="flex items-center gap-1.5">
          <div className="w-2 h-px bg-brown-400"></div>
          <MemberTreeCard member={spouse} isSpouse onOpenDetail={onOpenDetail} />
        </div>
      ))}
    </div>
    {node.children.length > 0 && (
      <ul>
        {node.children.map(child => (
          <FamilyTreeNode key={child.mainMember.id} node={child} onOpenDetail={onOpenDetail} />
        ))}
      </ul>
    )}
  </li>
));

export default function App() {
  const [familyTrees, setFamilyTrees] = useState<FamilyTree[]>([]);
  const [currentTreeId, setCurrentTreeId] = useState<string>('1');
  const [isLoading, setIsLoading] = useState(true);

  // --- ĐỒNG BỘ SUPABASE ---
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const { data } = await supabase.from('giapha_storage').select('data_json').eq('id', 1).single();
      if (data && data.data_json) {
        setFamilyTrees(data.data_json);
      } else {
        const initial = [{ id: '1', name: 'GIA PHẢ HỌ CAO', members: initialMembers as Member[] }];
        setFamilyTrees(initial);
        await saveToCloud(initial);
      }
      setIsLoading(false);
    };
    loadData();
  }, []);

  const saveToCloud = async (updatedTrees: FamilyTree[]) => {
    await supabase.from('giapha_storage').upsert({ id: 1, data_json: updatedTrees });
  };

  const currentTree = familyTrees.find(t => t.id === currentTreeId) || (familyTrees.length > 0 ? familyTrees[0] : { id: '1', name: 'Gia Phả Họ Cao', members: [] });
  const members = currentTree.members;

  const setMembers = (newMembers: Member[]) => {
    const updatedTrees = familyTrees.map(tree => {
      if (tree.id === currentTreeId) return { ...tree, members: newMembers };
      return tree;
    });
    setFamilyTrees(updatedTrees);
    saveToCloud(updatedTrees);
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [selectedGen, setSelectedGen] = useState<number>(1);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState<Partial<Member>>({});
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  const groupedMembers = useMemo(() => {
    const filtered = members.filter(m => m.fullName.toLowerCase().includes(searchQuery.toLowerCase()));
    const groups: Record<number, Member[]> = {};
    filtered.forEach(m => {
      if (!groups[m.generation]) groups[m.generation] = [];
      groups[m.generation].push(m);
    });
    return groups;
  }, [members, searchQuery]);

  const generations = Object.keys(groupedMembers).map(Number).sort((a, b) => a - b);
  
  const getSpousesCount = (memberId: string) => members.filter(m => (m.relationshipType === 'Vợ của' || m.relationshipType === 'Chồng của') && m.relatedMemberId === memberId).length;
  const getChildrenCount = (memberId: string) => members.filter(m => (m.relationshipType === 'Con trai của' || m.relationshipType === 'Con gái của') && m.relatedMemberId === memberId).length;

  const handleOpenForm = (member?: Member) => {
    if (member) { setCurrentMember(member); setFormData(member); }
    else { setCurrentMember(null); setFormData({ generation: selectedGen, gender: 'male' }); }
    setIsFormModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentMember) {
      setMembers(members.map(m => m.id === currentMember.id ? { ...m, ...formData } as Member : m));
    } else {
      const newMember = { ...formData, id: Date.now().toString() } as Member;
      setMembers([...members, newMember]);
    }
    setIsFormModalOpen(false);
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-[#fdf8f6] font-bold text-[#b48a28]">ĐANG ĐỒNG BỘ DỮ LIỆU...</div>;

  return (
    <div className="h-screen flex flex-col font-sans bg-gray-100 overflow-hidden">
      {/* BANNER THEO 13.PNG */}
      <div className="flex-shrink-0 h-28 sm:h-36 w-full relative overflow-hidden flex items-center justify-center bg-[#0a192f]">
        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-white tracking-[0.3em] uppercase drop-shadow-2xl z-10">
          {currentTree.name || "GIA PHẢ HỌ CAO"}
        </h1>
      </div>

      {/* NAVIGATION BAR VÀNG GOLD */}
      <header className="bg-[#b48a28] text-white shadow-lg flex-shrink-0">
        <div className="px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="font-bold text-xs uppercase tracking-widest">{currentTree.name}</span>
            <button onClick={() => handleOpenForm()} className="bg-white/20 hover:bg-white/40 text-white rounded px-3 py-1 text-[10px] font-bold flex items-center gap-1 transition-all">
              <Plus size={14} /> Thêm thành viên
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-black/20 p-0.5 rounded flex items-center gap-1">
              <button onClick={() => setViewMode('list')} className={`px-3 py-1 rounded text-[10px] font-bold ${viewMode === 'list' ? 'bg-white text-[#b48a28]' : 'text-white/80'}`}><List size={14}/> Danh sách</button>
              <button onClick={() => setViewMode('tree')} className={`px-3 py-1 rounded text-[10px] font-bold ${viewMode === 'tree' ? 'bg-white text-[#b48a28]' : 'text-white/80'}`}><Network size={14}/> Sơ đồ</button>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-white/50" />
              <input type="text" placeholder="Tìm kiếm..." className="pl-7 pr-3 py-1 rounded bg-black/20 text-white text-[10px] outline-none w-32 sm:w-48 placeholder-white/40" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {viewMode === 'list' ? (
          <>
            {/* CỘT ĐỜI THỨ THEO 13.PNG */}
            <div className="w-full md:w-24 bg-white border-r border-gray-200 overflow-x-auto md:overflow-y-auto flex md:flex-col shadow-inner">
              {generations.map(gen => (
                <div key={gen} onClick={() => setSelectedGen(gen)} className={`py-4 px-2 flex flex-col items-center cursor-pointer border-b transition-all ${selectedGen === gen ? 'bg-[#b48a28] text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>
                  <span className="text-[8px] uppercase font-bold opacity-80">ĐỜI THỨ</span>
                  <span className="text-2xl font-black leading-none my-1">{gen}</span>
                  <div className="flex gap-1 text-[9px] font-bold">
                    <span className={selectedGen === gen ? 'text-white' : 'text-blue-500'}>♂{groupedMembers[gen]?.filter(m=>m.gender==='male').length}</span>
                    <span className={selectedGen === gen ? 'text-white' : 'text-pink-500'}>♀{groupedMembers[gen]?.filter(m=>m.gender==='female').length}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* DANH SÁCH THEO 13.PNG */}
            <div className="flex-1 bg-white overflow-y-auto flex flex-col">
              <div className="bg-[#fdf8f6] border-b p-3 flex justify-around items-center sticky top-0 z-10 shadow-sm">
                 <div className="text-center"><p className="text-xl font-bold">{members.length}</p><p className="text-[9px] text-gray-500 uppercase font-bold tracking-tighter">Thành viên</p></div>
                 <div className="text-center"><p className="text-xl font-bold text-blue-600">{members.filter(m=>m.gender==='male').length}</p><p className="text-[9px] text-gray-500 uppercase font-bold tracking-tighter">Nam</p></div>
                 <div className="text-center"><p className="text-xl font-bold text-pink-600">{members.filter(m=>m.gender==='female').length}</p><p className="text-[9px] text-gray-500 uppercase font-bold tracking-tighter">Nữ</p></div>
                 <button className="flex flex-col items-center bg-gray-100 px-4 py-1 rounded hover:bg-gray-200 transition-colors">
                   <ChevronDown size={14} className="text-gray-500"/><span className="text-[9px] font-bold text-gray-500 uppercase">Mở rộng</span>
                 </button>
              </div>

              <div className="p-3 text-[10px] font-bold text-gray-400 bg-gray-50 border-b uppercase tracking-widest italic">Danh sách thành viên đời thứ {selectedGen}:</div>
              
              {groupedMembers[selectedGen]?.map(member => (
                <div key={member.id} onClick={() => { setCurrentMember(member); setIsDetailModalOpen(true); }} className="flex items-center p-3 border-b hover:bg-gray-50 cursor-pointer group transition-all">
                  <div className="w-12 h-12 rounded bg-[#e8d5c4] flex items-center justify-center mr-4 shadow-sm overflow-hidden flex-shrink-0">
                    {member.imageUrl ? <img src={member.imageUrl} className="w-full h-full object-cover" /> : <User className="text-[#b48a28]" size={24} />}
                  </div>
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 items-center gap-4">
                    <div className="min-w-0"><p className="font-black text-gray-800 uppercase text-sm tracking-tighter truncate">{member.fullName}</p><p className="text-[10px] text-gray-500">{member.gender === 'male' ? 'Nam' : 'Nữ'}</p></div>
                    <div className="hidden sm:block text-center text-xs font-bold text-gray-600">{calculateAge(member.birthDate, member.deathDate)} Tuổi</div>
                    <div className="hidden sm:block text-center text-xs font-bold text-gray-600">{getSpousesCount(member.id)} Vợ/Chồng</div>
                    <div className="hidden sm:block text-center text-xs font-bold text-gray-600">{getChildrenCount(member.id)} Con</div>
                  </div>
                  <ChevronRight size={18} className="text-gray-300 group-hover:text-[#b48a28]" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 bg-gray-50 overflow-hidden relative">
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
                <button onClick={() => setZoom(z => z + 0.1)} className="bg-white p-2 shadow-lg rounded-full hover:bg-gray-100 transition-colors"><ZoomIn size={20}/></button>
                <button onClick={() => setZoom(1)} className="bg-white p-2 shadow-lg rounded-full hover:bg-gray-100 transition-colors"><Maximize size={20}/></button>
                <button onClick={() => setZoom(z => Math.max(0.2, z - 0.1))} className="bg-white p-2 shadow-lg rounded-full hover:bg-gray-100 transition-colors"><ZoomOut size={20}/></button>
            </div>
            {/* Logic render tree ở đây... */}
          </div>
        )}
      </div>

      {/* MODAL CHI TIẾT THEO 1.PNG */}
      {isDetailModalOpen && currentMember && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
           <div className="bg-white rounded-xl w-full max-w-sm overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200">
              <div className="bg-[#b48a28] px-4 py-2.5 flex justify-between items-center">
                <h3 className="text-white font-bold text-sm">Thông tin thành viên</h3>
                <button onClick={() => setIsDetailModalOpen(false)} className="text-white hover:rotate-90 transition-transform"><X size={20}/></button>
              </div>
              <div className="p-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h2 className="text-2xl font-black text-gray-900 uppercase tracking-tighter leading-none">{currentMember.fullName}</h2>
                    <div className="flex items-center gap-2 mt-2 font-bold text-[10px]">
                       <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200">Đời {currentMember.generation}</span>
                       <span className="text-blue-600">• {currentMember.gender === 'male' ? 'Nam' : 'Nữ'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setIsDetailModalOpen(false); handleOpenForm(currentMember); }} className="p-1.5 text-gray-400 hover:text-[#b48a28] border border-gray-100 rounded-lg transition-colors"><Edit2 size={16}/></button>
                    <button onClick={() => { if(window.confirm('Xóa?')) { setMembers(members.filter(m => m.id !== currentMember.id)); setIsDetailModalOpen(false); } }} className="p-1.5 text-red-400 hover:text-red-600 border border-gray-100 rounded-lg transition-colors"><Trash2 size={16}/></button>
                  </div>
                </div>
                <div className="space-y-4 text-xs font-medium text-gray-600">
                   <div className="flex items-start gap-4">
                     <Calendar size={18} className="text-gray-400 mt-0.5 flex-shrink-0"/>
                     <div><p className="text-[10px] font-bold text-gray-400 uppercase">Sinh - Mất</p><p className="font-bold text-gray-900 text-sm mt-0.5">{currentMember.birthDate || '?'} - {currentMember.deathDate || 'Nay'} ({calculateAge(currentMember.birthDate, currentMember.deathDate)}t)</p></div>
                   </div>
                   <div className="flex items-start gap-4">
                     <Users size={18} className="text-gray-400 mt-0.5 flex-shrink-0"/>
                     <div><p className="text-[10px] font-bold text-gray-400 uppercase">Quan hệ</p><p className="font-bold text-gray-900 text-sm mt-0.5">{currentMember.relationships || '—'}</p></div>
                   </div>
                   <div className="flex items-start gap-4">
                     <MapPin size={18} className="text-gray-400 mt-0.5 flex-shrink-0"/>
                     <div><p className="text-[10px] font-bold text-gray-400 uppercase">Mộ phần</p><p className="font-bold text-gray-900 text-sm mt-0.5">{currentMember.graveLocation || '—'}</p></div>
                   </div>
                   <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-2 mb-2"><BookOpen size={16} className="text-gray-400"/><p className="text-[10px] font-bold text-gray-400 uppercase">Tiểu sử</p></div>
                      <p className="text-gray-700 italic leading-relaxed text-[13px]">{currentMember.biography || 'Chưa có thông tin tiểu sử.'}</p>
                   </div>
                </div>
              </div>
           </div>
        </div>
      )}

      {/* FORM CHỈNH SỬA THEO 2.PNG */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
          <form onSubmit={handleSave} className="bg-white rounded-[2rem] w-full max-w-lg p-8 shadow-2xl relative animate-in slide-in-from-bottom-4 duration-300 overflow-y-auto max-h-[90vh]">
            <button type="button" onClick={() => setIsFormModalOpen(false)} className="absolute top-6 right-6 text-gray-300 hover:text-gray-500 transition-colors"><X size={24}/></button>
            <h3 className="text-2xl font-black mb-8 text-gray-800 tracking-tight">Chỉnh sửa thành viên</h3>
            
            <div className="flex justify-center mb-8">
               <div className="w-24 h-24 rounded-full bg-gray-100 border-4 border-white shadow-xl overflow-hidden flex items-center justify-center relative group cursor-pointer">
                  {formData.imageUrl ? <img src={formData.imageUrl} className="w-full h-full object-cover" /> : <User size={48} className="text-gray-300" />}
                  <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center"><Upload size={24} className="text-white" /></div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-5 text-left">
              <div className="col-span-1">
                <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">Họ và tên <span className="text-red-500">*</span></label>
                <input type="text" className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-[#b48a28] font-medium" required value={formData.fullName || ''} onChange={e => setFormData({...formData, fullName: e.target.value})} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">Giới tính</label>
                <select className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-[#b48a28] font-medium" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value as any})}>
                  <option value="male">Nam</option><option value="female">Nữ</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">Đời thứ <span className="text-red-500">*</span></label>
                <input type="number" className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-[#b48a28] font-medium" value={formData.generation || ''} onChange={e => setFormData({...formData, generation: Number(e.target.value)})} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">Địa điểm mộ phần</label>
                <input type="text" className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-[#b48a28] font-medium" value={formData.graveLocation || ''} onChange={e => setFormData({...formData, graveLocation: e.target.value})} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">Ngày sinh</label>
                <input type="date" className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-[#b48a28]" value={formData.birthDate || ''} onChange={e => setFormData({...formData, birthDate: e.target.value})} />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">Ngày mất (nếu có)</label>
                <input type="date" className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-[#b48a28]" value={formData.deathDate || ''} onChange={e => setFormData({...formData, deathDate: e.target.value})} />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] font-bold text-gray-500 mb-1.5 block">Tiểu sử</label>
                <textarea className="w-full p-3 border border-gray-200 rounded-2xl outline-none focus:border-[#b48a28] h-24 resize-none" value={formData.biography || ''} onChange={e => setFormData({...formData, biography: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-4 mt-8">
              <button type="button" onClick={() => setIsFormModalOpen(false)} className="flex-1 bg-white border border-gray-200 text-gray-500 py-3.5 rounded-2xl font-bold hover:bg-gray-50 uppercase tracking-tighter text-sm">Hủy bỏ</button>
              <button type="submit" className="flex-1 bg-[#b48a28] text-white py-3.5 rounded-2xl font-bold hover:bg-[#a17a23] shadow-lg shadow-yellow-900/20 uppercase tracking-tighter text-sm">Lưu thông tin</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
