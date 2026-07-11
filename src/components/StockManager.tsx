import React, { useMemo, useState } from 'react';
import {
  Package, AlertTriangle, Plus, Edit2, Trash2, X, Save, Phone, BookOpen,
  History, Sun, Moon, PackagePlus, ClipboardList, MessageCircle, RefreshCw, Scale
} from 'lucide-react';
import { useStore } from '../../context/StoreContext';
import { StockItem, Supplier } from '../../types';

// ---------------------------------------------------------------------------
// STOCK MANAGER — วัตถุดิบหลัก 10-20 รายการ / นับมือเช้า-เย็น / จดของเข้า
// แจ้งเตือนใกล้หมด / สมุด Supplier / ลงบัญชีรายจ่าย (expenses) อัตโนมัติ
// v1: ไม่ตัดสต็อกอัตโนมัติตามออเดอร์
// ---------------------------------------------------------------------------

const CATEGORY_TH: Record<string, string> = {
  dough: '🍞 แป้ง/โดว์', cheese: '🧀 ชีส', sauce: '🥫 ซอส', meat: '🥓 เนื้อสัตว์',
  vegetable: '🥬 ผัก/ผลไม้', packaging: '📦 บรรจุภัณฑ์', drink: '🥤 เครื่องดื่ม', other: '📋 อื่นๆ'
};
const CATEGORY_ORDER = ['dough', 'cheese', 'sauce', 'meat', 'vegetable', 'packaging', 'drink', 'other'];
const UNITS = ['กก.', 'กรัม', 'ถุง', 'แพ็ค', 'กล่อง', 'กระป๋อง', 'ขวด', 'ใบ', 'ชิ้น', 'ลูก', 'ซอง'];

const inputCls = 'w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-brand-500';
const labelCls = 'block text-[10px] font-bold text-gray-500 uppercase mb-1';

const fmtQty = (n: number) => (Number.isInteger(Number(n)) ? String(n) : Number(n).toFixed(2).replace(/\.?0+$/, ''));
const fmtTime = (iso?: string) => {
  if (!iso) return '-';
  try { return new Date(iso).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return '-'; }
};

type ReceiveRow = { itemId: string; qty: string; unitCost: string };

