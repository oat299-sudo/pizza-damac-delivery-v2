import React, { useState, useEffect } from 'react';
import { Truck, MapPin, Check, ChevronRight, AlertTriangle, Play, CheckCircle2, User, Phone, Search, Loader2 } from 'lucide-react';
import { Order, parseGPSCoordinates, parseAnyMapLink, parseDeliveryPhone } from '../../types';
import { getLalamoveQuote, LalamoveQuote, fetchRealLalamoveQuote, createRealLalamoveOrder, checkLalamoveStatus } from '../../services/lalamoveService';
import { RESTAURANT_LOCATION } from '../../constants';
import { calculateDistanceKm } from '../../utils/geo';
import { useStore } from '../../context/StoreContext';

interface LalamoveDispatchPanelProps {
  order: Order;
  updateOrderFields: (orderId: string, fields: Partial<any>) => Promise<any>;
  language: 'en' | 'th';
}

export default function LalamoveDispatchPanel({ order, updateOrderFields, language }: LalamoveDispatchPanelProps) {
  const { storeSettings } = useStore();
  const [distance, setDistance] = useState<number>(0);
  const [quotes, setQuotes] = useState<LalamoveQuote[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<'motorcycle' | 'car' | 'pickup'>(
    order.delivery_vehicle === 'car' ? 'car' : order.delivery_vehicle === 'pickup' ? 'pickup' : 'motorcycle'
  ); // default to what the CUSTOMER already chose at checkout
  const [isBooking, setIsBooking] = useState(false);
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [apiMessage, setApiMessage] = useState<string>('');

  // --- ADVANCE (SCHEDULED) BOOKING for pre-orders ---
  // If the order has a machine-readable scheduled time far enough in the future,
  // we book Lalamove with scheduleAt = (scheduled time - 20 min rider lead).
  const RIDER_LEAD_MIN = 20;
  const scheduledInfo = (() => {
    if (!order.scheduledAt) return null;
    const t = new Date(order.scheduledAt);
    if (isNaN(t.getTime())) return null;
    const riderPickupAt = new Date(t.getTime() - RIDER_LEAD_MIN * 60000);
    // Needs to be comfortably in the future for Lalamove to accept a scheduled job
    if (riderPickupAt.getTime() < Date.now() + 15 * 60000) return null;
    const fmt = (d: Date) => d.toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
    return {
      deliverAt: t,
      riderPickupAt,
      riderPickupIso: riderPickupAt.toISOString(),
      deliverLabel: fmt(t),
      pickupLabel: fmt(riderPickupAt)
    };
  })();

  // Check Lalamove API status on mount
  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      const res = await checkLalamoveStatus();
      if (active) {
        setApiStatus(res.status);
        setApiMessage(res.message);
      }
    };
    fetchStatus();
    return () => { active = false; };
  }, []);

  // Extract coordinates and compute distance
  useEffect(() => {
    let lat = order.deliveryLat;
    let lng = order.deliveryLng;

    if (!lat || !lng) {
      const parsed = parseGPSCoordinates(order.deliveryAddress || '');
      if (parsed) {
        lat = parsed.lat;
        lng = parsed.lng;
      }
    }

    const storeGps = storeSettings?.storeLocationGps || "13.9239103,100.5220632";
    const storeCoords = parseAnyMapLink(storeGps) || { lat: 13.9239103, lng: 100.5220632 };

    const d = lat && lng 
      ? calculateDistanceKm(storeCoords.lat, storeCoords.lng, lat, lng)
      : 5.0;
    
    setDistance(d);

    // Fetch real Lalamove quotes if coordinates exist, fallback to simulation
    const loadQuotes = async () => {
      if (lat && lng) {
        const realQuotes = await fetchRealLalamoveQuote(
          lat,
          lng,
          order.deliveryAddress || '',
          order.customerName || 'Customer',
          order.customerPhone || '',
          scheduledInfo?.riderPickupIso // pre-orders get a SCHEDULED quotation
        );
        if (realQuotes && realQuotes.length > 0) {
          setQuotes(realQuotes);
          setDistance(realQuotes[0].distanceKm);
          return;
        }
      }
      // Fallback
      setQuotes(getLalamoveQuote(d));
    };

    loadQuotes();
  }, [order.deliveryAddress, order.deliveryLat, order.deliveryLng, order.customerName, order.customerPhone, order.scheduledAt]);

  // NOTE: The old auto-advance "Simulation effect" and the mock-rider fallback are REMOVED.
  // Production rule: only REAL Lalamove bookings are allowed. Real status updates arrive
  // via the Lalamove webhook (delivery_status), never from a client-side timer.

  // Derive display status: real orders follow the webhook's delivery_status (Lalamove v3 statuses)
  //   finding    = ASSIGNING_DRIVER (or REJECTED: Lalamove re-matches a new rider by itself)
  //   picking_up = ON_GOING  (rider accepted, heading to the shop)
  //   in_transit = PICKED_UP
  //   failed     = EXPIRED / CANCELED by Lalamove or the rider -> staff must re-book
  type PanelStatus = 'none' | 'finding' | 'picking_up' | 'in_transit' | 'completed' | 'failed';
  const deriveStatus = (): PanelStatus => {
    if (order.lalamove_order_id) {
      const ds = String(order.delivery_status || '').toLowerCase();
      if (ds === 'completed') return 'completed';
      if (ds === 'picked_up') return 'in_transit';
      if (ds === 'ongoing' || ds === 'on_going' || ds === 'on_the_way' || ds === 'to_pickup') return 'picking_up';
      if (ds === 'assigning' || ds === 'assigning_driver' || ds === 'rejected') return 'finding';
      if (ds === 'canceled' || ds === 'cancelled' || ds === 'expired') return 'failed';
      return 'finding';
    }
    const ls = order.lalamoveStatus;
    if (ls === 'completed') return 'completed';
    if (ls === 'in_transit') return 'in_transit';
    if (ls === 'picking_up' || ls === 'assigned') return 'picking_up';
    return 'none';
  };

  const selectedQuoteNow = quotes.find(q => q.vehicleType === selectedVehicle) || quotes[0];
  const hasRealQuote = Boolean(selectedQuoteNow?.quotationId);

  // Lalamove order created in THIS panel session (survives a slow / failed DB save so the
  // button can never be pressed twice for the same order).
  const [bookedOrderId, setBookedOrderId] = useState<string | null>(order.lalamove_order_id || null);
  const [saveFailed, setSaveFailed] = useState(false);
  useEffect(() => { if (order.lalamove_order_id) setBookedOrderId(order.lalamove_order_id); }, [order.lalamove_order_id]);

  const handleDispatch = async () => {
    const selectedQuote = quotes.find(q => q.vehicleType === selectedVehicle) || quotes[0];

    // DOUBLE-BOOKING GUARD: a real Lalamove order already exists for this order.
    if (isBooking || bookedOrderId || order.lalamove_order_id) {
      alert(language === 'th'
        ? `ออเดอร์นี้เรียกไรเดอร์ Lalamove ไปแล้ว (Lalamove ID: ${bookedOrderId || order.lalamove_order_id})\n\nไม่ต้องกดซ้ำครับ ถ้าต้องการเรียกใหม่ให้กด "ยกเลิกการเรียก" ก่อน`
        : `A Lalamove rider was already booked for this order (ID: ${bookedOrderId || order.lalamove_order_id}). Cancel it first to re-book.`);
      return;
    }

    // HARD GUARD: never book without a REAL Lalamove quotation (no more fake riders)
    if (!selectedQuote?.quotationId) {
      alert(language === 'th'
        ? 'ยังไม่ได้ราคาจริงจาก Lalamove จึงเรียกไรเดอร์ไม่ได้\n\nสาเหตุที่พบบ่อย: พิกัดลูกค้าไม่ครบ/ไม่ถูกต้อง\nวิธีแก้: ตรวจสอบที่อยู่และพิกัด [GPS Pin] ของออเดอร์นี้ แล้วกด "ขอราคาใหม่" อีกครั้ง'
        : 'No real Lalamove quotation available — cannot dispatch a real rider.\nCheck the customer coordinates and refresh the quote.');
      return;
    }

    // Fall back to the customer's phone embedded in the address text if the field is empty
    const customerPhone = order.customerPhone || parseDeliveryPhone(order.deliveryAddress || '') || '';
    if (customerPhone.replace(/\D/g, '').length < 9) {
      alert(language === 'th'
        ? 'ออเดอร์นี้ไม่มีเบอร์โทรลูกค้า จึงเรียกไรเดอร์ไม่ได้ (ไรเดอร์ต้องใช้โทรหาลูกค้า)\n\nวิธีแก้: โทรถามเบอร์ลูกค้า แล้วเพิ่มในที่อยู่ของออเดอร์ เช่น [Phone: 0812345678]'
        : 'This order has no customer phone, so a rider cannot be booked. Add it to the address, e.g. [Phone: 0812345678].');
      return;
    }

    setIsBooking(true);
    try {
      const realOrder = await createRealLalamoveOrder(
        selectedQuote.quotationId,
        order.customerName || 'Customer',
        customerPhone,
        selectedQuote.stopIds || [],
        storeSettings?.contactPhone
      );
      if (realOrder && 'orderId' in realOrder) {
        // Lock the button IMMEDIATELY - the real rider is already booked at this point.
        setBookedOrderId(realOrder.orderId);
        const saved = await updateOrderFields(order.id, {
          delivery_status: 'assigning', // Lalamove standard status
          lalamove_order_id: realOrder.orderId,
          lalamove_share_link: realOrder.shareLink,
          lalamoveStatus: 'assigned', // Keep for UI compatibility
          lalamoveTrackingId: realOrder.orderId,
          lalamoveRiderName: language === 'th' ? 'กำลังหาไรเดอร์...' : 'Waiting for Rider',
          lalamoveRiderPhone: '-',
          lalamoveVehicleType: selectedQuote.vehicleNameTh,
          deliveryFee: selectedQuote.totalFare
        });
        if (saved === false) {
          setSaveFailed(true);
          alert(language === 'th'
            ? `⚠️ เรียกไรเดอร์กับ Lalamove สำเร็จแล้ว (ID: ${realOrder.orderId}) แต่บันทึกลงระบบร้านไม่สำเร็จ\n\nห้ามกดเรียกซ้ำ! จดเลข ID นี้ไว้ แล้วดูสถานะในแอป Lalamove ได้เลย`
            : `⚠️ Lalamove booking succeeded (ID: ${realOrder.orderId}) but saving to the shop database failed.\n\nDo NOT book again - track it in the Lalamove app.`);
        }
      } else {
        const reason = (realOrder && 'error' in realOrder) ? realOrder.error : '';
        alert(language === 'th'
          ? `เรียกไรเดอร์ไม่สำเร็จ — Lalamove แจ้งว่า:\n\n${reason || 'ไม่ทราบสาเหตุ'}\n\nแก้ตามที่แจ้งแล้วลองใหม่อีกครั้งครับ`
          : `Lalamove booking failed:\n\n${reason || 'Unknown error'}`);
      }
    } catch (e) {
      console.error("Lalamove dispatch failed:", e);
      alert(language === 'th' ? 'เรียกไรเดอร์ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง' : 'Dispatch failed, please retry.');
    } finally {
      setIsBooking(false);
    }
  };

  const clearBookingFields = async () => {
    setBookedOrderId(null);
    setSaveFailed(false);
    await updateOrderFields(order.id, {
      lalamoveStatus: 'none',
      delivery_status: 'canceled',
      lalamoveTrackingId: null,
      lalamove_order_id: null,
      lalamove_share_link: null,
      lalamoveRiderName: null,
      lalamoveRiderPhone: null,
      lalamoveVehicleType: null
    });
  };

  const handleCancelBooking = async () => {
    if (!confirm(language === 'th' ? "ต้องการยกเลิกการเรียกไรเดอร์ Lalamove ใช่หรือไม่?" : "Are you sure you want to cancel the Lalamove booking?")) return;

    const realId = order.lalamove_order_id || bookedOrderId;
    // No real Lalamove order attached — just clear the local state
    if (!realId) {
      await clearBookingFields();
      return;
    }

    // REAL order: only clear our state if Lalamove actually confirms the cancellation.
    // (Old bug: state was cleared even when the real cancel failed -> staff re-booked
    //  and TWO riders showed up. Never again.)
    try {
      const res = await fetch(`/api/lalamove/order/${realId}`, { method: 'DELETE' });
      if (res.ok) {
        await clearBookingFields();
        alert(language === 'th' ? '✅ ยกเลิกไรเดอร์กับ Lalamove เรียบร้อยแล้ว' : '✅ Lalamove booking cancelled.');
        return;
      }
      // Cancel REJECTED by Lalamove (e.g. rider already on the way)
      let reason = '';
      try {
        const errJson = await res.json();
        const inner = errJson?.error?.errors || errJson?.errors;
        reason = Array.isArray(inner) && inner.length > 0
          ? inner.map((e: any) => e.message || e.detail || e.id).filter(Boolean).join(' / ')
          : JSON.stringify(errJson?.error || errJson).slice(0, 200);
      } catch (e) { reason = `HTTP ${res.status}`; }

      const forceClear = confirm(language === 'th'
        ? `⚠️ Lalamove ไม่ยอมรับการยกเลิก:\n${reason}\n\nงานจริงอาจยังวิ่งอยู่! กรุณายกเลิกในแอป Lalamove หรือโทรหาไรเดอร์ก่อน\n\nกด OK เฉพาะเมื่อจัดการในแอป Lalamove เรียบร้อยแล้ว เพื่อล้างสถานะในระบบร้าน (กด Cancel เพื่อคงสถานะไว้)`
        : `⚠️ Lalamove rejected the cancellation:\n${reason}\n\nThe real job may still be running! Cancel it in the Lalamove app first.\n\nPress OK ONLY after handling it in the Lalamove app to clear the shop-side status.`);
      if (forceClear) await clearBookingFields();
    } catch (e) {
      console.error(e);
      alert(language === 'th'
        ? 'เชื่อมต่อเพื่อยกเลิกไม่สำเร็จ — งานจริงยังไม่ถูกยกเลิก กรุณาลองใหม่หรือยกเลิกในแอป Lalamove'
        : 'Network error — the real booking was NOT cancelled. Retry or cancel in the Lalamove app.');
    }
  };

  const status = deriveStatus();
  // If we booked a real rider but the DB row has not caught up (or the save failed),
  // NEVER show the booking button again for this order.
  const lockedByLocalBooking = status === 'none' && !!bookedOrderId;

  return (
    <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-3 mt-3 shadow-xs space-y-3 animate-fade-in text-sm">
      <div className="flex justify-between items-center border-b border-orange-200/50 pb-2">
        <span className="font-extrabold text-orange-700 flex items-center gap-1">
          <Truck size={14} className="animate-pulse" />
          {language === 'th' ? 'Lalamove Delivery Dispatch' : 'Lalamove Dispatch Hub'}
        </span>
        <div className="flex items-center gap-1.5">
          {apiStatus === 'checking' ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-pulse"></span>
              {language === 'th' ? 'กำลังเช็ค...' : 'Checking...'}
            </span>
          ) : apiStatus === 'online' ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs cursor-help" title={apiMessage}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {language === 'th' ? 'ต่อจริง (Online)' : 'Real API (Online)'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-700 border border-gray-300 shadow-xs cursor-help" title={apiMessage || "Lalamove keys are missing."}>
              <span className="w-2 h-2 rounded-full bg-gray-500"></span>
              {language === 'th' ? 'จำลอง (Offline)' : 'Simulator (Offline)'}
            </span>
          )}
          <span className="text-sm bg-white border border-orange-200 text-orange-600 px-2 py-0.5 rounded font-bold">
            {distance.toFixed(2)} km
          </span>
        </div>
      </div>

      {lockedByLocalBooking ? (
        // BOOKED, BUT DB NOT YET IN SYNC (or save failed) - lock the panel
        <div className="space-y-2">
          <div className={`rounded-lg px-3 py-2 text-xs font-bold leading-relaxed border-2 ${saveFailed ? 'bg-red-50 border-red-300 text-red-800' : 'bg-blue-50 border-blue-300 text-blue-800'}`}>
            {saveFailed
              ? (language === 'th'
                  ? `⚠️ เรียกไรเดอร์ Lalamove สำเร็จแล้ว (ID: ${bookedOrderId}) แต่บันทึกลงระบบร้านไม่สำเร็จ — ห้ามกดเรียกซ้ำ ดูสถานะในแอป Lalamove`
                  : `⚠️ Rider booked (ID: ${bookedOrderId}) but the shop DB save failed — do NOT re-book. Track in the Lalamove app.`)
              : (language === 'th'
                  ? `✅ เรียกไรเดอร์ Lalamove แล้ว (ID: ${bookedOrderId}) — กำลังรอระบบอัปเดตสถานะ...`
                  : `✅ Lalamove rider booked (ID: ${bookedOrderId}) — waiting for status sync...`)}
          </div>
          <button
            type="button"
            onClick={handleCancelBooking}
            className="w-full py-1.5 rounded bg-white text-red-600 border border-red-200 hover:bg-red-50 text-sm font-bold shadow-sm transition active:scale-95"
          >
            {language === 'th' ? 'ยกเลิกการเรียก' : 'Cancel Lalamove'}
          </button>
        </div>
      ) : status === 'failed' ? (
        // LALAMOVE / RIDER CANCELLED OR NO RIDER FOUND - staff must re-book
        <div className="space-y-2">
          <div className="rounded-lg px-3 py-2 text-xs font-bold leading-relaxed border-2 bg-red-50 border-red-300 text-red-800">
            {String(order.delivery_status || '').toLowerCase() === 'expired'
              ? (language === 'th' ? '❌ Lalamove หาไรเดอร์ไม่ได้ (หมดเวลา)' : '❌ Lalamove found no rider (expired)')
              : (language === 'th' ? '❌ งาน Lalamove ถูกยกเลิก (ไรเดอร์หรือ Lalamove ยกเลิก)' : '❌ The Lalamove job was cancelled')}
            <br />
            {language === 'th' ? 'ถ้ายังต้องส่งออเดอร์นี้ กดปุ่มด้านล่างแล้วเรียกไรเดอร์ใหม่ (ลูกค้าได้รับแจ้งทาง LINE แล้ว)' : 'If this order still needs delivery, re-book below (the customer was notified on LINE).'}
          </div>
          <button
            type="button"
            onClick={clearBookingFields}
            className="w-full py-2 rounded bg-orange-600 text-white hover:bg-orange-700 text-sm font-extrabold shadow-sm transition active:scale-95"
          >
            {language === 'th' ? '🔄 เรียกไรเดอร์ใหม่' : '🔄 Book a new rider'}
          </button>
        </div>
      ) : status === 'none' ? (
        // QUOTE AND BOOKING VIEW
        <div className="space-y-2.5">
          {scheduledInfo && (
            <div className="bg-purple-50 border-2 border-purple-300 rounded-lg px-3 py-2 text-xs font-bold text-purple-800 leading-relaxed">
              🗓 {language === 'th'
                ? `ออเดอร์นัดส่ง ${scheduledInfo.deliverLabel} น. — กดเรียกได้เลยตอนนี้ ระบบจะ "จองไรเดอร์ล่วงหน้า" ให้มารับของ ~${scheduledInfo.pickupLabel} น. (ก่อนเวลาส่ง ${RIDER_LEAD_MIN} นาที) ไม่ต้องรอกดใกล้เวลา`
                : `Scheduled order (${scheduledInfo.deliverLabel}) — booking now creates an ADVANCE Lalamove job: rider arrives ~${scheduledInfo.pickupLabel} (${RIDER_LEAD_MIN} min before delivery time).`}
            </div>
          )}
          <p className="font-bold text-gray-500 uppercase text-sm">
            {language === 'th' ? 'เลือกประเภทรถเพื่อคำนวณราคาและเรียกไรเดอร์' : 'Select vehicle to book:'}
          </p>

          {order.delivery_vehicle && (
            <div className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1.5">
              👤 {language === 'th'
                  ? `ลูกค้าเลือกไว้ตอนสั่ง: ${order.delivery_vehicle === 'car' ? '🚗 รถยนต์' : order.delivery_vehicle === 'pickup' ? '🛻 รถกระบะ' : '🛵 มอเตอร์ไซค์'}${typeof order.deliveryFee === 'number' ? ` (ค่าส่งที่ลูกค้าเห็น ฿${order.deliveryFee})` : ''}`
                  : `Customer chose: ${order.delivery_vehicle}${typeof order.deliveryFee === 'number' ? ` (saw ฿${order.deliveryFee})` : ''}`}
            </div>
          )}

          <div className="grid grid-cols-1 gap-1.5">
            {quotes.map((q) => (
              <button
                key={q.vehicleType}
                type="button"
                onClick={() => setSelectedVehicle(q.vehicleType)}
                className={`p-2 rounded-lg border text-left flex justify-between items-center transition ${selectedVehicle === q.vehicleType ? 'bg-orange-100 border-orange-300 ring-2 ring-orange-400/20' : 'bg-white border-gray-200'}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-base">
                    {q.vehicleType === 'motorcycle' ? '🛵' : q.vehicleType === 'car' ? '🚗' : '🚚'}
                  </span>
                  <div>
                    <div className="font-bold text-gray-800 text-sm">
                      {language === 'th' ? q.vehicleNameTh : q.vehicleName}
                    </div>
                    <div className="text-xs text-gray-400 font-semibold">
                      {language === 'th' ? `ระยะเวลาประมาณ ${q.etaMinutes} นาที` : `ETA: ~${q.etaMinutes} mins`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-orange-600 text-xs">฿{q.totalFare}</div>
                  <div className="text-xs text-gray-400 font-semibold">Lalamove rate</div>
                </div>
              </button>
            ))}
          </div>

          {!hasRealQuote && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-xs font-bold flex items-start gap-1.5">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>
                {language === 'th'
                  ? 'ยังไม่ได้ราคาจริงจาก Lalamove (ราคาที่เห็นเป็นตัวเลขประมาณ) — เรียกไรเดอร์จริงไม่ได้ กรุณาตรวจพิกัด [GPS Pin] ในที่อยู่ลูกค้า'
                  : 'No real Lalamove quotation (prices shown are estimates) — real dispatch disabled. Check the customer GPS pin.'}
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={handleDispatch}
            disabled={isBooking || !hasRealQuote}
            className={`w-full py-2.5 rounded-lg font-bold shadow-sm transition flex items-center justify-center gap-1.5 ${hasRealQuote ? 'bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
          >
            {isBooking ? (
              <Loader2 className="animate-spin" size={14} />
            ) : (
              <Play size={12} />
            )}
            {hasRealQuote
              ? (scheduledInfo
                  ? (language === 'th' ? `📅 จองไรเดอร์ล่วงหน้า (มารับ ~${scheduledInfo.pickupLabel} น.)` : `📅 Book scheduled rider (~${scheduledInfo.pickupLabel})`)
                  : (language === 'th' ? 'เรียกไรเดอร์ Lalamove ทันที (ราคาจริง)' : 'Book Lalamove Dispatch'))
              : (language === 'th' ? 'เรียกไรเดอร์ไม่ได้ — ไม่มีราคาจริง' : 'Dispatch disabled — no real quote')}
          </button>
        </div>
      ) : (
        // ACTIVE DISPATCH SIMULATOR & TRACKING VIEW
        <div className="space-y-3">
          {/* Status Stepper */}
          <div className="bg-white rounded-lg p-2.5 border border-orange-200/50 space-y-2">
            <div className="flex justify-between items-center">
              <span className="font-extrabold text-sm text-gray-400 uppercase">
                {language === 'th' ? 'สถานะจัดส่ง' : 'Dispatch Status'}
              </span>
              <span className={`px-2 py-0.5 rounded text-sm font-extrabold uppercase ${
                status === 'finding' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                status === 'picking_up' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                status === 'in_transit' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                'bg-emerald-50 text-emerald-700 border border-emerald-200'
              }`}>
                {status === 'finding' && (String(order.delivery_status || '').toLowerCase() === 'rejected'
                  ? (language === 'th' ? 'ไรเดอร์ยกเลิก กำลังหาคนใหม่' : 'Re-matching rider')
                  : (language === 'th' ? 'กำลังหาไรเดอร์' : 'Finding Rider'))}
                {status === 'picking_up' && (language === 'th' ? 'ได้ไรเดอร์แล้ว กำลังมารับ' : 'Rider Coming')}
                {status === 'in_transit' && (language === 'th' ? 'กำลังนำส่งสินค้า' : 'In Transit')}
                {status === 'completed' && (language === 'th' ? 'ส่งสำเร็จแล้ว' : 'Delivered')}
              </span>
            </div>

            {/* Stepper Progress Bar */}
            <div className="relative pt-1">
              <div className="flex mb-2 items-center justify-between">
                <div className="flex flex-col items-center">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-sm font-bold ${status === 'finding' ? 'bg-blue-500 text-white animate-pulse' : 'bg-emerald-500 text-white'}`}>1</div>
                  <span className="text-xs font-bold mt-1 text-gray-500">{language === 'th' ? 'หาไรเดอร์' : 'Match'}</span>
                </div>
                <div className="flex-1 border-t-2 border-dashed border-gray-200 mx-1"></div>
                <div className="flex flex-col items-center">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-sm font-bold ${['picking_up', 'in_transit', 'completed'].includes(status) ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
                  <span className="text-xs font-bold mt-1 text-gray-500">{language === 'th' ? 'รับอาหาร' : 'Pickup'}</span>
                </div>
                <div className="flex-1 border-t-2 border-dashed border-gray-200 mx-1"></div>
                <div className="flex flex-col items-center">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-sm font-bold ${['in_transit', 'completed'].includes(status) ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
                  <span className="text-xs font-bold mt-1 text-gray-500">{language === 'th' ? 'นำส่ง' : 'Transit'}</span>
                </div>
                <div className="flex-1 border-t-2 border-dashed border-gray-200 mx-1"></div>
                <div className="flex flex-col items-center">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-sm font-bold ${status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-500'}`}>4</div>
                  <span className="text-xs font-bold mt-1 text-gray-500">{language === 'th' ? 'ส่งแล้ว' : 'Arrived'}</span>
                </div>
              </div>
            </div>
          </div>

          {order.lalamove_share_link && (
            <a href={order.lalamove_share_link} target="_blank" rel="noopener noreferrer"
               className="block text-center w-full py-2 rounded bg-blue-600 text-white hover:bg-blue-700 text-sm font-extrabold shadow-sm transition active:scale-95">
              {language === 'th' ? '📍 ดูตำแหน่งไรเดอร์ / ลิงก์ติดตาม Lalamove' : '📍 Track rider (Lalamove link)'}
            </a>
          )}

          {/* Rider Info Card */}
          <div className="bg-white rounded-lg p-3 border border-orange-200/50 space-y-2">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span className="text-sm font-bold text-gray-400 uppercase">{language === 'th' ? 'ข้อมูลไรเดอร์' : 'Rider Details'}</span>
              <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                ID: {order.lalamoveTrackingId}
              </span>
            </div>

            <div className="space-y-1.5 font-bold">
              <div className="flex justify-between">
                <span className="text-gray-400">ไรเดอร์:</span>
                <span className="text-gray-700 flex items-center gap-1">
                  <User size={12} className="text-gray-400" />
                  {order.lalamoveRiderName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">เบอร์โทร:</span>
                <a href={`tel:${order.lalamoveRiderPhone}`} className="text-blue-600 underline flex items-center gap-1">
                  <Phone size={12} className="text-blue-400" />
                  {order.lalamoveRiderPhone}
                </a>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">ประเภทยานพาหนะ:</span>
                <span className="text-gray-700">{order.lalamoveVehicleType}</span>
              </div>
            </div>
          </div>

          {/* Dispatch Simulation Notice / Cancel */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancelBooking}
              className="flex-1 py-1.5 rounded bg-white text-red-600 border border-red-200 hover:bg-red-50 text-sm font-bold shadow-sm transition active:scale-95"
            >
              {language === 'th' ? 'ยกเลิกการเรียก' : 'Cancel Lalamove'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
