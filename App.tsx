import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Search, Plus, User, Trash2, Edit2, MapPin, BookOpen, Users, X, Calendar, Upload, ChevronDown, ChevronRight, List, Network, ZoomIn, ZoomOut, Maximize, ChevronUp, UserPlus, Download, Check, LogOut, Bell, PartyPopper } from 'lucide-react';
import { Member, FamilyTree } from './types';
import { initialMembers } from './data';
// html2canvas and jsPDF are loaded lazily in handleDownloadPDF
// jsPDF is loaded lazily in handleDownloadPDF
import { supabase } from './supabaseClient';
import { Lunar } from 'lunar-calendar';
import AuthPage from './AuthPage';
import EventsModal, { checkUpcomingEvents, FamilyEvent } from './EventsModal';

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

const MemberTreeCard = React.memo(({ member, isSpouse = false, onOpenDetail }: { member: Member, isSpouse?: boolean, onOpenDetail: (m: Member) => void }) => {
  const isMale = member.gender === 'male';
  const borderColor = isMale ? '#22c55e' : '#f97316';
  const bgHeader = isMale ? '#dcfce7' : '#ffedd5';
  const textColor = isMale ? '#15803d' : '#c2410c';
  return (
    <div
      onClick={() => onOpenDetail(member)}
      style={{ borderColor, boxShadow: `0 2px 8px ${borderColor}40` }}
      className="bg-white rounded-xl border-2 w-24 flex flex-col items-center cursor-pointer hover:scale-105 transition-all z-10 relative overflow-hidden select-none"
    >
      {/* Header màu theo giới tính */}
      <div style={{ backgroundColor: bgHeader }} className="w-full flex justify-center pt-2 pb-1">
        {member.imageUrl ? (
          <img
            src={member.imageUrl}
            alt={member.fullName}
            className="w-14 h-14 rounded-full object-cover border-2"
            style={{ borderColor }}
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-14 h-14 rounded-full flex items-center justify-center border-2 bg-white" style={{ borderColor }}>
            <User className="h-7 w-7" style={{ color: borderColor }} />
          </div>
        )}
      </div>
      {/* Tên */}
      <div className="px-1 py-1.5 text-center w-full">
        <p className="text-[10px] font-bold text-gray-800 leading-tight line-clamp-2">{member.fullName}</p>
        <p className="text-[8px] mt-0.5 font-semibold" style={{ color: textColor }}>
          {member.birthDate ? new Date(member.birthDate).getFullYear() : '?'}
          {member.deathDate ? ` - ${new Date(member.deathDate).getFullYear()}` : ''}
        </p>
      </div>
    </div>
  );
});
MemberTreeCard.displayName = 'MemberTreeCard';

