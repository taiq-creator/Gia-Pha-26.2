import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Search, Plus, User, Trash2, Edit2, MapPin, BookOpen, Users, X, Calendar, Upload, ChevronDown, ChevronRight, List, Network, ZoomIn, ZoomOut, Maximize, ChevronUp, UserPlus, Download, Check } from 'lucide-react';
import { Member, FamilyTree } from './types';
import { initialMembers } from './data';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
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
        <img
          src={member.imageUrl}
          alt={member.fullName}
          className="w-5 h-5 rounded-full object-cover border border-brown-100"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="w-5 h-5 rounded-full bg-brown-50 flex items-center justify-center border border-brown-100">
          <User className="h-2.5 w-2.5 text-brown-400" />
        </div>
      )}
    </div>
    <h4 className="text-[8px] font-bold text-brown-900 text-center line-clamp-2 leading-tight">
      {member.fullName}
    </h4>
    <span className={`mt-0.5 inline-flex items-center px-1 py-0.5 rounded text-[6px] font-medium ${
      member.gender === 'male' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'
    }`}>
      {member.gender === 'male' ? 'Nam' : 'Nữ'}
    </span>
    <span className="text-[6px] text-brown-500 mt-0.5">
      {member.birthDate ? new Date(member.birthDate).getFullYear() : '?'} - {member.deathDate ? new Date(member.deathDate).getFullYear() : 'Nay'}
    </span>
  </div>
));
MemberTreeCard.displayName = 'MemberTreeCard';

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
FamilyTreeNode.displayName = 'FamilyTreeNode';

