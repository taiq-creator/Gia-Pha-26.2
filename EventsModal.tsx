import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Bell, BellOff, Calendar, Moon, PartyPopper, AlertCircle, Edit2 } from 'lucide-react';
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

// ===== THUẬT TOÁN LỊCH ÂM CHUẨN VIỆT NAM =====
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
  const deltat = T < -11
    ? 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3
    : -0.000278 + 0.000265 * T + 0.000262 * T2;
  return Math.floor(Jd1 + C1 - deltat + 0.5 + tz / 24);
}

function getSunLongitude(jdn: number, tz: number): number {
  const T = (jdn - 2451545.5 - tz / 24) / 36525;
  const T2 = T * T;
  const dr = Math.PI / 180;
  const M = 357.52910 + 35999.05030 * T - 0.0000333 * T2;
  const L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T2;
  const DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M)
    + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M)
    + 0.00029 * Math.sin(dr * 3 * M);
  let L = L0 + DL;
  L -= 360 * Math.floor(L / 360);
  return Math.floor(L / 30);
}

export function convertSolarToLunar(date: Date): { day: number; month: number; monthName: string; year: number } {
  const dd = date.getDate();
  const mm = date.getMonth() + 1;
  const yy = date.getFullYear();
  const jd = jdFromDate(dd, mm, yy);
  const k = Math.floor((jd - 2415021.076998695) / 29.530588853);
  let monthStart = getNewMoonDay(k + 1, TIMEZONE);
  if (monthStart > jd) monthStart = getNewMoonDay(k, TIMEZONE);
  const lunarDay = jd - monthStart + 1;
  const sunLong = getSunLongitude(monthStart, TIMEZONE);
  let lunarMonth = sunLong + 1;
  if (lunarMonth > 12) lunarMonth = 1;
  if (lunarMonth < 1) lunarMonth = 1;
  const lunarYear = lunarMonth >= mm ? yy : yy - 1;
  const MONTH_NAMES = ['Giêng','Hai','Ba','Tư','Năm','Sáu','Bảy','Tám','Chín','Mười','Một','Chạp'];
  return { day: lunarDay, month: lunarMonth, monthName: MONTH_NAMES[lunarMonth - 1] || String(lunarMonth), year: lunarYear };
}

export function checkUpcomingEvents(events: FamilyEvent[], today: Date): FamilyEvent[] {
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const todayL = convertSolarToLunar(today);
  const tomorrowL = convertSolarToLunar(tomorrow);
  return events.filter(ev => {
    if (!ev.notifyEnabled) return false;
    if (ev.solarDate) {
      const evDate = new Date(ev.solarDate);
      const match = ev.repeat === 'yearly'
        ? (evDate.getMonth() === tomorrow.getMonth() && evDate.getDate() === tomorrow.getDate()) ||
          (evDate.getMonth() === today.getMonth() && evDate.getDate() === today.getDate())
        : evDate.toDateString() === tomorrow.toDateString() || evDate.toDateString() === today.toDateString();
      if (match) return true;
    }
    if (ev.lunarDay && ev.lunarMonth) {
      if ((ev.lunarDay === tomorrowL.day && ev.lunarMonth === tomorrowL.month) ||
          (ev.lunarDay === todayL.day && ev.lunarMonth === todayL.month)) return true;
    }
    return false;
  });
}

// ===== CONSTANTS =====
const LUNAR_MONTHS = ['Giêng','Hai','Ba','Tư','Năm','Sáu','Bảy','Tám','Chín','Mười','Một','Chạp'];

interface EventsModalProps {
  treeId: string;
  treeName: string;
  onClose: () => void;
}

