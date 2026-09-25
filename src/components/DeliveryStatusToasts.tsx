import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Order } from '../../types';

// Pop-up alerts on the POS when Lalamove changes a delivery's status (via the webhook).
// Cancelled / expired bookings stay on screen until dismissed because staff must re-book a rider.

type Toast = { key: string; orderId: string; text: string; tone: 'info' | 'good' | 'bad'; link?: string };

const describe = (ds: string, sid: string, lang: 'en' | 'th'): { text: string; tone: Toast['tone'] } | null => {
  const th = lang === 'th';
  switch (ds) {
    case 'assigning_driver':
    case 'assigning':
      return { tone: 'info', text: th ? `🔎 #${sid} Lalamove กำลังหาไรเดอร์` : `🔎 #${sid} Lalamove is finding a rider` };
    case 'ongoing':
    case 'on_going':
      return { tone: 'good', text: th ? `🛵 #${sid} ได้ไรเดอร์แล้ว กำลังมารับที่ร้าน — เตรียมของได้เลย` : `🛵 #${sid} Rider found, heading to the shop` };
    case 'picked_up':
      return { tone: 'good', text: th ? `🍕 #${sid} ไรเดอร์รับของแล้ว กำลังไปส่ง` : `🍕 #${sid} Rider picked up the order` };
    case 'completed':
      return { tone: 'good', text: th ? `📦 #${sid} ส่งถึงลูกค้าเรียบร้อย` : `📦 #${sid} Delivered` };
    case 'rejected':
      return { tone: 'bad', text: th ? `⚠️ #${sid} ไรเดอร์ยกเลิกงาน — Lalamove กำลังหาคนใหม่ให้อัตโนมัติ` : `⚠️ #${sid} Rider dropped the job — Lalamove is re-matching` };
    case 'expired':
      return { tone: 'bad', text: th ? `❌ #${sid} หาไรเดอร์ไม่ได้ — กด "เรียกไรเดอร์ใหม่" ในออเดอร์นี้` : `❌ #${sid} No rider found — re-book this order` };
    case 'canceled':
    case 'cancelled':
      return { tone: 'bad', text: th ? `❌ #${sid} งาน Lalamove ถูกยกเลิก — ถ้ายังต้องส่ง กด "เรียกไรเดอร์ใหม่"` : `❌ #${sid} Lalamove job cancelled — re-book if still needed` };
    default:
      return null;
  }
};

const beep = (urgent: boolean) => {
  try {
    const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const tones = urgent ? [880, 660, 880, 660] : [880];
    tones.forEach((f, i) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.22;
      g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.start(t); o.stop(t + 0.2);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch (e) {}
};

export const DeliveryStatusToasts: React.FC<{ orders: Order[]; language: 'en' | 'th'; soundEnabled: boolean }> = ({ orders, language, soundEnabled }) => {
  const prev = useRef<Map<string, string> | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    if (!orders) return;
    const next = new Map<string, string>();
    orders.forEach(o => { if (o.lalamove_order_id || o.delivery_status) next.set(o.id, String(o.delivery_status || '').toLowerCase()); });
    const before = prev.current;
    prev.current = next;
    if (!before) return; // first load: remember statuses, do not alert on old ones

    const added: Toast[] = [];
    next.forEach((ds, id) => {
      if (!ds || before.get(id) === ds) return;
      const o = orders.find(x => x.id === id);
      // the shop cleared the booking itself ("cancel" / "re-book" button): no alert
      if (ds === 'canceled' && o && !o.lalamove_order_id) return;
      const d = describe(ds, id.slice(-4), language);
      if (!d) return;
      added.push({ key: `${id}:${ds}:${Date.now()}`, orderId: id, ...d, link: o?.lalamove_share_link || undefined });
    });
    if (added.length === 0) return;
    setToasts(t => [...added, ...t].slice(0, 6));
    if (soundEnabled) beep(added.some(a => a.tone === 'bad'));
    added.filter(a => a.tone !== 'bad').forEach(a => {
      setTimeout(() => setToasts(t => t.filter(x => x.key !== a.key)), 12000);
    });
  }, [orders, language, soundEnabled]);

  if (toasts.length === 0) return null;
  return (
    <div className="fixed top-3 right-3 z-[9999] flex flex-col gap-2 w-[min(92vw,360px)] print:hidden">
      {toasts.map(t => (
        <div key={t.key} className={`rounded-xl shadow-lg border-2 px-3 py-2.5 text-sm font-bold flex items-start gap-2 bg-white ${
          t.tone === 'bad' ? 'border-red-400 text-red-800 bg-red-50 animate-pulse' : t.tone === 'good' ? 'border-emerald-300 text-emerald-800' : 'border-blue-300 text-blue-800'
        }`}>
          <div className="flex-1 leading-snug">
            {t.text}
            {t.link && t.tone !== 'bad' && (
              <a href={t.link} target="_blank" rel="noopener noreferrer" className="block text-xs text-blue-600 underline mt-1">
                {language === 'th' ? '📍 ดูตำแหน่งไรเดอร์' : '📍 Track rider'}
              </a>
            )}
          </div>
          <button type="button" onClick={() => setToasts(ts => ts.filter(x => x.key !== t.key))} className="shrink-0 text-gray-400 hover:text-gray-700" aria-label="close">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default DeliveryStatusToasts;