export const StockManager: React.FC = () => {
  const {
    stockItems, suppliers, stockMovements, lowStockItems, fetchStockData,
    addStockItem, updateStockItem, deleteStockItem,
    addSupplier, updateSupplier, deleteSupplier,
    recordStockCount, receiveStock, adjustStock, language
  } = useStore();
  const th = language !== 'en';

  const [showInactive, setShowInactive] = useState(false);
  const [busy, setBusy] = useState(false);

  // --- modals ---
  const [countSession, setCountSession] = useState<null | 'morning' | 'evening'>(null);
  const [countValues, setCountValues] = useState<Record<string, string>>({});
  const [showReceive, setShowReceive] = useState(false);
  const [receiveRows, setReceiveRows] = useState<ReceiveRow[]>([{ itemId: '', qty: '', unitCost: '' }]);
  const [receiveSupplierId, setReceiveSupplierId] = useState('');
  const [receiveBill, setReceiveBill] = useState('');
  const [receiveNote, setReceiveNote] = useState('');
  const [receiveCreateExpense, setReceiveCreateExpense] = useState(true);
  const [showSuppliers, setShowSuppliers] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);
  const [isNewItem, setIsNewItem] = useState(false);
  const [adjustItem, setAdjustItem] = useState<StockItem | null>(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustIsWaste, setAdjustIsWaste] = useState(false);

  const visibleItems = useMemo(
    () => stockItems.filter(i => showInactive ? true : i.active !== false),
    [stockItems, showInactive]
  );
  const grouped = useMemo(() => {
    const g: Record<string, StockItem[]> = {};
    visibleItems.forEach(i => {
      const cat = CATEGORY_TH[i.category] ? i.category : 'other';
      (g[cat] = g[cat] || []).push(i);
    });
    return CATEGORY_ORDER.filter(c => g[c] && g[c].length > 0).map(c => ({ cat: c, items: g[c] }));
  }, [visibleItems]);

  const supplierName = (id?: string) => suppliers.find(s => s.id === id)?.name || '';
  const itemName = (id: string) => stockItems.find(i => i.id === id)?.name || id;

  const statusOf = (i: StockItem): 'out' | 'low' | 'ok' =>
    Number(i.currentQty) <= 0 ? 'out' : Number(i.currentQty) <= Number(i.minLevel) ? 'low' : 'ok';

  // ---------- actions ----------
  const openCount = () => {
    const hour = new Date().getHours();
    setCountValues({});
    setCountSession(hour < 14 ? 'morning' : 'evening');
  };

  const submitCount = async () => {
    const entries = Object.entries(countValues)
      .filter(([, v]) => v !== '' && !isNaN(Number(v)))
      .map(([itemId, v]) => ({ itemId, qty: Number(v) }));
    if (entries.length === 0) { alert(th ? 'ยังไม่ได้กรอกยอดนับ — พิมพ์เฉพาะช่องที่นับจริง ช่องว่าง = ไม่เปลี่ยน' : 'Nothing to save'); return; }
    setBusy(true);
    const n = await recordStockCount(countSession!, entries);
    setBusy(false);
    if (n > 0) {
      setCountSession(null);
      alert(th ? `✅ บันทึกการนับ${countSession === 'morning' ? 'เช้า' : 'เย็น'} ${n} รายการเรียบร้อย` : `Saved ${n} counts`);
    }
  };

  const submitReceive = async () => {
    const entries = receiveRows
      .filter(r => r.itemId && Number(r.qty) > 0)
      .map(r => ({ itemId: r.itemId, qty: Number(r.qty), unitCost: r.unitCost !== '' ? Number(r.unitCost) : undefined }));
    if (entries.length === 0) { alert(th ? 'เลือกวัตถุดิบและใส่จำนวนอย่างน้อย 1 รายการ' : 'Add at least one line'); return; }
    setBusy(true);
    const ok = await receiveStock(entries, {
      supplierId: receiveSupplierId || undefined,
      billNumber: receiveBill || undefined,
      note: receiveNote || undefined,
      createExpense: receiveCreateExpense
    });
    setBusy(false);
    if (ok) {
      setShowReceive(false);
      setReceiveRows([{ itemId: '', qty: '', unitCost: '' }]);
      setReceiveBill(''); setReceiveNote(''); setReceiveSupplierId('');
      alert(th ? `✅ รับของเข้า ${entries.length} รายการเรียบร้อย${receiveCreateExpense ? ' (ลงบัญชีรายจ่ายแล้ว)' : ''}` : 'Received');
    }
  };

  const receiveTotal = receiveRows.reduce((s, r) => s + (Number(r.qty) || 0) * (Number(r.unitCost) || 0), 0);

  const saveItem = async () => {
    if (!editingItem || !editingItem.name.trim()) { alert(th ? 'กรุณาใส่ชื่อวัตถุดิบ' : 'Name required'); return; }
    setBusy(true);
    if (isNewItem) await addStockItem(editingItem);
    else await updateStockItem(editingItem);
    setBusy(false);
    setEditingItem(null);
  };

  const saveSupplier = async () => {
    if (!editingSupplier || !editingSupplier.name.trim()) { alert(th ? 'กรุณาใส่ชื่อร้านค้า/Supplier' : 'Name required'); return; }
    setBusy(true);
    if (suppliers.some(s => s.id === editingSupplier.id)) await updateSupplier(editingSupplier);
    else await addSupplier(editingSupplier);
    setBusy(false);
    setEditingSupplier(null);
  };

  const submitAdjust = async () => {
    if (!adjustItem || adjustQty === '' || isNaN(Number(adjustQty))) return;
    setBusy(true);
    await adjustStock(adjustItem.id, Number(adjustQty), adjustNote || undefined, adjustIsWaste ? 'waste' : 'adjust');
    setBusy(false);
    setAdjustItem(null); setAdjustQty(''); setAdjustNote(''); setAdjustIsWaste(false);
  };

  const movementMeta = (t: string, session?: string) => {
    switch (t) {
      case 'count': return { icon: session === 'morning' ? '☀️' : '🌙', label: `นับสต็อก${session === 'morning' ? 'เช้า' : session === 'evening' ? 'เย็น' : ''}`, cls: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'receive': return { icon: '📦', label: 'รับของเข้า', cls: 'bg-green-50 text-green-700 border-green-200' };
      case 'waste': return { icon: '🗑', label: 'ของเสีย/ทิ้ง', cls: 'bg-red-50 text-red-700 border-red-200' };
      default: return { icon: '✏️', label: 'ปรับยอด', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    }
  };

  return (
    <div className="flex-1 bg-gray-100 p-4 sm:p-6 overflow-y-auto pb-24 lg:pb-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* ===== HEADER ===== */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border-b border-gray-200 pb-4">
          <div>
            <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
              <Package className="text-brand-600" size={26} />
              {th ? 'สต็อกวัตถุดิบ & Supplier' : 'Stock & Suppliers'}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {th ? 'นับมือเช้า-เย็น + จดของเข้า (ยังไม่ตัดอัตโนมัติตามออเดอร์) • แตะ "นับสต็อก" ทุกเช้าก่อนเปิดร้าน และเย็นก่อนปิดร้าน' : 'Manual counts + goods-in log (no auto deduction yet)'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={openCount} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm flex items-center gap-1.5 active:scale-95 transition">
              <ClipboardList size={16} />{th ? 'นับสต็อก' : 'Count'}
            </button>
            <button onClick={() => { setShowReceive(true); setReceiveRows([{ itemId: '', qty: '', unitCost: '' }]); }} className="px-4 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-bold shadow-sm flex items-center gap-1.5 active:scale-95 transition">
              <PackagePlus size={16} />{th ? 'รับของเข้า' : 'Receive'}
            </button>
            <button onClick={() => setShowSuppliers(true)} className="px-4 py-2.5 rounded-xl bg-gray-800 hover:bg-black text-white text-sm font-bold shadow-sm flex items-center gap-1.5 active:scale-95 transition">
              <BookOpen size={16} />{th ? `สมุด Supplier (${suppliers.length})` : `Suppliers (${suppliers.length})`}
            </button>
            <button onClick={() => { setIsNewItem(true); setEditingItem({ id: `stk_${Date.now()}`, name: '', unit: 'กก.', category: 'other', minLevel: 1, currentQty: 0, active: true }); }}
              className="px-4 py-2.5 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-bold shadow-sm flex items-center gap-1.5 active:scale-95 transition">
              <Plus size={16} />{th ? 'เพิ่มวัตถุดิบ' : 'Add item'}
            </button>
            <button onClick={() => fetchStockData()} title={th ? 'รีเฟรชข้อมูล' : 'Refresh'} className="px-3 py-2.5 rounded-xl bg-white border border-gray-300 hover:bg-gray-50 text-gray-500 shadow-sm active:scale-95 transition">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {/* ===== LOW STOCK ALERT ===== */}
        {lowStockItems.length > 0 && (
          <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 animate-fade-in">
            <div className="flex items-center gap-2 font-black text-red-700 text-sm mb-2">
              <AlertTriangle size={18} className="animate-pulse" />
              {th ? `ใกล้หมด/หมดสต็อก ${lowStockItems.length} รายการ — รีบสั่งของ!` : `${lowStockItems.length} items low or out of stock`}
            </div>
            <div className="flex flex-wrap gap-2">
              {lowStockItems.map(i => (
                <span key={i.id} className={`text-xs font-bold px-2.5 py-1.5 rounded-lg border ${Number(i.currentQty) <= 0 ? 'bg-red-600 text-white border-red-600' : 'bg-white text-red-700 border-red-200'}`}>
                  {i.name}: {fmtQty(i.currentQty)}/{fmtQty(i.minLevel)} {i.unit}
                  {i.supplierId && suppliers.find(s => s.id === i.supplierId)?.phone && (
                    <a href={`tel:${suppliers.find(s => s.id === i.supplierId)?.phone}`} className="ml-1.5 underline">📞 {supplierName(i.supplierId)}</a>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ===== ITEMS BY CATEGORY ===== */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="text-xs font-black text-gray-500 uppercase">{th ? `วัตถุดิบทั้งหมด ${visibleItems.length} รายการ` : `${visibleItems.length} items`}</span>
            <label className="text-xs font-bold text-gray-500 flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
              {th ? 'แสดงรายการที่เลิกใช้' : 'Show inactive'}
            </label>
          </div>

          {grouped.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center text-gray-400 font-bold">
              {th ? 'ยังไม่มีวัตถุดิบ — กด "เพิ่มวัตถุดิบ" เพื่อเริ่มต้น' : 'No items yet'}
            </div>
          )}

          {grouped.map(({ cat, items }) => (
            <div key={cat} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 font-black text-sm text-gray-700">{CATEGORY_TH[cat]}</div>
              <div className="divide-y divide-gray-50">
                {items.map(i => {
                  const st = statusOf(i);
                  return (
                    <div key={i.id} className={`px-4 py-3 flex items-center gap-3 ${i.active === false ? 'opacity-50' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-800 text-sm flex items-center gap-2 flex-wrap">
                          {i.name}
                          {i.active === false && <span className="text-[9px] font-black bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">{th ? 'เลิกใช้' : 'INACTIVE'}</span>}
                          {st === 'out' && i.active !== false && <span className="text-[9px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded animate-pulse">{th ? 'หมด!' : 'OUT'}</span>}
                          {st === 'low' && i.active !== false && <span className="text-[9px] font-black bg-orange-100 text-orange-700 border border-orange-200 px-1.5 py-0.5 rounded">{th ? 'ใกล้หมด' : 'LOW'}</span>}
                        </div>
                        <div className="text-[11px] text-gray-400 font-semibold flex items-center gap-2 flex-wrap mt-0.5">
                          <span>{th ? 'ขั้นต่ำ' : 'min'} {fmtQty(i.minLevel)} {i.unit}</span>
                          {i.costPerUnit !== undefined && <span>• ฿{i.costPerUnit}/{i.unit}</span>}
                          {i.supplierId && <span>• 🏪 {supplierName(i.supplierId)}</span>}
                        </div>
                      </div>
                      <button onClick={() => { setAdjustItem(i); setAdjustQty(fmtQty(i.currentQty)); setAdjustNote(''); setAdjustIsWaste(false); }}
                        className={`text-right px-3 py-1.5 rounded-xl border-2 transition active:scale-95 min-w-[92px] ${st === 'out' ? 'border-red-300 bg-red-50' : st === 'low' ? 'border-orange-300 bg-orange-50' : 'border-gray-200 bg-gray-50 hover:border-brand-300'}`}
                        title={th ? 'แตะเพื่อปรับยอด/บันทึกของเสีย' : 'Tap to adjust'}>
                        <div className={`text-lg font-black leading-none ${st === 'out' ? 'text-red-600' : st === 'low' ? 'text-orange-600' : 'text-gray-800'}`}>{fmtQty(i.currentQty)}</div>
                        <div className="text-[10px] font-bold text-gray-400">{i.unit}</div>
                      </button>
                      <button onClick={() => { setIsNewItem(false); setEditingItem({ ...i }); }} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"><Edit2 size={16} /></button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ===== MOVEMENT LOG ===== */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 font-black text-sm text-gray-700 flex items-center gap-2">
            <History size={16} className="text-brand-600" />{th ? 'ประวัติล่าสุด (นับ/รับเข้า/ปรับ/ของเสีย)' : 'Recent movements'}
          </div>
          {stockMovements.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm font-bold">{th ? 'ยังไม่มีประวัติ — เริ่มจากกด "นับสต็อก" ครั้งแรก' : 'No movements yet'}</div>
          ) : (
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {stockMovements.map(m => {
                const meta = movementMeta(m.type, m.session);
                return (
                  <div key={m.id} className="px-4 py-2.5 flex items-center gap-3 text-sm">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-lg border shrink-0 ${meta.cls}`}>{meta.icon} {meta.label}</span>
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-gray-800">{itemName(m.itemId)}</span>
                      <span className="text-gray-500 font-semibold">
                        {' '}{m.type === 'receive' ? `+${fmtQty(m.qty)}` : m.type === 'count' ? `นับได้ ${fmtQty(m.qty)}` : `${fmtQty(m.qtyBefore ?? 0)}→${fmtQty(m.qtyAfter ?? 0)}`}
                        {m.totalCost ? <span className="text-green-700"> • ฿{m.totalCost.toLocaleString()}</span> : null}
                        {m.supplierName ? ` • ${m.supplierName}` : ''}
                      </span>
                      {m.note && <div className="text-[10px] text-gray-400 truncate">{m.note}</div>}
                    </div>
                    <div className="text-right text-[10px] text-gray-400 font-bold shrink-0">
                      <div>{fmtTime(m.createdAt)}</div>
                      {m.createdBy && <div className="truncate max-w-[90px]">{String(m.createdBy).split('@')[0]}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ============ COUNT MODAL ============ */}
      {countSession && (
        <div className="fixed inset-0 bg-black/60 z-[95] flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">
            <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <h4 className="font-black text-gray-800 flex items-center gap-2">
                  <ClipboardList size={18} className="text-blue-600" />{th ? 'นับสต็อก' : 'Stock count'}
                </h4>
                <div className="flex rounded-xl overflow-hidden border border-gray-200">
                  <button onClick={() => setCountSession('morning')} className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1 ${countSession === 'morning' ? 'bg-amber-400 text-white' : 'bg-white text-gray-500'}`}><Sun size={13} />{th ? 'รอบเช้า' : 'Morning'}</button>
                  <button onClick={() => setCountSession('evening')} className={`px-3 py-1.5 text-xs font-bold flex items-center gap-1 ${countSession === 'evening' ? 'bg-indigo-500 text-white' : 'bg-white text-gray-500'}`}><Moon size={13} />{th ? 'รอบเย็น' : 'Evening'}</button>
                </div>
              </div>
              <button onClick={() => setCountSession(null)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="px-5 py-2 bg-blue-50 text-[11px] font-bold text-blue-700 border-b border-blue-100">
              💡 {th ? 'พิมพ์ยอดที่นับได้จริงเฉพาะช่องที่นับ — ช่องที่เว้นว่าง = ไม่เปลี่ยนยอด' : 'Fill only counted items; blank = unchanged'}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {grouped.map(({ cat, items }) => (
                <div key={cat}>
                  <div className="text-[10px] font-black text-gray-400 uppercase mb-1.5">{CATEGORY_TH[cat]}</div>
                  <div className="space-y-1.5">
                    {items.filter(i => i.active !== false).map(i => (
                      <div key={i.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-sm text-gray-800 truncate">{i.name}</div>
                          <div className="text-[10px] text-gray-400 font-bold">{th ? 'ยอดในระบบ' : 'System'}: {fmtQty(i.currentQty)} {i.unit}</div>
                        </div>
                        <input
                          type="number" inputMode="decimal" min={0} placeholder={fmtQty(i.currentQty)}
                          value={countValues[i.id] ?? ''}
                          onChange={e => setCountValues(prev => ({ ...prev, [i.id]: e.target.value }))}
                          className="w-24 text-center text-lg font-black border-2 border-gray-200 rounded-xl px-2 py-2 outline-none focus:border-blue-500 bg-white"
                        />
                        <span className="text-xs font-bold text-gray-400 w-10">{i.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
              <button onClick={() => setCountSession(null)} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200">{th ? 'ยกเลิก' : 'Cancel'}</button>
              <button onClick={submitCount} disabled={busy}
                className="flex-[2] py-2.5 rounded-xl font-bold text-sm bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Save size={15} />{busy ? '...' : (th ? `บันทึกการนับ${countSession === 'morning' ? 'เช้า ☀️' : 'เย็น 🌙'} (${Object.values(countValues).filter(v => v !== '').length} รายการ)` : 'Save counts')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ RECEIVE MODAL ============ */}
      {showReceive && (
        <div className="fixed inset-0 bg-black/60 z-[95] flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">
            <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-center">
              <h4 className="font-black text-gray-800 flex items-center gap-2"><PackagePlus size={18} className="text-green-600" />{th ? 'รับของเข้าจาก Supplier' : 'Receive goods'}</h4>
              <button onClick={() => setShowReceive(false)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{th ? 'ซื้อจาก (Supplier)' : 'Supplier'}</label>
                  <select className={inputCls} value={receiveSupplierId} onChange={e => setReceiveSupplierId(e.target.value)}>
                    <option value="">{th ? '— ไม่ระบุ / ซื้อสดตลาด —' : '— none —'}</option>
                    {suppliers.filter(s => s.active !== false).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{th ? 'เลขที่บิล (ถ้ามี)' : 'Bill no.'}</label>
                  <input className={inputCls} value={receiveBill} onChange={e => setReceiveBill(e.target.value)} placeholder="INV-001" />
                </div>
              </div>

              <div className="space-y-2">
                <label className={labelCls}>{th ? 'รายการของที่รับเข้า' : 'Lines'}</label>
                {receiveRows.map((r, idx) => {
                  const item = stockItems.find(i => i.id === r.itemId);
                  return (
                    <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-xl p-2 border border-gray-100">
                      <select className={`${inputCls} flex-1`} value={r.itemId}
                        onChange={e => {
                          const it = stockItems.find(i => i.id === e.target.value);
                          setReceiveRows(prev => prev.map((x, i) => i === idx ? { ...x, itemId: e.target.value, unitCost: x.unitCost || (it?.costPerUnit !== undefined ? String(it.costPerUnit) : '') } : x));
                        }}>
                        <option value="">{th ? '— เลือกวัตถุดิบ —' : '— item —'}</option>
                        {stockItems.filter(i => i.active !== false).map(i => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
                      </select>
                      <input type="number" inputMode="decimal" min={0} placeholder={th ? 'จำนวน' : 'qty'} className={`${inputCls} !w-20 text-center font-bold`}
                        value={r.qty} onChange={e => setReceiveRows(prev => prev.map((x, i) => i === idx ? { ...x, qty: e.target.value } : x))} />
                      <input type="number" inputMode="decimal" min={0} placeholder={`฿/${item?.unit || 'หน่วย'}`} className={`${inputCls} !w-24 text-center`}
                        value={r.unitCost} onChange={e => setReceiveRows(prev => prev.map((x, i) => i === idx ? { ...x, unitCost: e.target.value } : x))} />
                      <button onClick={() => setReceiveRows(prev => prev.length === 1 ? prev : prev.filter((_, i) => i !== idx))} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={15} /></button>
                    </div>
                  );
                })}
                <button onClick={() => setReceiveRows(prev => [...prev, { itemId: '', qty: '', unitCost: '' }])}
                  className="w-full py-2 rounded-xl border-2 border-dashed border-green-300 text-green-600 text-xs font-bold hover:bg-green-50 flex items-center justify-center gap-1">
                  <Plus size={14} />{th ? 'เพิ่มรายการ' : 'Add line'}
                </button>
              </div>

              <div>
                <label className={labelCls}>{th ? 'หมายเหตุ' : 'Note'}</label>
                <input className={inputCls} value={receiveNote} onChange={e => setReceiveNote(e.target.value)} placeholder={th ? 'เช่น ของแถม 1 ถุง' : ''} />
              </div>

              <label className={`flex items-center gap-2.5 rounded-xl border-2 p-3 cursor-pointer transition ${receiveCreateExpense ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
                <input type="checkbox" checked={receiveCreateExpense} onChange={e => setReceiveCreateExpense(e.target.checked)} className="w-4 h-4 rounded" />
                <div className="text-xs">
                  <div className="font-black text-gray-800">{th ? 'ลงบัญชีรายจ่ายอัตโนมัติ (แท็บ Expenses)' : 'Auto-log to Expenses'}</div>
                  <div className="text-gray-500 font-semibold">{th ? `หมวด COGS • ยอดรวม ฿${receiveTotal.toLocaleString()}${receiveTotal === 0 ? ' (ใส่ราคา/หน่วยเพื่อคำนวณ)' : ''}` : `COGS • total ฿${receiveTotal.toLocaleString()}`}</div>
                </div>
              </label>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
              <button onClick={() => setShowReceive(false)} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200">{th ? 'ยกเลิก' : 'Cancel'}</button>
              <button onClick={submitReceive} disabled={busy}
                className="flex-[2] py-2.5 rounded-xl font-bold text-sm bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Save size={15} />{busy ? '...' : (th ? `บันทึกรับของ${receiveTotal > 0 ? ` • ฿${receiveTotal.toLocaleString()}` : ''}` : 'Save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ SUPPLIER BOOK MODAL ============ */}
      {showSuppliers && (
        <div className="fixed inset-0 bg-black/60 z-[95] flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">
            <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-center">
              <h4 className="font-black text-gray-800 flex items-center gap-2"><BookOpen size={18} className="text-brand-600" />{th ? 'สมุดรายชื่อ Supplier' : 'Supplier book'}</h4>
              <div className="flex items-center gap-2">
                <button onClick={() => setEditingSupplier({ id: `sup_${Date.now()}`, name: '', phone: '', lineId: '', contactPerson: '', categories: '', note: '', active: true })}
                  className="px-3 py-1.5 rounded-xl bg-brand-600 text-white text-xs font-bold flex items-center gap-1"><Plus size={14} />{th ? 'เพิ่ม Supplier' : 'Add'}</button>
                <button onClick={() => setShowSuppliers(false)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {suppliers.length === 0 && (
                <div className="text-center py-10 text-gray-400 font-bold text-sm">{th ? 'ยังไม่มี Supplier — กด "เพิ่ม Supplier" เพื่อบันทึกร้านค้าที่ซื้อประจำ' : 'No suppliers yet'}</div>
              )}
              {suppliers.map(s => (
                <div key={s.id} className={`border rounded-xl p-3.5 ${s.active === false ? 'opacity-50 bg-gray-50' : 'bg-white border-gray-200'}`}>
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-gray-800 text-sm">{s.name}{s.active === false ? ' (เลิกใช้)' : ''}</div>
                      <div className="text-xs text-gray-500 font-semibold space-y-0.5 mt-1">
                        {s.contactPerson && <div>👤 {s.contactPerson}</div>}
                        {s.phone && <div>📞 <a href={`tel:${s.phone}`} className="text-blue-600 underline font-bold">{s.phone}</a></div>}
                        {s.lineId && <div>💬 LINE: {s.lineId}</div>}
                        {s.categories && <div>🛒 {th ? 'ขาย' : 'sells'}: {s.categories}</div>}
                        {s.note && <div className="text-gray-400">📝 {s.note}</div>}
                        <div className="text-[10px] text-gray-300">
                          {th ? 'ใช้กับ' : 'used by'} {stockItems.filter(i => i.supplierId === s.id).length} {th ? 'วัตถุดิบ' : 'items'}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => setEditingSupplier({ ...s })} className="p-2 rounded-lg text-gray-400 hover:bg-gray-100"><Edit2 size={15} /></button>
                      <button onClick={async () => {
                        if (confirm(`ลบ "${s.name}" ออกจากสมุด Supplier?\n(วัตถุดิบที่ผูกไว้จะไม่ถูกลบ แค่ปลดการเชื่อม)`)) await deleteSupplier(s.id);
                      }} className="p-2 rounded-lg text-red-400 hover:bg-red-50"><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ============ SUPPLIER EDIT MODAL ============ */}
      {editingSupplier && (
        <div className="fixed inset-0 bg-black/70 z-[97] flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-center">
              <h4 className="font-black text-gray-800">{suppliers.some(s => s.id === editingSupplier.id) ? (th ? 'แก้ไข Supplier' : 'Edit supplier') : (th ? 'เพิ่ม Supplier ใหม่' : 'New supplier')}</h4>
              <button onClick={() => setEditingSupplier(null)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className={labelCls}>{th ? 'ชื่อร้าน/บริษัท *' : 'Name *'}</label>
                <input className={inputCls} value={editingSupplier.name} onChange={e => setEditingSupplier(p => p ? { ...p, name: e.target.value } : p)} placeholder={th ? 'เช่น แม็คโคร แจ้งวัฒนะ' : ''} autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{th ? 'เบอร์โทร' : 'Phone'}</label>
                  <input className={inputCls} value={editingSupplier.phone || ''} onChange={e => setEditingSupplier(p => p ? { ...p, phone: e.target.value } : p)} placeholder="08x-xxx-xxxx" />
                </div>
                <div>
                  <label className={labelCls}>LINE ID</label>
                  <input className={inputCls} value={editingSupplier.lineId || ''} onChange={e => setEditingSupplier(p => p ? { ...p, lineId: e.target.value } : p)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>{th ? 'ชื่อผู้ติดต่อ (เซลส์)' : 'Contact person'}</label>
                <input className={inputCls} value={editingSupplier.contactPerson || ''} onChange={e => setEditingSupplier(p => p ? { ...p, contactPerson: e.target.value } : p)} />
              </div>
              <div>
                <label className={labelCls}>{th ? 'ขายอะไร (หมวดของ)' : 'Sells'}</label>
                <input className={inputCls} value={editingSupplier.categories || ''} onChange={e => setEditingSupplier(p => p ? { ...p, categories: e.target.value } : p)} placeholder={th ? 'เช่น ชีส, แป้ง, กล่อง' : ''} />
              </div>
              <div>
                <label className={labelCls}>{th ? 'หมายเหตุ (เงื่อนไขส่ง/ขั้นต่ำ/วันส่งของ)' : 'Note'}</label>
                <textarea rows={2} className={inputCls} value={editingSupplier.note || ''} onChange={e => setEditingSupplier(p => p ? { ...p, note: e.target.value } : p)} placeholder={th ? 'เช่น ส่งทุกอังคาร/ศุกร์ ขั้นต่ำ ฿1,000' : ''} />
              </div>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
              <button onClick={() => setEditingSupplier(null)} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-600">{th ? 'ยกเลิก' : 'Cancel'}</button>
              <button onClick={saveSupplier} disabled={busy} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-brand-600 text-white hover:bg-brand-700 flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Save size={15} />{th ? 'บันทึก' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ ITEM EDIT MODAL ============ */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/70 z-[97] flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-center">
              <h4 className="font-black text-gray-800">{isNewItem ? (th ? 'เพิ่มวัตถุดิบใหม่' : 'New item') : (th ? 'แก้ไขวัตถุดิบ' : 'Edit item')}</h4>
              <button onClick={() => setEditingItem(null)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className={labelCls}>{th ? 'ชื่อวัตถุดิบ *' : 'Name *'}</label>
                <input className={inputCls} value={editingItem.name} onChange={e => setEditingItem(p => p ? { ...p, name: e.target.value } : p)} autoFocus placeholder={th ? 'เช่น ชีสมอสซาเรลล่า' : ''} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{th ? 'หน่วยนับ' : 'Unit'}</label>
                  <select className={inputCls} value={editingItem.unit} onChange={e => setEditingItem(p => p ? { ...p, unit: e.target.value } : p)}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>{th ? 'หมวดหมู่' : 'Category'}</label>
                  <select className={inputCls} value={editingItem.category} onChange={e => setEditingItem(p => p ? { ...p, category: e.target.value } : p)}>
                    {CATEGORY_ORDER.map(c => <option key={c} value={c}>{CATEGORY_TH[c]}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>⚠️ {th ? 'จุดแจ้งเตือนใกล้หมด' : 'Alert level'}</label>
                  <input type="number" inputMode="decimal" min={0} className={inputCls} value={editingItem.minLevel}
                    onChange={e => setEditingItem(p => p ? { ...p, minLevel: Number(e.target.value) } : p)} />
                  <p className="text-[10px] text-gray-400 mt-0.5">{th ? `เหลือ ≤ ค่านี้จะขึ้นเตือนแดง` : ''}</p>
                </div>
                <div>
                  <label className={labelCls}>{th ? 'ราคา/หน่วย (฿)' : 'Cost/unit'}</label>
                  <input type="number" inputMode="decimal" min={0} className={inputCls} value={editingItem.costPerUnit ?? ''}
                    onChange={e => setEditingItem(p => p ? { ...p, costPerUnit: e.target.value === '' ? undefined : Number(e.target.value) } : p)} />
                </div>
              </div>
              {isNewItem && (
                <div>
                  <label className={labelCls}>{th ? 'ยอดเริ่มต้นตอนนี้' : 'Starting qty'}</label>
                  <input type="number" inputMode="decimal" min={0} className={inputCls} value={editingItem.currentQty}
                    onChange={e => setEditingItem(p => p ? { ...p, currentQty: Number(e.target.value) } : p)} />
                </div>
              )}
              <div>
                <label className={labelCls}>{th ? 'Supplier ประจำ' : 'Default supplier'}</label>
                <select className={inputCls} value={editingItem.supplierId || ''} onChange={e => setEditingItem(p => p ? { ...p, supplierId: e.target.value || undefined } : p)}>
                  <option value="">{th ? '— ไม่ระบุ —' : '— none —'}</option>
                  {suppliers.filter(s => s.active !== false).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              {!isNewItem && (
                <div className="flex gap-2 pt-1">
                  <button onClick={async () => {
                    await updateStockItem({ ...editingItem, active: editingItem.active === false });
                    setEditingItem(null);
                  }} className="flex-1 py-2 rounded-xl text-xs font-bold border border-gray-300 text-gray-600 hover:bg-gray-50">
                    {editingItem.active === false ? (th ? '↩️ กลับมาใช้รายการนี้' : 'Reactivate') : (th ? '🚫 เลิกใช้ (ซ่อนจากรายการ)' : 'Deactivate')}
                  </button>
                  <button onClick={async () => {
                    if (confirm(`ลบ "${editingItem.name}" ถาวร?\n\n⚠️ ประวัติการนับ/รับของของรายการนี้จะหายทั้งหมด — ถ้าแค่ไม่ใช้แล้วแนะนำ "เลิกใช้" แทน`)) {
                      await deleteStockItem(editingItem.id, true);
                      setEditingItem(null);
                    }
                  }} className="py-2 px-3 rounded-xl text-xs font-bold border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"><Trash2 size={14} /></button>
                </div>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
              <button onClick={() => setEditingItem(null)} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-600">{th ? 'ยกเลิก' : 'Cancel'}</button>
              <button onClick={saveItem} disabled={busy} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-brand-600 text-white hover:bg-brand-700 flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Save size={15} />{th ? 'บันทึก' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ QUICK ADJUST MODAL ============ */}
      {adjustItem && (
        <div className="fixed inset-0 bg-black/70 z-[97] flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-5 py-3.5 border-b border-gray-100 flex justify-between items-center">
              <h4 className="font-black text-gray-800 flex items-center gap-2"><Scale size={16} className="text-brand-600" />{th ? 'ปรับยอด' : 'Adjust'}: {adjustItem.name}</h4>
              <button onClick={() => setAdjustItem(null)} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-400"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="text-center text-xs font-bold text-gray-400">{th ? 'ยอดปัจจุบันในระบบ' : 'Current'}: {fmtQty(adjustItem.currentQty)} {adjustItem.unit}</div>
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setAdjustQty(v => String(Math.max(0, (Number(v) || 0) - 1)))} className="w-12 h-12 rounded-2xl bg-gray-100 text-2xl font-black text-gray-600 active:scale-90 transition">−</button>
                <input type="number" inputMode="decimal" min={0} value={adjustQty} onChange={e => setAdjustQty(e.target.value)}
                  className="w-28 text-center text-3xl font-black border-2 border-gray-200 rounded-2xl py-2 outline-none focus:border-brand-500" />
                <button onClick={() => setAdjustQty(v => String((Number(v) || 0) + 1))} className="w-12 h-12 rounded-2xl bg-gray-100 text-2xl font-black text-gray-600 active:scale-90 transition">+</button>
              </div>
              <div className="text-center text-xs font-bold text-gray-400">{adjustItem.unit}</div>
              <label className={`flex items-center gap-2 rounded-xl border-2 p-2.5 cursor-pointer text-xs font-bold transition ${adjustIsWaste ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-500'}`}>
                <input type="checkbox" checked={adjustIsWaste} onChange={e => setAdjustIsWaste(e.target.checked)} className="rounded" />
                🗑 {th ? 'บันทึกเป็น "ของเสีย/ทิ้ง" (เช่น ของหมดอายุ ทำหก)' : 'Log as waste'}
              </label>
              <input className={inputCls} value={adjustNote} onChange={e => setAdjustNote(e.target.value)} placeholder={th ? 'หมายเหตุ (ไม่บังคับ)' : 'Note'} />
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
              <button onClick={() => setAdjustItem(null)} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-600">{th ? 'ยกเลิก' : 'Cancel'}</button>
              <button onClick={submitAdjust} disabled={busy} className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 flex items-center justify-center gap-1.5">
                <Save size={15} />{th ? 'บันทึก' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockManager;
