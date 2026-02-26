import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Bell, BellOff, Moon, PartyPopper, AlertCircle, Edit2 } from 'lucide-react';
import { supabase } from './supabaseClient';

export interface FamilyEvent {
  id: string;
  treeId: string;
  name: string;
  solarDate: string;
  lunarDay: number;
  lunarMonth: number;
  lunarMonthName: string;
  notifyEnabled: boolean;
  repeat: 'once' | 'yearly';
  note?: string;
  createdAt: string;
}

// ===== THUẬT TOÁN LỊCH ÂM CHUẨN VIỆT NAM (Giữ nguyên logic của bạn) =====
const TIMEZONE = 7;
function jdFromDate(d: number, m: number, y: number): number {
  const a = Math.floor((14 - m) / 12);
  const yr = y + 4800 - a;
  const mo = m + 12 * a - 3;
  let jd = d + Math.floor((153 * mo + 2) / 5) + 365 * yr + Math.floor(yr / 4) - Math.floor(yr / 100) + Math.floor(yr / 400) - 32045;
  if (jd < 2299161) jd = d + Math.floor((153 * mo + 2) / 5) + 365 * yr + Math.floor(yr / 4) - 32083;
  return jd;
}
function getNewMoonDay(k: number, tz: number): number {
  const T = k / 1236.85;
  const T2 = T * T; const T3 = T2 * T;
  const dr = Math.PI / 180;
  let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
  Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
  const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
  const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
  const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
  let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
  C1 -= 0.4068 * Math.sin(Mpr * dr) - 0.0161 * Math.sin(2 * dr * Mpr) - 0.0004 * Math.sin(3 * dr * Mpr);
  C1 += 0.0104 * Math.sin(2 * dr * F) - 0.0051 * Math.sin(dr * (M + Mpr)) - 0.0074 * Math.sin(dr * (M - Mpr));
  C1 += 0.0004 * Math.sin(dr * (2 * F + M)) - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
  C1 += 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (M + 2 * Mpr));
  const deltat = T < -11 ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3 : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Math.floor(Jd1 + C1 - deltat + 0.5 + tz / 24);
}
function getSunLongitude(jdn: number, tz: number): number {
  const T = (jdn - 2451545.5 - tz / 24) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.52910 + 35999.05030 * T - 0.0000333 * T2;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T2;
  const DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M) + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L -= 360 * Math.floor(L / 360);
  return Math.floor(L / 30);
}
export function convertSolarToLunar(date: Date): { day: number; month: number; monthName: string; year: number } {
  const dd = date.getDate(); const mm = date.getMonth() + 1; const yy = date.getFullYear();
  const jd = jdFromDate(dd, mm, yy);
  const k = Math.floor((jd - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, TIMEZONE);
  if (monthStart > jd) monthStart = getNewMoonDay(k, TIMEZONE);
  const lunarDay = jd - monthStart + 1;
  const sunLong = getSunLongitude(monthStart, TIMEZONE);
  let lunarMonth = sunLong + 1;
  if (lunarMonth > 12) lunarMonth = 1; if (lunarMonth < 1) lunarMonth = 1;
  const MONTH_NAMES = ['Giêng','Hai','Ba','Tư','Năm','Sáu','Bảy','Tám','Chín','Mười','Một','Chạp'];
  return { day: lunarDay, month: lunarMonth, monthName: MONTH_NAMES[lunarMonth - 1] || String(lunarMonth), year: yy };
}

// ===== CONSTANTS =====
const LUNAR_MONTHS = ['Giêng','Hai','Ba','Tư','Năm','Sáu','Bảy','Tám','Chín','Mười','Một','Chạp'];

interface EventsModalProps {
  treeId: string;
  treeName: string;
  onClose: () => void;
}

export default function EventsModal({ treeId, treeName, onClose }: EventsModalProps) {
  const [events, setEvents] = useState<FamilyEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<FamilyEvent | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formName, setFormName] = useState('');
  const [formSolarDate, setFormSolarDate] = useState('');
  const [formLunarDay, setFormLunarDay] = useState('');
  const [formLunarMonth, setFormLunarMonth] = useState('1');
  const [formLunarMonthName, setFormLunarMonthName] = useState('Giêng');
  const [formNotify, setFormNotify] = useState(true);
  const [formRepeat, setFormRepeat] = useState<'once' | 'yearly'>('yearly');
  const [formNote, setFormNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!formSolarDate) return;
    const d = new Date(formSolarDate + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    const lunar = convertSolarToLunar(d);
    setFormLunarDay(String(lunar.day));
    setFormLunarMonth(String(lunar.month));
    setFormLunarMonthName(lunar.monthName);
  }, [formSolarDate]);

  useEffect(() => { loadEvents(); }, [treeId]);

  const loadEvents = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('giapha_events').select('*').eq('tree_id', treeId).order('solar_date', { ascending: true });
    if (data) {
      setEvents(data.map((r: any) => ({
        id: r.id, treeId: r.tree_id, name: r.name, solarDate: r.solar_date,
        lunarDay: r.lunar_day, lunarMonth: r.lunar_month,
        lunarMonthName: LUNAR_MONTHS[(r.lunar_month - 1)] || String(r.lunar_month),
        notifyEnabled: r.notify_enabled, repeat: r.repeat_yearly ? 'yearly' : 'once',
        note: r.note, createdAt: r.created_at,
      })));
    }
    setIsLoading(false);
  };

  const openNewForm = () => {
    setEditingEvent(null); setFormName(''); setFormSolarDate(''); setFormLunarDay('');
    setFormLunarMonth('1'); setFormLunarMonthName('Giêng'); setFormNotify(true);
    setFormRepeat('yearly'); setFormNote(''); setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setIsSaving(true);
    const payload = {
      tree_id: treeId, name: formName.trim(), solar_date: formSolarDate || null,
      lunar_day: formLunarDay ? parseInt(formLunarDay) : null,
      lunar_month: formLunarMonth ? parseInt(formLunarMonth) : null,
      notify_enabled: formNotify, repeat_yearly: formRepeat === 'yearly',
      note: formNote.trim() || null,
    };
    if (editingEvent) await supabase.from('giapha_events').update(payload).eq('id', editingEvent.id);
    else await supabase.from('giapha_events').insert(payload);
    await loadEvents(); setIsFormOpen(false); setIsSaving(false);
  };

  const today = new Date();
  const categorize = (ev: FamilyEvent) => {
    if (!ev.solarDate) return 'other';
    const evDate = new Date(ev.solarDate);
    const thisYear = new Date(today.getFullYear(), evDate.getMonth(), evDate.getDate());
    const diff = Math.ceil((thisYear.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return 'today';
    if (diff > 0 && diff <= 30) return 'soon';
    return 'other';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" role="dialog">
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header - Thu nhỏ padding và text */}
        <div className="bg-[#b48a28] px-4 py-3 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2">
            <PartyPopper className="h-4 w-4 text-white" />
            <div>
              <h3 className="text-white font-bold text-sm">Sự kiện</h3>
              <p className="text-white/70 text-[10px]">{events.length} sự kiện</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={openNewForm} className="bg-white/20 hover:bg-white/30 text-white rounded-lg p-1.5 transition-colors">
              <Plus className="h-4 w-4" />
            </button>
            <button onClick={onClose} className="bg-white/20 hover:bg-white/30 text-white rounded-lg p-1.5 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Body - Thu nhỏ khoảng cách */}
        <div className="overflow-y-auto flex-1 p-4 bg-gray-50/50">
          {isLoading ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-2 border-[#b48a28] border-t-transparent rounded-full animate-spin"></div></div>
          ) : events.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-xs">Chưa có sự kiện nào.</div>
          ) : (
            <div className="space-y-4">
              {['today', 'soon', 'other'].map(cat => {
                const filtered = events.filter(e => categorize(e) === cat);
                if (filtered.length === 0) return null;
                const labels: any = { today: 'Hôm nay', soon: 'Sắp tới', other: 'Sự kiện khác' };
                const colors: any = { today: 'text-red-500', soon: 'text-orange-500', other: 'text-gray-400' };
                return (
                  <section key={cat}>
                    <p className={`text-[9px] font-black uppercase tracking-wider mb-2 flex items-center gap-1 ${colors[cat]}`}>
                      <AlertCircle className="h-3 w-3" /> {labels[cat]}
                    </p>
                    <div className="grid gap-1.5">
                      {filtered.map(ev => (
                        <EventCard key={ev.id} ev={ev} onEdit={(e) => { setEditingEvent(e); setFormName(e.name); setIsFormOpen(true); }} onDelete={setDeleteId} highlight={cat as any} />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        {/* Form Overlay - Nhỏ gọn hơn */}
        {isFormOpen && (
          <div className="absolute inset-0 bg-white z-20 flex flex-col animate-in slide-in-from-bottom duration-300">
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <h4 className="font-bold text-xs text-gray-700">{editingEvent ? 'Sửa sự kiện' : 'Thêm sự kiện'}</h4>
              <X className="h-4 w-4 text-gray-400 cursor-pointer" onClick={() => setIsFormOpen(false)} />
            </div>
            <form onSubmit={handleSave} className="p-4 space-y-3 overflow-y-auto">
              <div>
                <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Tên sự kiện</label>
                <input required value={formName} onChange={e => setFormName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-xs focus:ring-1 focus:ring-[#b48a28] outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Dương lịch</label>
                  <input type="date" value={formSolarDate} onChange={e => setFormSolarDate(e.target.value)} className="w-full border rounded-lg px-2 py-2 text-xs outline-none" />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-1">Âm lịch</label>
                  <div className="flex gap-1">
                    <input placeholder="Ngày" value={formLunarDay} onChange={e => setFormLunarDay(e.target.value)} className="w-10 border rounded-lg px-1 py-2 text-xs text-center outline-none" />
                    <select value={formLunarMonth} onChange={e => setFormLunarMonth(e.target.value)} className="flex-1 border rounded-lg px-1 py-2 text-[10px] outline-none">
                      {LUNAR_MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setFormRepeat(formRepeat === 'yearly' ? 'once' : 'yearly')} className={`flex-1 py-2 rounded-lg text-[10px] font-bold border ${formRepeat === 'yearly' ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  {formRepeat === 'yearly' ? '🔄 Hàng năm' : '1️⃣ Một lần'}
                </button>
                <button type="button" onClick={() => setFormNotify(!formNotify)} className={`flex-1 py-2 rounded-lg text-[10px] font-bold border ${formNotify ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
                  {formNotify ? '🔔 Bật báo' : '🔕 Tắt báo'}
                </button>
              </div>
              <textarea placeholder="Ghi chú..." value={formNote} onChange={e => setFormNote(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-xs h-16 resize-none outline-none" />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsFormOpen(false)} className="flex-1 py-2 text-xs font-bold text-gray-400">Hủy</button>
                <button type="submit" disabled={isSaving} className="flex-1 bg-[#b48a28] text-white py-2 rounded-lg text-xs font-bold shadow-md active:scale-95 transition-transform">
                  {isSaving ? '...' : 'Lưu lại'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Xóa xác nhận - Thu nhỏ */}
      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/20">
          <div className="bg-white rounded-xl p-4 w-64 shadow-xl text-center">
            <p className="text-xs font-bold mb-4">Xác nhận xóa sự kiện này?</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2 text-xs font-bold text-gray-400">Không</button>
              <button onClick={async () => { await supabase.from('giapha_events').delete().eq('id', deleteId); setDeleteId(null); loadEvents(); }} className="flex-1 bg-red-500 text-white py-2 rounded-lg text-xs font-bold">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({ ev, onEdit, onDelete, highlight }: { ev: FamilyEvent; onEdit: (ev: FamilyEvent) => void; onDelete: (id: string) => void; highlight: 'today' | 'soon' | 'other' }) {
  const bg = { today: 'bg-red-50 border-red-100', soon: 'bg-orange-50 border-orange-100', other: 'bg-white border-gray-100' };
  return (
    <div className={`border rounded-lg p-2.5 flex items-center gap-3 ${bg[highlight]}`}>
      <div className="flex-1 min-w-0">
        <h5 className="text-[11px] font-bold text-gray-800 truncate">{ev.name}</h5>
        <div className="flex items-center gap-2 mt-0.5 text-[9px] text-gray-500">
          {ev.solarDate && <span>☀️ {new Date(ev.solarDate).toLocaleDateString('vi-VN')}</span>}
          {ev.lunarDay && <span>🌙 {ev.lunarDay}/{ev.lunarMonthName}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => onEdit(ev)} className="p-1.5 text-gray-400 hover:text-[#b48a28]"><Edit2 className="h-3 w-3" /></button>
        <button onClick={() => onDelete(ev.id)} className="p-1.5 text-gray-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
      </div>
    </div>
  );
}
