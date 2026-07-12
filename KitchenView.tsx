import React, { useMemo, useState } from 'react';
import {
  ChefHat, Edit2, Plus, Trash2, X, Save, TrendingUp, Wallet, Receipt,
  PiggyBank, AlertTriangle, Settings2, Calculator, Info
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { RecipeLine, Order } from '../../types';

// ---------------------------------------------------------------------------
// COSTING CENTER — ต่อยอดจาก "Pizza Damac Cost.xlsx" ของ Oat
//   แท็บ 1: สูตร & ต้นทุนต่อเมนู (แก้สูตรได้ ต้นทุนคิดสดจากราคาสต็อกล่าสุด)
//   แท็บ 2: กำไร/ขาดทุน (P&L) + กำไรต่อเมนู + ของเสีย
// หมายเหตุบัญชี: COGS ใน P&L มาจากสูตรต่อออเดอร์ (ตัดสต็อกจริง) ส่วนค่าแรง/ค่าไฟ/
// ค่าเช่า มาจากแท็บรายจ่ายตามจริง — ไม่นับซ้ำกับ "ต้นทุนแฝงต่อถาด" ที่โชว์อ้างอิง
// ---------------------------------------------------------------------------

const inputCls = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-brand-500';
const labelCls = 'block text-[10px] font-bold text-gray-500 uppercase mb-1';
const fmt = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 2 });
const fmtB = (n: number) => `฿${fmt(Math.round(n * 100) / 100)}`;

const CATEGORY_LABEL: Record<string, string> = {
  pizza: '🍕 พิซซ่า', promotion: '🎁 ชุดโปรโมชั่น', pasta: '🍝 พาสต้า', appetizer: '🍟 ทานเล่น',
  salad: '🥗 สลัด', rice: '🍚 ข้าว', cake: '🍰 ของหวาน', drink: '🥤 เครื่องดื่ม'
};
const CATEGORY_ORDER = ['pizza', 'promotion', 'pasta', 'appetizer', 'salad', 'rice', 'cake', 'drink'];

const marginColor = (pct: number) =>
  pct >= 60 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-red-600';