const FamilyTreeNode = React.memo(({ node, onOpenDetail }: { node: FamilyNodeData, onOpenDetail: (m: Member) => void }) => {
  const hasChildren = node.children.length > 0;
  const singleChild = node.children.length === 1;
  return (
    <li className="flex flex-col items-center" style={{ listStyle: 'none' }}>
      {/* Cặp vợ chồng */}
      <div className="flex justify-center items-center relative">
        <MemberTreeCard member={node.mainMember} onOpenDetail={onOpenDetail} />
        {node.spouses.map((spouse) => (
          <div key={spouse.id} className="flex items-center">
            {/* Đường nối đỏ vợ chồng */}
            <div style={{ width: 20, height: 3, background: '#ef4444', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', position: 'absolute' }}></div>
            </div>
            <MemberTreeCard member={spouse} isSpouse onOpenDetail={onOpenDetail} />
          </div>
        ))}
      </div>
      {/* Con cái */}
      {hasChildren && (
        <div className={`tree-children ${singleChild ? 'single-child' : ''}`}>
          {node.children.map((child, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === node.children.length - 1;
            return (
              <div
                key={child.mainMember.id}
                className={`tree-node ${singleChild ? 'only-child' : ''} ${isFirst ? 'first-child' : ''} ${isLast ? 'last-child' : ''}`}
              >
                <FamilyTreeNode node={child} onOpenDetail={onOpenDetail} />
              </div>
            );
          })}
        </div>
      )}
    </li>
  );
});
FamilyTreeNode.displayName = 'FamilyTreeNode';

export default function App() {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const ADMIN_EMAIL = 'taiketnoi@gmail.com';
  const isAdmin = session?.user?.email === ADMIN_EMAIL;

  // --- SỰ KIỆN ---
  const [isEventsModalOpen, setIsEventsModalOpen] = useState(false);
  const [upcomingPopup, setUpcomingPopup] = useState<FamilyEvent[]>([]);
  const [popupDismissed, setPopupDismissed] = useState(false);

  // --- ĐỒNG HỒ + LỊCH ÂM THỰC ---
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);



  // Lịch âm: sử dụng thư viện lunar-calendar
const getLunarDate = (date: Date): string => {
  const lunar = Lunar.fromSolar(date.getFullYear(), date.getMonth() + 1, date.getDate());
  const LUNAR_MONTH_NAMES = ['Giêng','Hai','Ba','Tư','Năm','Sáu','Bảy','Tám','Chín','Mười','Một','Chạp'];
  const monthName = LUNAR_MONTH_NAMES[lunar.month - 1];
  return `${lunar.day} tháng ${monthName}`;
};
// ── Quản lý tài khoản ──
  const SUPABASE_FUNCTION_URL = 'https://byulldrwnnxuoeihlsdr.supabase.co/functions/v1/create-user';

  const fetchManagedUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, email, display_name, created_at')
      .order('created_at', { ascending: false });
    if (data) setManagedUsers(data);
  };

  const handleCreateUser = async () => {
    if (!newUserEmail || !newUserPassword) {
      setUserCreateMsg({ type: 'error', text: 'Vui lòng nhập email và mật khẩu' });
      return;
    }
    // Simple validation
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(newUserEmail)) {
  setUserCreateMsg({ type: 'error', text: '❌ Email không hợp lệ' });
  return;
}
if (newUserPassword.length < 6) {
  setUserCreateMsg({ type: 'error', text: '❌ Mật khẩu ít nhất 6 ký tự' });
  return;
}
setUserCreateLoading(true);
    setUserCreateMsg(null);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      const res = await fetch(SUPABASE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentSession?.access_token}`,
        },
        body: JSON.stringify({
          email: newUserEmail,
          password: newUserPassword,
          displayName: newUserName || newUserEmail,
        }),
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      setUserCreateMsg({ type: 'success', text: `✅ Đã tạo tài khoản cho ${newUserEmail}` });
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      fetchManagedUsers();
    } catch (err: any) {
      setUserCreateMsg({ type: 'error', text: `❌ ${err.message}` });
    } finally {
      setUserCreateLoading(false);
    }
  };

  const [lunarStr, setLunarStr] = useState(getLunarDate(now));
  // Cập nhật lịch âm mỗi khi thời gian thay đổi (mỗi giây)
  useEffect(() => {
    setLunarStr(getLunarDate(now));
  }, [now]);
  const weekDays = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
  const solarStr = `${weekDays[now.getDay()]}, ${now.getDate().toString().padStart(2,'0')}/${(now.getMonth()+1).toString().padStart(2,'0')}/${now.getFullYear()}`;
  const timeStr = `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}:${now.getSeconds().toString().padStart(2,'0')}`;

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

    // Realtime: tự động cập nhật khi thiết bị khác thay đổi
    const channel = supabase
      .channel('giapha_realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'giapha_storage', filter: 'id=eq.1' },
        (payload) => {
          if (payload.new && payload.new.data_json) {
            setFamilyTrees(payload.new.data_json);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  // Kiểm tra sự kiện sắp tới khi load xong data - đặt sau familyTrees
  useEffect(() => {
    if (familyTrees.length === 0 || popupDismissed) return;
    const checkEvents = async () => {
      const { data } = await supabase.from('giapha_events').select('*');
      if (!data || data.length === 0) return;
      const allEvents: FamilyEvent[] = data.map((r: any) => ({
        id: r.id, treeId: r.tree_id, name: r.name, solarDate: r.solar_date,
        lunarDay: r.lunar_day, lunarMonth: r.lunar_month, lunarMonthName: '',
        notifyEnabled: r.notify_enabled, repeat: r.repeat_yearly ? 'yearly' : 'once',
        note: r.note, createdAt: r.created_at,
      }));
      const upcoming = checkUpcomingEvents(allEvents, new Date());
      if (upcoming.length > 0) {
        setUpcomingPopup(upcoming);
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          if (permission === 'granted') {
            upcoming.forEach(ev => {
              const solarDate = ev.solarDate ? new Date(ev.solarDate).toLocaleDateString('vi-VN') : '';
              new Notification(`🔔 Sự kiện sắp tới: ${ev.name}`, {
                body: `${solarDate}${ev.lunarDay ? ` | Âm: ${ev.lunarDay}/${ev.lunarMonth}` : ''}`,
                icon: '/favicon.ico',
              });
            });
          }
        }
      }
    };
    checkEvents();
  }, [familyTrees, popupDismissed]);
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
  const [isManageUsersOpen, setIsManageUsersOpen] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [userCreateLoading, setUserCreateLoading] = useState(false);
  const [userCreateMsg, setUserCreateMsg] = useState<{type:'success'|'error', text:string} | null>(null);
  const [managedUsers, setManagedUsers] = useState<{id:string,email:string,display_name:string,created_at:string}[]>([]);
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
    if (members.length === 0) return [];

    const getChildren = (parentId: string): Member[] =>
      members.filter(m =>
        (m.relationshipType === 'Con trai của' || m.relationshipType === 'Con gái của') &&
        m.relatedMemberId === parentId
      );

    const getSpouses = (memberId: string): Member[] =>
      members.filter(m =>
        (m.relationshipType === 'Vợ của' || m.relationshipType === 'Chồng của') &&
        m.relatedMemberId === memberId
      );

    // Tập hợp id đã được render để tránh lặp vô hạn
    const visited = new Set<string>();

    const buildUnit = (member: Member): FamilyNodeData => {
      visited.add(member.id);
      const spouses = getSpouses(member.id).filter(s => !visited.has(s.id));
      spouses.forEach(s => visited.add(s.id));

      const childrenRaw = [
        ...getChildren(member.id),
        ...spouses.flatMap(s => getChildren(s.id))
      ];
      const uniqueChildren = Array.from(new Map(childrenRaw.map(c => [c.id, c])).values())
        .filter(c => !visited.has(c.id));

      return {
        mainMember: member,
        spouses,
        children: uniqueChildren.map(buildUnit)
      };
    };

    // ID của tất cả người là con hoặc vợ/chồng của ai đó
    const childIds = new Set(
      members
        .filter(m => m.relationshipType === 'Con trai của' || m.relationshipType === 'Con gái của')
        .map(m => m.id)
    );
    const spouseIds = new Set(
      members
        .filter(m => m.relationshipType === 'Vợ của' || m.relationshipType === 'Chồng của')
        .map(m => m.id)
    );

    // Root = không phải con của ai, không phải vợ/chồng của ai
    const roots = members.filter(m => !childIds.has(m.id) && !spouseIds.has(m.id));

    // Nếu không có root rõ ràng → lấy đời thấp nhất làm root
    if (roots.length === 0) {
      const minGen = Math.min(...members.map(m => m.generation));
      const gen1 = members.filter(m => m.generation === minGen && !spouseIds.has(m.id));
      return gen1.map(buildUnit);
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
    try {
      setIsDownloading(true);
    // Lazy load heavy libraries
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf')
    ]);

      // Tạo div ẩn bên ngoài viewport để render toàn bộ sơ đồ
      const printDiv = document.createElement('div');
      printDiv.style.cssText = `
        position: fixed;
        top: -99999px;
        left: -99999px;
        background: #fff9f0;
        padding: 40px;
        display: inline-flex;
        flex-direction: column;
        align-items: center;
        font-family: Inter, sans-serif;
        min-width: 800px;
      `;

      // Clone nội dung sơ đồ (không có transform pan/zoom)
      if (treeContainerRef.current) {
        const clone = treeContainerRef.current.cloneNode(true) as HTMLElement;
        clone.style.cssText = `
          position: static;
          transform: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 20px;
        `;
        printDiv.appendChild(clone);
      }

      document.body.appendChild(printDiv);

      // Đợi render xong
      await new Promise(r => setTimeout(r, 300));

      const canvas = await html2canvas(printDiv, {
        scale: 2,
        backgroundColor: '#fff9f0',
        logging: false,
        useCORS: true,
        allowTaint: true,
        scrollX: 0,
        scrollY: 0,
        width: printDiv.scrollWidth,
        height: printDiv.scrollHeight,
        windowWidth: printDiv.scrollWidth,
        windowHeight: printDiv.scrollHeight,
      });

      document.body.removeChild(printDiv);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width / 2, canvas.height / 2]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
      pdf.save(`${currentTree.name || 'gia-pha'}.pdf`);
    } catch (err) {
      console.error('PDF error:', err);
      alert('Xuất PDF thất bại. Vui lòng thử lại.');
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

  if (authLoading) return (
    <div className="h-screen flex items-center justify-center bg-[#0a192f]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#b48a28] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="font-bold text-[#b48a28] text-sm tracking-widest uppercase">Đang tải...</p>
      </div>
    </div>
  );

  if (!session) return <AuthPage />;

  if (isLoading) return (
    <div className="h-screen flex items-center justify-center bg-[#fdf8f6]">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-[#b48a28] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="font-bold text-[#b48a28] text-sm tracking-widest uppercase">Đang đồng bộ dữ liệu...</p>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col font-sans bg-gray-100 overflow-hidden pb-16">
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

          {/* Nút đổi ảnh bìa */}
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

          {/* Toàn bộ nội dung: flex-col, tên trên - đồng hồ dưới, KHÔNG đè nhau */}
          <div className="absolute inset-0 flex flex-col justify-between py-2 px-3">

            {/* TÊN GIA PHẢ - hàng trên */}
            <div className="flex-1 flex items-center justify-center">
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
                  <h1 className="text-xl sm:text-4xl font-serif font-bold text-white tracking-widest uppercase drop-shadow-lg text-center px-4"
                    style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
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

            {/* ĐỒNG HỒ + LỊCH - hàng dưới, luôn dưới tên */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-white font-black tabular-nums leading-none"
                style={{ fontSize: 'clamp(18px, 4.5vw, 30px)', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                {timeStr}
              </span>
              <div className="w-px h-7 bg-white/30 self-center flex-shrink-0"></div>
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1">
                  <span className="text-[9px] sm:text-[10px]">☀️</span>
                  <span className="text-white font-semibold"
                    style={{ fontSize: 'clamp(8px, 2vw, 11px)', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                    {solarStr}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] sm:text-[10px]">🌙</span>
                  <span className="text-yellow-200 font-semibold"
                    style={{ fontSize: 'clamp(8px, 2vw, 11px)', textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                    Âm lịch: {lunarStr}
                  </span>
                </div>
              </div>
            </div>

          </div>
        </div>
        {/* Navigation Bar - chỉ view toggle + search + logout */}
        <header className="bg-[#b48a28] text-white shadow-md">
          <div className="px-2 py-1.5 flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center bg-white/10 rounded p-0.5 gap-0.5">
              <button
                onClick={() => setViewMode('list')}
                className={`px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${viewMode === 'list' ? 'bg-white text-[#b48a28]' : 'text-white hover:bg-white/20'}`}
              >
                <List className="h-3 w-3" /> Danh sách
              </button>
              <button
                onClick={() => setViewMode('tree')}
                className={`px-2 py-1 rounded text-[10px] font-medium flex items-center gap-1 transition-colors ${viewMode === 'tree' ? 'bg-white text-[#b48a28]' : 'text-white hover:bg-white/20'}`}
              >
                <Network className="h-3 w-3" /> Sơ đồ
              </button>
            </div>

            {viewMode === 'tree' && (
              <button
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="bg-white/20 hover:bg-white/30 text-white rounded px-2 py-1 text-[10px] font-medium flex items-center gap-1 transition-colors disabled:opacity-50"
              >
                <Download className="h-3 w-3" />
                {isDownloading ? 'Đang xuất...' : 'PDF'}
              </button>
            )}

            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-white/50" />
              <input
                type="text"
                placeholder="Tìm kiếm..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-6 pr-2 py-1 bg-white/10 rounded text-[10px] text-white placeholder-white/50 outline-none border border-white/20 focus:border-white/50"
              />
            </div>

            {/* Admin badge */}
            {isAdmin ? (
              <button
                onClick={() => { setIsManageUsersOpen(true); fetchManagedUsers(); }}
                className="flex items-center gap-1 bg-yellow-400 hover:bg-yellow-300 text-yellow-900 rounded-full px-2 py-0.5 text-[9px] font-bold flex-shrink-0 transition-colors"
                title="Quản lý tài khoản"
              >
                👑 Admin
              </button>
            ) : (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-white/20 text-white">👤</span>
            )}

            {/* Logout */}
            <button
              onClick={handleLogout}
              title="Đăng xuất"
              className="bg-white/10 hover:bg-red-500/40 text-white rounded p-1.5 flex items-center justify-center transition-colors flex-shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
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
            className="flex-1 overflow-hidden relative cursor-grab active:cursor-grabbing select-none"
            style={{ background: 'linear-gradient(180deg, #fff9f0 0%, #fef3e2 100%)' }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            {/* Zoom Controls */}
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
              className="absolute inset-0 flex flex-col items-center pt-4 family-tree"
            >
              {/* ===== BANNER TRUYỀN THỐNG ===== */}
              <div className="relative flex items-center justify-center mb-6 select-none" style={{ width: 520, height: 130 }}>
                {/* Nền banner đỏ */}
                <div className="absolute inset-x-8 inset-y-6 rounded-2xl shadow-2xl" style={{ background: 'linear-gradient(135deg, #c0392b 0%, #e74c3c 40%, #c0392b 100%)', border: '4px solid #f39c12' }}></div>
                {/* Viền vàng trang trí */}
                <div className="absolute inset-x-10 inset-y-8 rounded-xl border-2 border-yellow-300 opacity-60"></div>
                {/* Chim hạc trái */}
                <div className="absolute left-0 top-2 text-4xl" style={{ transform: 'scaleX(-1)', filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.3))' }}>🦢</div>
                <div className="absolute left-6 top-0 text-2xl opacity-80">🌸</div>
                {/* Chim hạc phải */}
                <div className="absolute right-0 top-2 text-4xl" style={{ filter: 'drop-shadow(1px 1px 2px rgba(0,0,0,0.3))' }}>🦢</div>
                <div className="absolute right-6 top-0 text-2xl opacity-80">🌸</div>
                {/* Hoa trang trí */}
                <div className="absolute left-12 bottom-1 text-xl opacity-70">🌺</div>
                <div className="absolute right-12 bottom-1 text-xl opacity-70">🌺</div>
                <div className="absolute left-24 top-1 text-sm opacity-60">✨</div>
                <div className="absolute right-24 top-1 text-sm opacity-60">✨</div>
                {/* Nội dung chữ */}
                <div className="relative z-10 text-center px-12">
                  <p className="text-yellow-200 text-[11px] font-bold tracking-widest uppercase mb-0.5" style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.5)' }}>
                    Đại Gia Đình
                  </p>
                  <h2 className="text-white font-black tracking-widest uppercase leading-tight" style={{ fontSize: 20, textShadow: '2px 2px 4px rgba(0,0,0,0.5)', letterSpacing: '0.15em' }}>
                    {currentTree.coverText || currentTree.name}
                  </h2>
                  {/* Trang trí dưới chữ */}
                  <div className="flex items-center justify-center gap-2 mt-1">
                    <div className="h-px w-8 bg-yellow-300 opacity-80"></div>
                    <span className="text-yellow-300 text-xs">❖</span>
                    <div className="h-px w-8 bg-yellow-300 opacity-80"></div>
                  </div>
                </div>
                {/* Góc trang trí */}
                <div className="absolute top-5 left-8 text-yellow-400 text-lg opacity-70">🐉</div>
                <div className="absolute top-5 right-8 text-yellow-400 text-lg opacity-70" style={{ transform: 'scaleX(-1)' }}>🐉</div>
              </div>

              {/* ===== SƠ ĐỒ CÂY ===== */}
              {familyTreeData.length > 0 ? (
                <ul className="family-tree-new">
                  {familyTreeData.map(node => (
                    <FamilyTreeNode key={node.mainMember.id} node={node} onOpenDetail={handleOpenDetail} />
                  ))}
                </ul>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
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

      {/* ===== MODAL QUẢN LÝ TÀI KHOẢN ===== */}
      {isManageUsersOpen && isAdmin && (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsManageUsersOpen(false)} />
          <div className="flex min-h-full items-center justify-center p-4">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
              <div className="bg-[#b48a28] rounded-t-2xl px-5 py-4 flex items-center justify-between">
                <div>
                  <h2 className="text-white font-bold text-lg">👑 Quản lý tài khoản</h2>
                  <p className="text-white/70 text-xs mt-0.5">Tạo tài khoản cho thành viên gia đình</p>
                </div>
                <button onClick={() => { setIsManageUsersOpen(false); setUserCreateMsg(null); }} className="text-white/80 hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-5 space-y-5">
                {/* Form tạo mới */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
                  <h3 className="font-bold text-sm text-amber-900">➕ Tạo tài khoản mới</h3>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Họ tên hiển thị</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Cao Văn An"
                      value={newUserName}
                      onChange={e => setNewUserName(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#b48a28] focus:ring-1 focus:ring-[#b48a28]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Email đăng nhập <span className="text-red-500">*</span></label>
                    <input
                      type="email"
                      placeholder="email@gmail.com"
                      value={newUserEmail}
                      onChange={e => setNewUserEmail(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#b48a28] focus:ring-1 focus:ring-[#b48a28]"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Mật khẩu <span className="text-red-500">*</span></label>
                    <input
                      type="password"
                      placeholder="Tối thiểu 6 ký tự"
                      value={newUserPassword}
                      onChange={e => setNewUserPassword(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-[#b48a28] focus:ring-1 focus:ring-[#b48a28]"
                      onKeyDown={e => e.key === 'Enter' && handleCreateUser()}
                    />
                  </div>
                  {userCreateMsg && (
                    <div className={`text-xs font-semibold px-3 py-2 rounded-lg ${userCreateMsg.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {userCreateMsg.text}
                    </div>
                  )}
                  <button
                    onClick={handleCreateUser}
                    disabled={userCreateLoading}
                    className="w-full bg-[#b48a28] hover:bg-[#9a7522] disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {userCreateLoading ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Đang tạo...</>
                    ) : (
                      <><UserPlus className="h-4 w-4" />Tạo tài khoản</>
                    )}
                  </button>
                </div>
                {/* Danh sách đã tạo */}
                <div>
                  <h3 className="font-bold text-sm text-gray-700 mb-2">👥 Tài khoản đã tạo ({managedUsers.length})</h3>
                  {managedUsers.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4">Chưa có tài khoản nào</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {managedUsers.map(u => (
                        <div key={u.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2.5 border border-gray-100">
                          <div className="w-8 h-8 bg-[#b48a28]/20 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm">👤</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-800 truncate">{u.display_name || u.email}</p>
                            <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                          </div>
                          <span className="text-[9px] text-gray-400 flex-shrink-0">
                            {new Date(u.created_at).toLocaleDateString('vi-VN')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ===== END MODAL QUẢN LÝ TÀI KHOẢN ===== */}

      {/* Events Modal */}
      {isEventsModalOpen && (
        <EventsModal
          treeId={currentTreeId}
          treeName={currentTree.name}
          onClose={() => setIsEventsModalOpen(false)}
        />
      )}

      {/* Popup thông báo sự kiện sắp tới */}
      {upcomingPopup.length > 0 && !popupDismissed && (
        <div className="fixed bottom-5 right-5 z-50 w-80 sm:w-96">
          <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-[#b48a28] px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <Bell className="h-5 w-5 text-white animate-bounce" />
                </div>
                <div>
                  <p className="text-white font-black text-base leading-tight">Sự kiện sắp tới!</p>
                  <p className="text-white/75 text-[11px] mt-0.5">{upcomingPopup.length} sự kiện cần chú ý</p>
                </div>
              </div>
              <button
                onClick={() => setPopupDismissed(true)}
                className="w-7 h-7 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
              >
                <X className="h-3.5 w-3.5 text-white" />
              </button>
            </div>

            {/* Danh sách sự kiện */}
            <div className="px-4 py-3 space-y-2 max-h-52 overflow-y-auto">
              {upcomingPopup.map(ev => (
                <div key={ev.id} className="flex items-center gap-3 p-2.5 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="w-7 h-7 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <PartyPopper className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">{ev.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {ev.solarDate && (
                        <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                          ☀️ {new Date(ev.solarDate).toLocaleDateString('vi-VN')}
                        </span>
                      )}
                      {ev.lunarDay && ev.lunarMonth && (
                        <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                          🌙 {ev.lunarDay}/{ev.lunarMonth} âm
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Footer button */}
            <div className="px-4 pb-4 pt-1">
              <button
                onClick={() => { setPopupDismissed(true); setIsEventsModalOpen(true); }}
                className="w-full bg-[#b48a28] text-white py-2.5 rounded-xl text-sm font-bold hover:bg-[#9a7522] transition-colors shadow-md"
              >
                Xem tất cả sự kiện →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== FOOTER CỐ ĐỊNH ===== */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#b48a28] border-t border-white/20 shadow-lg">
        <div className="flex items-center justify-around px-2 py-1.5">

          {/* Chọn gia phả */}
          <div className="flex flex-col items-center gap-0.5 flex-1">
            <select
              value={currentTreeId}
              onChange={(e) => setCurrentTreeId(e.target.value)}
              className="bg-transparent text-white text-[10px] font-bold border-none outline-none cursor-pointer text-center appearance-none max-w-[80px] truncate"
            >
              {familyTrees.map(tree => (
                <option key={tree.id} value={tree.id} className="text-black">{tree.name}</option>
              ))}
            </select>
            <span className="text-white/60 text-[8px]">Gia phả</span>
          </div>

          {/* Tạo gia phả mới */}
          <button
            onClick={() => setIsNewTreeModalOpen(true)}
            className="flex flex-col items-center gap-0.5 flex-1 py-0.5"
          >
            <div className="w-7 h-7 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
              <Plus className="h-4 w-4 text-white" />
            </div>
            <span className="text-white/80 text-[8px]">Tạo mới</span>
          </button>

          {/* Xóa gia phả */}
          {familyTrees.length > 1 && (
            <button
              onClick={() => setTreeToDelete(currentTreeId)}
              className="flex flex-col items-center gap-0.5 flex-1 py-0.5"
            >
              <div className="w-7 h-7 bg-red-500/30 hover:bg-red-500/50 rounded-full flex items-center justify-center transition-colors">
                <Trash2 className="h-4 w-4 text-red-200" />
              </div>
              <span className="text-white/80 text-[8px]">Xóa</span>
            </button>
          )}

          {/* Thêm thành viên */}
          <button
            onClick={() => handleOpenForm()}
            className="flex flex-col items-center gap-0.5 flex-1 py-0.5"
          >
            <div className="w-7 h-7 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors">
              <UserPlus className="h-4 w-4 text-white" />
            </div>
            <span className="text-white/80 text-[8px]">Thêm TV</span>
          </button>

          {/* Sự kiện */}
          <button
            onClick={() => setIsEventsModalOpen(true)}
            className="flex flex-col items-center gap-0.5 flex-1 py-0.5 relative"
          >
            <div className="w-7 h-7 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors relative">
              <Bell className="h-4 w-4 text-white" />
              {upcomingPopup.length > 0 && !popupDismissed && (
                <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full text-[7px] font-black text-white flex items-center justify-center">
                  {upcomingPopup.length}
                </span>
              )}
            </div>
            <span className="text-white/80 text-[8px]">Sự kiện</span>
          </button>

        </div>
      </div>
      {/* ===== END FOOTER ===== */}

    </div>
  );
}
