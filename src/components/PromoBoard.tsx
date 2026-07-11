import React, { useState } from 'react';
import {
  Megaphone, Edit2, Gift, Cake, Clock, X, Save, Plus, Trash2, Ticket,
  ToggleLeft, ToggleRight, Info, MessageCircle
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { PromoCampaign } from '../../types';

// ---------------------------------------------------------------------------
// PROMO BOARD — พนักงานเห็นโปรที่รันอยู่ทั้งหมด + ผู้จัดการแก้แคมเปญได้เอง
// (config เก็บใน DB ตาราง promo_campaigns — แก้แล้วมีผลกับคูปองที่แจกใหม่เท่านั้น)
// ---------------------------------------------------------------------------

const DISCOUNT_TYPE_TH: Record<string, string> = {
  percentage_most_expensive: 'ลด % ถาดที่แพงที่สุด',
  fixed_discount: 'ลดเป็นเงิน (บาท) ทั้งบิล',
  free_delivery: 'ลดค่าจัดส่ง (บาท)',
  percentage_total: 'ลด % ทั้งบิล',
  fixed_per_pizza: 'ลดต่อถาดพิซซ่า (บาท)'
};
const ORDER_TYPE_TH: Record<string, string> = {
  'dine-in': 'ทานที่ร้าน',
  'online': 'สั่งกลับบ้าน/มารับเอง',
  'delivery': 'เดลิเวอรี่'
};

const discountSummary = (cfg: any): string => {
  const v = Number(cfg?.discountValue) || 0;
  switch (cfg?.discountType) {
    case 'percentage_total': return `ลด ${v}% ทั้งบิล`;
    case 'percentage_most_expensive': return `ลด ${v}% ถาดที่แพงที่สุด`;
    case 'fixed_discount': return `ลด ฿${v}`;
    case 'free_delivery': return `ลดค่าส่ง ฿${v}`;
    case 'fixed_per_pizza': return `ลด ฿${v} ทุกถาด`;
    default: return `ลด ${v}`;
  }
};

const conditionChips = (cfg: any): string[] => {
  const conds: string[] = [];
  if (Number(cfg?.minOrderAmount) > 0) conds.push(`ขั้นต่ำ ฿${cfg.minOrderAmount}`);
  if (Array.isArray(cfg?.applicableOrderTypes) && cfg.applicableOrderTypes.length > 0) {
    conds.push(cfg.applicableOrderTypes.map((t: string) => ORDER_TYPE_TH[t] || t).join(' / '));
  }
  if (cfg?.requiresPreorder) conds.push('เฉพาะสั่งล่วงหน้า');
  return conds;
};

const CAMPAIGN_META: Record<string, { icon: React.ReactNode; nameTh: string; who: string; color: string; chip: string }> = {
  pickup_monthly: {
    icon: <Clock size={20} />, nameTh: 'จองล่วงหน้า มารับเอง',
    who: 'สมาชิกทุกคน ได้ใหม่ทุกเดือน', color: 'border-purple-300 bg-purple-50', chip: 'bg-purple-600'
  },
  birthday: {
    icon: <Cake size={20} />, nameTh: 'ของขวัญวันเกิด',
    who: 'สมาชิกในเดือนเกิด (ปีละครั้ง)', color: 'border-pink-300 bg-pink-50', chip: 'bg-pink-600'
  },
  welcome: {
    icon: <Gift size={20} />, nameTh: 'ชุดคูปองสมาชิกใหม่',
    who: 'แจกครั้งเดียวตอนสมัครสมาชิก', color: 'border-emerald-300 bg-emerald-50', chip: 'bg-emerald-600'
  }
};

const inputCls = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-brand-500';
const labelCls = 'block text-[10px] font-bold text-gray-500 uppercase mb-1';

export const PromoBoard: React.FC = () => {
  const { promoCampaigns, updatePromoCampaign, promoCodes, language } = useStore();
  const [editing, setEditing] = useState<PromoCampaign | null>(null);
  const [saving, setSaving] = useState(false);

  const th = language === 'th';
  const activePromoCodes = (promoCodes || []).filter(p => p.isActive);

  const quickToggle = async (c: PromoCampaign) => {
    const onOff = c.enabled ? 'ปิด' : 'เปิด';
    if (!confirm(`${onOff}แคมเปญ "${CAMPAIGN_META[c.kind]?.nameTh || c.id}" ใช่หรือไม่?${c.enabled ? '\n\n(คูปองที่ลูกค้าถืออยู่แล้วยังใช้ได้ตามเงื่อนไขเดิม — ระบบจะหยุดแจกใบใหม่เท่านั้น)' : ''}`)) return;
    await updatePromoCampaign({ ...c, enabled: !c.enabled });
  };

  const openEdit = (c: PromoCampaign) => {
    setEditing(JSON.parse(JSON.stringify(c))); // deep copy — แก้ใน modal ไม่กระทบ state จริง
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    const ok = await updatePromoCampaign(editing);
    setSaving(false);
    if (ok) setEditing(null);
  };

  const setCfg = (patch: any) => {
    setEditing(prev => prev ? { ...prev, config: { ...prev.config, ...patch } } : prev);
  };
  const setWelcomeCoupon = (idx: number, patch: any) => {
    setEditing(prev => {
      if (!prev) return prev;
      const coupons = [...(prev.config?.coupons || [])];
      coupons[idx] = { ...coupons[idx], ...patch };
      return { ...prev, config: { ...prev.config, coupons } };
    });
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-gray-100 pb-3">
        <div>
          <h3 className="text-lg font-black text-gray-800 flex items-center gap-2">
            <Megaphone className="text-brand-600" size={22} />
            {th ? 'บอร์ดโปรโมชั่น — โปรที่รันอยู่ตอนนี้' : 'Promo Board — Currently Running'}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {th ? 'ให้พนักงานใช้ตอบลูกค้า • ผู้จัดการกด "แก้ไข" เพื่อปรับแคมเปญได้เอง (มีผลกับคูปองที่แจกใหม่เท่านั้น)' : 'Staff reference • Managers can edit campaigns (affects newly granted coupons only)'}
          </p>
        </div>
      </div>

      {(!promoCampaigns || promoCampaigns.length === 0) ? (
        <div className="text-center text-gray-400 py-8 text-sm font-bold">{th ? 'กำลังโหลดแคมเปญ...' : 'Loading campaigns...'}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {promoCampaigns.map(c => {
            const meta = CAMPAIGN_META[c.kind] || CAMPAIGN_META.welcome;
            const cfg = c.config || {};
            const isWelcome = c.kind === 'welcome';
            const subCoupons: any[] = isWelcome ? (cfg.coupons || []) : [];
            return (
              <div key={c.id} className={`rounded-2xl border-2 p-4 space-y-3 ${meta.color} ${!c.enabled ? 'opacity-60 grayscale-[30%]' : ''}`}>
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-9 h-9 rounded-xl text-white flex items-center justify-center shadow-sm ${meta.chip}`}>{meta.icon}</span>
                    <div>
                      <div className="font-black text-gray-800 text-sm leading-tight">{meta.nameTh}</div>
                      <div className="text-[10px] font-bold text-gray-500">{meta.who}</div>
                    </div>
                  </div>
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${c.enabled ? 'bg-green-600 text-white' : 'bg-gray-400 text-white'}`}>
                    {c.enabled ? (th ? 'กำลังรัน' : 'LIVE') : (th ? 'ปิดอยู่' : 'OFF')}
                  </span>
                </div>

                {!isWelcome ? (
                  <div className="bg-white/80 rounded-xl p-3 space-y-1.5 border border-white">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm bg-gray-900 text-white px-2 py-0.5 rounded-lg">{cfg.code}</span>
                      <span className="font-black text-brand-700 text-sm">{discountSummary(cfg)}</span>
                    </div>
                    {c.kind === 'pickup_monthly' && (
                      <div className="text-xs font-bold text-purple-800">🎟 {cfg.perMonth || 5} {th ? 'ใบ/คน/เดือน • หมดอายุสิ้นเดือน' : 'per member per month'}</div>
                    )}
                    {c.kind === 'birthday' && (
                      <div className="text-xs font-bold text-pink-800">🎂 {th ? 'แจกอัตโนมัติในเดือนเกิด • หมดอายุสิ้นเดือนเกิด' : 'Auto-granted in birth month'}</div>
                    )}
                    <div className="flex flex-wrap gap-1">
                      {conditionChips(cfg).map((cond, i) => (
                        <span key={i} className="text-[10px] font-bold bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full border border-gray-200">{cond}</span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/80 rounded-xl p-3 space-y-1.5 border border-white">
                    {subCoupons.filter(sc => sc.enabled !== false).map((sc, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 text-xs">
                        <span className="font-mono font-bold bg-gray-900 text-white px-1.5 py-0.5 rounded text-[10px]">{sc.code}</span>
                        <span className="font-bold text-gray-700 flex-1 text-right">{discountSummary(sc)}{Number(sc.minOrderAmount) > 0 ? ` (ขั้นต่ำ ฿${sc.minOrderAmount})` : ''}</span>
                      </div>
                    ))}
                    {subCoupons.filter(sc => sc.enabled !== false).length === 0 && (
                      <div className="text-xs text-gray-400 font-bold text-center py-2">{th ? 'ไม่มีคูปองเปิดใช้ในชุดนี้' : 'No coupons enabled'}</div>
                    )}
                  </div>
                )}

                {c.staffNoteTh && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-[11px] text-amber-900 leading-relaxed flex gap-1.5">
                    <MessageCircle size={13} className="shrink-0 mt-0.5 text-amber-500" />
                    <span><b>{th ? 'วิธีตอบลูกค้า:' : 'Staff note:'}</b> {c.staffNoteTh}</span>
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button onClick={() => quickToggle(c)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-1.5 ${c.enabled ? 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50' : 'bg-green-600 text-white border-green-600 hover:bg-green-700'}`}>
                    {c.enabled ? <><ToggleLeft size={16} />{th ? 'ปิดแคมเปญ' : 'Turn off'}</> : <><ToggleRight size={16} />{th ? 'เปิดแคมเปญ' : 'Turn on'}</>}
                  </button>
                  <button onClick={() => openEdit(c)}
                    className="flex-1 py-2 rounded-xl text-xs font-bold bg-gray-900 text-white hover:bg-black transition flex items-center justify-center gap-1.5">
                    <Edit2 size={13} />{th ? 'แก้ไขแคมเปญ' : 'Edit'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active promo codes strip (managed in the section below) */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
        <div className="flex items-center gap-2 text-xs font-black text-gray-600 uppercase mb-2">
          <Ticket size={14} className="text-brand-600" />
          {th ? `รหัสส่วนลดที่เปิดใช้อยู่ (${activePromoCodes.length})` : `Active promo codes (${activePromoCodes.length})`}
          <span className="text-[10px] font-bold text-gray-400 normal-case">{th ? '• จัดการได้ที่ส่วนด้านล่าง ⬇' : '• manage below ⬇'}</span>
        </div>
        {activePromoCodes.length === 0 ? (
          <div className="text-xs text-gray-400 font-bold">{th ? 'ยังไม่มีรหัสส่วนลดที่เปิดใช้' : 'No active codes'}</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {activePromoCodes.map(p => (
              <span key={p.id} className="text-xs font-bold bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 shadow-xs">
                <span className="font-mono font-black">{p.code}</span>
                <span className="text-gray-500"> — {p.discountType === 'percentage' ? `ลด ${p.discountValue}%` : p.discountType === 'fixed_order' ? `ลด ฿${p.discountValue}` : `ลดค่าส่ง ฿${p.discountValue}`}{p.minOrderAmount > 0 ? ` (ขั้นต่ำ ฿${p.minOrderAmount})` : ''}</span>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ============ EDIT CAMPAIGN MODAL ============ */}
      {editing && (
        <div className="fixed inset-0 bg-black/60 z-[95] flex items-center justify-center p-3" onClick={() => !saving && setEditing(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3.5 flex justify-between items-center z-10">
              <h4 className="font-black text-gray-800 flex items-center gap-2">
                <Edit2 size={16} className="text-brand-600" />
                {th ? 'แก้ไข: ' : 'Edit: '}{CAMPAIGN_META[editing.kind]?.nameTh || editing.id}
              </h4>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400" disabled={saving}><X size={18} /></button>
            </div>

            <div className="p-5 space-y-4">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-2.5 text-[11px] text-blue-800 flex gap-1.5">
                <Info size={13} className="shrink-0 mt-0.5" />
                {th ? 'การแก้ไขมีผลกับคูปองที่ระบบจะแจกใหม่เท่านั้น — คูปองที่ลูกค้าถืออยู่แล้วคงเงื่อนไขเดิม' : 'Changes affect newly granted coupons only.'}
              </div>

              {/* enabled toggle */}
              <button onClick={() => setEditing(p => p ? { ...p, enabled: !p.enabled } : p)}
                className={`w-full py-2.5 rounded-xl font-bold text-sm border-2 transition flex items-center justify-center gap-2 ${editing.enabled ? 'bg-green-50 border-green-400 text-green-700' : 'bg-gray-50 border-gray-300 text-gray-500'}`}>
                {editing.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                {editing.enabled ? (th ? 'แคมเปญเปิดอยู่ (กดเพื่อปิด)' : 'Enabled — tap to disable') : (th ? 'แคมเปญปิดอยู่ (กดเพื่อเปิด)' : 'Disabled — tap to enable')}
              </button>

              {editing.kind !== 'welcome' ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>{th ? 'โค้ดบนคูปอง' : 'Code'}</label>
                      <input className={`${inputCls} font-mono font-bold uppercase`} value={editing.config?.code || ''}
                        onChange={e => setCfg({ code: e.target.value.toUpperCase() })} />
                    </div>
                    <div>
                      <label className={labelCls}>{th ? 'มูลค่าส่วนลด' : 'Discount value'}</label>
                      <input type="number" min={0} className={inputCls} value={editing.config?.discountValue ?? ''}
                        onChange={e => setCfg({ discountValue: Number(e.target.value) })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>{th ? 'ประเภทส่วนลด' : 'Discount type'}</label>
                      <select className={inputCls} value={editing.config?.discountType || 'percentage_total'}
                        onChange={e => setCfg({ discountType: e.target.value })}>
                        {Object.entries(DISCOUNT_TYPE_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>{th ? 'ยอดขั้นต่ำ (฿)' : 'Min order (฿)'}</label>
                      <input type="number" min={0} className={inputCls} value={editing.config?.minOrderAmount ?? 0}
                        onChange={e => setCfg({ minOrderAmount: Number(e.target.value) })} />
                    </div>
                  </div>
                  {editing.kind === 'pickup_monthly' && (
                    <div>
                      <label className={labelCls}>{th ? 'จำนวนใบต่อคนต่อเดือน' : 'Coupons per member per month'}</label>
                      <input type="number" min={0} max={20} className={inputCls} value={editing.config?.perMonth ?? 5}
                        onChange={e => setCfg({ perMonth: Number(e.target.value) })} />
                      <p className="text-[10px] text-gray-400 mt-1">{th ? 'สมาชิกที่ได้ครบเดือนนี้แล้วจะไม่ได้เพิ่ม จะเริ่มจำนวนใหม่เดือนหน้า' : 'Applies from next grant.'}</p>
                    </div>
                  )}
                  <div>
                    <label className={labelCls}>{th ? 'ชื่อคูปอง (ไทย)' : 'Title (TH)'}</label>
                    <input className={inputCls} value={editing.config?.titleTh || ''} onChange={e => setCfg({ titleTh: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>{th ? 'คำอธิบาย (ไทย)' : 'Description (TH)'}</label>
                    <textarea rows={2} className={inputCls} value={editing.config?.descriptionTh || ''} onChange={e => setCfg({ descriptionTh: e.target.value })} />
                  </div>
                </>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-black text-gray-500 uppercase">{th ? 'คูปองในชุดต้อนรับสมาชิกใหม่' : 'Coupons in welcome set'}</p>
                  {(editing.config?.coupons || []).map((sc: any, idx: number) => (
                    <div key={idx} className={`border rounded-xl p-3 space-y-2 ${sc.enabled !== false ? 'border-emerald-200 bg-emerald-50/40' : 'border-gray-200 bg-gray-50 opacity-70'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <input className="font-mono font-black text-xs uppercase bg-gray-900 text-white px-2 py-1 rounded-lg w-36 outline-none"
                          value={sc.code || ''} onChange={e => setWelcomeCoupon(idx, { code: e.target.value.toUpperCase() })} />
                        <div className="flex items-center gap-1">
                          <button onClick={() => setWelcomeCoupon(idx, { enabled: sc.enabled === false })}
                            className={`p-1.5 rounded-lg border ${sc.enabled !== false ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}
                            title={sc.enabled !== false ? 'ปิดคูปองนี้' : 'เปิดคูปองนี้'}>
                            {sc.enabled !== false ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                          <button onClick={() => {
                            if (confirm(`ลบคูปอง ${sc.code} ออกจากชุดต้อนรับ?`)) {
                              setEditing(prev => prev ? { ...prev, config: { ...prev.config, coupons: (prev.config?.coupons || []).filter((_: any, i: number) => i !== idx) } } : prev);
                            }
                          }} className="p-1.5 rounded-lg bg-red-50 text-red-500 border border-red-100"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <input className={inputCls} placeholder="ชื่อคูปอง (ไทย)" value={sc.titleTh || ''} onChange={e => setWelcomeCoupon(idx, { titleTh: e.target.value, title: e.target.value })} />
                      <div className="grid grid-cols-3 gap-2">
                        <select className={`${inputCls} col-span-1 text-xs`} value={sc.discountType || 'fixed_discount'} onChange={e => setWelcomeCoupon(idx, { discountType: e.target.value })}>
                          {Object.entries(DISCOUNT_TYPE_TH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <div>
                          <input type="number" min={0} className={inputCls} placeholder="มูลค่า" value={sc.discountValue ?? ''} onChange={e => setWelcomeCoupon(idx, { discountValue: Number(e.target.value) })} />
                        </div>
                        <div>
                          <input type="number" min={0} className={inputCls} placeholder="ขั้นต่ำ ฿" value={sc.minOrderAmount ?? 0} onChange={e => setWelcomeCoupon(idx, { minOrderAmount: Number(e.target.value) })} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <button onClick={() => {
                    setEditing(prev => prev ? {
                      ...prev,
                      config: {
                        ...prev.config,
                        coupons: [...(prev.config?.coupons || []), {
                          id: `coupon_custom_${Date.now()}`, enabled: true, code: 'NEWCODE',
                          title: '', titleTh: '', description: '', descriptionTh: '',
                          discountType: 'fixed_discount', discountValue: 50, minOrderAmount: 0
                        }]
                      }
                    } : prev);
                  }} className="w-full py-2 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-600 text-xs font-bold hover:bg-emerald-50 flex items-center justify-center gap-1">
                    <Plus size={14} />{th ? 'เพิ่มคูปองในชุดต้อนรับ' : 'Add coupon'}
                  </button>
                </div>
              )}

              <div>
                <label className={labelCls}>💬 {th ? 'โน้ตสำหรับพนักงาน (วิธีตอบลูกค้า)' : 'Staff note'}</label>
                <textarea rows={3} className={inputCls} value={editing.staffNoteTh || ''}
                  onChange={e => setEditing(p => p ? { ...p, staffNoteTh: e.target.value } : p)}
                  placeholder={th ? 'เช่น เงื่อนไขที่พนักงานต้องรู้ / คำตอบเมื่อลูกค้าถาม' : ''} />
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3 flex gap-2">
              <button onClick={() => setEditing(null)} disabled={saving}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200">{th ? 'ยกเลิก' : 'Cancel'}</button>
              <button onClick={saveEdit} disabled={saving}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-brand-600 text-white hover:bg-brand-700 flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Save size={15} />{saving ? (th ? 'กำลังบันทึก...' : 'Saving...') : (th ? 'บันทึกแคมเปญ' : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PromoBoard;