// ============================ TAB 1: สูตร & ต้นทุน ============================
export const RecipeCostTab: React.FC = () => {
  const {
    menu, menuRecipes, stockItems, costSettings, language,
    saveRecipe, deleteRecipe, saveCostSettings, recipeFoodCost
  } = useStore();
  const th = language !== 'en';

  const [editingMenuId, setEditingMenuId] = useState<string | null>(null);
  const [editLines, setEditLines] = useState<RecipeLine[]>([]);
  const [showOverhead, setShowOverhead] = useState(false);
  const [overheadDraft, setOverheadDraft] = useState<{ name: string; amount: number }[]>([]);
  const [busy, setBusy] = useState(false);

  const overheadTotal = (costSettings.overheadLines || []).reduce((s, l) => s + (Number(l.amount) || 0), 0);

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    (menu || []).forEach(m => {
      if (m.id === 'p_half_half') return; // ครึ่งๆ คิดตามสูตรของหน้าที่เลือกอยู่แล้ว
      (g[m.category] = g[m.category] || []).push(m);
    });
    return CATEGORY_ORDER.filter(c => g[c]?.length).map(c => ({ cat: c, items: g[c] }));
  }, [menu]);

  const openEditor = (menuId: string) => {
    const existing = menuRecipes[menuId];
    setEditLines(existing ? JSON.parse(JSON.stringify(existing.lines)) : []);
    setEditingMenuId(menuId);
  };

  const editingMenu = (menu || []).find(m => m.id === editingMenuId);
  const editCost = editLines.reduce((s, l) => {
    if (l.stockItemId) {
      const st = stockItems.find(x => x.id === l.stockItemId);
      return s + (Number(l.qty) || 0) * (st?.costPerUnit !== undefined ? Number(st.costPerUnit) : 0);
    }
    return s + (Number(l.fixedCost) || 0);
  }, 0);
  const editPrice = Number(editingMenu?.basePrice) || 0;
  const editMarginPct = editPrice > 0 ? ((editPrice - editCost) / editPrice) * 100 : 0;

  const setLine = (idx: number, patch: Partial<RecipeLine>) =>
    setEditLines(prev => prev.map((l, i) => i === idx ? { ...l, ...patch } : l));

  const saveEditor = async () => {
    if (!editingMenuId) return;
    setBusy(true);
    const ok = await saveRecipe(editingMenuId, editLines);
    setBusy(false);
    if (ok) setEditingMenuId(null);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Overhead reference card */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="text-sm font-black text-amber-900 flex items-center gap-2">
            <Calculator size={16} />
            {th ? `ต้นทุนแฝงต่อถาด (อ้างอิง): ${fmtB(overheadTotal)}` : `Overhead per tray (reference): ${fmtB(overheadTotal)}`}
          </div>
          <button onClick={() => { setOverheadDraft(JSON.parse(JSON.stringify(costSettings.overheadLines || []))); setShowOverhead(true); }}
            className="text-xs font-bold bg-white border border-amber-300 text-amber-800 rounded-lg px-3 py-1.5 flex items-center gap-1 hover:bg-amber-100">
            <Settings2 size={13} />{th ? 'แก้ไข' : 'Edit'}
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {(costSettings.overheadLines || []).map((l, i) => (
            <span key={i} className="text-[10px] font-bold bg-white border border-amber-200 text-amber-800 rounded-full px-2 py-0.5">{l.name} {fmtB(Number(l.amount) || 0)}</span>
          ))}
        </div>
        <p className="text-[10px] text-amber-700 mt-2 flex items-start gap-1">
          <Info size={11} className="shrink-0 mt-0.5" />
          {th ? 'ใช้ดูภาพรวมต่อถาดแบบใน Excel เดิม — งบกำไร/ขาดทุนจะใช้ค่าแรง/ค่าไฟ/ค่าเช่าจากแท็บรายจ่ายจริงแทน จึงไม่ถูกนับซ้ำ' : 'Reference only — the P&L uses real expenses instead (no double counting).'}
        </p>
      </div>

      {/* Menu list */}
      {grouped.map(({ cat, items }) => (
        <div key={cat} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 font-black text-sm text-gray-700">{CATEGORY_LABEL[cat] || cat}</div>
          <div className="divide-y divide-gray-50">
            {items.map((m: any) => {
              const cost = recipeFoodCost(m.id);
              const price = Number(m.basePrice) || 0;
              const hasRecipe = cost !== null;
              const profit = hasRecipe ? price - (cost as number) : null;
              const pct = hasRecipe && price > 0 ? ((profit as number) / price) * 100 : null;
              const fullCost = hasRecipe ? (cost as number) + overheadTotal : null;
              return (
                <button key={m.id} onClick={() => openEditor(m.id)}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-orange-50/40 transition">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-800 text-sm truncate">{m.nameTh || m.name}</div>
                    <div className="text-[11px] text-gray-400 font-semibold">
                      {th ? 'ขาย' : 'price'} {fmtB(price)}
                      {hasRecipe && <span> • {th ? 'รวมต้นทุนแฝง' : 'incl. overhead'} ≈ {fmtB(fullCost as number)}</span>}
                    </div>
                  </div>
                  {hasRecipe ? (
                    <div className="text-right shrink-0">
                      <div className="text-sm font-black text-gray-800">{fmtB(cost as number)}</div>
                      <div className={`text-[11px] font-black ${marginColor(pct as number)}`}>
                        {th ? 'กำไร' : 'profit'} {fmtB(profit as number)} ({Math.round(pct as number)}%)
                      </div>
                    </div>
                  ) : (
                    <span className="text-[10px] font-black bg-gray-100 text-gray-400 border border-gray-200 px-2 py-1 rounded-lg shrink-0">
                      {th ? '+ ใส่สูตร' : '+ add recipe'}
                    </span>
                  )}
                  <Edit2 size={14} className="text-gray-300 shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* ============ RECIPE EDITOR MODAL ============ */}
      {editingMenuId && editingMenu && (
        <div className="fixed inset-0 bg-black/60 z-[95] flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl">
            <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-center">
              <div>
                <h4 className="font-black text-gray-800 flex items-center gap-2"><ChefHat size={17} className="text-brand-600" />{editingMenu.nameTh || editingMenu.name}</h4>
                <p className="text-[11px] text-gray-400 font-bold">{th ? 'ราคาขาย' : 'price'} {fmtB(editPrice)} • {th ? 'สูตรต่อ 1 ถาด/จาน' : 'per tray'}</p>
              </div>
              <button onClick={() => setEditingMenuId(null)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {editLines.length === 0 && (
                <div className="text-center text-gray-400 text-sm font-bold py-6">{th ? 'ยังไม่มีสูตร — กด "เพิ่มวัตถุดิบ" ด้านล่าง' : 'No recipe yet'}</div>
              )}
              {editLines.map((l, idx) => {
                const st = l.stockItemId ? stockItems.find(x => x.id === l.stockItemId) : undefined;
                const lineCost = l.stockItemId
                  ? (Number(l.qty) || 0) * (st?.costPerUnit !== undefined ? Number(st.costPerUnit) : 0)
                  : (Number(l.fixedCost) || 0);
                return (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl p-2">
                    {l.stockItemId !== undefined ? (
                      <>
                        <select className={`${inputCls} flex-1`} value={l.stockItemId}
                          onChange={e => {
                            const s = stockItems.find(x => x.id === e.target.value);
                            setLine(idx, { stockItemId: e.target.value, name: s?.name || '', unit: s?.unit || '' });
                          }}>
                          <option value="">{th ? '— เลือกวัตถุดิบ —' : '— ingredient —'}</option>
                          {stockItems.filter(s => s.active !== false).map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.costPerUnit !== undefined ? `฿${s.costPerUnit}/${s.unit}` : th ? 'ยังไม่มีราคา' : 'no cost'})</option>
                          ))}
                        </select>
                        <input type="number" inputMode="decimal" min={0} className={`${inputCls} !w-20 text-center font-bold`}
                          value={l.qty || ''} onChange={e => setLine(idx, { qty: Number(e.target.value) })} />
                        <span className="text-[10px] font-bold text-gray-400 w-9">{st?.unit || l.unit}</span>
                      </>
                    ) : (
                      <>
                        <input className={`${inputCls} flex-1`} placeholder={th ? 'ชื่อค่าใช้จ่าย' : 'name'} value={l.name}
                          onChange={e => setLine(idx, { name: e.target.value })} />
                        <input type="number" inputMode="decimal" min={0} className={`${inputCls} !w-24 text-center font-bold`}
                          placeholder="฿" value={l.fixedCost ?? ''} onChange={e => setLine(idx, { fixedCost: Number(e.target.value), qty: 1, unit: 'ครั้ง' })} />
                      </>
                    )}
                    <span className="text-xs font-black text-gray-700 w-16 text-right">{fmtB(lineCost)}</span>
                    <button onClick={() => setEditLines(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                  </div>
                );
              })}
              <div className="flex gap-2">
                <button onClick={() => setEditLines(prev => [...prev, { stockItemId: '', name: '', qty: 0, unit: '' }])}
                  className="flex-1 py-2 rounded-xl border-2 border-dashed border-brand-300 text-brand-600 text-xs font-bold hover:bg-orange-50 flex items-center justify-center gap-1">
                  <Plus size={14} />{th ? 'เพิ่มวัตถุดิบ (ตัดสต็อก)' : 'Add ingredient'}
                </button>
                <button onClick={() => setEditLines(prev => [...prev, { name: '', qty: 1, unit: 'ครั้ง', fixedCost: 0 }])}
                  className="flex-1 py-2 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 text-xs font-bold hover:bg-gray-50 flex items-center justify-center gap-1">
                  <Plus size={14} />{th ? 'ค่าคงที่ (ไม่ตัดสต็อก)' : 'Fixed cost line'}
                </button>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-gray-100 space-y-2">
              <div className="flex justify-between text-sm font-black">
                <span className="text-gray-500">{th ? 'ต้นทุนวัตถุดิบ/ถาด' : 'Food cost'}</span>
                <span className="text-gray-800">{fmtB(editCost)}</span>
              </div>
              <div className="flex justify-between text-[11px] font-bold text-gray-400">
                <span>{th ? `+ ต้นทุนแฝง ${fmtB(overheadTotal)} = รวม ${fmtB(editCost + overheadTotal)}` : `+ overhead = ${fmtB(editCost + overheadTotal)}`}</span>
                <span className={marginColor(editMarginPct)}>{th ? 'กำไรขั้นต้น' : 'margin'} {fmtB(editPrice - editCost)} ({Math.round(editMarginPct)}%)</span>
              </div>
              <div className="flex gap-2 pt-1">
                {menuRecipes[editingMenuId] && (
                  <button onClick={async () => { if (confirm(th ? 'ลบสูตรนี้? เมนูนี้จะไม่ถูกคิดต้นทุน/ตัดสต็อก' : 'Delete recipe?')) { await deleteRecipe(editingMenuId); setEditingMenuId(null); } }}
                    className="py-2.5 px-3 rounded-xl text-xs font-bold border border-red-200 bg-red-50 text-red-600"><Trash2 size={14} /></button>
                )}
                <button onClick={() => setEditingMenuId(null)} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-600">{th ? 'ยกเลิก' : 'Cancel'}</button>
                <button onClick={saveEditor} disabled={busy}
                  className="flex-[2] py-2.5 rounded-xl font-bold text-sm bg-brand-600 text-white hover:bg-brand-700 flex items-center justify-center gap-1.5 disabled:opacity-50">
                  <Save size={15} />{busy ? '...' : (th ? 'บันทึกสูตร' : 'Save recipe')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ OVERHEAD EDITOR MODAL ============ */}
      {showOverhead && (
        <div className="fixed inset-0 bg-black/60 z-[95] flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
            <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-center">
              <h4 className="font-black text-gray-800 flex items-center gap-2"><Calculator size={16} className="text-amber-600" />{th ? 'ต้นทุนแฝงต่อถาด' : 'Overhead per tray'}</h4>
              <button onClick={() => setShowOverhead(false)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {overheadDraft.map((l, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input className={`${inputCls} flex-1`} value={l.name}
                    onChange={e => setOverheadDraft(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} />
                  <input type="number" inputMode="decimal" min={0} className={`${inputCls} !w-24 text-center font-bold`} value={l.amount ?? ''}
                    onChange={e => setOverheadDraft(prev => prev.map((x, i) => i === idx ? { ...x, amount: Number(e.target.value) } : x))} />
                  <button onClick={() => setOverheadDraft(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                </div>
              ))}
              <button onClick={() => setOverheadDraft(prev => [...prev, { name: '', amount: 0 }])}
                className="w-full py-2 rounded-xl border-2 border-dashed border-amber-300 text-amber-700 text-xs font-bold hover:bg-amber-50 flex items-center justify-center gap-1">
                <Plus size={14} />{th ? 'เพิ่มรายการ' : 'Add line'}
              </button>
              <div className="text-right text-sm font-black text-gray-700 pt-1">{th ? 'รวม' : 'total'} {fmtB(overheadDraft.reduce((s, l) => s + (Number(l.amount) || 0), 0))}/{th ? 'ถาด' : 'tray'}</div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
              <button onClick={() => setShowOverhead(false)} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-600">{th ? 'ยกเลิก' : 'Cancel'}</button>
              <button onClick={async () => {
                setBusy(true);
                const ok = await saveCostSettings({ overheadLines: overheadDraft.filter(l => l.name.trim()) });
                setBusy(false);
                if (ok) setShowOverhead(false);
              }} disabled={busy} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-amber-500 text-white hover:bg-amber-600 flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Save size={15} />{th ? 'บันทึก' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================ TAB 2: กำไร/ขาดทุน ============================
type Period = 'today' | '7d' | 'month' | 'lastMonth';

export const ProfitLossTab: React.FC = () => {
  const { orders, expenses, stockMovements, computeOrderCogs, language } = useStore();
  const th = language !== 'en';
  const [period, setPeriod] = useState<Period>('today');

  const range = useMemo(() => {
    const now = new Date();
    const start = new Date(now);
    let end = new Date(now.getTime() + 86400000);
    if (period === 'today') { start.setHours(0, 0, 0, 0); }
    else if (period === '7d') { start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0); }
    else if (period === 'month') { start.setDate(1); start.setHours(0, 0, 0, 0); }
    else { // last month
      start.setMonth(start.getMonth() - 1, 1); start.setHours(0, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return { start: start.getTime(), end: end.getTime() };
  }, [period]);

  const data = useMemo(() => {
    const inRange = (iso?: string) => {
      if (!iso) return false;
      const t = new Date(iso).getTime();
      return t >= range.start && t < range.end;
    };

    const done = (orders || []).filter(o => o.status === 'completed' && inRange(o.createdAt));

    let revenue = 0, cogs = 0, estimatedCount = 0;
    const perMenu: Record<string, { name: string; qty: number; revenue: number; cost: number }> = {};

    done.forEach((o: Order) => {
      const dFee = typeof o.deliveryFee === 'number' ? o.deliveryFee : 0;
      const net = Number(o.netAmount || o.totalAmount || 0) - dFee; // ไม่รวมค่าส่งที่เก็บแทนไรเดอร์
      revenue += net;

      let oCogs: number;
      if (o.stockDeducted && o.cogsAmount !== undefined) {
        oCogs = Number(o.cogsAmount);
      } else {
        oCogs = computeOrderCogs(o).amount; // ออเดอร์เก่าก่อนมีระบบ — ประมาณจากสูตรปัจจุบัน
        if (oCogs > 0) estimatedCount++;
      }
      cogs += oCogs;

      (o.items || []).forEach(item => {
        const key = item.nameTh || item.name;
        if (!perMenu[key]) perMenu[key] = { name: key, qty: 0, revenue: 0, cost: 0 };
        perMenu[key].qty += Number(item.quantity) || 1;
        perMenu[key].revenue += Number(item.totalPrice) || 0;
        const single: Order = { ...o, items: [item] } as Order;
        perMenu[key].cost += computeOrderCogs(single).amount;
      });
    });

    const opexList = (expenses || []).filter(e => inRange(e.date + 'T12:00:00') && e.category !== 'COGS');
    const opex = opexList.reduce((s, e) => s + (Number(e.amount) || 0), 0);
    const opexByCat: Record<string, number> = {};
    opexList.forEach(e => { opexByCat[e.category] = (opexByCat[e.category] || 0) + (Number(e.amount) || 0); });

    const ingredientCash = (expenses || [])
      .filter(e => inRange(e.date + 'T12:00:00') && e.category === 'COGS')
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);

    const wasteCost = (stockMovements || [])
      .filter(m => m.type === 'waste' && inRange(m.createdAt))
      .reduce((s, m) => s + Math.abs((Number(m.qty) || 0) * (Number(m.unitCost) || 0)), 0);

    const menuRows = Object.values(perMenu)
      .map(r => ({ ...r, profit: r.revenue - r.cost, pct: r.revenue > 0 ? ((r.revenue - r.cost) / r.revenue) * 100 : 0 }))
      .sort((a, b) => b.profit - a.profit);

    return {
      orderCount: done.length, revenue, cogs, gross: revenue - cogs,
      opex, opexByCat, net: revenue - cogs - opex,
      ingredientCash, wasteCost, menuRows, estimatedCount
    };
  }, [orders, expenses, stockMovements, range, computeOrderCogs]);

  const PERIOD_LABEL: Record<Period, string> = {
    today: th ? 'วันนี้' : 'Today', '7d': th ? '7 วันล่าสุด' : 'Last 7 days',
    month: th ? 'เดือนนี้' : 'This month', lastMonth: th ? 'เดือนที่แล้ว' : 'Last month'
  };

  const kpi = (label: string, value: string, sub: string, icon: React.ReactNode, cls: string) => (
    <div className={`rounded-2xl border-2 p-4 ${cls}`}>
      <div className="flex items-center gap-1.5 text-[10px] font-black uppercase opacity-70">{icon}{label}</div>
      <div className="text-xl font-black mt-1">{value}</div>
      <div className="text-[10px] font-bold opacity-60">{sub}</div>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Period picker */}
      <div className="flex flex-wrap gap-2">
        {(Object.keys(PERIOD_LABEL) as Period[]).map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${period === p ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
            {PERIOD_LABEL[p]}
          </button>
        ))}
        <span className="ml-auto self-center text-xs font-bold text-gray-400">{data.orderCount} {th ? 'บิลที่ปิดแล้ว' : 'completed orders'}</span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpi(th ? 'รายได้ (ไม่รวมค่าส่ง)' : 'Revenue', fmtB(data.revenue), th ? 'หลังหัก GP แพลตฟอร์ม' : 'net of platform GP', <Wallet size={12} />, 'bg-blue-50 border-blue-200 text-blue-900')}
        {kpi(th ? 'ต้นทุนวัตถุดิบ (COGS)' : 'COGS', fmtB(data.cogs), data.revenue > 0 ? `${Math.round((data.cogs / data.revenue) * 100)}% ${th ? 'ของรายได้' : 'of revenue'}` : '-', <Receipt size={12} />, 'bg-orange-50 border-orange-200 text-orange-900')}
        {kpi(th ? 'กำไรขั้นต้น' : 'Gross profit', fmtB(data.gross), data.revenue > 0 ? `${Math.round((data.gross / data.revenue) * 100)}%` : '-', <TrendingUp size={12} />, 'bg-emerald-50 border-emerald-200 text-emerald-900')}
        {kpi(th ? 'กำไรสุทธิ' : 'Net profit', fmtB(data.net), th ? `หักค่าใช้จ่ายร้าน ${fmtB(data.opex)}` : `after opex ${fmtB(data.opex)}`, <PiggyBank size={12} />, data.net >= 0 ? 'bg-green-50 border-green-300 text-green-900' : 'bg-red-50 border-red-300 text-red-900')}
      </div>

      {/* P&L statement */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-black text-gray-800 text-sm mb-3 flex items-center gap-2">📊 {th ? `งบกำไรขาดทุน — ${PERIOD_LABEL[period]}` : `P&L — ${PERIOD_LABEL[period]}`}</h3>
        <div className="space-y-1.5 text-sm font-bold max-w-md">
          <div className="flex justify-between"><span className="text-gray-500">{th ? 'รายได้จากการขาย' : 'Sales revenue'}</span><span>{fmtB(data.revenue)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">{th ? 'หัก ต้นทุนวัตถุดิบตามสูตร' : 'Less: COGS'}</span><span className="text-orange-700">−{fmtB(data.cogs)}</span></div>
          <div className="flex justify-between border-t border-gray-100 pt-1.5"><span className="text-gray-700">{th ? 'กำไรขั้นต้น' : 'Gross profit'}</span><span className="text-emerald-700">{fmtB(data.gross)}</span></div>
          {Object.entries(data.opexByCat).map(([cat, amt]) => (
            <div key={cat} className="flex justify-between text-[13px]"><span className="text-gray-400 pl-3">{th ? 'หัก' : 'less'} {cat}</span><span className="text-gray-500">−{fmtB(amt)}</span></div>
          ))}
          <div className={`flex justify-between border-t-2 pt-2 text-base font-black ${data.net >= 0 ? 'text-green-700 border-green-200' : 'text-red-700 border-red-200'}`}>
            <span>{th ? 'กำไรสุทธิ' : 'NET PROFIT'}</span><span>{fmtB(data.net)}</span>
          </div>
        </div>
        <div className="mt-3 space-y-1 text-[10px] font-bold text-gray-400">
          <p>💵 {th ? `เงินสดซื้อวัตถุดิบช่วงนี้ (จากแท็บรายจ่าย): ${fmtB(data.ingredientCash)} — ใช้เทียบกับ COGS ตามสูตร ถ้าห่างกันมาก = ซื้อเกิน/ของเสีย/สูตรคลาด` : `Cash spent on ingredients: ${fmtB(data.ingredientCash)}`}</p>
          {data.wasteCost > 0 && <p className="text-red-500">🗑 {th ? `ของเสียที่บันทึกไว้: ${fmtB(data.wasteCost)}` : `Recorded waste: ${fmtB(data.wasteCost)}`}</p>}
          {data.estimatedCount > 0 && <p>ℹ️ {th ? `${data.estimatedCount} บิลเก่ายังไม่มีสแตมป์ต้นทุน — ใช้สูตรปัจจุบันประมาณให้` : `${data.estimatedCount} old orders estimated from current recipes`}</p>}
        </div>
      </div>

      {/* Per-menu profitability */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 font-black text-sm text-gray-700">🏆 {th ? 'กำไรต่อเมนู (เรียงตามกำไรรวม)' : 'Profit by menu'}</div>
        {data.menuRows.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm font-bold">{th ? 'ยังไม่มีบิลปิดในช่วงนี้' : 'No completed orders in this period'}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-black text-gray-400 uppercase border-b border-gray-100">
                  <th className="text-left px-4 py-2">{th ? 'เมนู' : 'Menu'}</th>
                  <th className="text-right px-3 py-2">{th ? 'ขาย' : 'Qty'}</th>
                  <th className="text-right px-3 py-2">{th ? 'ยอดขาย' : 'Revenue'}</th>
                  <th className="text-right px-3 py-2">{th ? 'ต้นทุน' : 'Cost'}</th>
                  <th className="text-right px-3 py-2">{th ? 'กำไร' : 'Profit'}</th>
                  <th className="text-right px-4 py-2">%</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.menuRows.map((r, i) => (
                  <tr key={i} className="font-bold">
                    <td className="px-4 py-2 text-gray-800">{r.name}{r.cost === 0 && <span className="ml-1.5 text-[9px] font-black bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded" title={th ? 'ยังไม่มีสูตร ต้นทุน=0' : 'no recipe'}>{th ? 'ไม่มีสูตร' : 'no recipe'}</span>}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{r.qty}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{fmtB(r.revenue)}</td>
                    <td className="px-3 py-2 text-right text-orange-700">{fmtB(r.cost)}</td>
                    <td className="px-3 py-2 text-right text-emerald-700">{fmtB(r.profit)}</td>
                    <td className={`px-4 py-2 text-right font-black ${marginColor(r.pct)}`}>{Math.round(r.pct)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-2 text-[10px] font-bold text-gray-400 border-t border-gray-50">
          <AlertTriangle size={10} className="inline mr-1" />
          {th ? 'เมนูที่ไม่มีสูตรจะโชว์ต้นทุน 0 — ใส่สูตรได้ที่แท็บ "สูตร & ต้นทุน"' : 'Menus without recipes show cost 0.'}
        </div>
      </div>
    </div>
  );
};
