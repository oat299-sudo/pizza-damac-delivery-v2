import React, { useEffect, useState } from 'react';
import { Percent, Save, RotateCcw } from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { GP_RATES } from '../../constants';
import { OrderSource } from '../../types';

/**
 * Editable platform GP (commission) rates — v1.4.0.
 * Stored in store_settings.gp_rates as fractions ({ grab: 0.32 }); shown here as percent.
 * Used by StoreContext.getGpRate() for every platform order's net amount.
 */
const PLATFORMS: { key: OrderSource; label: string; color: string }[] = [
  { key: 'grab', label: 'Grab', color: 'bg-green-50 border-green-200 text-green-800' },
  { key: 'lineman', label: 'LINE MAN', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  { key: 'robinhood', label: 'Robinhood', color: 'bg-purple-50 border-purple-200 text-purple-800' },
  { key: 'foodpanda', label: 'Foodpanda', color: 'bg-pink-50 border-pink-200 text-pink-800' },
  { key: 'shopeefood', label: 'ShopeeFood', color: 'bg-orange-50 border-orange-200 text-orange-800' },
  { key: 'other', label: 'อื่นๆ (Other)', color: 'bg-gray-50 border-gray-200 text-gray-700' }
];

export default function PlatformGpSettingsCard({ language }: { language: 'en' | 'th' }) {
  const th = language === 'th';
  const { storeSettings, updateStoreSettings, getGpRate } = useStore();
  const [pct, setPct] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const load = () => {
    const next: Record<string, string> = {};
    PLATFORMS.forEach(p => { next[p.key] = String(Math.round(getGpRate(p.key) * 10000) / 100); });
    setPct(next);
  };
  useEffect(load, [storeSettings?.gpRates]);

  const dirty = PLATFORMS.some(p => Math.abs((parseFloat(pct[p.key] || '0') / 100) - getGpRate(p.key)) > 0.00001);

  const save = async () => {
    const rates: Partial<Record<OrderSource, number>> = {};
    for (const p of PLATFORMS) {
      const v = parseFloat(pct[p.key]);
      if (isNaN(v) || v < 0 || v > 100) { alert(th ? `ค่า GP ของ ${p.label} ต้องอยู่ระหว่าง 0–100` : `${p.label} GP must be 0–100`); return; }
      rates[p.key] = Math.round(v * 100) / 10000; // percent -> fraction, 2 decimals
    }
    rates.store = 0;
    setSaving(true);
    try { await updateStoreSettings({ gpRates: rates }); setSavedAt(Date.now()); }
    finally { setSaving(false); }
  };
  const resetDefaults = () => {
    const next: Record<string, string> = {};
    PLATFORMS.forEach(p => { next[p.key] = String(Math.round(((GP_RATES as any)[p.key] || 0) * 10000) / 100); });
    setPct(next);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
      <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4 mb-4">
        <div>
          <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2"><Percent size={20} className="text-brand-500" /> {th ? 'ค่า GP แพลตฟอร์มเดลิเวอรี่ (%)' : 'Delivery platform GP (%)'}</h3>
          <p className="text-xs text-gray-400 mt-1">{th ? 'เปอร์เซ็นต์ที่แพลตฟอร์มหักจากยอดขาย — ใช้คำนวณ "รายรับสุทธิ" ของทุกออเดอร์ที่เลือกช่องทางนั้นใน POS (ออเดอร์เก่าไม่เปลี่ยน)' : 'Commission the platform keeps — used for the net amount of every POS order tagged with that channel (past orders unchanged).'}</p>
        </div>
        <button onClick={resetDefaults} className="text-xs font-bold text-gray-500 hover:text-gray-800 flex items-center gap-1 shrink-0"><RotateCcw size={12} /> {th ? 'ค่าเริ่มต้น' : 'Defaults'}</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {PLATFORMS.map(p => (
          <label key={p.key} className={`rounded-xl border-2 p-3 flex items-center justify-between gap-2 ${p.color}`}>
            <span className="font-extrabold text-sm">{p.label}</span>
            <span className="flex items-center gap-1">
              <input type="number" min={0} max={100} step={0.5} value={pct[p.key] ?? ''} onChange={e => setPct({ ...pct, [p.key]: e.target.value })}
                className="w-20 text-right font-black text-lg bg-white border border-gray-200 rounded-lg px-2 py-1 outline-none focus:border-brand-500" />
              <span className="font-bold">%</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between mt-4">
        <span className="text-xs font-semibold text-gray-400">
          {th ? 'ตัวอย่าง: ขาย Grab ฿500 ที่ GP ' : 'Example: ฿500 on Grab at '}{pct.grab || 0}% → {th ? 'รับสุทธิ' : 'net'} ฿{Math.round(500 * (1 - (parseFloat(pct.grab || '0') / 100)))}
          {savedAt && !dirty ? <span className="text-emerald-600 ml-3">✓ {th ? 'บันทึกแล้ว' : 'Saved'}</span> : null}
        </span>
        <button onClick={save} disabled={!dirty || saving} className={`px-5 py-2.5 rounded-xl text-sm font-black flex items-center gap-2 ${dirty ? 'bg-brand-600 text-white hover:bg-brand-700' : 'bg-gray-100 text-gray-400'}`}>
          <Save size={14} /> {saving ? '...' : (th ? 'บันทึกค่า GP' : 'Save GP rates')}
        </button>
      </div>
    </div>
  );
}
