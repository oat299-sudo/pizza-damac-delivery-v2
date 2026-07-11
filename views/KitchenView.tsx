
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../context/StoreContext';
import { Order, OrderStatus, parseGPSCoordinates, parseDeliveryPhone } from '../types';
import { CheckCircle, Clock, Utensils, Bell, MapPin, Truck, ShoppingBag, Banknote, QrCode, ChefHat, Flame, LogOut, Bike, Layers, History, Calendar, Volume2, VolumeX, Printer, Phone, Globe } from 'lucide-react';

const formatOrderDateTime = (dateStr?: string | null, dateStyle: 'short' | 'medium' | 'long' | 'full' | 'default' = 'default'): string => {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'N/A';
    if (dateStyle === 'default') {
      return d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    }
    return d.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle, timeStyle: 'short' });
  } catch (e) {
    return 'N/A';
  }
};

export const KitchenView: React.FC = () => {
  const {
    orders, updateOrderStatus, adminLogout, t, language, toggleLanguage,
    paperSize, setPaperSize, receiptFontSize, receiptPadding,
    autoPrintNewOrders, setAutoPrintNewOrders, printerType, setPrinterType, btCharacteristic, triggerKitchenPrint,
    btDevice, btStatus, connectBluetoothPrinter, disconnectBluetoothPrinter, resetBluetoothConnection, writeBtInChunks,
    newVersionAvailable
  } = useStore();
  const [filterType, setFilterType] = useState<'active' | 'today' | 'yesterday' | 'cancelled'>('active');
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>(() => {
      try { return JSON.parse(localStorage.getItem('damac_kds_checked') || '{}'); } catch (e) { return {}; }
  });
  // Live clock tick (every 30s) for order waiting-time badges & aging colors
  const [nowTick, setNowTick] = useState<number>(Date.now());
  useEffect(() => {
      const iv = setInterval(() => setNowTick(Date.now()), 30000);
      return () => clearInterval(iv);
  }, []);

  // How long an order has been waiting + its urgency level
  const getOrderAging = (order: Order) => {
      const started = order.createdAt ? new Date(order.createdAt).getTime() : nowTick;
      const mins = Math.max(0, Math.floor((nowTick - started) / 60000));
      let level: 'ok' | 'warn' | 'late' = 'ok';
      if (mins >= 20) level = 'late'; else if (mins >= 10) level = 'warn';
      return { mins, level };
  };

  const agingBorderClass = (order: Order) => {
      if (order.status === 'completed') return 'border-gray-400 opacity-60';
      if (order.status === 'cancelled') return 'border-gray-300 opacity-50';
      const a = getOrderAging(order);
      if (a.level === 'late') return 'border-red-600 ring-4 ring-red-200';
      if (a.level === 'warn') return 'border-amber-500 ring-2 ring-amber-100';
      return 'border-green-500';
  };
  const [printOrder, setPrintOrder] = useState<Order | null>(null);
  const [showPrinterSettings, setShowPrinterSettings] = useState<boolean>(false);

  const handlePrintOrder = async (order: Order) => {
    if (printerType === 'bluetooth' && btCharacteristic) {
      try {
        await triggerKitchenPrint(order);
        return;
      } catch (err: any) {
        console.error("Bluetooth kitchen print failed, falling back to standard print", err);
      }
    }
    setPrintOrder(order);
    setTimeout(() => {
        window.print();
    }, 250);
  };
  
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
      try {
          const saved = localStorage.getItem('damac_kds_sound');
          return saved !== null ? JSON.parse(saved) : true;
      } catch (e) {
          return true;
      }
  });
  const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);

  const audioCtxRef = useRef<AudioContext | null>(null);

  // Function to initialize & unlock the AudioContext
  const initAudio = () => {
      try {
          if (!audioCtxRef.current) {
              audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
          }
          if (audioCtxRef.current.state === 'suspended') {
              audioCtxRef.current.resume();
          }
          setAudioUnlocked(true);
          // Play a test chime to let the user know it works
          playBellChime(true);
      } catch (e) {
          console.warn("Failed to initialize or resume AudioContext", e);
      }
  };

  // Add click listener to document to automatically auto-unlock audio context on first interaction
  useEffect(() => {
      const handleUserGesture = () => {
          if (!audioUnlocked) {
              initAudio();
          }
          // Remove listener once unlocked
          window.removeEventListener('click', handleUserGesture);
          window.removeEventListener('touchstart', handleUserGesture);
      };

      window.addEventListener('click', handleUserGesture);
      window.addEventListener('touchstart', handleUserGesture);

      return () => {
          window.removeEventListener('click', handleUserGesture);
          window.removeEventListener('touchstart', handleUserGesture);
      };
  }, [audioUnlocked]);

  const toggleSound = () => {
      setSoundEnabled(prev => {
          const next = !prev;
          localStorage.setItem('damac_kds_sound', JSON.stringify(next));
          return next;
      });
      // Try initializing on toggle sound click too
      initAudio();
      setTimeout(() => {
          playSuccessFeedback();
      }, 50);
  };

  const playClickSound = () => {
      if (!soundEnabled) return;
      try {
          const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
          if (!audioCtxRef.current) audioCtxRef.current = ctx;
          if (ctx.state === 'suspended') ctx.resume();
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();
          osc.connect(gainNode);
          gainNode.connect(ctx.destination);
          
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(580, ctx.currentTime);
          
          gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
          
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.08);
      } catch (e) {
          console.warn("Failed to play click sound", e);
      }
  };

  const playSuccessFeedback = () => {
      if (!soundEnabled) return;
      try {
          const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
          if (!audioCtxRef.current) audioCtxRef.current = ctx;
          if (ctx.state === 'suspended') ctx.resume();
          
          const beep = (freq: number, delay: number, duration: number) => {
              if (!ctx) return;
              const osc = ctx.createOscillator();
              const gainNode = ctx.createGain();
              osc.connect(gainNode);
              gainNode.connect(ctx.destination);
              osc.type = 'sine';
              osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
              gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
              gainNode.gain.linearRampToValueAtTime(0.18, ctx.currentTime + delay + 0.02);
              gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
              osc.start(ctx.currentTime + delay);
              osc.stop(ctx.currentTime + delay + duration + 0.05);
          };
          beep(659.25, 0, 0.08); // E5
          beep(880.00, 0.07, 0.2);  // A5
      } catch (e) {
          console.warn("Failed to play success sound", e);
      }
  };

  const playAlertSound = () => {
      if (!soundEnabled) return;
      try {
          const ctx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
          if (!audioCtxRef.current) audioCtxRef.current = ctx;
          if (ctx.state === 'suspended') ctx.resume();
          
          const buzz = (freq: number, delay: number, duration: number) => {
              if (!ctx) return;
              const osc = ctx.createOscillator();
              const gainNode = ctx.createGain();
              osc.connect(gainNode);
              gainNode.connect(ctx.destination);
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
              gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
              gainNode.gain.linearRampToValueAtTime(0.12, ctx.currentTime + delay + 0.03);
              gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
              osc.start(ctx.currentTime + delay);
              osc.stop(ctx.currentTime + delay + duration + 0.05);
          };
          buzz(160, 0, 0.12);
          buzz(120, 0.08, 0.2);
      } catch (e) {
          console.warn("Failed to play alert sound", e);
      }
  };

  const playBellChime = (isTest = false) => {
      if (!soundEnabled && !isTest) return;
      try {
          let ctx = audioCtxRef.current;
          if (!ctx) {
              ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              audioCtxRef.current = ctx;
          }
          if (ctx.state === 'suspended') {
              ctx.resume();
          }
          
          const chime = (freq: number, delay: number, duration: number) => {
              if (!ctx) return;
              const osc = ctx.createOscillator();
              const gainNode = ctx.createGain();
              
              osc.connect(gainNode);
              gainNode.connect(ctx.destination);
              
              osc.type = 'sine';
              osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
              
              gainNode.gain.setValueAtTime(0, ctx.currentTime + delay);
              gainNode.gain.linearRampToValueAtTime(0.3, ctx.currentTime + delay + 0.05);
              gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
              
              osc.start(ctx.currentTime + delay);
              osc.stop(ctx.currentTime + delay + duration + 0.1);
          };
          
          // Satisfying triple ring
          chime(523.25, 0, 0.4);      // C5
          chime(659.25, 0.12, 0.4);    // E5
          chime(783.99, 0.24, 0.8);    // G5
      } catch (e) {
          console.warn("Audio Context failed to play sound", e);
      }
  };

  const sessionStartTimeRef = useRef<number>(Date.now());
  const prevOrderIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
      if (!orders) return;

      // Real-time Order Monitoring Logic
      if (prevOrderIdsRef.current.size === 0 && orders.length > 0) {
          prevOrderIdsRef.current = new Set(orders.map(o => o.id));
          return;
      }

      let hasNewOrder = false;
      let newOrderToPrint: Order | null = null;
      for (const order of orders) {
          if (!prevOrderIdsRef.current.has(order.id)) {
              prevOrderIdsRef.current.add(order.id);

              const orderTime = order.createdAt ? new Date(order.createdAt).getTime() : Date.now();
              const isNewSessionOrder = orderTime > sessionStartTimeRef.current - 15000; // within 15 seconds of or after session start

              if (isNewSessionOrder && (order.status === 'pending' || order.status === 'confirmed')) {
                  hasNewOrder = true;
                  newOrderToPrint = order;
              }
          }
      }

      if (hasNewOrder && soundEnabled) {
          playBellChime();
      }

      if (newOrderToPrint && autoPrintNewOrders) {
          handlePrintOrder(newOrderToPrint);
      }
  }, [orders, soundEnabled, autoPrintNewOrders]);

  const toggleItemCheck = (orderId: string, itemIdx: number) => {
      playClickSound();
      const key = `${orderId}-${itemIdx}`;
      setCheckedItems(prev => {
          const next = {...prev, [key]: !prev[key]};
          try { localStorage.setItem('damac_kds_checked', JSON.stringify(next)); } catch (e) {}
          return next;
      });
  };

  const getStatusColor = (status: OrderStatus) => {
      switch(status) {
          case 'pending': return 'bg-red-100 text-red-800 border-red-200 animate-pulse'; // Flashing for new orders
          case 'confirmed': return 'bg-yellow-100 text-yellow-800 border-yellow-200'; // Accepted
          case 'acknowledged': return 'bg-blue-100 text-blue-800 border-blue-200'; // Prep
          case 'cooking': return 'bg-orange-100 text-orange-800 border-orange-200'; // Baking
          case 'ready': return 'bg-green-100 text-green-800 border-green-200'; // Done
          case 'completed': return 'bg-gray-100 text-gray-600 border-gray-200';
          case 'cancelled': return 'bg-red-50 text-red-700 border-red-200';
          default: return 'bg-gray-50';
      }
  };

  const getOrderTypeIcon = (type: Order['type']) => {
      if (type === 'delivery') return <Truck size={16} className="text-brand-600" />;
      if (type === 'online') return <ShoppingBag size={16} className="text-purple-600" />;
      return <Utensils size={16} className="text-blue-600" />;
  };

  const getOrderTypeLabel = (type: string) => {
      if (language === 'th') {
          if (type === 'dinein') return 'ทานที่ร้าน';
          if (type === 'takeaway') return 'กลับบ้าน / Takeaway';
          if (type === 'delivery') return 'จัดส่งเดลิเวอรี่';
          return type;
      }
      if (type === 'dinein') return 'Dine In';
      if (type === 'takeaway') return 'Take Away';
      if (type === 'delivery') return 'Delivery';
      return type;
  };

  const displayOrders = (orders || []).filter(o => o).filter(o => {
      if (filterType === 'active') return o.status !== 'completed' && o.status !== 'cancelled';
      if (filterType === 'cancelled') return o.status === 'cancelled';
      
      const d = o.createdAt ? new Date(o.createdAt) : null;
      if (!d) return false;
      const now = new Date();
      if (filterType === 'today') {
           return d.toDateString() === now.toDateString();
      }
      if (filterType === 'yesterday') {
           const yesterday = new Date(now);
           yesterday.setDate(yesterday.getDate() - 1);
           return d.toDateString() === yesterday.toDateString();
      }
      return true;
  }).sort((a,b) => {
       const priority = { pending: 0, confirmed: 1, acknowledged: 2, cooking: 3, ready: 4, completed: 5, cancelled: 6 };
       if (priority[a.status] !== priority[b.status]) return priority[a.status] - priority[b.status];
       return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="p-6 bg-gray-800 min-h-screen pb-24 text-gray-100 animate-fade-in print:bg-white print:p-0 print:m-0 print:min-h-0 print:pb-0">
      <div className="print:hidden">

      {/* NEW-DEPLOY PROMPT: kitchen tablets stay open for days — one tap refreshes to the new build */}
      {newVersionAvailable && (
        <button onClick={() => window.location.reload()}
          className="fixed bottom-5 right-4 z-[999] bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-black px-4 py-3 rounded-2xl shadow-2xl animate-bounce flex items-center gap-2 active:scale-95">
          🔄 {language === 'th' ? 'มีเวอร์ชันใหม่ — แตะเพื่ออัปเดต' : 'New version — tap to update'}
        </button>
      )}

      {/* Interactive Sound Activation / Browser Autoplay restriction banner */}
      {soundEnabled && !audioUnlocked && (
        <div 
          onClick={initAudio}
          className="mb-6 bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-500 text-white p-4 rounded-xl flex items-center justify-between shadow-lg cursor-pointer hover:brightness-110 active:scale-[0.99] transition-all border border-amber-400 group animate-pulse"
        >
          <div className="flex items-center gap-3">
            <span className="bg-white/20 p-2 rounded-lg animate-bounce">
              <Bell size={24} className="text-white" />
            </span>
            <div>
              <p className="font-bold text-base md:text-lg">📢 กดที่นี่เพื่อเปิดใช้งานเสียงแจ้งเตือนออเดอร์ใหม่</p>
              <p className="text-xs text-amber-50 font-medium">Click here to enable sound notifications for new orders (Required by browsers)</p>
            </div>
          </div>
          <button className="bg-white text-amber-700 hover:bg-amber-50 px-4 py-2 rounded-lg font-bold text-xs select-none shadow">
            เปิดเสียง (Enable)
          </button>
        </div>
      )}

      {printerType === 'bluetooth' && btStatus !== 'connected' && (
        <div 
          onClick={async () => {
            playClickSound();
            await resetBluetoothConnection();
          }}
          className="mb-6 bg-amber-500 hover:bg-amber-600 border border-amber-650 p-4 rounded-xl flex items-center justify-between text-white font-sans text-xs font-black cursor-pointer shadow-lg active:scale-[0.99] transition-all duration-200 select-none group"
          title={language === 'th' ? 'คลิกที่นี่เพื่อเชื่อมต่อเครื่องปริ้นเตอร์ Bluetooth และล้างบัฟเฟอร์ค้าง' : 'Click to connect / reconnect Bluetooth printer'}
        >
          <div className="flex items-center gap-3">
            <span className="bg-white/20 p-2 rounded-lg animate-pulse text-xl text-white">
              🖨️
            </span>
            <div>
              <p className="font-bold text-base md:text-lg flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-ping"></span>
                {language === 'th' ? 'เครื่องพิมพ์ครัวบลูทูธ ไม่ได้เชื่อมต่ออยู่ หรือค้างทำงาน' : 'Bluetooth kitchen printer is disconnected or inactive!'}
              </p>
              <p className="text-xs text-amber-50 font-medium font-sans">
                {language === 'th' ? '👉 แตะที่นี่เพื่อเชื่อมต่อใหม่และล้างบัฟเฟอร์ค้าง เพื่อใช้งานส่งออเดอร์เข้าห้องครัวอัติโนมัติ' : '👉 Tap here to reconnect & reset stream buffers instantly for kitchen auto print'}
              </p>
            </div>
          </div>
          <button className="bg-white text-amber-700 hover:bg-amber-50 px-4 py-2 rounded-lg font-bold text-xs select-none shadow uppercase shrink-0">
            {language === 'th' ? '🔄 รีเฟรชด่วน' : '🔄 Refresh BT'}
          </button>
        </div>
      )}

      <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 border-b border-gray-700 pb-4 gap-4">
        <div className="flex-1">
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Utensils className="text-brand-500"/> {t('kitchenDisplay')}
            </h1>
            <p className="text-gray-400 text-sm mt-1">{t('realtimeTracking')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
            
            {/* Filter Buttons */}
            <div className="flex gap-2 bg-gray-700 p-1 rounded-lg">
                <button onClick={() => { playClickSound(); setFilterType('active'); }} className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-1 ${filterType === 'active' ? 'bg-brand-600 text-white shadow' : 'text-gray-300 hover:text-white'}`}>
                    {language === 'th' ? 'ออเดอร์ปัจจุบัน' : 'Active'}
                </button>
                <button onClick={() => { playClickSound(); setFilterType('today'); }} className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-1 ${filterType === 'today' ? 'bg-brand-600 text-white shadow' : 'text-gray-300 hover:text-white'}`}>
                    {language === 'th' ? 'วันนี้' : 'Today'}
                </button>
                <button onClick={() => { playClickSound(); setFilterType('yesterday'); }} className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-1 ${filterType === 'yesterday' ? 'bg-brand-600 text-white shadow' : 'text-gray-300 hover:text-white'}`}>
                    {language === 'th' ? 'เมื่อวาน' : 'Yesterday'}
                </button>
                <button onClick={() => { playClickSound(); setFilterType('cancelled'); }} className={`px-4 py-2 rounded-md text-sm font-bold transition flex items-center gap-1 ${filterType === 'cancelled' ? 'bg-red-600 text-white shadow' : 'text-gray-300 hover:text-white'}`}>
                    {language === 'th' ? 'ถูกปฏิเสธ / ยกเลิก' : 'Rejected'}
                </button>
            </div>

            {/* Sound Notification Toggle */}
            <button 
                onClick={toggleSound} 
                className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition border cursor-pointer ${soundEnabled ? 'bg-green-900/30 text-green-400 border-green-700/80 hover:bg-green-900/50' : 'bg-red-900/30 text-red-400 border-red-700/80 hover:bg-red-900/50'}`}
                title={soundEnabled ? (language === 'th' ? "ปิดเสียงแจ้งเตือน" : "Mute alert sounds") : (language === 'th' ? "เปิดเสียงแจ้งเตือน" : "Enable alert sounds")}
            >
                {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                <span>{soundEnabled ? (language === 'th' ? 'เสียงแจ้งเตือน: เปิด' : 'Sound: ON') : (language === 'th' ? 'เสียงแจ้งเตือน: ปิด' : 'Sound: OFF')}</span>
            </button>

            {/* Auto Print Toggle */}
            <button 
                onClick={() => { playClickSound(); setAutoPrintNewOrders(!autoPrintNewOrders); }} 
                className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition border cursor-pointer ${autoPrintNewOrders ? 'bg-amber-900/40 text-amber-300 border-amber-600/80 hover:bg-amber-900/50 animate-pulse' : 'bg-gray-750 text-gray-400 border-gray-600 hover:bg-gray-700'}`}
                title={autoPrintNewOrders ? (language === 'th' ? "ปิดการพิมพ์อัตโนมัติ" : "Disable auto printing") : (language === 'th' ? "เปิดใช้งานระบบพิมพ์อัตโนมัติ" : "Enable automatic print on new order")}
            >
                <Printer size={18} />
                <span>{autoPrintNewOrders ? (language === 'th' ? 'พิมพ์อัตโนมัติ: เปิด' : 'Auto-Print: ON') : (language === 'th' ? 'พิมพ์อัตโนมัติ: ปิด' : 'Auto-Print: OFF')}</span>
            </button>

            {/* Bluetooth Printer Setup & Connection Popover */}
            <div className="relative">
                <button 
                    onClick={() => { playClickSound(); setShowPrinterSettings(!showPrinterSettings); }} 
                    className={`px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition border cursor-pointer ${
                        printerType === 'bluetooth' 
                            ? (btStatus === 'connected' 
                                ? 'bg-emerald-950/45 text-emerald-300 border-emerald-600/80 hover:bg-emerald-900/50' 
                                : btStatus === 'connecting' 
                                    ? 'bg-blue-950/45 text-blue-300 border-blue-600/80 animate-pulse hover:bg-blue-900/50' 
                                    : 'bg-red-955/45 text-red-300 border-red-650/80 hover:bg-red-900/50') 
                            : 'bg-gray-750 text-gray-400 border-gray-600 hover:bg-gray-700'
                    }`}
                    title={language === 'th' ? "ตั้งค่าเครื่องพิมพ์ด่วน" : "Quick Printer Settings"}
                >
                    <span className={`w-2 h-2 rounded-full ${
                        printerType === 'bluetooth'
                            ? (btStatus === 'connected' ? 'bg-emerald-400' : btStatus === 'connecting' ? 'bg-blue-400 animate-ping' : 'bg-red-400 animate-pulse')
                            : 'bg-gray-400'
                    }`} />
                    <span>
                        {printerType === 'bluetooth' 
                            ? (btStatus === 'connected' 
                                ? (language === 'th' ? `พิมพ์ BT: ดำเนินการ` : `BT Print: Active`) 
                                : btStatus === 'connecting' 
                                    ? (language === 'th' ? `พิมพ์ BT: กำลังเชื่อม...` : `BT Print: Connecting...`) 
                                    : (language === 'th' ? `เชื่อมต่อเครื่องพิมพ์` : `Connect BT Printer`)) 
                            : (language === 'th' ? 'บราวเซอร์ปริ้นต์' : 'System Print')}
                    </span>
                    <span className="text-[10px] opacity-75">▼</span>
                </button>

                {showPrinterSettings && (
                    <>
                        {/* Overlay to close popover */}
                        <div className="fixed inset-0 z-40" onClick={() => setShowPrinterSettings(false)} />
                        
                        {/* Dropdown Card */}
                        <div className="absolute right-0 mt-2 w-72 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-4 z-50 animate-fade-in text-left space-y-3">
                            <h4 className="font-bold text-white text-sm pb-1.5 border-b border-gray-750 flex items-center justify-between">
                                <span>🖨️ {language === 'th' ? 'การพิมพ์ครัว & ใบเสร็จ' : 'Kitchen Printer settings'}</span>
                                <button type="button" onClick={() => setShowPrinterSettings(false)} className="text-gray-400 hover:text-white text-xs cursor-pointer">✕</button>
                            </h4>
                            
                            {/* Mode Selection */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{language === 'th' ? 'โหมดเครื่องพิมพ์' : 'Printer Mode'}</label>
                                <select 
                                    value={printerType}
                                    onChange={(e) => {
                                        playClickSound();
                                        setPrinterType(e.target.value as any);
                                    }}
                                    className="w-full bg-gray-750 text-white text-xs py-2 px-3 rounded-lg border border-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500 cursor-pointer"
                                >
                                    <option value="system">{language === 'th' ? '🌐 ระบบพิมพ์ผ่านบราวเซอร์' : '🌐 Browser System Print'}</option>
                                    <option value="bluetooth">{language === 'th' ? '🔵 บลูทูธ Direct (Welltech G5)' : '🔵 Bluetooth Direct (Welltech)'}</option>
                                </select>
                            </div>

                            {/* Bluetooth Controls */}
                            {printerType === 'bluetooth' && (
                                <div className="space-y-2.5 pt-1.5 border-t border-gray-750">
                                    <div className="flex justify-between items-center text-xs">
                                        <span className="text-gray-400 font-medium">{language === 'th' ? 'สถานะบลูทูธ:' : 'Bluetooth status:'}</span>
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                            btStatus === 'connected' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                                            btStatus === 'connecting' ? 'bg-blue-950 text-blue-400 border border-blue-800 animate-pulse' :
                                            'bg-gray-750 text-gray-400 border border-gray-600'
                                        }`}>
                                            {btStatus === 'connected' ? (language === 'th' ? 'เชื่อมต่อแล้ว' : 'Connected') :
                                             btStatus === 'connecting' ? (language === 'th' ? 'กำลังเชื่อม...' : 'Connecting...') :
                                             (language === 'th' ? 'ยังไม่เชื่อมต่อ' : 'Disconnected')}
                                        </span>
                                    </div>

                                    {btDevice && (
                                        <div className="text-[10px] font-mono bg-gray-750 p-2 rounded border border-gray-700 text-gray-300 space-y-0.5 max-w-full overflow-hidden">
                                            <div className="truncate">🏷️ Name: {btDevice.name || 'Printer001'}</div>
                                            <div className="truncate">🔋 Server: Connected</div>
                                        </div>
                                    )}

                                    <div className="flex flex-col gap-1.5 pt-1">
                                        {btStatus !== 'connected' ? (
                                            <div className="flex flex-col gap-1 w-full">
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        playClickSound();
                                                        await connectBluetoothPrinter();
                                                    }}
                                                    className="w-full bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-extrabold py-2 rounded-lg text-[11px] shadow transition-all cursor-pointer text-center"
                                                >
                                                    🔗 {btStatus === 'connecting' ? (language === 'th' ? 'กำลังเชื่อมต่อ...' : 'Connecting...') : (language === 'th' ? 'ค้นหา & เชื่อมต่อเครื่องพิมพ์' : 'Search & Connect Bluetooth')}
                                                </button>
                                                {btStatus === 'connecting' && (
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            playClickSound();
                                                            disconnectBluetoothPrinter();
                                                        }}
                                                        className="w-full bg-red-900/40 text-red-400 border border-red-800/40 hover:bg-red-900 hover:text-white py-1.5 rounded-lg text-[11px] transition-all cursor-pointer text-center"
                                                    >
                                                        ❌ {language === 'th' ? 'ยกเลิกการเชื่อมต่อ' : 'Cancel Connection'}
                                                    </button>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 gap-1.5 w-full">
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        playClickSound();
                                                        // Test kitchen print payload
                                                        const testOrder: any = {
                                                            id: "TEST-KDS",
                                                            tableNumber: "KDS-TEST",
                                                            type: "dine_in",
                                                            createdAt: new Date().toISOString(),
                                                            items: [
                                                                { name: "ทดสอบพิมพ์ใบพาสลี่ครัว (TEST KITCHEN)", quantity: 1, selectedToppings: [], subItems: [], specialInstructions: "ไม่ใส่หอม" }
                                                            ],
                                                            note: "พิมพ์ทดสอบจากหน้าที่ครัวห้องครัว"
                                                        };
                                                        try {
                                                            await triggerKitchenPrint(testOrder);
                                                            alert("🎉 ส่งยอดพิมพ์ทดสอบใบห้องครัวสำเร็จ!");
                                                        } catch (err: any) {
                                                            alert("❌ พิมพ์ไม่ได้: " + err.message);
                                                        }
                                                    }}
                                                    className="w-full bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-extrabold py-2 rounded-lg text-[11px] shadow transition-all cursor-pointer text-center"
                                                >
                                                    📝 {language === 'th' ? 'ทดสอบพิมพ์ใบครัว' : 'Test Kitchen Print'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        playClickSound();
                                                        await resetBluetoothConnection();
                                                    }}
                                                    className="w-full bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-extrabold py-2 rounded-lg text-[11px] shadow transition-all cursor-pointer text-center"
                                                    title={language === 'th' ? 'ตัดการเชื่อมเดิมและหาพิมพ์เชื่อมต่อใหม่ทันที' : 'Force disconnect and refresh BT stream'}
                                                >
                                                    🔄 {language === 'th' ? 'รีเฟรชการเชื่อมต่อ' : 'Refresh Connection'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        playClickSound();
                                                        disconnectBluetoothPrinter();
                                                    }}
                                                    className="w-full bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold py-2 rounded-lg text-[11px] shadow transition-all cursor-pointer text-center"
                                                >
                                                    ❌ {language === 'th' ? 'ยกเลิกการเชื่อมต่อบลูทูธ' : 'Disconnect Bluetooth'}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Additional paper options */}
                            <div className="pt-2 border-t border-gray-750 text-[10px] text-gray-400 space-y-1">
                                <div className="flex justify-between items-center">
                                    <span>{language === 'th' ? 'ขนาดกระดาษ:' : 'Paper size:'}</span>
                                    <span className="font-bold text-gray-200">{paperSize === '80mm' ? '80mm' : '58mm'}</span>
                                </div>
                                <div className="text-[9px] text-gray-500 leading-snug">
                                    {language === 'th' 
                                        ? '* หากเปลี่ยนเป็นโหมด Bluetooth ระบบจะเชื่อมตรงผ่านบราวเซอร์ และพิมพ์ใบสั่งอาหารของห้องครัวโดยตรง' 
                                        : '* Bluetooth mode bypasses system print dialog by sending direct ESC/POS command to Welltech G5.'}
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="bg-gray-700 px-4 py-2 rounded-lg shadow-sm border border-gray-600">
                <span className="text-gray-400 text-sm block">{language === 'th' ? 'จำนวนออเดอร์' : 'Orders'}</span>
                <span className="text-2xl font-bold text-brand-400">{displayOrders.length}</span>
            </div>

            {/* Language Switcher */}
            <button 
                onClick={toggleLanguage} 
                className="bg-gray-700 hover:bg-gray-650 text-white px-4 py-2.5 rounded-lg flex items-center gap-2 text-sm font-black transition border border-gray-600 shadow-sm hover:border-gray-500 cursor-pointer active:scale-95"
                title={language === 'th' ? "Switch to English" : "เปลี่ยนเป็นภาษาไทย"}
            >
                <span>🌐 {language === 'en' ? 'EN' : 'ไทย'}</span>
            </button>

            <button 
                onClick={adminLogout} 
                className="bg-gray-700 hover:bg-red-900 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition border border-gray-600 hover:border-red-700 active:scale-95 cursor-pointer"
            >
                <LogOut size={16} /> {t('logout')}
            </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
        {displayOrders.map(order => (
           <motion.div 
             key={order.id} 
             layout
             initial={{ opacity: 0, y: 20, scale: 0.95 }}
             animate={{ opacity: 1, y: 0, scale: 1 }}
             exit={{ opacity: 0, scale: 0.9 }}
             transition={{ duration: 0.3 }}
             className={`bg-white rounded-xl shadow-lg border-l-8 flex flex-col overflow-hidden text-gray-900 ${agingBorderClass(order)}`}
           >
              {/* Header */}
              <div className={`p-4 border-b flex justify-between items-start ${order.status === 'pending' ? 'bg-red-50' : 'bg-white'}`}>
                  <div>
                      <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-lg text-gray-900">#{String(order.id).slice(-4)}</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold uppercase ${getStatusColor(order.status)}`}>
                            {t(order.status as any)}
                          </span>
                      </div>
                      <h3 className="font-bold text-xl text-gray-800 flex items-center gap-2">
                          {order.tableNumber ? (language === 'th' ? `โต๊ะ ${order.tableNumber}` : `Table ${order.tableNumber}`) : order.customerName}
                      </h3>
                      {order.source !== 'store' && (
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded font-bold uppercase mt-1">
                              <Bike size={12} /> {order.source}
                          </span>
                      )}
                  </div>
                  <div className="text-right text-sm text-gray-500">
                      <div className="flex items-center gap-1 justify-end font-bold text-gray-700"><Clock size={14}/> {formatOrderDateTime(order.createdAt, 'short')}</div>
                      {order.status !== 'completed' && order.status !== 'cancelled' && (() => { const a = getOrderAging(order); return (
                          <div className={`inline-flex items-center gap-1 justify-end text-xs font-black mt-1 px-2 py-0.5 rounded-full ${a.level === 'late' ? 'bg-red-100 text-red-700' : a.level === 'warn' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-700'}`}>
                              ⏱ {language === 'th' ? `รอมาแล้ว ${a.mins} นาที` : `waiting ${a.mins} min`}
                          </div>
                      ); })()}
                      {order.pickupTime && (
                           <div className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded mt-1 font-bold">
                               {language === 'th' ? 'เวลารับสินค้า' : 'Pickup'}: {order.pickupTime}
                           </div>
                      )}
                      <div className="flex items-center gap-1 mt-2 justify-end font-bold uppercase tracking-wide">
                          {getOrderTypeIcon(order.type)} {getOrderTypeLabel(order.type)}
                      </div>
                      {order.paymentMethod && (
                          <div className="flex items-center gap-1 justify-end text-xs mt-1 text-gray-400">
                              {order.paymentMethod === 'cash' ? <Banknote size={12}/> : <QrCode size={12}/>}
                              {order.paymentMethod === 'cash' ? t('cash') : t('qrTransfer')}
                          </div>
                      )}
                  </div>
              </div>

              {/* Delivery Info Block */}
              {order.type === 'delivery' && (
                  <div className="bg-blue-50 p-3 border-b border-blue-100 space-y-2">
                      <div className="flex items-start gap-2">
                          <MapPin size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
                          <div>
                              <p className="text-xs font-bold text-blue-800 uppercase mb-0.5">{t('deliveryAddress')}:</p>
                              <p className="text-sm text-gray-850 leading-snug">
                                  {(order.deliveryAddress || '')
                                      .replace(/\[Phone: .*?\]/g, '')
                                      .replace(/\[GPS Pin: .*?\]/g, '')
                                      .replace(/\[Google Maps Link: .*?\]/g, '')
                                      .trim()
                                  }
                              </p>
                          </div>
                      </div>
                      
                      {/* Interactive metadata annotations decoded for the kitchen */}
                      <div className="pl-6 text-xs space-y-1.5 pt-1.5 border-t border-dashed border-blue-200/60">
                          {parseDeliveryPhone(order.deliveryAddress) && (
                              <div className="flex items-center gap-1.5 font-bold text-gray-700">
                                  <Phone size={13} className="text-blue-600 shrink-0"/>
                                  <span>เบอร์ติดต่อ: {parseDeliveryPhone(order.deliveryAddress)}</span>
                              </div>
                          )}
                          {parseGPSCoordinates(order.deliveryAddress) && (
                              <div className="flex items-center justify-between gap-1.5 font-bold pt-1">
                                  <span className="text-red-700 flex items-center gap-1">📍 ปักหมุดพิกัด GPS เรียบร้อย</span>
                                  <a 
                                      href={parseGPSCoordinates(order.deliveryAddress)?.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-[10px] bg-red-650 hover:bg-red-700 text-white px-1.5 py-0.5 rounded font-extrabold flex items-center gap-1 shadow-sm transition"
                                  >
                                      <Globe size={10}/> เปิดแผนที่นำทาง
                                  </a>
                              </div>
                          )}
                      </div>
                  </div>
              )}

              {/* Items */}
              <div className="p-4 bg-white flex-1 min-h-[150px]">
                  <ul className="space-y-4">
                      {(order.items || []).map((item, idx) => {
                          const name = language === 'th' && item.nameTh ? item.nameTh : item.name;
                          const isChecked = checkedItems[`${order.id}-${idx}`] || false;
                          return (
                          <li key={idx} className={`flex flex-col border-b border-dashed border-gray-100 pb-3 last:border-0 last:pb-0 transition-all ${isChecked ? 'opacity-50 grayscale' : ''}`}>
                              <div className="flex items-start gap-3">
                                  <button onClick={() => toggleItemCheck(order.id, idx)} className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border-2 transition-colors ${isChecked ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-transparent hover:border-green-400'}`}>
                                      <CheckCircle size={20} />
                                  </button>
                                  <span className="bg-gray-900 text-white w-8 h-8 flex items-center justify-center rounded-lg text-lg font-bold flex-shrink-0">{item.quantity}</span> 
                                  <div className="flex-1 overflow-hidden" onClick={() => toggleItemCheck(order.id, idx)}>
                                      <span className={`font-bold text-gray-800 text-lg leading-tight block ${isChecked ? 'line-through text-gray-500' : ''}`}>{name}</span>
                                      
                                      {/* Sub Items (Combo Choices) */}
                                      {item.subItems && item.subItems.length > 0 && (
                                          <div className="mt-2.5 pl-3 border-l-4 border-purple-500 bg-purple-50/70 p-2.5 rounded-r-xl space-y-2">
                                              <div className="text-[11px] font-black text-purple-900 uppercase tracking-wider flex items-center gap-1">
                                                  <span>🍱 รายการในเซ็ต / COMBO ITEMS (x{item.subItems.length})</span>
                                              </div>
                                              {item.subItems.map((sub, sIdx) => {
                                                  const subName = sub.nameTh && sub.nameTh !== sub.name ? `${sub.name} / ${sub.nameTh}` : sub.name;
                                                  return (
                                                      <div key={sIdx} className="text-gray-900 text-sm font-bold pl-1.5 border-b border-purple-100/50 pb-1.5 last:border-0 last:pb-0">
                                                          <div className="flex items-start gap-1 font-extrabold text-purple-950">
                                                              <span className="text-purple-600 font-black">↳</span>
                                                              <span>{subName}</span>
                                                          </div>
                                                          {sub.toppings && sub.toppings.length > 0 && (
                                                              <div className="flex flex-wrap gap-1 mt-1.5 pl-3.5">
                                                                  {sub.toppings.map(t => {
                                                                      const isCheeseOrSauce = t.category === 'cheese' || t.category === 'sauce' || t.name.toLowerCase().includes('cheese') || t.nameTh?.includes('ชีส') || t.name.toLowerCase().includes('sauce') || t.nameTh?.includes('ซอส');
                                                                      const icon = t.category === 'cheese' ? '🧀' : t.category === 'sauce' ? '🍅' : t.category === 'meat' ? '🍖' : t.category === 'vegetable' ? '🥦' : '✨';
                                                                      const toppingText = t.nameTh && t.nameTh !== t.name ? `${t.name} / ${t.nameTh}` : t.name;
                                                                      return (
                                                                          <span key={t.id} className={`text-xs font-black px-2 py-1 rounded-md shadow-sm border flex items-center gap-1 ${isCheeseOrSauce ? 'bg-orange-100 text-orange-950 border-orange-300 ring-2 ring-orange-200' : 'bg-amber-50 text-amber-950 border-amber-200'}`}>
                                                                              {icon} {toppingText}
                                                                          </span>
                                                                      );
                                                                  })}
                                                              </div>
                                                          )}
                                                      </div>
                                                  );
                                              })}
                                          </div>
                                      )}

                                      {/* Standard Toppings */}
                                      {(item.selectedToppings || []).length > 0 && (
                                        <div className="mt-2.5 pl-3 border-l-4 border-amber-500 bg-amber-50/70 p-2.5 rounded-r-xl space-y-1.5">
                                            <div className="text-[11px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1">
                                                <span>➕ เพิ่มท็อปปิ้งพิเศษ / EXTRA ADD-ONS (x{item.selectedToppings.length})</span>
                                            </div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {(item.selectedToppings || []).map(t => {
                                                    const isCheeseOrSauce = t.category === 'cheese' || t.category === 'sauce' || t.name.toLowerCase().includes('cheese') || t.nameTh?.includes('ชีส') || t.name.toLowerCase().includes('sauce') || t.nameTh?.includes('ซอส');
                                                    const icon = t.category === 'cheese' ? '🧀' : t.category === 'sauce' ? '🍅' : t.category === 'meat' ? '🍖' : t.category === 'vegetable' ? '🥦' : '✨';
                                                    const toppingText = t.nameTh && t.nameTh !== t.name ? `${t.name} / ${t.nameTh}` : t.name;
                                                    return (
                                                        <span key={t.id} className={`text-sm font-black px-2.5 py-1.5 rounded-lg shadow-sm border flex items-center gap-1.5 ${isCheeseOrSauce ? 'bg-orange-100 text-orange-950 border-orange-300 ring-2 ring-orange-200 animate-pulse' : 'bg-amber-100 text-amber-950 border-amber-300'}`}>
                                                            {icon} {toppingText}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                      )}
                                      
                                      {/* Special Instructions */}
                                      {item.specialInstructions && (
                                          <div className="mt-2.5 text-red-900 bg-gradient-to-r from-red-50 to-red-100/80 border-2 border-red-500 rounded-xl px-3 py-2.5 text-sm md:text-base font-extrabold flex items-center gap-2.5 animate-pulse w-full shadow-md">
                                              <span className="px-2 py-1 bg-red-600 text-white rounded-md text-xs shrink-0 font-black uppercase tracking-wider shadow">🚨 พิเศษ / SPECIAL REQUEST</span>
                                              <span className="break-words font-black text-red-950 text-left">"{item.specialInstructions}"</span>
                                          </div>
                                      )}
                                  </div>
                              </div>
                          </li>
                      )})}
                  </ul>
                  {order.note && (
                      <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-400 text-yellow-800 italic font-medium">
                          {language === 'th' ? 'หมายเหตุ' : 'Note'}: "{order.note}"
                      </div>
                  )}
              </div>

              {/* Actions */}
              <div className="p-4 border-t bg-gray-50 flex items-center justify-between gap-2">
                <button 
                    onClick={() => { playSuccessFeedback(); handlePrintOrder(order); }} 
                    className="bg-gray-200 hover:bg-gray-300 text-gray-750 px-3 py-2 rounded-lg font-black text-xs flex items-center gap-1.5 transition active:scale-95 cursor-pointer shadow-xs print:hidden"
                    title={language === 'th' ? 'พิมพ์ใบครัว' : 'Print Receipt'}
                >
                    <Printer size={14} />
                    <span>{language === 'th' ? 'พิมพ์ใบครัว' : 'Print'}</span>
                </button>

                <div className="flex gap-2 flex-1 justify-end items-center">
                    {order.status === 'pending' && (
                        <>
                            <button onClick={() => { playAlertSound(); updateOrderStatus(order.id, 'cancelled'); }} className="px-2 py-2 text-red-650 hover:bg-red-50 rounded font-semibold text-xs transition">{t('reject')}</button>
                            <button onClick={() => { playSuccessFeedback(); updateOrderStatus(order.id, 'confirmed'); }} className="bg-brand-600 text-white px-3 py-2 rounded-lg shadow hover:bg-brand-700 font-bold text-xs flex items-center justify-center gap-1 transition">
                                <Bell size={14} /> {t('confirm')}
                            </button>
                        </>
                    )}
                    {order.status === 'confirmed' && (
                        <>
                            <button 
                                onClick={() => { 
                                    if (confirm(language === 'th' ? "คุณแน่ใจหรือไม่ที่จะปฏิเสธ/ยกเลิกออเดอร์นี้?" : "Are you sure you want to reject/cancel this order?")) {
                                        playAlertSound(); 
                                        updateOrderStatus(order.id, 'cancelled'); 
                                    }
                                }} 
                                className="px-2 py-2 text-red-650 hover:bg-red-50 rounded font-semibold text-xs transition"
                            >
                                {t('reject')}
                            </button>
                            <button onClick={() => { playSuccessFeedback(); updateOrderStatus(order.id, 'acknowledged'); }} className="w-full max-w-[140px] bg-blue-600 text-white px-3 py-2 rounded-lg shadow hover:bg-blue-700 font-bold text-xs flex items-center justify-center gap-1 transition">
                                <ChefHat size={14} /> {t('acknowledged')}
                            </button>
                        </>
                    )}
                    {order.status === 'acknowledged' && (
                        <>
                            <button 
                                onClick={() => { 
                                    if (confirm(language === 'th' ? "คุณแน่ใจหรือไม่ที่จะปฏิเสธ/ยกเลิกออเดอร์นี้?" : "Are you sure you want to reject/cancel this order?")) {
                                        playAlertSound(); 
                                        updateOrderStatus(order.id, 'cancelled'); 
                                    }
                                }} 
                                className="px-2 py-2 text-red-650 hover:bg-red-50 rounded font-semibold text-xs transition"
                            >
                                {t('reject')}
                            </button>
                            <button onClick={() => { playSuccessFeedback(); updateOrderStatus(order.id, 'cooking'); }} className="w-full max-w-[140px] bg-orange-500 text-white px-3 py-2 rounded-lg shadow hover:bg-orange-600 font-bold text-xs flex items-center justify-center gap-1 transition">
                                <Flame size={14} /> {t('startCooking')}
                            </button>
                        </>
                    )}
                    {order.status === 'cooking' && (
                        <>
                            <button 
                                onClick={() => { 
                                    if (confirm(language === 'th' ? "คุณแน่ใจหรือไม่ที่จะปฏิเสธ/ยกเลิกออเดอร์นี้?" : "Are you sure you want to reject/cancel this order?")) {
                                        playAlertSound(); 
                                        updateOrderStatus(order.id, 'cancelled'); 
                                    }
                                }} 
                                className="px-2 py-2 text-red-650 hover:bg-red-50 rounded font-semibold text-xs transition"
                            >
                                {t('reject')}
                            </button>
                            <button onClick={() => { playSuccessFeedback(); updateOrderStatus(order.id, 'ready'); }} className="w-full max-w-[140px] bg-green-500 text-white px-3 py-2 rounded-lg shadow hover:bg-green-600 font-bold text-xs flex items-center justify-center gap-1 transition">
                                <CheckCircle size={14} /> {t('markReady')}
                            </button>
                        </>
                    )}
                    {order.status === 'ready' && (
                        <div className="w-full max-w-[160px] bg-green-100 text-green-800 px-2 py-1.5 rounded-lg font-bold text-center border border-green-200 text-[10px]">
                            {t('ready')} - {language === 'th' ? 'รอเสิร์ฟ / จัดส่ง' : 'Waiting for Server'}
                        </div>
                    )}
                    {order.status === 'completed' && (
                        <span className="text-gray-400 text-xs font-semibold py-1">{t('completed')}</span>
                    )}
                    {order.status === 'cancelled' && (
                        <div className="w-full max-w-[160px] bg-red-100 text-red-800 px-2 py-1.5 rounded-lg font-bold text-center border border-red-200 text-[10px]">
                            {language === 'th' ? 'ถูกปฏิเสธ / ยกเลิกแล้ว' : 'Rejected'}
                        </div>
                    )}
                </div>
              </div>
           </motion.div>
        ))}
        </AnimatePresence>
      </div>
    </div>

    {/* --- PRINTABLE KITCHEN CHIT --- */}
    <style dangerouslySetInnerHTML={{ __html: `
        @media print {
            @page {
                size: ${paperSize === '58mm' ? '58mm' : '80mm'} auto !important;
                margin: 0mm !important;
            }
            html, body, #root {
                width: ${paperSize === '58mm' ? '58mm' : '80mm'} !important;
                height: auto !important;
                overflow: visible !important;
                margin: 0 !important;
                padding: 0 !important;
                background: white !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
            .printable-area {
                width: ${paperSize === '58mm' ? '58mm' : '80mm'} !important;
                padding: ${receiptPadding}mm !important;
                height: auto !important;
                min-height: auto !important;
                max-height: none !important;
                overflow: visible !important;
                display: block !important;
            }
            .printable-area, .printable-area * {
                font-size: ${receiptFontSize}px !important;
            }
            .printable-area .ticket-title {
                font-size: ${receiptFontSize + 3}px !important;
            }
        }
    ` }} />

    <div 
        className={`hidden print:block printable-area ${paperSize === '58mm' ? 'print:w-[58mm]' : 'print:w-[80mm]'} print:font-mono p-0 m-0 bg-white text-black leading-snug`}
        style={{ fontSize: `${receiptFontSize}px` }}
    >
        {printOrder && (
            <div className={`${paperSize === '58mm' ? 'w-[58mm]' : 'w-[80mm]'} overflow-hidden`}>
                <div className="text-center font-bold">
                    <div>{paperSize === '58mm' ? '=============================' : '========================================'}</div>
                    <div 
                        className="font-black uppercase my-1 ticket-title"
                        style={{ fontSize: `${receiptFontSize + 1}px` }}
                    >
                        KITCHEN TICKET
                    </div>
                    <div>ใบสั่งอาหาร / ครัว</div>
                    <div>{paperSize === '58mm' ? '=============================' : '========================================'}</div>
                    <div 
                        className="font-black my-1 ticket-title"
                        style={{ fontSize: `${receiptFontSize + 3}px` }}
                    >
                        {printOrder.tableNumber ? (language === 'th' ? `โต๊ะ ${printOrder.tableNumber}` : `Table ${printOrder.tableNumber}`) : (printOrder.type === 'delivery' ? `DELIVERY` : `TAKE AWAY`)}
                    </div>
                    {printOrder.customerName && !printOrder.tableNumber && (
                        <div className="text-[11px] font-extrabold my-0.5">ลูกค้า: {printOrder.customerName}</div>
                    )}
                    <div>{paperSize === '58mm' ? '-----------------------------' : '----------------------------------------'}</div>
                </div>

                <div className="mt-1 mb-1 px-1 font-bold">
                    <div className="flex justify-between">
                        <span>บิล: #{String(printOrder.id).slice(-4)}</span>
                        <span>วันที่: {printOrder.createdAt ? new Date(printOrder.createdAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-'}</span>
                    </div>
                    <div className="flex justify-between">
                        <span>ช่องทาง: {printOrder.source.toUpperCase()}</span>
                        <span>เวลา: {printOrder.createdAt ? new Date(printOrder.createdAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute:'2-digit' }) : '-'}</span>
                    </div>
                    {printOrder.pickupTime && (
                        <div className="font-bold">
                            เวลารับ: {printOrder.pickupTime}
                        </div>
                    )}
                    {printOrder.deliveryPlatformRef && (
                        <div className="font-bold mt-1 text-[11px] bg-gray-150 p-1">
                            Ref: {printOrder.deliveryPlatformRef}
                        </div>
                    )}
                </div>

                {printOrder.deliveryAddress && (
                    <div className="my-1.5 p-1 text-[9px] rounded font-bold leading-normal text-black bg-white" style={{ border: '1px solid black' }}>
                        <div className="font-extrabold border-b pb-0.5 mb-1 text-[9.5px]" style={{ borderBottom: '1px solid black' }}>
                            📍 ที่อยู่จัดส่ง / DELIVERY DETAILS:
                        </div>
                        <div className="space-y-0.5">
                            <div>
                                <span className="font-black">ที่อยู่:</span>{" "}
                                <span>{printOrder.deliveryAddress.replace(/\[Phone: .*?\]/g, '')}</span>
                            </div>
                            {parseDeliveryPhone(printOrder.deliveryAddress) && (
                                <div>
                                    <span className="font-black">เบอร์โทร:</span>{" "}
                                    <span className="text-[10px] underline font-black">
                                        {parseDeliveryPhone(printOrder.deliveryAddress)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {printOrder.status === 'completed' ? (
                    <div className="my-1 py-1 px-2 text-center font-black text-[12px] uppercase bg-black text-white rounded">
                        <span>ชำระเงินแล้ว / PAID</span>
                    </div>
                ) : (
                    <div className="my-1 py-1 px-2 text-center font-black text-[11px] uppercase" style={{ border: '1px dashed black' }}>
                        <span>ค้างชำระ / UNPAID</span>
                    </div>
                )}

                <div className="text-center font-bold">{paperSize === '58mm' ? '-----------------------------' : '----------------------------------------'}</div>
                <div className="px-1 font-bold">
                    {(printOrder.items || []).map((item, i) => {
                        const name = language === 'th' && item.nameTh ? item.nameTh : item.name;
                        return (
                            <div key={i} className="mb-2 pb-1 border-b border-dashed border-gray-300 last:border-0 last:mb-0">
                                <div className="flex justify-between items-start font-black text-black">
                                    <span className={`${paperSize === '58mm' ? 'text-[11px]' : 'text-[12px]'}`}>[{item.quantity}x] {name}</span>
                                </div>
                                
                                {/* Combo choices */}
                                {item.subItems && item.subItems.length > 0 && (
                                    <div className="pl-2 mt-1 text-[9px] space-y-0.5">
                                        {item.subItems.map((sub, sIdx) => {
                                            const subName = sub.nameTh && sub.nameTh !== sub.name ? `${sub.name} (${sub.nameTh})` : sub.name;
                                            return (
                                                <div key={sIdx} className="font-black">
                                                    ↳ [เซ็ต] {subName}
                                                    {sub.toppings && sub.toppings.length > 0 && (
                                                        <div className="pl-3 text-[8px] font-bold italic text-gray-700">
                                                            {sub.toppings.map(t => t.nameTh && t.nameTh !== t.name ? `${t.name} (${t.nameTh})` : t.name).join(', ')}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Toppings */}
                                {item.selectedToppings && item.selectedToppings.length > 0 && (
                                    <div className="pl-2 mt-1 text-[9px] space-y-0.5">
                                        {item.selectedToppings.map((t, tIdx) => {
                                            const toppingName = t.nameTh && t.nameTh !== t.name ? `${t.name} (${t.nameTh})` : t.name;
                                            return (
                                                <div key={tIdx} className="font-bold">
                                                    * [บวกเพิ่ม] {toppingName}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Special Instructions */}
                                {item.specialInstructions && (
                                    <div className="mt-1 pl-1 border-l border-black text-[9px] font-black bg-gray-100 p-0.5 leading-normal">
                                        ⚠️ พิเศษ: "{item.specialInstructions}"
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {printOrder.note && (
                    <div className="my-2 p-1 border border-black text-black leading-normal">
                        <div className="text-[9px] font-black">📝 หมายเหตุ:</div>
                        <div className="text-[9.5px] font-black mt-0.5">"{printOrder.note}"</div>
                    </div>
                )}

                <div className="text-center font-bold">{paperSize === '58mm' ? '=============================' : '========================================'}</div>
                <div className="text-center text-[9px] mt-1 mb-2 font-bold font-mono">
                    Damac Pizza Kitchen
                </div>
            </div>
        )}
    </div>
    </div>
  );
};