// ===== COMPONENT CHÍNH =====
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
  const [formLunarYear, setFormLunarYear] = useState('');
  const [formNotify, setFormNotify] = useState(true);
  const [formRepeat, setFormRepeat] = useState<'once' | 'yearly'>('yearly');
  const [formNote, setFormNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Tự động tính âm lịch khi chọn dương lịch
  useEffect(() => {
    if (!formSolarDate) return;
    const d = new Date(formSolarDate + 'T00:00:00');
    if (isNaN(d.getTime())) return;
    const lunar = convertSolarToLunar(d);
    setFormLunarDay(String(lunar.day));
    setFormLunarMonth(String(lunar.month));
    setFormLunarMonthName(lunar.monthName);
    setFormLunarYear(String(lunar.year));
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
    setEditingEvent(null);
    setFormName(''); setFormSolarDate(''); setFormLunarDay('');
    setFormLunarMonth('1'); setFormLunarMonthName('Giêng'); setFormLunarYear('');
    setFormNotify(true); setFormRepeat('yearly'); setFormNote('');
    setIsFormOpen(true);
  };

  const openEditForm = (ev: FamilyEvent) => {
    setEditingEvent(ev);
    setFormName(ev.name); setFormSolarDate(ev.solarDate || '');
    setFormLunarDay(String(ev.lunarDay || '')); setFormLunarMonth(String(ev.lunarMonth || '1'));
    setFormLunarMonthName(LUNAR_MONTHS[(ev.lunarMonth - 1)] || ''); setFormLunarYear('');
    setFormNotify(ev.notifyEnabled); setFormRepeat(ev.repeat); setFormNote(ev.note || '');
    setIsFormOpen(true);
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
    if (editingEvent) {
      await supabase.from('giapha_events').update(payload).eq('id', editingEvent.id);
    } else {
      await supabase.from('giapha_events').insert(payload);
    }
    await loadEvents();
    setIsFormOpen(false);
    setIsSaving(false);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await supabase.from('giapha_events').delete().eq('id', deleteId);
    setDeleteId(null);
    await loadEvents();
  };

  const toggleNotify = async (ev: FamilyEvent) => {
    await supabase.from('giapha_events').update({ notify_enabled: !ev.notifyEnabled }).eq('id', ev.id);
    setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, notifyEnabled: !e.notifyEnabled } : e));
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

  const todayEvents = events.filter(e => categorize(e) === 'today');
  const soonEvents = events.filter(e => categorize(e) === 'soon');
  const otherEvents = events.filter(e => !['today','soon'].includes(categorize(e)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

      <div className="relative z-10 bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="bg-[#b48a28] px-4 py-2.5 flex justify-between items-center flex-shrink-0">
          <div className="flex items-center gap-2">
            <PartyPopper className="h-4 w-4 text-white" />
            <div>
              <h3 className="text-white font-black text-sm leading-tight">Sự kiện gia phả</h3>
              <p className="text-white/70 text-[10px]">{treeName} · {events.length} sự kiện</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={openNewForm}
              className="bg-white text-[#b48a28] rounded-lg px-3 py-1.5 text-[11px] font-black flex items-center gap-1 hover:bg-white/90 transition-colors shadow">
              <Plus className="h-3 w-3" /> Tạo mới
            </button>
            <button onClick={onClose} className="w-7 h-7 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center">
              <X className="h-3.5 w-3.5 text-white" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-3">
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-7 h-7 border-[3px] border-[#b48a28] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <PartyPopper className="h-10 w-10 mb-2 opacity-20" />
              <p className="text-sm font-semibold">Chưa có sự kiện nào</p>
              <p className="text-xs mt-0.5 opacity-60">Nhấn "Tạo mới" để thêm</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayEvents.length > 0 && (
                <section>
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Hôm nay
                  </p>
                  <div className="grid gap-1.5">
                    {todayEvents.map(ev => <EventCard key={ev.id} ev={ev} onEdit={openEditForm} onDelete={setDeleteId} onToggleNotify={toggleNotify} highlight="red" />)}
                  </div>
                </section>
              )}
              {soonEvents.length > 0 && (
                <section>
                  <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-1.5 flex items-center gap-1">
                    <Bell className="h-3 w-3" /> Sắp tới (30 ngày)
                  </p>
                  <div className="grid gap-1.5">
                    {soonEvents.map(ev => <EventCard key={ev.id} ev={ev} onEdit={openEditForm} onDelete={setDeleteId} onToggleNotify={toggleNotify} highlight="orange" />)}
                  </div>
                </section>
              )}
              {otherEvents.length > 0 && (
                <section>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Tất cả sự kiện</p>
                  <div className="grid gap-1.5">
                    {otherEvents.map(ev => <EventCard key={ev.id} ev={ev} onEdit={openEditForm} onDelete={setDeleteId} onToggleNotify={toggleNotify} highlight="none" />)}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* FORM TẠO/SỬA */}
        {isFormOpen && (
          <div className="fixed inset-0 z-[55] flex items-center justify-center p-3 sm:p-6">
            <div className="fixed inset-0 bg-black/40" onClick={() => setIsFormOpen(false)}></div>
            <div className="relative z-10 bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="bg-[#b48a28] px-4 py-2.5 flex justify-between items-center rounded-t-xl">
              <h3 className="text-white font-black text-sm">
                {editingEvent ? '✏️ Chỉnh sửa' : '➕ Tạo mới'}
              </h3>
              <button type="button" onClick={() => setIsFormOpen(false)} className="w-7 h-7 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center">
                <X className="h-3.5 w-3.5 text-white" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

                {/* Tên - full width */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Tên sự kiện *</label>
                  <input type="text" required value={formName} onChange={e => setFormName(e.target.value)}
                    placeholder="VD: Giỗ tổ họ Cao, Sinh nhật ông Nội..."
                    className="w-full border-2 border-gray-100 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-[#b48a28] transition-colors" />
                </div>

                {/* Dương lịch */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">☀️ Ngày dương lịch</label>
                  <input type="date" value={formSolarDate} onChange={e => setFormSolarDate(e.target.value)}
                    className="w-full border-2 border-gray-100 rounded-lg px-3 py-2 text-xs font-medium focus:outline-none focus:border-[#b48a28] transition-colors" />
                </div>

                {/* Âm lịch tự động */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                    🌙 Âm lịch
                    {formLunarDay && formSolarDate && (
                      <span className="text-[9px] text-green-600 font-bold normal-case bg-green-50 px-1 py-0.5 rounded-full border border-green-200">✓ Tự động</span>
                    )}
                  </label>
                  <div className="flex gap-1.5">
                    <input type="number" min="1" max="30" value={formLunarDay}
                      onChange={e => setFormLunarDay(e.target.value)} placeholder="Ngày"
                      className="w-16 flex-shrink-0 border-2 border-gray-100 rounded-lg px-2 py-2 text-xs font-medium text-center focus:outline-none focus:border-[#b48a28] transition-colors" />
                    <select value={formLunarMonth}
                      onChange={e => { setFormLunarMonth(e.target.value); setFormLunarMonthName(LUNAR_MONTHS[parseInt(e.target.value) - 1]); }}
                      className="flex-1 border-2 border-gray-100 rounded-lg px-2 py-2 text-xs font-medium focus:outline-none focus:border-[#b48a28] transition-colors">
                      {LUNAR_MONTHS.map((name, idx) => (
                        <option key={idx + 1} value={idx + 1}>Tháng {name}</option>
                      ))}
                    </select>
                  </div>
                  {formLunarDay && formSolarDate && (
                    <p className="mt-1 text-[10px] text-[#b48a28] font-semibold flex items-center gap-1">
                      <Moon className="h-2.5 w-2.5" />
                      Ngày {formLunarDay} tháng {formLunarMonthName} năm {formLunarYear}
                    </p>
                  )}
                </div>

                {/* Lặp lại */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Lặp lại</label>
                  <div className="flex gap-1.5 h-[34px]">
                    <button type="button" onClick={() => setFormRepeat('yearly')}
                      className={`flex-1 rounded-lg text-[11px] font-bold border-2 transition-colors ${formRepeat === 'yearly' ? 'bg-[#b48a28] text-white border-[#b48a28]' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}>
                      🔄 Hàng năm
                    </button>
                    <button type="button" onClick={() => setFormRepeat('once')}
                      className={`flex-1 rounded-lg text-[11px] font-bold border-2 transition-colors ${formRepeat === 'once' ? 'bg-[#b48a28] text-white border-[#b48a28]' : 'border-gray-100 text-gray-500 hover:bg-gray-50'}`}>
                      1️⃣ Một lần
                    </button>
                  </div>
                </div>

                {/* Thông báo */}
                <div>
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Thông báo</label>
                  <button type="button" onClick={() => setFormNotify(!formNotify)}
                    className={`w-full h-[34px] rounded-lg text-[11px] font-bold border-2 transition-colors flex items-center justify-between px-3 ${formNotify ? 'bg-amber-50 border-amber-200 text-amber-800' : 'border-gray-100 text-gray-400 bg-gray-50'}`}>
                    <span className="flex items-center gap-1.5">
                      <Bell className={`h-3 w-3 ${formNotify ? 'text-amber-500' : 'text-gray-300'}`} />
                      {formNotify ? 'Nhắc trước 1 ngày + đúng ngày' : 'Tắt thông báo'}
                    </span>
                    <div className={`w-7 h-4 rounded-full relative transition-colors flex-shrink-0 ${formNotify ? 'bg-[#b48a28]' : 'bg-gray-200'}`}>
                      <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${formNotify ? 'left-3.5' : 'left-0.5'}`}></div>
                    </div>
                  </button>
                </div>

                {/* Ghi chú - full width */}
                <div className="sm:col-span-2">
                  <label className="block text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">Ghi chú</label>
                  <textarea value={formNote} onChange={e => setFormNote(e.target.value)} rows={2}
                    placeholder="Mô tả thêm về sự kiện..."
                    className="w-full border-2 border-gray-100 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#b48a28] transition-colors resize-none" />
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <button type="button" onClick={() => setIsFormOpen(false)}
                  className="flex-1 border-2 border-gray-100 text-gray-500 py-2 rounded-lg text-xs font-bold hover:bg-gray-50 transition-colors">
                  Hủy
                </button>
                <button type="submit" disabled={isSaving}
                  className="flex-1 bg-[#b48a28] text-white py-2 rounded-lg text-xs font-black hover:bg-[#9a7522] transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5 shadow">
                  {isSaving && <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>}
                  {editingEvent ? 'Lưu thay đổi' : 'Tạo sự kiện'}
                </button>
              </div>
            </form>
            </div>
          </div>
        )}
      </div>

      {/* Confirm delete */}
      {deleteId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDeleteId(null)}></div>
          <div className="relative bg-white rounded-xl p-4 w-full max-w-xs shadow-2xl z-10">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="font-black text-gray-900 text-sm">Xóa sự kiện?</p>
                <p className="text-xs text-gray-500">Hành động này không thể hoàn tác.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setDeleteId(null)} className="flex-1 border-2 border-gray-100 text-gray-600 py-2 rounded-lg text-xs font-bold">Hủy</button>
              <button onClick={handleDelete} className="flex-1 bg-red-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-red-700">Xóa</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== EVENT CARD =====
function EventCard({ ev, onEdit, onDelete, onToggleNotify, highlight }: {
  key?: any;
  ev: FamilyEvent;
  onEdit: (ev: FamilyEvent) => void;
  onDelete: (id: string) => void;
  onToggleNotify: (ev: FamilyEvent) => void;
  highlight: 'red' | 'orange' | 'none';
}) {
  const styles = { red: 'border-red-200 bg-red-50', orange: 'border-orange-200 bg-orange-50', none: 'border-gray-100 bg-white hover:bg-gray-50' };
  const dots = { red: 'bg-red-400', orange: 'bg-orange-400', none: 'bg-gray-300' };
  return (
    <div className={`border rounded-lg p-2.5 transition-colors ${styles[highlight]}`}>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dots[highlight]}`}></div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-xs truncate">{ev.name}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0 mt-0.5">
            {ev.solarDate && <span className="text-[10px] text-gray-500">☀️ {new Date(ev.solarDate).toLocaleDateString('vi-VN')}</span>}
            {ev.lunarDay && ev.lunarMonth && <span className="text-[10px] text-gray-500">🌙 {ev.lunarDay} tháng {ev.lunarMonthName}</span>}
            <span className="text-[10px] text-gray-400">{ev.repeat === 'yearly' ? '🔄 Hàng năm' : '1️⃣ Một lần'}</span>
          </div>
          {ev.note && <p className="text-[10px] text-gray-400 italic mt-0.5 line-clamp-1">{ev.note}</p>}
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={() => onToggleNotify(ev)}
            className={`p-1 rounded-md transition-colors ${ev.notifyEnabled ? 'text-amber-500 bg-amber-50 hover:bg-amber-100' : 'text-gray-300 hover:bg-gray-100'}`}>
            {ev.notifyEnabled ? <Bell className="h-3 w-3" /> : <BellOff className="h-3 w-3" />}
          </button>
          <button onClick={() => onEdit(ev)} className="p-1 rounded-md text-gray-300 hover:text-[#b48a28] hover:bg-amber-50 transition-colors">
            <Edit2 className="h-3 w-3" />
          </button>
          <button onClick={() => onDelete(ev.id)} className="p-1 rounded-md text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
