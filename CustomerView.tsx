import React, { useEffect, useRef, useState } from 'react';
import { Bell, Play, Square } from 'lucide-react';

// ---------------------------------------------------------------------------
// ORDER ALERT SOUND — เลือกเสียงเตือนตอนมีออเดอร์ออนไลน์เข้าใหม่
// ค่าเก็บใน localStorage ต่อเครื่อง (แท็บเล็ต POS กับจอครัวตั้งแยกกันได้)
// ไฟล์เสียงอยู่ที่ public/sounds/*.mp3 (ตัดมาจากไฟล์ของ Oat เหลือ 20 วิ + fade)
// ---------------------------------------------------------------------------

export interface OrderSoundOption {
  id: string;
  labelTh: string;
  labelEn: string;
  file: string | null; // null = ใช้เสียงกริ่งสังเคราะห์เดิมของแต่ละหน้าจอ
}

export const ORDER_SOUND_OPTIONS: OrderSoundOption[] = [
  { id: 'chime', labelTh: '🔔 กริ่งมาตรฐาน (เสียงเดิม)', labelEn: '🔔 Classic chime', file: null },
  { id: 'voice-th', labelTh: '🗣️ เพลง "มีออเดอร์เข้าแล้ว" (ไทย)', labelEn: '🗣️ Thai "มีออเดอร์เข้าแล้ว"', file: '/sounds/order-voice-th.mp3' },
  { id: 'voice-en', labelTh: '🗣️ เพลง "You have order"', labelEn: '🗣️ "You have order" song', file: '/sounds/order-voice-en.mp3' },
  { id: 'ringtone-1', labelTh: '🎵 ริงโทน Pizza Damac 1', labelEn: '🎵 Ringtone 1', file: '/sounds/ringtone-1.mp3' },
  { id: 'ringtone-2', labelTh: '🎵 ริงโทน Pizza Damac 2', labelEn: '🎵 Ringtone 2', file: '/sounds/ringtone-2.mp3' },
];

const LS_KEY = 'damac_order_sound';
const MAX_PLAY_SECONDS = 20;

export const getSelectedOrderSoundId = (): string => {
  try { return localStorage.getItem(LS_KEY) || 'chime'; } catch (e) { return 'chime'; }
};

// เครื่องเล่นกลางตัวเดียว — เสียงใหม่ตัดเสียงเก่าเสมอ ไม่เล่นซ้อนกัน
let sharedAudio: HTMLAudioElement | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;

export const stopOrderSound = () => {
  if (stopTimer) { clearTimeout(stopTimer); stopTimer = null; }
  if (sharedAudio) {
    try { sharedAudio.pause(); sharedAudio.currentTime = 0; } catch (e) { /* ignore */ }
  }
};

// เล่นเสียงเตือนตามที่ตั้งค่าไว้ — ถ้าเลือก "กริ่งเดิม" หรือไฟล์เล่นไม่ได้
// (เช่น browser ยังไม่ปลดล็อกเสียง/ไฟล์หาย) จะ fallback ไปเสียงกริ่งสังเคราะห์
export const playOrderSound = (fallbackChime?: () => void, soundId?: string) => {
  const id = soundId || getSelectedOrderSoundId();
  const opt = ORDER_SOUND_OPTIONS.find(o => o.id === id);
  if (!opt || !opt.file) { if (fallbackChime) fallbackChime(); return; }
  try {
    stopOrderSound();
    if (!sharedAudio) sharedAudio = new Audio();
    sharedAudio.src = opt.file;
    sharedAudio.volume = 1.0;
    sharedAudio.currentTime = 0;
    const p = sharedAudio.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => { if (fallbackChime) fallbackChime(); });
    }
    stopTimer = setTimeout(stopOrderSound, MAX_PLAY_SECONDS * 1000);
  } catch (e) {
    if (fallbackChime) fallbackChime();
  }
};

// ---------------------------------------------------------------------------
// UI: dropdown เลือกเสียง + ปุ่มทดลองฟัง (ใช้ได้ทั้งธีมสว่าง POS / ธีมมืดครัว)
// ---------------------------------------------------------------------------
export const OrderSoundPicker: React.FC<{
  dark?: boolean;
  language?: string;
  onPreviewChime?: () => void; // เสียงกริ่งสังเคราะห์ของหน้าจอนั้นๆ ไว้พรีวิวตัวเลือก "กริ่งเดิม"
}> = ({ dark = false, language = 'th', onPreviewChime }) => {
  const th = language !== 'en';
  const [selected, setSelected] = useState<string>(getSelectedOrderSoundId());
  const [playing, setPlaying] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    stopOrderSound();
  }, []);

  const choose = (id: string) => {
    setSelected(id);
    try { localStorage.setItem(LS_KEY, id); } catch (e) { /* ignore */ }
  };

  const togglePreview = () => {
    if (playing) {
      stopOrderSound();
      setPlaying(false);
      if (previewTimer.current) clearTimeout(previewTimer.current);
      return;
    }
    const opt = ORDER_SOUND_OPTIONS.find(o => o.id === selected);
    if (!opt || !opt.file) {
      if (onPreviewChime) onPreviewChime();
      return; // เสียงสั้น ไม่ต้องเข้าโหมดหยุด
    }
    setPlaying(true);
    playOrderSound(onPreviewChime, selected);
    previewTimer.current = setTimeout(() => setPlaying(false), MAX_PLAY_SECONDS * 1000);
  };

  const selectCls = dark
    ? 'bg-gray-750 text-white border-gray-600 focus:ring-brand-500'
    : 'bg-white text-gray-800 border-gray-200 focus:border-brand-500';

  return (
    <div className={`space-y-1.5 ${dark ? '' : ''}`}>
      <label className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${dark ? 'text-gray-400' : 'text-gray-500'}`}>
        <Bell size={11} />
        {th ? 'เสียงเตือนออเดอร์ใหม่ (เครื่องนี้)' : 'New-order alert sound (this device)'}
      </label>
      <div className="flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => choose(e.target.value)}
          className={`flex-1 text-xs py-2 px-3 rounded-lg border outline-none focus:ring-1 cursor-pointer ${selectCls}`}
        >
          {ORDER_SOUND_OPTIONS.map(o => (
            <option key={o.id} value={o.id}>{th ? o.labelTh : o.labelEn}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={togglePreview}
          className={`shrink-0 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition active:scale-95 ${playing
            ? 'bg-red-500 text-white'
            : (dark ? 'bg-emerald-800/60 text-emerald-300 border border-emerald-600/60 hover:bg-emerald-800' : 'bg-emerald-500 text-white hover:bg-emerald-600')}`}
          title={th ? 'ทดลองฟังเสียงที่เลือก' : 'Preview selected sound'}
        >
          {playing ? <Square size={12} /> : <Play size={12} />}
          {playing ? (th ? 'หยุด' : 'Stop') : (th ? 'ทดลองฟัง' : 'Test')}
        </button>
      </div>
      <p className={`text-[10px] leading-relaxed ${dark ? 'text-gray-500' : 'text-gray-400'}`}>
        {th
          ? 'ดังเมื่อมีออเดอร์ใหม่เข้าระบบ (เล่นสูงสุด 20 วินาที) • ตั้งแยกได้ต่อเครื่อง เช่น จอครัวใช้เพลง แท็บเล็ตแคชเชียร์ใช้กริ่ง'
          : 'Plays when a new order arrives (max 20s). Saved per device.'}
      </p>
    </div>
  );
};

export default OrderSoundPicker;