export default function App() {
  const [familyTrees, setFamilyTrees] = useState<FamilyTree[]>([]);
  const [currentTreeId, setCurrentTreeId] = useState<string>('1');
  const [isLoading, setIsLoading] = useState(true);
  const [isNewTreeModalOpen, setIsNewTreeModalOpen] = useState(false);
  const [newTreeName, setNewTreeName] = useState('');
  const [treeToDelete, setTreeToDelete] = useState<string | null>(null);

  // --- ĐỒNG BỘ SUPABASE ---
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const { data } = await supabase.from('giapha_storage').select('data_json').eq('id', 1).single();
      if (data && data.data_json) {
        setFamilyTrees(data.data_json);
        setCurrentTreeId(data.data_json[0]?.id || '1');
      } else {
        const initial: FamilyTree[] = [{ id: '1', name: 'Gia Phả Họ Cao', members: initialMembers as Member[] }];
        setFamilyTrees(initial);
        await supabase.from('giapha_storage').upsert({ id: 1, data_json: initial });
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
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<string | null>(null);
  const [currentMember, setCurrentMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState<Partial<Member>>({});
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  const [selectedGen, setSelectedGen] = useState<number>(1);
  const [expandedListMembers, setExpandedListMembers] = useState<Record<string, boolean>>({});
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isDownloading, setIsDownloading] = useState(false);
  const treeContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [isEditingCoverText, setIsEditingCoverText] = useState(false);
  const [tempCoverText, setTempCoverText] = useState('');

  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const updatedTrees = familyTrees.map(tree => {
          if (tree.id === currentTreeId) return { ...tree, coverImage: reader.result as string };
          return tree;
        });
        setFamilyTrees(updatedTrees);
        saveToCloud(updatedTrees);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveCoverText = () => {
    const updatedTrees = familyTrees.map(tree => {
      if (tree.id === currentTreeId) return { ...tree, coverText: tempCoverText };
      return tree;
    });
    setFamilyTrees(updatedTrees);
    saveToCloud(updatedTrees);
    setIsEditingCoverText(false);
  };

  const groupedMembers = useMemo(() => {
    const filtered = members.filter(m =>
      m.fullName.toLowerCase().includes(searchQuery.toLowerCase())
    );
    const groups: Record<number, Member[]> = {};
    filtered.forEach(m => {
      if (!groups[m.generation]) groups[m.generation] = [];
      groups[m.generation].push(m);
    });
    return groups;
  }, [members, searchQuery]);

  const generations = Object.keys(groupedMembers).map(Number).sort((a, b) => a - b);

  useEffect(() => {
    if (generations.length > 0 && !generations.includes(selectedGen)) {
      setSelectedGen(generations[0]);
    }
  }, [generations, selectedGen]);

  const familyTreeData = useMemo(() => {
    const getChildren = (parentId: string): Member[] => {
      return members.filter(m =>
        (m.relationshipType === 'Con trai của' || m.relationshipType === 'Con gái của') &&
        m.relatedMemberId === parentId
      );
    };
    const getSpouses = (memberId: string): Member[] => {
      return members.filter(m =>
        (m.relationshipType === 'Vợ của' || m.relationshipType === 'Chồng của') &&
        m.relatedMemberId === memberId
      );
    };
    const buildUnit = (member: Member): FamilyNodeData => {
      const spouses = getSpouses(member.id);
      const children = [
        ...getChildren(member.id),
        ...spouses.flatMap(s => getChildren(s.id))
      ];
      const uniqueChildren = Array.from(new Set(children.map(c => c.id)))
        .map(id => children.find(c => c.id === id)!);
      return { mainMember: member, spouses, children: uniqueChildren.map(buildUnit) };
    };
    const roots = members.filter(m => {
      const isChild = m.relationshipType === 'Con trai của' || m.relationshipType === 'Con gái của';
      const isSpouse = m.relationshipType === 'Vợ của' || m.relationshipType === 'Chồng của';
      return !isChild && !isSpouse;
    });
    if (roots.length === 0 && members.length > 0) {
      const gen1 = members.filter(m => m.generation === 1);
      const gen1Roots = gen1.filter(m => m.relationshipType !== 'Vợ của' && m.relationshipType !== 'Chồng của');
      return gen1Roots.map(buildUnit);
    }
    return roots.map(buildUnit);
  }, [members]);

  const handleOpenForm = (member?: Member) => {
    if (member) {
      setCurrentMember(member);
      setFormData(member);
    } else {
      setCurrentMember(null);
      setFormData({ generation: selectedGen, gender: 'male' });
    }
    setIsFormModalOpen(true);
  };

  const handleOpenDetail = useCallback((member: Member) => {
    setCurrentMember(member);
    setIsDetailModalOpen(true);
  }, []);

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMemberToDelete(id);
  };

  const executeDelete = () => {
    if (memberToDelete) {
      setMembers(members.filter(m => m.id !== memberToDelete));
      if (currentMember?.id === memberToDelete) setIsDetailModalOpen(false);
      setMemberToDelete(null);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    let finalRelationships = formData.relationships;
    if (!finalRelationships && formData.relationshipType && formData.relationshipType !== 'Khác' && formData.relatedMemberId) {
      const relatedMember = members.find(m => m.id === formData.relatedMemberId);
      if (relatedMember) finalRelationships = `${formData.relationshipType} ${relatedMember.fullName}`;
    }
    const memberDataToSave = { ...formData, relationships: finalRelationships };
    if (currentMember) {
      setMembers(members.map(m => m.id === currentMember.id ? { ...m, ...memberDataToSave } as Member : m));
    } else {
      const newMember: Member = { ...memberDataToSave, id: Date.now().toString() } as Member;
      setMembers([...members, newMember]);
    }
    setIsFormModalOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleDownloadPDF = async () => {
    if (!treeContainerRef.current) return;
    try {
      setIsDownloading(true);
      const originalTransform = treeContainerRef.current.style.transform;
      treeContainerRef.current.style.transform = 'none';
      const canvas = await html2canvas(treeContainerRef.current, {
        scale: 2,
        backgroundColor: '#fdf8f6',
        logging: false,
        useCORS: true,
      });
      treeContainerRef.current.style.transform = originalTransform;
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${currentTree.name || 'gia-pha'}.pdf`);
    } catch (err) {
      console.error('PDF error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  const toggleListExpand = (memberId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedListMembers(prev => ({ ...prev, [memberId]: !prev[memberId] }));
  };

  const getSpousesForMember = (memberId: string) => members.filter(m => (m.relationshipType === 'Vợ của' || m.relationshipType === 'Chồng của') && m.relatedMemberId === memberId);
  const getChildrenForMember = (memberId: string) => members.filter(m => (m.relationshipType === 'Con trai của' || m.relationshipType === 'Con gái của') && m.relatedMemberId === memberId);

  const renderMemberRow = (member: Member, isSubRow = false, label?: string) => {
    const age = calculateAge(member.birthDate, member.deathDate);
    const isAlive = !member.deathDate;
    const spousesCount = getSpousesForMember(member.id).length;
    const childrenCount = getChildrenForMember(member.id).length;
    const hasFamily = spousesCount > 0 || childrenCount > 0;
    const isExpandedRoot = !isSubRow && expandedListMembers[member.id];

    return (
      <div
        key={member.id}
        onClick={() => handleOpenDetail(member)}
        className={`flex items-center px-3 py-2 border-b cursor-pointer transition-all group ${
          isSubRow
            ? 'bg-gray-50 pl-8 hover:bg-gray-100'
            : isExpandedRoot
            ? 'bg-brown-700 text-white hover:bg-brown-600'
            : 'bg-white hover:bg-brown-50'
        }`}
      >
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="relative w-8 h-8 sm:w-10 sm:h-10 rounded overflow-hidden flex-shrink-0">
            {member.imageUrl ? (
              <img src={member.imageUrl} alt={member.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full bg-[#e8d5c4] flex items-center justify-center">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-[#b48a28]" />
              </div>
            )}
          </div>
          {label && (
            <span className="text-[7px] bg-[#facc15] text-black px-1 py-0.5 rounded font-bold">{label}</span>
          )}

          {/* Name on mobile */}
          <div className="sm:hidden flex flex-col justify-center">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isAlive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className={`font-bold uppercase text-[10px] truncate max-w-[140px] ${isExpandedRoot ? 'text-white' : 'text-gray-800'}`}>{member.fullName}</span>
            </div>
            <div className={`text-[9px] mt-0.5 ${isExpandedRoot ? 'text-white/70' : 'text-gray-500'}`}>
              {member.gender === 'male' ? 'Nam' : 'Nữ'}
            </div>
          </div>
        </div>

        {/* Mobile actions */}
        <div className="flex sm:hidden items-center gap-1.5 flex-shrink-0 ml-auto">
          {hasFamily && (
            <button
              onClick={(e) => toggleListExpand(member.id, e)}
              className={`p-1 rounded-full border ${isExpandedRoot ? 'border-white text-white' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}
            >
              {isExpandedRoot ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenForm(); }}
            className="bg-[#facc15] text-white rounded-full p-1 hover:bg-yellow-500 transition-colors"
          >
            <UserPlus className="h-3 w-3" />
          </button>
        </div>

        {/* Desktop info grid */}
        <div className="flex-1 hidden sm:grid grid-cols-4 items-center gap-2 sm:gap-3 ml-3">
          <div className="col-span-1 min-w-[120px]">
            <div className="flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isAlive ? 'bg-green-500' : 'bg-gray-400'}`}></div>
              <span className={`font-bold uppercase text-xs truncate ${isExpandedRoot ? 'text-white' : 'text-gray-800'}`}>{member.fullName}</span>
            </div>
            <div className={`text-[10px] mt-0.5 ${isExpandedRoot ? 'text-white/70' : 'text-gray-500'}`}>
              {member.gender === 'male' ? 'Nam' : 'Nữ'}
            </div>
          </div>
          <div className={`col-span-1 text-center text-xs ${isExpandedRoot ? 'text-white/80' : 'text-gray-600'}`}>
            {age !== null ? `${age} Tuổi` : '-'}
          </div>
          <div className={`col-span-1 text-center text-xs ${isExpandedRoot ? 'text-white/80' : 'text-gray-600'}`}>
            {spousesCount} Vợ/Chồng
          </div>
          <div className={`col-span-1 text-center text-xs ${isExpandedRoot ? 'text-white/80' : 'text-gray-600'}`}>
            {childrenCount} Con
          </div>
        </div>

        {/* Desktop actions */}
        <div className="hidden sm:flex items-center gap-2 ml-3 flex-shrink-0">
          {hasFamily && (
            <button
              onClick={(e) => toggleListExpand(member.id, e)}
              className={`p-1 rounded-full border ${isExpandedRoot ? 'border-white text-white hover:bg-white/20' : 'border-transparent text-gray-500 hover:bg-gray-100'}`}
            >
              {isExpandedRoot ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleOpenForm(); }}
            className="bg-[#facc15] text-white rounded-full p-1.5 hover:bg-yellow-500 transition-colors"
          >
            <UserPlus className="h-3 w-3" />
          </button>
        </div>
      </div>
    );
  };

  if (isLoading) return (
    <div className="h-screen flex items-center justify-center bg-[#fdf8f6]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#b48a28] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="font-bold text-[#b48a28] text-sm tracking-widest uppercase">Đang đồng bộ dữ liệu...</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col font-sans bg-gray-100 overflow-hidden">
      {/* Cover Section & Header */}
      <div className="flex-shrink-0 relative group/cover">
        <div className="h-24 sm:h-32 w-full relative overflow-hidden">
          <img
            src={currentTree.coverImage || "https://images.unsplash.com/photo-1599839619722-39751411ea63?q=80&w=2000&auto=format&fit=crop"}
            alt="Cover"
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/40"></div>

          <div className="absolute top-2 right-2 opacity-0 group-hover/cover:opacity-100 transition-opacity z-10">
            <button
              onClick={() => coverInputRef.current?.click()}
              className="bg-black/50 hover:bg-black/70 text-white rounded p-1.5 text-xs flex items-center gap-1 backdrop-blur-sm transition-colors cursor-pointer"
            >
              <Edit2 className="h-3 w-3" />
              <span className="hidden sm:inline">Đổi ảnh bìa</span>
            </button>
            <input type="file" ref={coverInputRef} onChange={handleCoverUpload} accept="image/*" className="hidden" />
          </div>

          <div className="absolute inset-0 flex items-center justify-center">
            {isEditingCoverText ? (
              <div className="flex items-center gap-2 bg-black/50 p-2 rounded backdrop-blur-sm">
                <input
                  type="text"
                  value={tempCoverText}
                  onChange={(e) => setTempCoverText(e.target.value)}
                  className="bg-transparent text-white border-b border-white/50 focus:border-white outline-none text-xl sm:text-3xl font-serif font-bold tracking-widest uppercase text-center w-64"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveCoverText();
                    if (e.key === 'Escape') setIsEditingCoverText(false);
                  }}
                />
                <button onClick={handleSaveCoverText} className="text-green-400 hover:text-green-300"><Check className="h-5 w-5" /></button>
                <button onClick={() => setIsEditingCoverText(false)} className="text-red-400 hover:text-red-300"><X className="h-5 w-5" /></button>
              </div>
            ) : (
              <div className="group/text relative flex items-center">
                <h1 className="text-2xl sm:text-4xl font-serif font-bold text-white tracking-widest uppercase drop-shadow-lg text-center px-4">
                  {currentTree.coverText || currentTree.name}
                </h1>
                <button
                  onClick={() => {
                    setTempCoverText(currentTree.coverText || currentTree.name);
                    setIsEditingCoverText(true);
                  }}
                  className="absolute -right-8 opacity-0 group-hover/text:opacity-100 text-white/70 hover:text-white transition-opacity p-1"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Bar */}
        <header className="bg-[#b48a28] text-white shadow-md">
          <div className="px-2 py-1.5 sm:py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-0">
            <div className="flex items-center justify-between sm:justify-start gap-3">
              <div className="flex items-center gap-2">
                <select
                  value={currentTreeId}
                  onChange={(e) => setCurrentTreeId(e.target.value)}
                  className="bg-transparent text-sm sm:text-base font-bold tracking-tight uppercase border-none outline-none cursor-pointer hover:bg-white/10 rounded px-1 py-0.5 appearance-none"
                >
                  {familyTrees.map(tree => (
                    <option key={tree.id} value={tree.id} className="text-black">{tree.name}</option>
                  ))}
                </select>
                <button
                  onClick={() => setIsNewTreeModalOpen(true)}
                  className="bg-white/20 hover:bg-white/30 text-white rounded p-1 flex items-center justify-center transition-colors"
                  title="Tạo gia phả mới"
                >
                  <Plus className="h-3 w-3" />
                </button>
                {familyTrees.length > 1 && (
                  <button
                    onClick={() => setTreeToDelete(currentTreeId)}
                    className="bg-red-500/20 hover:bg-red-500/40 text-white rounded p-1 flex items-center justify-center transition-colors"
                    title="Xóa gia phả hiện tại"
                  >
                    <Trash2 className="h-3 w-3 text-red-100" />
                  </button>
                )}
              </div>
              <button
                onClick={() => handleOpenForm()}
                className="bg-white/20 hover:bg-white/30 text-white rounded px-2 py-1 text-[10px] sm:text-xs font-medium flex items-center gap-1 transition-colors"
              >
                <UserPlus className="h-3 w-3" />
                Thêm thành viên
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto mt-1.5 sm:mt-0">
              <div className="flex items-center bg-white/10 rounded p-0.5 gap-0.5">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-2 py-1 rounded text-[10px] sm:text-xs font-medium flex items-center gap-1 transition-colors ${viewMode === 'list' ? 'bg-white text-[#b48a28]' : 'text-white hover:bg-white/20'}`}
                >
                  <List className="h-3 w-3" /> Danh sách
                </button>
                <button
                  onClick={() => setViewMode('tree')}
                  className={`px-2 py-1 rounded text-[10px] sm:text-xs font-medium flex items-center gap-1 transition-colors ${viewMode === 'tree' ? 'bg-white text-[#b48a28]' : 'text-white hover:bg-white/20'}`}
                >
                  <Network className="h-3 w-3" /> Sơ đồ
                </button>
              </div>

              {viewMode === 'tree' && (
                <button
                  onClick={handleDownloadPDF}
                  disabled={isDownloading}
                  className="bg-white/20 hover:bg-white/30 text-white rounded px-2 py-1 text-[10px] sm:text-xs font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
                >
                  <Download className="h-3 w-3" />
                  {isDownloading ? 'Đang xuất...' : 'PDF'}
                </button>
              )}

              <div className="relative flex-1 sm:flex-none">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/50" />
                <input
                  type="text"
                  placeholder="Tìm kiếm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-40 pl-6 pr-2 py-1 bg-white/10 rounded text-[10px] sm:text-xs text-white placeholder-white/50 outline-none border border-white/20 focus:border-white/50"
                />
              </div>
            </div>
          </div>
        </header>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {viewMode === 'list' ? (
          <>
            {/* Generation Sidebar */}
            <div className="w-16 sm:w-20 bg-white border-r border-gray-200 flex flex-col overflow-y-auto flex-shrink-0 shadow-sm">
              <div className="p-1 sm:p-2 text-center border-b bg-gray-50">
                <p className="text-[8px] sm:text-[10px] font-bold text-gray-400 uppercase">Đời</p>
              </div>
              {generations.map(gen => (
                <button
                  key={gen}
                  onClick={() => setSelectedGen(gen)}
                  className={`py-2 sm:py-3 px-1 flex flex-col items-center border-b transition-all ${
                    selectedGen === gen
                      ? 'bg-[#b48a28] text-white'
                      : 'text-brown-700 hover:bg-brown-50'
                  }`}
                >
                  <span className="text-xs sm:text-base font-black">{gen}</span>
                  <span className={`text-[7px] sm:text-[8px] ${selectedGen === gen ? 'text-white/70' : 'text-gray-400'}`}>
                    {groupedMembers[gen]?.length || 0} người
                  </span>
                </button>
              ))}
            </div>

            {/* Member List */}
            <div className="flex-1 overflow-y-auto bg-gray-50">
              {/* Stats Bar */}
              <div className="bg-white border-b px-3 py-2 flex items-center gap-4 sm:gap-6 sticky top-0 z-10 shadow-sm">
                <div className="text-center">
                  <p className="text-sm sm:text-base font-black text-gray-800">{members.length}</p>
                  <p className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase">Thành viên</p>
                </div>
                <div className="text-center">
                  <p className="text-sm sm:text-base font-black text-blue-600">{members.filter(m => m.gender === 'male').length}</p>
                  <p className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase">Nam</p>
                </div>
                <div className="text-center">
                  <p className="text-sm sm:text-base font-black text-rose-600">{members.filter(m => m.gender === 'female').length}</p>
                  <p className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase">Nữ</p>
                </div>
                <div className="text-center">
                  <p className="text-sm sm:text-base font-black text-green-600">{members.filter(m => !m.deathDate).length}</p>
                  <p className="text-[8px] sm:text-[9px] font-bold text-gray-400 uppercase">Còn sống</p>
                </div>
                <div className="ml-auto hidden sm:grid grid-cols-4 text-[9px] font-bold text-gray-400 uppercase text-center gap-2 pr-2" style={{ minWidth: '320px' }}>
                  <span>Tên</span><span>Tuổi</span><span>Vợ/Chồng</span><span>Con</span>
                </div>
              </div>

              <div className="p-2 text-[10px] font-bold text-gray-400 bg-gray-50 border-b uppercase tracking-widest italic px-3">
                Danh sách thành viên đời thứ {selectedGen}:
              </div>

              {/* Members */}
              <div className="divide-y divide-gray-100">
                {(groupedMembers[selectedGen] || []).map(member => {
                  const isExpanded = expandedListMembers[member.id];
                  const spouses = getSpousesForMember(member.id);
                  const children = getChildrenForMember(member.id);
                  return (
                    <div key={member.id}>
                      {renderMemberRow(member)}
                      {isExpanded && (
                        <div className="border-t border-gray-100">
                          {spouses.map(s => renderMemberRow(s, true, 'Vợ/Chồng'))}
                          {children.map(c => renderMemberRow(c, true, 'Con'))}
                        </div>
                      )}
                    </div>
                  );
                })}
                {(groupedMembers[selectedGen] || []).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                    <Users className="h-10 w-10 mb-3 opacity-30" />
                    <p className="text-sm font-medium">Chưa có thành viên đời {selectedGen}</p>
                    <button
                      onClick={() => handleOpenForm()}
                      className="mt-3 bg-[#b48a28] text-white rounded px-4 py-2 text-xs font-bold hover:bg-[#9a7522] transition-colors"
                    >
                      + Thêm thành viên
                    </button>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          /* Tree View */
          <div
            className="flex-1 bg-brown-50 overflow-hidden relative cursor-grab active:cursor-grabbing select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5">
              <button onClick={() => setZoom(z => Math.min(z + 0.15, 3))} className="bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors border border-gray-200">
                <ZoomIn className="h-4 w-4 text-gray-600" />
              </button>
              <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors border border-gray-200">
                <Maximize className="h-4 w-4 text-gray-600" />
              </button>
              <button onClick={() => setZoom(z => Math.max(z - 0.15, 0.2))} className="bg-white rounded-full w-8 h-8 flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors border border-gray-200">
                <ZoomOut className="h-4 w-4 text-gray-600" />
              </button>
            </div>

            <div
              ref={treeContainerRef}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'center top',
                transition: isDragging ? 'none' : 'transform 0.1s ease'
              }}
              className="absolute inset-0 flex items-start justify-center pt-8 family-tree"
            >
              {familyTreeData.length > 0 ? (
                <ul className="flex gap-8">
                  {familyTreeData.map(node => (
                    <FamilyTreeNode key={node.mainMember.id} node={node} onOpenDetail={handleOpenDetail} />
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-brown-400">
                  <Network className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm font-medium">Chưa có dữ liệu để hiển thị sơ đồ</p>
                  <p className="text-xs mt-1 opacity-60">Thêm thành viên và thiết lập quan hệ để xem sơ đồ</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {isDetailModalOpen && currentMember && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsDetailModalOpen(false)}></div>
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
              <div className="bg-[#b48a28] px-5 py-3 flex justify-between items-center">
                <h3 className="text-white font-bold text-sm tracking-wide">Thông tin thành viên</h3>
                <button onClick={() => setIsDetailModalOpen(false)} className="text-white/80 hover:text-white transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="p-5">
                <div className="flex items-start gap-4 mb-5">
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-brown-100 border-2 border-brown-200">
                    {currentMember.imageUrl ? (
                      <img src={currentMember.imageUrl} alt={currentMember.fullName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#e8d5c4]">
                        <User className="h-8 w-8 text-[#b48a28]" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="font-black text-gray-900 text-lg leading-tight truncate">{currentMember.fullName}</h2>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] bg-brown-100 text-brown-700 px-2 py-0.5 rounded font-bold">Đời {currentMember.generation}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${currentMember.gender === 'male' ? 'bg-blue-100 text-blue-700' : 'bg-rose-100 text-rose-700'}`}>
                        {currentMember.gender === 'male' ? 'Nam' : 'Nữ'}
                      </span>
                      {!currentMember.deathDate && (
                        <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold">Còn sống</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => { setIsDetailModalOpen(false); handleOpenForm(currentMember); }}
                      className="p-2 text-gray-400 hover:text-[#b48a28] hover:bg-brown-50 rounded-lg transition-colors border border-gray-100"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { setIsDetailModalOpen(false); handleDeleteClick(currentMember.id, e); }}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-gray-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                    <Calendar className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Ngày sinh - Ngày mất</p>
                      <p className="text-sm font-semibold text-gray-800">
                        {currentMember.birthDate || '?'} — {currentMember.deathDate || 'Nay'}
                        {calculateAge(currentMember.birthDate, currentMember.deathDate) !== null && (
                          <span className="text-gray-500 font-normal ml-1">({calculateAge(currentMember.birthDate, currentMember.deathDate)} tuổi)</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {currentMember.relationships && (
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <Users className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Quan hệ</p>
                        <p className="text-sm font-semibold text-gray-800">{currentMember.relationships}</p>
                      </div>
                    </div>
                  )}

                  {currentMember.graveLocation && (
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Mộ phần</p>
                        <p className="text-sm font-semibold text-gray-800">{currentMember.graveLocation}</p>
                      </div>
                    </div>
                  )}

                  {currentMember.biography && (
                    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <BookOpen className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase mb-0.5">Tiểu sử</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{currentMember.biography}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsFormModalOpen(false)}></div>
            <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
              <div className="bg-[#b48a28] px-5 py-3 flex justify-between items-center">
                <h3 className="text-white font-bold text-sm">
                  {currentMember ? 'Chỉnh sửa thành viên' : 'Thêm thành viên mới'}
                </h3>
                <button onClick={() => setIsFormModalOpen(false)} className="text-white/80 hover:text-white transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-5 overflow-y-auto max-h-[75vh]">
                <div className="flex justify-center mb-5">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-xl overflow-hidden bg-[#e8d5c4] border-2 border-brown-200 flex items-center justify-center">
                      {formData.imageUrl ? (
                        <img src={formData.imageUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-10 w-10 text-[#b48a28]" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute -bottom-2 -right-2 bg-[#b48a28] text-white rounded-full p-1.5 shadow-md hover:bg-[#9a7522] transition-colors"
                    >
                      <Upload className="h-3 w-3" />
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Họ và tên *</label>
                    <input
                      type="text"
                      name="fullName"
                      required
                      value={formData.fullName || ''}
                      onChange={handleInputChange}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#b48a28] transition-colors"
                      placeholder="Nhập họ và tên đầy đủ"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Giới tính</label>
                    <select
                      name="gender"
                      value={formData.gender || 'male'}
                      onChange={handleInputChange}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#b48a28] transition-colors"
                    >
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Đời thứ *</label>
                    <input
                      type="number"
                      name="generation"
                      required
                      min="1"
                      value={formData.generation || ''}
                      onChange={handleInputChange}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#b48a28] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Ngày sinh</label>
                    <input
                      type="date"
                      name="birthDate"
                      value={formData.birthDate || ''}
                      onChange={handleInputChange}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#b48a28] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Ngày mất</label>
                    <input
                      type="date"
                      name="deathDate"
                      value={formData.deathDate || ''}
                      onChange={handleInputChange}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#b48a28] transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Loại quan hệ</label>
                    <select
                      name="relationshipType"
                      value={formData.relationshipType || ''}
                      onChange={handleInputChange}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#b48a28] transition-colors"
                    >
                      <option value="">-- Chọn --</option>
                      <option value="Con trai của">Con trai của</option>
                      <option value="Con gái của">Con gái của</option>
                      <option value="Vợ của">Vợ của</option>
                      <option value="Chồng của">Chồng của</option>
                      <option value="Khác">Khác</option>
                    </select>
                  </div>

                  {formData.relationshipType && formData.relationshipType !== 'Khác' && (
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Liên quan đến</label>
                      <select
                        name="relatedMemberId"
                        value={formData.relatedMemberId || ''}
                        onChange={handleInputChange}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#b48a28] transition-colors"
                      >
                        <option value="">-- Chọn người --</option>
                        {members
                          .filter(m => m.id !== currentMember?.id)
                          .map(m => (
                            <option key={m.id} value={m.id}>{m.fullName} (Đời {m.generation})</option>
                          ))
                        }
                      </select>
                    </div>
                  )}

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Mô tả quan hệ</label>
                    <input
                      type="text"
                      name="relationships"
                      value={formData.relationships || ''}
                      onChange={handleInputChange}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#b48a28] transition-colors"
                      placeholder="VD: Con trai trưởng ông Nguyễn Văn A"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Địa điểm mộ phần</label>
                    <input
                      type="text"
                      name="graveLocation"
                      value={formData.graveLocation || ''}
                      onChange={handleInputChange}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#b48a28] transition-colors"
                      placeholder="VD: Nghĩa trang Lái Thiêu, Bình Dương"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tiểu sử</label>
                    <textarea
                      name="biography"
                      value={formData.biography || ''}
                      onChange={handleInputChange}
                      rows={3}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#b48a28] transition-colors resize-none"
                      placeholder="Nhập thông tin tiểu sử..."
                    />
                  </div>
                </div>

                <div className="flex gap-3 mt-5">
                  <button
                    type="button"
                    onClick={() => setIsFormModalOpen(false)}
                    className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-[#b48a28] text-white py-2.5 rounded-xl text-sm font-bold hover:bg-[#9a7522] transition-colors shadow-md"
                  >
                    {currentMember ? 'Lưu thay đổi' : 'Thêm thành viên'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Member Modal */}
      {memberToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMemberToDelete(null)}></div>
            <div className="relative z-10 bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Xóa thành viên</h3>
                  <p className="text-sm text-gray-500">Hành động này không thể hoàn tác.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setMemberToDelete(null)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors">
                  Hủy
                </button>
                <button onClick={executeDelete} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors">
                  Xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Tree Modal */}
      {isNewTreeModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsNewTreeModalOpen(false)}></div>
            <div className="relative z-10 bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4">Tạo gia phả mới</h3>
              <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tên gia phả</label>
              <input
                type="text"
                value={newTreeName}
                onChange={(e) => setNewTreeName(e.target.value)}
                placeholder="VD: Gia Phả Họ Nguyễn"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#b48a28] mb-5"
              />
              <div className="flex gap-3">
                <button onClick={() => setIsNewTreeModalOpen(false)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors">
                  Hủy
                </button>
                <button
                  disabled={!newTreeName.trim()}
                  onClick={() => {
                    if (newTreeName.trim()) {
                      const newTree: FamilyTree = { id: Date.now().toString(), name: newTreeName.trim(), members: [] };
                      const updatedTrees = [...familyTrees, newTree];
                      setFamilyTrees(updatedTrees);
                      saveToCloud(updatedTrees);
                      setCurrentTreeId(newTree.id);
                      setNewTreeName('');
                      setIsNewTreeModalOpen(false);
                    }
                  }}
                  className="flex-1 bg-[#b48a28] text-white py-2 rounded-lg text-sm font-bold hover:bg-[#9a7522] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Tạo mới
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Tree Modal */}
      {treeToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="flex items-center justify-center min-h-screen p-4">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setTreeToDelete(null)}></div>
            <div className="relative z-10 bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Xóa gia phả</h3>
                  <p className="text-sm text-gray-500">Toàn bộ thành viên sẽ bị xóa. Không thể hoàn tác.</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setTreeToDelete(null)} className="flex-1 border border-gray-200 text-gray-600 py-2 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors">
                  Hủy
                </button>
                <button
                  onClick={() => {
                    const newTrees = familyTrees.filter(t => t.id !== treeToDelete);
                    setFamilyTrees(newTrees);
                    saveToCloud(newTrees);
                    if (currentTreeId === treeToDelete) setCurrentTreeId(newTrees[0].id);
                    setTreeToDelete(null);
                  }}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-bold hover:bg-red-700 transition-colors"
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
