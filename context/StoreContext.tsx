
import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { 
  Pizza, Topping, CartItem, Order, OrderType, OrderSource, OrderStatus, 
  PaymentMethod, CustomerProfile, Expense, StoreSettings, NewsItem, 
  SavedFavorite, Language, AppView, ProductCategory, SubItem, ExpenseCategory, Partner,
  PromoCode, Coupon, CouponDiscountType
} from '../types';
import { 
  INITIAL_MENU, INITIAL_TOPPINGS, DEFAULT_STORE_SETTINGS, 
  OPERATING_HOURS, GP_RATES, TRANSLATIONS, CATEGORIES 
} from '../constants';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';

interface StoreContextType {
  language: Language;
  toggleLanguage: () => void;
  t: (key: keyof typeof TRANSLATIONS.en, params?: Record<string, string | number>) => string;
  getLocalizedItem: (item: { name: string; nameTh?: string; description?: string; descriptionTh?: string } | undefined) => { name: string; description: string };
  
  currentView: AppView;
  trackingOrderId: string | null;
  navigateTo: (view: AppView, orderId?: string) => void;
  
  isAdminLoggedIn: boolean;
  adminLogin: (u: string, p: string) => Promise<boolean>;
  adminLogout: () => void;
  
  shopLogo: string;
  updateShopLogo: (base64: string) => void;
  
  menu: Pizza[];
  addPizza: (pizza: Pizza) => Promise<void>;
  updatePizza: (pizza: Pizza) => Promise<void>;
  deletePizza: (id: string) => Promise<void>;
  updatePizzaPrice: (id: string, newPrice: number) => Promise<void>;
  togglePizzaAvailability: (id: string) => Promise<void>;
  toggleBestSeller: (id: string) => Promise<void>;
  generateLuckyPizza: () => { pizza: Pizza; toppings: Topping[] } | null;
  seedDatabase: () => Promise<void>;
  reorderMenu: (sortedIds: string[]) => void;

  toppings: Topping[];
  addTopping: (topping: Topping) => Promise<void>;
  updateTopping: (topping: Topping) => Promise<void>;
  deleteTopping: (id: string) => Promise<void>;
  
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  removeFromCart: (itemId: string) => void;
  updateCartItemQuantity: (itemId: string, delta: number) => void;
  updateCartItem: (item: CartItem) => void;
  clearCart: () => void;
  cartTotal: number;
  
  customer: CustomerProfile | null;
  setCustomer: (profile: CustomerProfile) => Promise<void>;
  registerCustomer: (profile: CustomerProfile) => Promise<'created' | 'updated'>;
  customerLogin: (phone: string, pass: string) => Promise<boolean>;
  getAllCustomers: () => Promise<any[]>;
  adminUpdateCustomerCoupons: (customerPhone: string, coupons: Coupon[]) => Promise<void>;
  addToFavorites: (name: string, pizzaId: string, toppings: Topping[]) => Promise<void>;
  claimReward: () => boolean;

  orders: Order[];
  placeOrder: (
    type: OrderType, 
    details?: {
      note?: string;
      delivery?: { address: string; zoneName: string; fee: number | 'pending'; lat?: number; lng?: number; quotationId?: string; };
      paymentMethod?: PaymentMethod;
      pickupTime?: string;
      tableNumber?: string;
      source?: OrderSource;
      status?: OrderStatus;
      deliveryPlatformRef?: string;
      partnerId?: string;
      promoCode?: string;
      discountAmount?: number;
      couponCode?: string;
      couponDiscountAmount?: number;
      couponId?: string;
      isPosOrder?: boolean;
      customerName?: string;
      customerPhone?: string;
    }
  ) => Promise<boolean>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  updateOrderTypeToPickup: (orderId: string) => Promise<void>;
  updateOrderDeliveryFee: (orderId: string, fee: number) => Promise<void>;
  updateOrderNetAmount: (orderId: string, netAmount: number) => Promise<void>;
  completeOrder: (orderId: string, paymentDetails: { paymentMethod: PaymentMethod, note?: string }) => Promise<void>;
  deleteOrder: (orderId: string) => Promise<void>;
  updateOrderFields: (orderId: string, fields: Partial<Order>) => Promise<void>;
  reorderItem: (orderId: string) => void;
  fetchOrders: () => Promise<void>;
  submitOrderFeedback: (orderId: string, rating: number, comment: string) => Promise<void>;

  expenses: Expense[];
  addExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;

  isStoreOpen: boolean;
  isHoliday: boolean;
  closedMessage: string;
  storeSettings: StoreSettings;
  toggleStoreStatus: (isOpen: boolean, message?: string) => Promise<void>;
  updateStoreSettings: (settings: Partial<StoreSettings>) => Promise<void>;
  generateTimeSlots: (dateOffset?: number) => string[];
  canOrderForToday: () => boolean;

  addNewsItem: (item: NewsItem) => Promise<void>;
  deleteNewsItem: (id: string) => Promise<void>;

  tableSession: string | null;
  partnerSession: string | null;
  setPartnerSession: (partnerId: string | null) => void;
  paperSize: '58mm' | '80mm';
  setPaperSize: (size: '58mm' | '80mm') => void;
  printerIpAddress: string;
  setPrinterIpAddress: (ip: string) => void;
  printerPort: number;
  setPrinterPort: (port: number) => void;
  printerType: 'system' | 'rawbt' | 'local_proxy' | 'bluetooth';
  setPrinterType: (type: 'system' | 'rawbt' | 'local_proxy' | 'bluetooth') => void;
  receiptFontSize: number;
  setReceiptFontSize: (size: number) => void;
  receiptPadding: number;
  setReceiptPadding: (padding: number) => void;
  autoPrintNewOrders: boolean;
  setAutoPrintNewOrders: (val: boolean) => void;
  vatEnabled: boolean;
  setVatEnabled: (val: boolean) => void;

  partners: Partner[];
  addPartner: (partner: Partner) => void;
  updatePartner: (partner: Partner) => void;
  deletePartner: (id: string) => void;

  // Bluetooth Direct Printing
  btDevice: any;
  setBtDevice: (device: any) => void;
  btCharacteristic: any;
  setBtCharacteristic: (char: any) => void;
  btStatus: 'disconnected' | 'connecting' | 'connected';
  setBtStatus: (status: 'disconnected' | 'connecting' | 'connected') => void;
  connectBluetoothPrinter: () => Promise<void>;
  disconnectBluetoothPrinter: () => void;
  resetBluetoothConnection: () => Promise<void>;
  triggerReceiptPrint: (payload: any) => Promise<void>;
  triggerKitchenPrint: (order: Order) => Promise<void>;
  generateEscPosData: (data: any, lang: Language) => Uint8Array;
  generateKitchenEscPosData: (order: Order, lang: Language) => Uint8Array;
  writeBtInChunks: (characteristic: any, data: Uint8Array) => Promise<void>;
  thaiCodePage: string;
  setThaiCodePage: (cp: string) => void;

  promoCodes: PromoCode[];
  addPromoCode: (pc: PromoCode) => Promise<void>;
  updatePromoCode: (pc: PromoCode) => Promise<void>;
  deletePromoCode: (id: string) => Promise<void>;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

export const generateInitialCoupons = (): Coupon[] => {
  return [
    {
      id: 'coupon_new_member',
      code: 'NEWMEMBER10',
      title: 'คูปองสมาชิกใหม่ ลด 10% พิซซ่าถาดที่แพงที่สุด',
      titleTh: 'คูปองสมาชิกใหม่ ลด 10% พิซซ่าถาดที่แพงที่สุด',
      description: 'Get 10% off the most expensive pizza in your order',
      descriptionTh: 'ลดทันที 10% สำหรับพิซซ่าถาดที่ราคาสูงที่สุดในออเดอร์',
      discountType: 'percentage_most_expensive',
      discountValue: 10,
      minOrderAmount: 0,
      isUsed: false,
      badge: 'New Member',
      badgeTh: 'สมาชิกใหม่',
    },
    {
      id: 'coupon_monthly_promo',
      code: 'JUNEPROMO50',
      title: 'คูปองส่วนลดประจำเดือน ฿50',
      titleTh: 'คูปองส่วนลดประจำเดือน ฿50',
      description: 'Save ฿50 on any order over ฿350 (Dine-in, Pickup, or Delivery)',
      descriptionTh: 'ลดทันที ฿50 เมื่อสั่งอาหารครบ ฿350 ขึ้นไป (ได้ทุกช่องทาง ทานที่ร้าน, สั่งกลับบ้าน หรือจัดส่ง)',
      discountType: 'fixed_discount',
      discountValue: 50,
      minOrderAmount: 350,
      isUsed: false,
      applicableOrderTypes: ['dine-in', 'online', 'delivery'],
      badge: 'Monthly Promo',
      badgeTh: 'คูปองประจำเดือน',
    },
    {
      id: 'coupon_free_delivery',
      code: 'JUNEFREESHIP',
      title: 'คูปองส่วนลดค่าจัดส่ง ฿30',
      titleTh: 'คูปองส่วนลดค่าจัดส่ง ฿30',
      description: 'Get ฿30 off delivery fee on orders over ฿300',
      descriptionTh: 'ส่วนลดค่าจัดส่ง ฿30 เมื่อสั่งครบ ฿300 ขึ้นไป (เฉพาะจัดส่งเดลิเวอรี่)',
      discountType: 'free_delivery',
      discountValue: 30,
      minOrderAmount: 300,
      isUsed: false,
      applicableOrderTypes: ['delivery'],
      badge: 'Free Delivery',
      badgeTh: 'ลดค่าจัดส่ง',
    },
    {
      id: 'coupon_member_percentage',
      code: 'MEMBERVIP5',
      title: 'คูปองลดพิเศษทั้งออเดอร์ 5%',
      titleTh: 'คูปองลดพิเศษทั้งออเดอร์ 5%',
      description: 'Get 5% off your entire bill, no minimum purchase',
      descriptionTh: 'ลดทันที 5% จากราคาทั้งออเดอร์ ไม่มีขั้นต่ำในการสั่งซื้อ',
      discountType: 'percentage_total',
      discountValue: 5,
      minOrderAmount: 0,
      isUsed: false,
      badge: 'VIP Member',
      badgeTh: 'สมาชิก VIP',
    },
  ];
};

export const StoreProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // --- Language State ---
  const [language, setLanguage] = useState<Language>(() => {
      return (localStorage.getItem('damac_lang') as Language) || 'en';
  });
  const toggleLanguage = () => {
      setLanguage(prev => {
          const newLang = prev === 'en' ? 'th' : 'en';
          try {
            localStorage.setItem('damac_lang', newLang);
          } catch(e) { console.error("Storage Error", e); }
          return newLang;
      });
  };

  // --- Printer Preference State ---
  const [paperSize, setPaperSizeState] = useState<'58mm' | '80mm'>(() => {
      if (typeof window !== 'undefined') {
          return (localStorage.getItem('damac_paper_size') as '58mm' | '80mm') || '80mm';
      }
      return '80mm';
  });
  const setPaperSize = (size: '58mm' | '80mm') => {
      setPaperSizeState(size);
      try {
          localStorage.setItem('damac_paper_size', size);
      } catch(e) { console.error("Storage Error", e); }
  };

  // --- Printer Setting Preferences (Wifi Printer) ---
  const [printerIpAddress, setPrinterIpAddressState] = useState<string>(() => {
      if (typeof window !== 'undefined') {
          return localStorage.getItem('damac_printer_ip') || '192.168.1.255';
      }
      return '192.168.1.255';
  });
  const setPrinterIpAddress = (ip: string) => {
      setPrinterIpAddressState(ip);
      try {
          localStorage.setItem('damac_printer_ip', ip);
      } catch(e) { console.error("Storage Error", e); }
  };

  const [printerPort, setPrinterPortState] = useState<number>(() => {
      if (typeof window !== 'undefined') {
          const portVal = localStorage.getItem('damac_printer_port');
          return portVal ? parseInt(portVal, 10) : 9100;
      }
      return 9100;
  });
  const setPrinterPort = (port: number) => {
      setPrinterPortState(port);
      try {
          localStorage.setItem('damac_printer_port', String(port));
      } catch(e) { console.error("Storage Error", e); }
  };

  const [printerType, setPrinterTypeState] = useState<'system' | 'rawbt' | 'local_proxy' | 'bluetooth'>(() => {
      if (typeof window !== 'undefined') {
          return (localStorage.getItem('damac_printer_type') as 'system' | 'rawbt' | 'local_proxy' | 'bluetooth') || 'system';
      }
      return 'system';
  });
  const setPrinterType = (type: 'system' | 'rawbt' | 'local_proxy' | 'bluetooth') => {
      setPrinterTypeState(type);
      try {
          localStorage.setItem('damac_printer_type', type);
      } catch(e) { console.error("Storage Error", e); }
  };

  const [receiptFontSize, setReceiptFontSizeState] = useState<number>(() => {
      if (typeof window !== 'undefined') {
          const fs = localStorage.getItem('damac_receipt_font_size');
          return fs ? parseInt(fs, 10) : 12;
      }
      return 12;
  });
  const setReceiptFontSize = (size: number) => {
      setReceiptFontSizeState(size);
      try {
          localStorage.setItem('damac_receipt_font_size', String(size));
      } catch(e) { console.error("Storage Error", e); }
  };

  const [receiptPadding, setReceiptPaddingState] = useState<number>(() => {
      if (typeof window !== 'undefined') {
          const pad = localStorage.getItem('damac_receipt_padding');
          return pad ? parseInt(pad, 10) : 2;
      }
      return 2;
  });
  const setReceiptPadding = (padding: number) => {
      setReceiptPaddingState(padding);
      try {
          localStorage.setItem('damac_receipt_padding', String(padding));
      } catch(e) { console.error("Storage Error", e); }
  };

  const [autoPrintNewOrders, setAutoPrintNewOrdersState] = useState<boolean>(() => {
      if (typeof window !== 'undefined') {
          return localStorage.getItem('damac_auto_print_new_orders') === 'true';
      }
      return false;
  });
  const setAutoPrintNewOrders = (val: boolean) => {
      setAutoPrintNewOrdersState(val);
      try {
          localStorage.setItem('damac_auto_print_new_orders', String(val));
      } catch(e) { console.error("Storage Error", e); }
  };

  const [vatEnabled, setVatEnabledState] = useState<boolean>(() => {
      if (typeof window !== 'undefined') {
          const val = localStorage.getItem('damac_vat_enabled');
          return val === null ? true : val === 'true';
      }
      return true;
  });
  const setVatEnabled = (val: boolean) => {
      setVatEnabledState(val);
      try {
          localStorage.setItem('damac_vat_enabled', String(val));
      } catch(e) { console.error("Storage Error", e); }
  };

  const [thaiCodePage, setThaiCodePageState] = useState<string>(() => {
      if (typeof window !== 'undefined') {
          const cp = localStorage.getItem('damac_thai_code_page');
          // Support migration from number stores to key strings
          if (cp) {
              if (cp === '26' || cp === '18' || cp === '17' || cp === '40') {
                  return `tis620-${cp}`;
              }
              return cp;
          }
          return 'tis620-26'; // Default to Code Page 26 (recommended text-mode, lightning-fast and stable!)
      }
      return 'tis620-26';
  });
  const setThaiCodePage = (cp: string) => {
      setThaiCodePageState(cp);
      try {
          localStorage.setItem('damac_thai_code_page', cp);
      } catch(e) { console.error("Storage Error", e); }
  };

  // Helper to parse active Thai configuration
  const getThaiConfigs = (mode: string) => {
      const ESC = 0x1B;
      const GS = 0x1D;
      const FS = 0x1C;
      
      let initBytes: number[] = [ESC, 0x40]; // Init printer first
      let isUtf8 = false;

      if (mode === 'utf8-epson') {
          isUtf8 = true;
          // ESC ( G pL pH m n (Epson standard UTF-8 mode setup)
          initBytes.push(0x1B, 0x28, 0x47, 0x02, 0x00, 0x30, 0x01);
      } else if (mode === 'utf8-xprinter') {
          isUtf8 = true;
          // FS & (Enable multi-byte mode for Xprinter Chinese/Thai/etc UTF-8)
          initBytes.push(FS, 0x26);
      } else if (mode === 'utf8-raw') {
          isUtf8 = true;
          // Only standard init ESC @, no special page commands
      } else if (mode.startsWith('tis620-')) {
          const num = parseInt(mode.split('-')[1], 10);
          const singleByteVal = isNaN(num) ? 26 : num;
          // Cancel double-byte Kanji/Chinese mode explicitly to prevent interception of Thai high-ASCII bytes
          initBytes.push(FS, 0x2E);
          initBytes.push(ESC, 0x74, singleByteVal);
      } else if (mode.startsWith('custom-')) {
          const num = parseInt(mode.split('-')[1], 10);
          const singleByteVal = isNaN(num) ? 26 : num;
          initBytes.push(FS, 0x2E);
          initBytes.push(ESC, 0x74, singleByteVal);
      } else {
          // Backward compatibility
          const num = parseInt(mode, 10);
          initBytes.push(FS, 0x2E);
          if (!isNaN(num)) {
              initBytes.push(ESC, 0x74, num);
          } else {
              initBytes.push(ESC, 0x74, 26);
          }
      }

      return { initBytes, isUtf8 };
  };

  // --- BLUETOOTH GRAPHICS THERMAL PRINT COMPILER ---
  const canvasToEscPosBytes = (canvas: HTMLCanvasElement): Uint8Array => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return new Uint8Array();
      const width = canvas.width;
      const height = canvas.height;
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      const widthBytes = Math.ceil(width / 8);
      const escposBytes: number[] = [];

      const ESC = 0x1B;
      const GS = 0x1D;

      // Start with standard hardware reset / init
      escposBytes.push(ESC, 0x40);

      // GS v 0 0 xL xH yL yH (Standard ESC/POS Raster Graphic Print Command)
      const xL = widthBytes % 256;
      const xH = Math.floor(widthBytes / 256);
      const yL = height % 256;
      const yH = Math.floor(height / 256);

      escposBytes.push(GS, 0x76, 0x30, 0, xL, xH, yL, yH);

      for (let y = 0; y < height; y++) {
          for (let x = 0; x < widthBytes * 8; x += 8) {
              let byteVal = 0;
              for (let bit = 0; bit < 8; bit++) {
                  const pxX = x + bit;
                  if (pxX < width) {
                      const idx = (y * width + pxX) * 4;
                      const r = data[idx];
                      const g = data[idx + 1];
                      const b = data[idx + 2];
                      const a = data[idx + 3];
                      
                      let isBlack = false;
                      if (a > 50) {
                          // Standard grayscale calculation
                          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                          if (luminance < 140) { // Slight bias towards black for maximum readability
                              isBlack = true;
                          }
                      }
                      if (isBlack) {
                          byteVal |= (1 << (7 - bit));
                      }
                  }
              }
              escposBytes.push(byteVal);
          }
      }

      // Feed paper to clear mechanical knife & cut
      escposBytes.push(ESC, 0x64, 0x02); // Economical feed: 2 lines is perfect to clear cutter line
      escposBytes.push(GS, 0x56, 0x42, 0x00); // Standard Auto-Cut command

      return new Uint8Array(escposBytes);
  };

  const generateEscPosGraphicData = async (payload: any, isKitchen: boolean, lang: Language, width: number): Promise<Uint8Array> => {
      if (typeof document === 'undefined') return new Uint8Array();

      // Ensure browser web fonts are fully loaded before rendering to canvas
      try {
          if (document.fonts && typeof document.fonts.ready !== 'undefined') {
              await document.fonts.ready;
          }
      } catch (e) {
          console.warn("Fonts ready API not fully supported or timed out:", e);
      }

      const lines: any[] = [];
      const addLineText = (left: string, right: string = '', options: any = {}) => {
          lines.push({ type: 'text', left, right, ...options });
      };
      const addDivider = (char: string = '-') => {
          lines.push({ type: 'divider', char });
      };
      const addGap = (height: number = 10) => {
          lines.push({ type: 'gap', height });
      };

      if (isKitchen) {
          addLineText(lang === 'th' ? "--- ครัว PIZZA DAMAC ---" : "--- KITCHEN ORDER ---", '', { align: 'center', size: 'large', bold: true });
          addDivider('=');
          
          let headerStr = "";
          if (payload.tableNumber) {
              headerStr = lang === 'th' ? `โต๊ะ (Table) ${payload.tableNumber}` : `Table ${payload.tableNumber}`;
          } else {
              headerStr = `Q-${String(payload.id).slice(-3)}`;
          }
          addLineText(headerStr, '', { align: 'center', size: 'huge', bold: true });
          addGap(5);

          addLineText(`${lang === 'th' ? 'ประเภท: ' : 'Type: '}${payload.type?.toUpperCase() || ''}`, '', { align: 'center', size: 'normal' });
          if (payload.createdAt) {
              const orderTimeStr = new Date(payload.createdAt).toLocaleString('th-TH', { 
                  timeZone: 'Asia/Bangkok',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit'
              });
              addLineText(`${lang === 'th' ? 'เวลาสั่ง: ' : 'Time: '}${orderTimeStr}`, '', { align: 'center', size: 'normal' });
          }
          addDivider('-');

          (payload.items || []).filter(Boolean).forEach((item: any) => {
              // Large size bold for easy reading in hot pizza kitchens
              addLineText(`${item.quantity}x ${item.name}`, '', { align: 'left', size: 'large', bold: true });
              
              if (item.selectedToppings && item.selectedToppings.length > 0) {
                  addLineText(`  + ${lang === 'th' ? 'ท็อปปิ้ง: ' : 'Toppings: '}` + item.selectedToppings.map((t: any) => t.name).join(", "), '', { align: 'left', size: 'normal', indent: 15 });
              }
              if (item.subItems && item.subItems.length > 0) {
                  addLineText(`  + ${lang === 'th' ? 'รายการย่อย: ' : 'Sub items: '}` + item.subItems.filter(Boolean).map((s: any) => s.name).join(", "), '', { align: 'left', size: 'normal', indent: 15 });
              }
              if (item.specialInstructions) {
                  addLineText(`  * ${lang === 'th' ? 'หมายเหตุ: ' : 'Instructions: '}` + item.specialInstructions, '', { align: 'left', size: 'normal', italic: true, indent: 15 });
              }
              addDivider('-');
          });

          if (payload.note) {
              addLineText(lang === 'th' ? "== หมายเหตุสำคัญ ==" : "== SPECIAL NOTICE ==", '', { align: 'center', size: 'normal', bold: true });
              addLineText(payload.note, '', { align: 'center', size: 'large', bold: true });
              addDivider('-');
          }
          
          addLineText(lang === 'th' ? "เร่งมือทำความอร่อยเลยค่ะ/ครับ! 🍕" : "Let's Pizza! 🍕", '', { align: 'center', size: 'normal' });
      } else {
          // Customer Receipt
          addLineText(payload.storeName || "Pizza Damac Nonthaburi", '', { align: 'center', size: 'large', bold: true });
          addLineText(payload.address || "Nonthaburi, Thailand", '', { align: 'center', size: 'normal' });
          if (payload.phone) {
              addLineText((lang === 'th' ? "โทร: " : "Tel: ") + payload.phone, '', { align: 'center', size: 'normal' });
          }
          addDivider('=');

          addLineText(payload.queueNo || `ORDER: #${payload.orderId}`, '', { align: 'center', size: 'large', bold: true });
          addLineText(`${lang === 'th' ? 'ประเภท: ' : 'Type: '}${payload.tableOrType || (lang === 'th' ? 'ลูกค้าทั่วไป' : 'Walk-in')}`, '', { align: 'left', size: 'normal' });
          addLineText(`${lang === 'th' ? 'วันที่: ' : 'Date: '}${payload.date}`, '', { align: 'left', size: 'normal' });

          if (payload.customerName && payload.customerName !== 'Guest') {
              addLineText(`${lang === 'th' ? 'ลูกค้า: ' : 'Cust: '}${payload.customerName}`, '', { align: 'left', size: 'normal' });
          }
          if (payload.customerPhone) {
              addLineText(`${lang === 'th' ? 'เบอร์โทร: ' : 'Phone: '}${payload.customerPhone}`, '', { align: 'left', size: 'normal' });
          }
          if (payload.deliveryAddress) {
              const cleanDeliveryAddr = (payload.deliveryAddress || '')
                  .replace(/\[Phone: .*?\]/g, '')
                  .replace(/\[GPS Pin: .*?\]/g, '')
                  .replace(/\[Google Maps Link: .*?\]/g, '')
                  .trim();
              if (cleanDeliveryAddr) {
                  addLineText(`${lang === 'th' ? 'ที่อยู่จัดส่ง: ' : 'Addr: '}${cleanDeliveryAddr}`, '', { align: 'left', size: 'normal' });
              }
          }
          if (payload.note) {
              addLineText(`${lang === 'th' ? '* โน้ต: ' : '* Note: '}${payload.note}`, '', { align: 'left', size: 'normal', italic: true });
          }

          addDivider('-');

          // Menu items
          (payload.items || []).filter(Boolean).forEach((item: any) => {
              addLineText(`${item.quantity}x ${item.name}`, `B${item.totalPrice}`, { align: 'split', size: 'normal', bold: true });
              
              if (item.selectedToppings && item.selectedToppings.length > 0) {
                  addLineText(`  + ${lang === 'th' ? 'ท็อปปิ้ง: ' : 'Toppings: '}` + item.selectedToppings.map((t: any) => t.name).join(", "), '', { align: 'left', size: 'small', indent: 15 });
              }
              if (item.subItems && item.subItems.length > 0) {
                  addLineText(`  + ${lang === 'th' ? 'รายการย่อย: ' : 'Sub: '}` + item.subItems.filter(Boolean).map((s: any) => s.name).join(", "), '', { align: 'left', size: 'small', indent: 15 });
              }
              if (item.specialInstructions) {
                  addLineText(`  * ${lang === 'th' ? 'หมายเหตุ: ' : 'Note: '}${item.specialInstructions}`, '', { align: 'left', size: 'small', italic: true, indent: 15 });
              }
          });

          addDivider('-');

          // Totals section
          if (payload.subtotal && Math.abs(payload.subtotal - payload.total) > 1) {
              addLineText(lang === 'th' ? 'มูลค่าก่อนภาษี:' : 'Subtotal:', `B${payload.subtotal.toFixed(2)}`, { align: 'split', size: 'normal' });
              addLineText(lang === 'th' ? 'ภาษี (7%):' : 'VAT (7%):', `B${payload.vat.toFixed(2)}`, { align: 'split', size: 'normal' });
          }
          addLineText(lang === 'th' ? 'ยอดสุทธิ:' : 'TOTAL:', `B${payload.total?.toLocaleString() || '0'}`, { align: 'split', size: 'large', bold: true });
          
          addDivider('-');
          addLineText(lang === 'th' ? 'ชำระโดย:' : 'Paid:', payload.paymentMethod || 'CASH', { align: 'split', size: 'normal' });
          if (payload.received !== undefined) {
              addLineText(lang === 'th' ? 'รับเงิน:' : 'Recv:', `B${payload.received}`, { align: 'split', size: 'normal' });
          }
          if (payload.change !== undefined) {
              addLineText(lang === 'th' ? 'เงินทอน:' : 'Chg:', `B${payload.change}`, { align: 'split', size: 'normal' });
          }
          
          addDivider('=');
          addLineText(lang === 'th' ? "ขอบคุณค่ะ/ครับ - พิซซ่า ดามัค นนทบุรี 🍕" : "Thank you! - Pizza Damac Nonthaburi 🍕", '', { align: 'center', size: 'normal', bold: true });
      }

      // Layout geometry specs
      const margin = 10;
      const xMarginLeft = margin;
      const xMarginRight = width - margin;
      
      let currentY = 15;
      const computedYCoords: number[] = [];
      const computedHeights: number[] = [];

      lines.forEach((line) => {
          let h = 0;
          if (line.type === 'gap') {
              h = line.height;
          } else if (line.type === 'divider') {
              h = 16;
          } else if (line.type === 'text') {
              if (line.size === 'small') h = 18;
              else if (line.size === 'large') h = 30;
              else if (line.size === 'huge') h = 42;
              else h = 24;
          }
          computedYCoords.push(currentY);
          computedHeights.push(h);
          currentY += h;
      });

      const totalHeight = currentY + 30; // Safety tail padding

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = totalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return new Uint8Array();

      // Clear layout background to solid white
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, totalHeight);

      // Render lines
      lines.forEach((line, index) => {
          const y = computedYCoords[index];
          const h = computedHeights[index];

          if (line.type === 'gap') {
              // space gap
          } else if (line.type === 'divider') {
              ctx.strokeStyle = '#000000';
              ctx.lineWidth = line.char === '=' ? 3 : 1;
              ctx.beginPath();
              if (line.char === '-') {
                  ctx.setLineDash([4, 4]);
              } else {
                  ctx.setLineDash([]);
              }
              ctx.moveTo(margin, y + h / 2);
              ctx.lineTo(width - margin, y + h / 2);
              ctx.stroke();
          } else if (line.type === 'text') {
              let fontStyle = '';
              if (line.italic) fontStyle += 'italic ';
              if (line.bold !== false) fontStyle += 'bold ';

              let fontSize = '18px';
              if (line.size === 'small') fontSize = '15px';
              else if (line.size === 'large') fontSize = '24px';
              else if (line.size === 'huge') fontSize = '34px';

              // Beautiful modern and accessible font specs for crisp details with Tahoma and Leelawadee fallbacks
              ctx.font = `${fontStyle}${fontSize} "Sarabun", "Tahoma", "Leelawadee", "Segoe UI", sans-serif`;
              ctx.fillStyle = '#000000';
              ctx.textBaseline = 'middle';

              const textY = y + h / 2;
              const indent = line.indent || 0;

              if (line.align === 'center') {
                  ctx.textAlign = 'center';
                  ctx.fillText(line.left, width / 2, textY);
              } else if (line.align === 'right') {
                  ctx.textAlign = 'right';
                  ctx.fillText(line.left, xMarginRight, textY);
              } else if (line.align === 'split') {
                  ctx.textAlign = 'left';
                  ctx.fillText(line.left, xMarginLeft + indent, textY);
                  ctx.textAlign = 'right';
                  ctx.fillText(line.right, xMarginRight, textY);
              } else {
                  ctx.textAlign = 'left';
                  ctx.fillText(line.left, xMarginLeft + indent, textY);
              }
          }
      });

      return canvasToEscPosBytes(canvas);
  };

  // --- BLUETOOTH DIRECT PRINTING STATE & IMPLEMENTATION ---
  const [btDevice, setBtDevice] = useState<any>(null);
  const [btCharacteristic, setBtCharacteristic] = useState<any>(null);
  const [btStatus, setBtStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  const encodeThaiTIS620 = (str: string): Uint8Array => {
      const bytes: number[] = [];
      for (let i = 0; i < str.length; i++) {
          const code = str.charCodeAt(i);
          if (code >= 0x0E01 && code <= 0x0E5B) {
              // Map Unicode Thai [ก-๏] to TIS-620 [0xA1-0xFB]
              bytes.push(code - 0x0E00 + 0xA0);
          } else if (code === 0x000A) {
              bytes.push(0x0A); // LF
          } else if (code === 0x000D) {
              bytes.push(0x0D); // CR
          } else if (code < 128) {
              bytes.push(code); // ASCII
          } else {
              bytes.push(32); // Space for unsupported character
          }
      }
      return new Uint8Array(bytes);
  };

  const generateEscPosData = (data: any, lang: Language): Uint8Array => {
      const ESC = 0x1B;
      const GS = 0x1D;

      const { initBytes, isUtf8 } = getThaiConfigs(thaiCodePage);
      const commands: number[] = [...initBytes];

      const addText = (text: string) => {
          // Replace raw '฿' with 'B' or 'THB' or 'บาท' to avoid black background box
          const safeText = text.replace(/฿/g, lang === 'th' ? 'บาท' : 'B');
          let encoded: Uint8Array;
          if (isUtf8) {
              encoded = new TextEncoder().encode(safeText);
          } else {
              encoded = encodeThaiTIS620(safeText);
          }
          commands.push(...Array.from(encoded));
      };

      const addLine = (text: string) => {
          addText(text + "\n");
      };

      const centerAlign = () => commands.push(ESC, 0x61, 0x01);
      const leftAlign = () => commands.push(ESC, 0x61, 0x00);
      const rightAlign = () => commands.push(ESC, 0x61, 0x02);
      const bigText = () => commands.push(GS, 0x21, 0x11); // Double width + double height
      const normalText = () => commands.push(GS, 0x21, 0x00);

      centerAlign();
      bigText();
      addLine(data.storeName || "Pizza Damac");
      normalText();
      addLine(data.address || "Nonthaburi, Thailand");
      if (data.phone) addLine((lang === 'th' ? "โทร: " : "Tel: ") + data.phone);
      addLine("================================");
      
      bigText();
      addLine(data.queueNo || `ORDER: #${data.orderId}`);
      normalText();
      addLine(`${lang === 'th' ? 'ประเภท: ' : 'Type: '}${data.tableOrType || (lang === 'th' ? 'ลูกค้าทั่วไป' : 'Walk-in')}`);
      addLine(`${lang === 'th' ? 'วันที่: ' : 'Date: '}${data.date}`);
      
      if (data.customerName && data.customerName !== 'Guest') {
          addLine(`${lang === 'th' ? 'ลูกค้า: ' : 'Cust: '}${data.customerName}`);
      }
      if (data.customerPhone) {
          addLine(`${lang === 'th' ? 'เบอร์โทร: ' : 'Phone: '}${data.customerPhone}`);
      }
      if (data.deliveryAddress) {
          const cleanDeliveryAddr = (data.deliveryAddress || '')
              .replace(/\[Phone: .*?\]/g, '')
              .replace(/\[GPS Pin: .*?\]/g, '')
              .replace(/\[Google Maps Link: .*?\]/g, '')
              .trim();
          if (cleanDeliveryAddr) {
              addLine(`${lang === 'th' ? 'ที่อยู่จัดส่ง: ' : 'Addr: '}${cleanDeliveryAddr}`);
          }
      }
      if (data.note) {
          addLine(`${lang === 'th' ? '* โน้ต: ' : '* Note: '}${data.note}`);
      }

      leftAlign();
      addLine("--------------------------------");
      
      // Render items safely
      (data.items || []).filter(Boolean).forEach((item: any) => {
          addLine(`${item.quantity}x ${item.name}`);
          if (item.selectedToppings && item.selectedToppings.length > 0) {
              addLine(` + ${lang === 'th' ? 'ท็อปปิ้ง' : 'Toppings'}: ` + item.selectedToppings.map((t: any) => t.name).join(", "));
          }
          if (item.subItems && item.subItems.length > 0) {
              addLine(` + ${lang === 'th' ? 'รายการย่อย' : 'Sub'}: ` + item.subItems.filter(Boolean).map((s: any) => s.name).join(", "));
          }
          if (item.specialInstructions) {
              addLine(` * ${lang === 'th' ? 'หมายเหตุ' : 'Note'}: ` + item.specialInstructions);
          }
          rightAlign();
          addLine(`${lang === 'th' ? 'ราคา' : 'Price'}: B${item.totalPrice}`);
          leftAlign();
      });

      addLine("--------------------------------");
      
      rightAlign();
      if (data.subtotal && Math.abs(data.subtotal - data.total) > 1) {
          addLine(`${lang === 'th' ? 'มูลค่าก่อนภาษี: ' : 'Subtotal: '}B${data.subtotal.toFixed(2)}`);
          addLine(`${lang === 'th' ? 'ภาษี (7%): ' : 'VAT (7%): '}B${data.vat.toFixed(2)}`);
      }
      bigText();
      addLine(`${lang === 'th' ? 'ยอดสุทธิ: ' : 'TOTAL: '}B${data.total?.toLocaleString() || '0'}`);
      normalText();
      leftAlign();
      
      addLine("--------------------------------");
      addLine(`${lang === 'th' ? 'ชำระโดย: ' : 'Paid: '}${data.paymentMethod || 'CASH'}`);
      if (data.received !== undefined) addLine(`${lang === 'th' ? 'รับเงิน: ' : 'Recv: '}B${data.received}`);
      if (data.change !== undefined) addLine(`${lang === 'th' ? 'เงินทอน: ' : 'Chg:  '}B${data.change}`);
      addLine("================================");
      
      centerAlign();
      addLine(lang === 'th' ? "ขอบคุณค่ะ/ครับ - พิซซ่า ดามัค นนทบุรี 🍕" : "Thank you! - Pizza Damac Nonthaburi 🍕");
      
      // Economical Paper Cut Sequence:
      // Feed paper 2 lines using ESC d to safely clear the mechanical cutter line with minimum paper waste
      commands.push(ESC, 0x64, 0x02);
      
      // Send exact single paper cut command: GS V 66 0 (1D 56 42 00)
      commands.push(GS, 0x56, 0x42, 0x00);

      return new Uint8Array(commands);
  };

  const generateKitchenEscPosData = (order: Order, lang: Language): Uint8Array => {
      const ESC = 0x1B;
      const GS = 0x1D;

      const { initBytes, isUtf8 } = getThaiConfigs(thaiCodePage);
      const commands: number[] = [...initBytes];

      const addText = (text: string) => {
          const safeText = text.replace(/฿/g, lang === 'th' ? 'บาท' : 'B');
          let encoded: Uint8Array;
          if (isUtf8) {
              encoded = new TextEncoder().encode(safeText);
          } else {
              encoded = encodeThaiTIS620(safeText);
          }
          commands.push(...Array.from(encoded));
      };

      const addLine = (text: string) => {
          addText(text + "\n");
      };

      const centerAlign = () => commands.push(ESC, 0x61, 0x01);
      const leftAlign = () => commands.push(ESC, 0x61, 0x00);
      const rightAlign = () => commands.push(ESC, 0x61, 0x02);
      const bigText = () => commands.push(GS, 0x21, 0x11); // Double width + double height
      const normalText = () => commands.push(GS, 0x21, 0x00);

      centerAlign();
      bigText();
      addLine(lang === 'th' ? "--- ออเดอร์ครัว (KITCHEN) ---" : "--- KITCHEN ORDER ---");
      addLine("================================");
      
      // Very large Queue/Table header
      let headerStr = "";
      if (order.tableNumber) {
          headerStr = lang === 'th' ? `โต๊ะ (Table) ${order.tableNumber}` : `Table ${order.tableNumber}`;
      } else {
          headerStr = `Q-${String(order.id).slice(-3)}`;
      }
      addLine(headerStr);
      normalText();
      
      addLine(`${lang === 'th' ? 'ประเภท: ' : 'Type: '}${order.type.toUpperCase()}`);
      if (order.createdAt) {
          addLine(`${lang === 'th' ? 'เวลาสั่ง: ' : 'Time: '}${new Date(order.createdAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}`);
      }
      addLine("--------------------------------");
      
      leftAlign();
      // Render ordered item list, making items DOUBLE size for cooks to read easily
      (order.items || []).filter(Boolean).forEach((item: any) => {
          bigText();
          addLine(`${item.quantity}x ${item.name}`);
          normalText();
          
          if (item.selectedToppings && item.selectedToppings.length > 0) {
              addLine(`  + ${lang === 'th' ? 'ท็อปปิ้ง' : 'Toppings'}: ` + item.selectedToppings.map((t: any) => t.name).join(", "));
          }
          if (item.subItems && item.subItems.length > 0) {
              addLine(`  + ${lang === 'th' ? 'รายการย่อย' : 'Sub items'}: ` + item.subItems.filter(Boolean).map((s: any) => s.name).join(", "));
          }
          if (item.specialInstructions) {
              addLine(`  * ${lang === 'th' ? 'หมายเหตุ' : 'Instructions'}: ` + item.specialInstructions);
          }
          addLine("--------------------------------");
      });

      if (order.note) {
          centerAlign();
          addLine(lang === 'th' ? "== หมายเหตุสำคัญ ==" : "== SPECIAL NOTICE ==");
          bigText();
          addLine(order.note);
          normalText();
          addLine("--------------------------------");
      }
      
      centerAlign();
      addLine(lang === 'th' ? "เร่งมือทำความอร่อยเลยค่ะ/ครับ! 🍕" : "Let's Pizza! 🍕");

      // Economical Paper Cut Sequence:
      // Feed paper 2 lines using ESC d to safely clear the mechanical cutter line with minimum paper waste
      commands.push(ESC, 0x64, 0x02);
      
      // Send exact single paper cut command: GS V 66 0 (1D 56 42 00)
      commands.push(GS, 0x56, 0x42, 0x00);

      return new Uint8Array(commands);
  };

  const writeBtInChunks = async (characteristic: any, data: Uint8Array) => {
      // Dynamic high-performance BLE chunk writing:
      // Text mode (< 1500 bytes) uses 120-byte chunks and 3ms delay for instant prints.
      // Graphic mode (> 1500 bytes) uses 96-byte chunks and 8ms delay for fast, buffered graphics without choke.
      const isLarge = data.length > 1500;
      const chunkSize = isLarge ? 96 : 120;
      const delay = isLarge ? 8 : 3;
      
      for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          await characteristic.writeValue(chunk);
          await new Promise(r => setTimeout(r, delay)); // Micro-delay to avoid buffer overflow
      }
  };

  const triggerReceiptPrint = async (payload: any) => {
      if (printerType === 'bluetooth') {
          // Try background auto-reconnect if device exists but connection dropped / went to sleep
          if (!btCharacteristic && btDevice) {
              console.log("Bluetooth device was paired but GATT is disconnected. Trying to auto-reconnect...");
              try {
                  setBtStatus('connecting');
                  const server = await btDevice.gatt.connect();
                  const services = await server.getPrimaryServices();
                  let autoChar = null;
                  for (const service of services) {
                      try {
                          const characteristics = await service.getCharacteristics();
                          for (const char of characteristics) {
                              if (char.properties.write || char.properties.writeWithoutResponse) {
                                  autoChar = char;
                                  break;
                              }
                          }
                      } catch (cErr) {}
                      if (autoChar) break;
                  }
                  if (autoChar) {
                      setBtCharacteristic(autoChar);
                      setBtStatus('connected');
                      
                      let escPosBytes: Uint8Array;
                      if (thaiCodePage.startsWith('graphic-')) {
                          const width = thaiCodePage === 'graphic-80' ? 576 : 384;
                          escPosBytes = await generateEscPosGraphicData(payload, false, language, width);
                      } else {
                          escPosBytes = generateEscPosData(payload, language);
                      }
                      await writeBtInChunks(autoChar, escPosBytes);
                      return; // Successfully printed after auto-reconnect!
                  }
              } catch (reconnectErr) {
                  console.warn("Bluetooth background reconnection failed:", reconnectErr);
                  setBtStatus('disconnected');
                  setBtCharacteristic(null);
              }
          }

          if (btCharacteristic) {
              try {
                  let escPosBytes: Uint8Array;
                  if (thaiCodePage.startsWith('graphic-')) {
                      const width = thaiCodePage === 'graphic-80' ? 576 : 384;
                      escPosBytes = await generateEscPosGraphicData(payload, false, language, width);
                  } else {
                      escPosBytes = generateEscPosData(payload, language);
                  }
                  await writeBtInChunks(btCharacteristic, escPosBytes);
                  return; // Successfully printed directly via Bluetooth!
              } catch (err: any) {
                  console.error("Bluetooth write failed under active channel, trying fallback", err);
                  // Connection might be stale - reset characteristic to trigger reconnect next time
                  setBtCharacteristic(null);
                  setBtStatus('disconnected');
              }
          } else {
              console.log("Bluetooth printer active but not connected. Falling back to system print smoothly without blocking alert.");
          }
      }
      
      // Fallback
      setTimeout(() => { window.print(); }, 250);
  };

  const triggerKitchenPrint = async (order: Order) => {
      if (printerType === 'bluetooth') {
          // Try background auto-reconnect if device exists but connection dropped / went to sleep
          if (!btCharacteristic && btDevice) {
              console.log("Bluetooth kitchen device was paired but GATT is disconnected. Trying to auto-reconnect...");
              try {
                  setBtStatus('connecting');
                  const server = await btDevice.gatt.connect();
                  const services = await server.getPrimaryServices();
                  let autoChar = null;
                  for (const service of services) {
                      try {
                          const characteristics = await service.getCharacteristics();
                          for (const char of characteristics) {
                              if (char.properties.write || char.properties.writeWithoutResponse) {
                                  autoChar = char;
                                  break;
                              }
                          }
                      } catch (cErr) {}
                      if (autoChar) break;
                  }
                  if (autoChar) {
                      setBtCharacteristic(autoChar);
                      setBtStatus('connected');
                      
                      let escPosBytes: Uint8Array;
                      if (thaiCodePage.startsWith('graphic-')) {
                          const width = thaiCodePage === 'graphic-80' ? 576 : 384;
                          escPosBytes = await generateEscPosGraphicData(order, true, language, width);
                      } else {
                          escPosBytes = generateKitchenEscPosData(order, language);
                      }
                      await writeBtInChunks(autoChar, escPosBytes);
                      return; // Successfully printed after auto-reconnect!
                  }
              } catch (reconnectErr) {
                  console.warn("Bluetooth kitchen background reconnection failed:", reconnectErr);
                  setBtStatus('disconnected');
                  setBtCharacteristic(null);
              }
          }

          if (btCharacteristic) {
              try {
                  let escPosBytes: Uint8Array;
                  if (thaiCodePage.startsWith('graphic-')) {
                      const width = thaiCodePage === 'graphic-80' ? 576 : 384;
                      escPosBytes = await generateEscPosGraphicData(order, true, language, width);
                  } else {
                      escPosBytes = generateKitchenEscPosData(order, language);
                  }
                  await writeBtInChunks(btCharacteristic, escPosBytes);
                  return; // Successfully printed kitchen ticket directly via Bluetooth!
              } catch (err: any) {
                  console.error("Bluetooth kitchen write failed", err);
                  setBtCharacteristic(null);
                  setBtStatus('disconnected');
              }
          }
      }
      console.log("No Bluetooth direct printer connected or fallback when calling kitchen auto print");
  };

  // Connect & Disconnect methods
  const connectBluetoothPrinter = async () => {
      if (!navigator.bluetooth) {
          alert("⚠️ เบราว์เซอร์ของคุณไม่สนับสนุน Bluetooth หรือไม่ได้รับการเปิดใช้ผ่าน HTTPS! กรุณาเปิดแอปในแท็บใหม่ หรือเปลี่ยนมาใช้บราวเซอร์ที่รองรับ (Chrome, Edge หรือ Opera)");
          return;
      }
      setBtStatus('connecting');
      try {
          const device = await navigator.bluetooth.requestDevice({
              acceptAllDevices: true,
              optionalServices: [
                  '000018f0-0000-1000-8000-00805f9b34fb', // ESC/POS Thermal SPP Service
                  '0000e7e1-0000-1000-8000-00805f9b34fb', // Other generic thermal Service
                  '49535343-fe7d-4158-938b-12e24011271a' // ISSC BLE Service
              ]
          });
          
          setBtDevice(device);
          const server = await device.gatt.connect();
          
          const services = await server.getPrimaryServices();
          let characteristic = null;
          
          for (const service of services) {
              try {
                  const characteristics = await service.getCharacteristics();
                  for (const char of characteristics) {
                      if (char.properties.write || char.properties.writeWithoutResponse) {
                          characteristic = char;
                          break;
                      }
                  }
              } catch (e) {
                  console.warn("Could not read characteristics for service", service.uuid, e);
              }
              if (characteristic) break;
          }
          
          if (!characteristic) {
              throw new Error("ไม่พบช่องรับข้อมูลสั่งพิมพ์ (writeable characteristic) บนเครื่องพิมพ์นี้ กรุณาลองใหม่อีกครั้ง");
          }
          
          setBtCharacteristic(characteristic);
          setBtStatus('connected');
          
          device.addEventListener('gattserverdisconnected', () => {
              setBtStatus('disconnected');
              setBtCharacteristic(null);
              setBtDevice(null);
          });
          
          alert(`🎉 เชื่อมต่อเครื่องพิมพ์สำเร็จ: ${device.name || 'Printer001'}! พร้อมใช้งานพิมพ์ใบเสร็จอัตโนมัติแล้ว`);
      } catch (err: any) {
          console.error("Bluetooth connection failed", err);
          setBtStatus('disconnected');
          setBtCharacteristic(null);
          setBtDevice(null);
          if (err.name !== 'NotFoundError') {
              alert(`❌ เชื่อมต่อล้มเหลว: ${err.message || String(err)}`);
          }
      }
  };

  const disconnectBluetoothPrinter = () => {
      try {
          if (btDevice && btDevice.gatt && btDevice.gatt.connected) {
              btDevice.gatt.disconnect();
          }
      } catch (e) {
          console.warn("Disconnection failed during manual disconnect:", e);
      }
      setBtStatus('disconnected');
      setBtCharacteristic(null);
      setBtDevice(null);
  };

  const resetBluetoothConnection = async () => {
      setBtStatus('connecting');
      try {
          if (btDevice && btDevice.gatt && btDevice.gatt.connected) {
              try {
                  btDevice.gatt.disconnect();
              } catch (e) {
                  console.warn("Disconnection warning during reset connection:", e);
              }
          }
      } catch (err) {
          console.error("GATT disconnect error during connection reset:", err);
      }
      
      setBtCharacteristic(null);
      setBtDevice(null);
      setBtStatus('disconnected');

      // A short timeout to ensure the device lists can refresh and clear internal buffers
      await new Promise(r => setTimeout(r, 600));
      
      // Attempt fresh connection re-scan
      await connectBluetoothPrinter();
  };

  const t = (key: keyof typeof TRANSLATIONS.en, params?: Record<string, string | number>) => {
      let text = TRANSLATIONS[language][key] || TRANSLATIONS['en'][key] || key;
      if (params) {
          Object.entries(params).forEach(([k, v]) => {
              text = text.replace(`{${k}}`, String(v));
          });
      }
      return text;
  };
  const getLocalizedItem = (item: { name: string; nameTh?: string; description?: string; descriptionTh?: string } | undefined) => {
      if (!item) return { name: '', description: '' };
      return {
          name: (language === 'th' && item.nameTh) ? item.nameTh : item.name,
          description: (language === 'th' && item.descriptionTh) ? item.descriptionTh : (item.description || '')
      };
  };

  // --- View Navigation & Table Session ---
  // Initialize from URL path
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);

  const [currentView, setCurrentView] = useState<AppView>(() => {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path === '/pos') return 'pos';
      if (path === '/kitchen') return 'kitchen';
      if (path.startsWith('/track/')) {
        const id = path.split('/track/')[1];
        if (id) {
          return 'track';
        }
      }
      
      // Fallback to legacy query params
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view');
      if (view === 'kitchen' || view === 'pos') return view;
    }
    return 'customer';
  });

  // Extract tracking order ID on mount if in track view
  useEffect(() => {
    if (currentView === 'track' && typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path.startsWith('/track/')) {
            const id = path.split('/track/')[1];
            if (id) setTrackingOrderId(id);
        }
    }
  }, [currentView]);

  const navigateTo = (view: AppView, orderId?: string) => {
      setCurrentView(view);
      if (orderId) setTrackingOrderId(orderId);
      
      if (typeof window !== 'undefined') {
          let newPath = '/';
          if (view === 'pos') newPath = '/pos';
          else if (view === 'kitchen') newPath = '/kitchen';
          else if (view === 'track' && orderId) newPath = `/track/${orderId}`;
          
          window.history.pushState({}, '', newPath + window.location.search);
          window.scrollTo(0, 0);
      }
  };
  
  // Check for Table Param (QR Code Scan)
  const [tableSession, setTableSession] = useState<string | null>(() => {
      if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          return params.get('table');
      }
      return null;
  });

  // Check for Partner Param (QR Code Scan)
  const [partnerSession, setPartnerSessionState] = useState<string | null>(() => {
      if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const partner = params.get('partner');
          if (partner) {
              localStorage.setItem('damac_partner_session', partner);
              return partner;
          }
          return localStorage.getItem('damac_partner_session');
      }
      return null;
  });

  const setPartnerSession = (partnerId: string | null) => {
      setPartnerSessionState(partnerId);
      if (typeof window !== 'undefined') {
          if (partnerId) {
              localStorage.setItem('damac_partner_session', partnerId);
          } else {
              localStorage.removeItem('damac_partner_session');
          }
      }
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view');
      const table = params.get('table');
      const partner = params.get('partner');
      setCurrentView((view === 'kitchen' || view === 'pos') ? view : 'customer');
      if (table) setTableSession(table);
      if (partner) setPartnerSession(partner);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // --- Auth State ---
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(() => {
    const authExpiry = localStorage.getItem('damac_auth_expiry');
    if (authExpiry && parseInt(authExpiry) > Date.now()) {
      return true;
    }
    localStorage.removeItem('damac_auth_expiry');
    return false;
  });

  const adminLogin = async (u: string, p: string) => {
    // Check locally first for fallback/legacy
    if (u === 'oatto' && p === 'Wachirus299*') {
        setIsAdminLoggedIn(true);
        localStorage.setItem('damac_auth_expiry', (Date.now() + 12 * 60 * 60 * 1000).toString());
        return true;
    }
    
    // Check with server
    try {
      const response = await fetch('/api/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: p, username: u })
      });
      const data = await response.json();
      if (data.success) {
        setIsAdminLoggedIn(true);
        localStorage.setItem('damac_auth_expiry', (Date.now() + 12 * 60 * 60 * 1000).toString());
        return true;
      }
    } catch (e) {
      console.error('Login error', e);
    }
    
    return false;
  };

  const adminLogout = () => {
    setIsAdminLoggedIn(false);
    localStorage.removeItem('damac_auth_expiry');
    sessionStorage.removeItem('damac_auth');
    navigateTo('customer');
  };

  // --- Branding ---
  const [shopLogo, setShopLogo] = useState(() => localStorage.getItem('damac_logo') || '');
  const updateShopLogo = (base64: string) => {
    setShopLogo(base64);
    try {
        localStorage.setItem('damac_logo', base64);
    } catch(e) {
        console.warn("Storage Full: Logo could not be saved locally. It will persist in DB if connected.", e);
    }
  };

  // --- Data States (From DB + Local Storage Backup) ---
  const [menu, setMenu] = useState<Pizza[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('damac_menu');
          if (saved) {
              try { return JSON.parse(saved); } catch(e) {}
          }
      }
      return INITIAL_MENU;
  });
  
  // Persist Menu to LocalStorage
  useEffect(() => {
      try {
        const menuWithoutImages = menu.map(item => ({ ...item, imageUrl: '' }));
        localStorage.setItem('damac_menu', JSON.stringify(menuWithoutImages));
      } catch(e) { console.warn("Menu Storage Full", e); }
  }, [menu]);

  // Initialized Toppings from LocalStorage
  const [toppings, setToppings] = useState<Topping[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('damac_toppings');
          if (saved) {
              try { return JSON.parse(saved); } catch(e) {}
          }
      }
      return INITIAL_TOPPINGS;
  });

  // Persist Toppings to LocalStorage
  useEffect(() => {
      try {
        localStorage.setItem('damac_toppings', JSON.stringify(toppings));
      } catch(e) { console.warn("Toppings Storage Full", e); }
  }, [toppings]);

  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('damac_expenses');
          if (saved) {
              try { return JSON.parse(saved); } catch(e) {}
          }
      }
      return [];
  });

  useEffect(() => {
      try {
        localStorage.setItem('damac_expenses', JSON.stringify(expenses));
      } catch(e) {}
  }, [expenses]);

  // Partners State
  const [partners, setPartners] = useState<Partner[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('damac_partners');
          if (saved) {
              try { return JSON.parse(saved); } catch(e) {}
          }
      }
      return [
        {
          id: 'partner_bella_cafe',
          name: 'Bella Cafe',
          nameTh: 'ร้านเบลล่า คาเฟ่',
          commissionPercent: 10,
          createdAt: new Date().toISOString(),
          note: 'สแกนสั่งจากร้านกาแฟเบลล่า ส่วนแบ่ง 10%'
        }
      ];
  });

  useEffect(() => {
      try {
        localStorage.setItem('damac_partners', JSON.stringify(partners));
      } catch(e) {}
  }, [partners]);

  const addPartner = async (partner: Partner) => {
    const updated = [partner, ...partners];
    setPartners(updated);
    if (isSupabaseConfigured) {
        try {
            await supabase.from('store_settings').update({ partners: updated }).eq('id', 1);
        } catch(e) {
            console.warn("Could not sync partner list to Supabase. Run SQL migration to add 'partners' column.", e);
        }
    }
  };

  const updatePartner = async (updated: Partner) => {
    const updatedList = partners.map(p => p.id === updated.id ? updated : p);
    setPartners(updatedList);
    if (isSupabaseConfigured) {
        try {
            await supabase.from('store_settings').update({ partners: updatedList }).eq('id', 1);
        } catch(e) {
            console.warn("Could not sync partner list update to Supabase.", e);
        }
    }
  };

  const deletePartner = async (id: string) => {
    const updatedList = partners.filter(p => p.id !== id);
    setPartners(updatedList);
    if (isSupabaseConfigured) {
        try {
            await supabase.from('store_settings').update({ partners: updatedList }).eq('id', 1);
        } catch(e) {
            console.warn("Could not sync partner deletion to Supabase.", e);
        }
    }
  };

  // --- Promo Codes State ---
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('damac_promo_codes');
          if (saved) {
              try { return JSON.parse(saved); } catch(e) {}
          }
      }
      return [
        {
          id: 'pc_boi3',
          code: 'BOI3',
          discountType: 'percentage',
          discountValue: 3,
          minOrderAmount: 0,
          isActive: true,
          description: '3% Discount for BOI workers',
          descriptionTh: 'ส่วนลด 3% สำหรับพนักงาน BOI',
          createdAt: new Date().toISOString()
        },
        {
          id: 'pc_free50',
          code: 'BOI50',
          discountType: 'fixed_delivery',
          discountValue: 50,
          minOrderAmount: 500,
          isActive: true,
          description: '50 THB off delivery fee on orders over 500 THB',
          descriptionTh: 'ส่วนลดค่าส่ง 50 บาท เมื่อยอดสั่งครบ 500 บาทขึ้นไป',
          createdAt: new Date().toISOString()
        }
      ];
  });

  const addPromoCode = async (pc: PromoCode) => {
      const updated = [pc, ...promoCodes];
      setPromoCodes(updated);
      try {
          localStorage.setItem('damac_promo_codes', JSON.stringify(updated));
      } catch(e) {}

      if (isSupabaseConfigured) {
          try {
              await supabase.from('promo_codes').insert([{
                  id: pc.id,
                  code: pc.code,
                  discount_type: pc.discountType,
                  discount_value: pc.discountValue,
                  min_order_amount: pc.minOrderAmount,
                  is_active: pc.isActive,
                  description: pc.description,
                  description_th: pc.descriptionTh,
                  created_at: pc.createdAt
              }]);
          } catch(e) { console.error("Supabase insert promo code failed", e); }
      }
  };

  const updatePromoCode = async (pc: PromoCode) => {
      const updated = promoCodes.map(p => p.id === pc.id ? pc : p);
      setPromoCodes(updated);
      try {
          localStorage.setItem('damac_promo_codes', JSON.stringify(updated));
      } catch(e) {}

      if (isSupabaseConfigured) {
          try {
              await supabase.from('promo_codes').upsert({
                  id: pc.id,
                  code: pc.code,
                  discount_type: pc.discountType,
                  discount_value: pc.discountValue,
                  min_order_amount: pc.minOrderAmount,
                  is_active: pc.isActive,
                  description: pc.description,
                  description_th: pc.descriptionTh,
                  created_at: pc.createdAt
              });
          } catch(e) { console.error("Supabase update promo code failed", e); }
      }
  };

  const deletePromoCode = async (id: string) => {
      const updated = promoCodes.filter(p => p.id !== id);
      setPromoCodes(updated);
      try {
          localStorage.setItem('damac_promo_codes', JSON.stringify(updated));
      } catch(e) {}

      if (isSupabaseConfigured) {
          try {
              await supabase.from('promo_codes').delete().eq('id', id);
          } catch(e) { console.error("Supabase delete promo code failed", e); }
      }
  };

  const [cart, setCart] = useState<CartItem[]>([]);
  const [customer, setCustState] = useState<CustomerProfile | null>(() => {
    const saved = localStorage.getItem('damac_customer');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as CustomerProfile;
        if (parsed && (!parsed.coupons || parsed.coupons.length === 0)) {
          parsed.coupons = generateInitialCoupons();
        }
        return parsed;
      } catch(e) {
        console.error("Error parsing customer", e);
      }
    }
    return null;
  });

  // --- Store Settings State (From DB + Local Storage Backup) ---
  const [storeSettings, setStoreSettings] = useState<StoreSettings>(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('damac_store_settings');
          if (saved) {
              try { return { ...DEFAULT_STORE_SETTINGS, ...JSON.parse(saved) }; } 
              catch(e) { console.error("Settings parse error", e); }
          }
      }
      return DEFAULT_STORE_SETTINGS;
  });

  // Persist Settings to LocalStorage
  useEffect(() => {
      try {
          const lighterSettings = { ...storeSettings, eventGalleryUrls: [], promoBannerUrl: '' };
          localStorage.setItem('damac_store_settings', JSON.stringify(lighterSettings));
      } catch (e2) {
          console.error("Critical Storage Error", e2);
      }
  }, [storeSettings]);

  const [isHoliday, setIsHoliday] = useState(false);
  const [isStoreOpen, setIsStoreOpen] = useState(true);

  // Helper to check if today is within holiday range
  const checkHolidayStatus = (start?: string, end?: string) => {
      if (!start || !end) return false;
      const today = new Date().toISOString().split('T')[0];
      return today >= start && today <= end;
  };

  const checkOperatingHours = () => {
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const isOpenHours = currentHour >= OPERATING_HOURS.open && currentHour < OPERATING_HOURS.close;
    return isOpenHours;
  };
  
  const canOrderForToday = () => {
      const now = new Date();
      const currentHour = now.getHours() + now.getMinutes() / 60;
      // Can order today if we haven't passed the closing time yet
      return currentHour < OPERATING_HOURS.close;
  };

  useEffect(() => {
     const updateStatus = () => {
         // Check if explicit holiday in DB OR manually closed
         const isScheduledHoliday = checkHolidayStatus(storeSettings.holidayStart, storeSettings.holidayEnd);
         const effectiveHoliday = isScheduledHoliday || !storeSettings.isOpen;
         
         // Store is "Open" if no holiday/manual close AND within hours
         const withinHours = checkOperatingHours();
         
         setIsHoliday(isScheduledHoliday);
         // Note: isStoreOpen tracks "Currently accepting ASAP orders". 
         // If closed (morning), you can still preorder for today.
         setIsStoreOpen(!effectiveHoliday && withinHours);
     };

     updateStatus();
     const interval = setInterval(updateStatus, 30000); // Check every 30 seconds
     return () => clearInterval(interval);
  }, [storeSettings]);

  // DB Sync
  const fetchMenu = async () => {
      if (!isSupabaseConfigured) return;
      try {
        const { data, error } = await supabase.from('menu_items').select('*');
        if (!error && data) {
           // PRESERVE LOCAL IMAGES: If DB image is missing but we have it locally, keep local.
           let localMenu: Pizza[] = [];
           try {
               const saved = localStorage.getItem('damac_menu');
               if (saved) localMenu = JSON.parse(saved);
           } catch(e) {}

           const mergedMenu = data.map((d: any) => {
               const local = INITIAL_MENU.find(m => m.id === d.id);
               const savedLocal = localMenu.find(m => m.id === d.id);
               return {
                   ...d, 
                   basePrice: d.base_price, 
                   nameTh: d.name_th, 
                   descriptionTh: d.description_th, 
                   // Prioritize DB image, fall back to Local saved image, then Default
                   image: d.image || savedLocal?.image || local?.image || 'https://via.placeholder.com/150',
                   isBestSeller: d.is_best_seller,
                   comboCount: d.combo_count !== undefined ? d.combo_count : (local?.comboCount || 0),
                   category: d.category || local?.category || 'pizza',
                   available: d.available,
                   badge: savedLocal?.badge || local?.badge || d.badge || '',
                   badgeTh: savedLocal?.badgeTh || local?.badgeTh || d.badge_th || '',
                   rawCost: d.raw_cost !== undefined ? d.raw_cost : (savedLocal?.rawCost || local?.rawCost || 0),
                   grabPrice: d.grab_price !== undefined ? d.grab_price : (savedLocal?.grabPrice || d.base_price || local?.grabPrice || d.base_price),
                   linemanPrice: d.lineman_price !== undefined ? d.lineman_price : (savedLocal?.linemanPrice || d.base_price || local?.linemanPrice || d.base_price)
               };
           });

           // Sort mergedMenu based on the sequence in localMenu or INITIAL_MENU!
           mergedMenu.sort((a, b) => {
               let indexA = localMenu.findIndex(m => m.id === a.id);
               if (indexA === -1) indexA = INITIAL_MENU.findIndex(m => m.id === a.id);
               if (indexA === -1) indexA = 9999;
               
               let indexB = localMenu.findIndex(m => m.id === b.id);
               if (indexB === -1) indexB = INITIAL_MENU.findIndex(m => m.id === b.id);
               if (indexB === -1) indexB = 9999;
               
               return indexA - indexB;
           });

           setMenu(mergedMenu);
        }
      } catch (err) { console.error("Menu fetch failed", err); }
  };

  const fetchToppings = async () => {
      if (!isSupabaseConfigured) return;
      try {
          const { data, error } = await supabase.from('toppings').select('*');
          if (!error && data) {
              // PRESERVE LOCAL IMAGES for Toppings
              let localToppings: Topping[] = [];
              try {
                  const saved = localStorage.getItem('damac_toppings');
                  if (saved) localToppings = JSON.parse(saved);
              } catch(e) {}

              const mergedToppings = data.map((d: any) => {
                  const local = INITIAL_TOPPINGS.find(t => t.id === d.id);
                  const savedLocal = localToppings.find(t => t.id === d.id);
                  return {
                      ...d, 
                      nameTh: d.name_th,
                      category: d.category || local?.category || 'other',
                      // Prioritize DB image, fall back to Local saved image
                      image: d.image || savedLocal?.image || undefined,
                      available: d.available !== false 
                  };
              });
              setToppings(mergedToppings);
          }
      } catch (err) { console.error("Toppings fetch failed", err); }
  };

  const fetchPromoCodes = async () => {
      if (!isSupabaseConfigured) return;
      try {
          const { data, error } = await supabase.from('promo_codes').select('*');
          if (error) {
              if (error.code === '42P01') {
                  console.warn("Table 'promo_codes' missing. Relying on local storage promo codes.");
                  return;
              }
              throw error;
          }
          if (data) {
              const mapped = data.map((d: any) => ({
                  id: d.id,
                  code: d.code,
                  discountType: d.discount_type,
                  discountValue: Number(d.discount_value),
                  minOrderAmount: Number(d.min_order_amount || 0),
                  isActive: d.is_active !== false,
                  description: d.description,
                  descriptionTh: d.description_th,
                  createdAt: d.created_at
              }));
              setPromoCodes(mapped);
          }
      } catch (err) { console.error("Promo codes fetch failed", err); }
  };

  const fetchOrders = async () => {
      if (!isSupabaseConfigured) return;
      try {
          const { data, error } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
          if (error) {
              if (error.code === '42P01') {
                  console.warn("Table 'orders' missing. Please run SQL script.");
                  return;
              }
          }
          if (data) setOrders(data.map((d: any) => {
              let lalaStatus = undefined;
              let lalaTrackingId = undefined;
              let lalaRiderName = undefined;
              let lalaRiderPhone = undefined;
              let lalaVehicleType = undefined;
              let dLat = d.delivery_lat;
              let dLng = d.delivery_lng;
              let dZone = d.delivery_zone;

              if (d.delivery_zone && d.delivery_zone.trim().startsWith('{')) {
                  try {
                      const parsed = JSON.parse(d.delivery_zone);
                      lalaStatus = parsed.lalamoveStatus;
                      lalaTrackingId = parsed.lalamoveTrackingId;
                      lalaRiderName = parsed.lalamoveRiderName;
                      lalaRiderPhone = parsed.lalamoveRiderPhone;
                      lalaVehicleType = parsed.lalamoveVehicleType;
                      if (parsed.deliveryLat !== undefined) dLat = parsed.deliveryLat;
                      if (parsed.deliveryLng !== undefined) dLng = parsed.deliveryLng;
                      dZone = parsed.deliveryZone || '';
                  } catch (e) {
                      // fallback
                  }
              }

              return {
                  ...d, 
                  customerName: d.customer_name, 
                  customerPhone: d.customer_phone, 
                  totalAmount: d.total_amount,
                  netAmount: d.net_amount || d.total_amount,
                  createdAt: d.created_at,
                  deliveryAddress: d.delivery_address,
                  deliveryZone: dZone,
                  deliveryFee: d.type === 'delivery' && d.delivery_fee === null ? 'pending' : d.delivery_fee,
                  paymentMethod: d.payment_method,
                  pickupTime: d.pickup_time,
                  tableNumber: d.table_number,
                  rating: d.rating,
                  comment: d.comment,
                  lalamoveStatus: lalaStatus,
                  lalamoveTrackingId: lalaTrackingId,
                  lalamoveRiderName: lalaRiderName,
                  lalamoveRiderPhone: lalaRiderPhone,
                  lalamoveVehicleType: lalaVehicleType,
                  deliveryLat: d.dropoff_lat || dLat,
                  deliveryLng: d.dropoff_lng || dLng,
                  delivery_type: d.delivery_type,
                  lalamove_quotation_id: d.lalamove_quotation_id,
                  lalamove_order_id: d.lalamove_order_id,
                  lalamove_share_link: d.lalamove_share_link,
                  delivery_status: d.delivery_status
              };
          }));
      } catch (err) { console.error("Orders fetch failed", err); }
  };

  const fetchSettings = async () => {
      if (!isSupabaseConfigured) return;
      try {
          const { data } = await supabase.from('store_settings').select('*').single();
          if (data) {
              // Preserve Local Banner if DB is empty/null
              let localSettings: Partial<StoreSettings> = {};
              try {
                  const saved = localStorage.getItem('damac_store_settings');
                  if (saved) localSettings = JSON.parse(saved);
              } catch(e) {}

              setStoreSettings({
                  isOpen: data.is_open,
                  closedMessage: data.closed_message,
                  promoBannerUrl: data.promo_banner_url || localSettings.promoBannerUrl, // Preserve local banner
                  promoContentType: data.promo_content_type,
                  holidayStart: data.holiday_start,
                  holidayEnd: data.holiday_end,
                  // New fields with fallback to constants
                  reviewUrl: data.review_url || DEFAULT_STORE_SETTINGS.reviewUrl,
                  facebookUrl: data.facebook_url || DEFAULT_STORE_SETTINGS.facebookUrl,
                  lineUrl: data.line_url || DEFAULT_STORE_SETTINGS.lineUrl,
                  mapUrl: data.map_url || DEFAULT_STORE_SETTINGS.mapUrl,
                  contactPhone: data.contact_phone || DEFAULT_STORE_SETTINGS.contactPhone,
                  promptPayNumber: data.prompt_pay_number || DEFAULT_STORE_SETTINGS.promptPayNumber,
                  
                  // Delivery configuration (prefer DB, then local, then default)
                  storeLocationGps: data.store_location_gps || localSettings.storeLocationGps || DEFAULT_STORE_SETTINGS.storeLocationGps,
                  freeDeliveryRadiusKm: data.free_delivery_radius_km ?? localSettings.freeDeliveryRadiusKm ?? DEFAULT_STORE_SETTINGS.freeDeliveryRadiusKm,
                  deliveryFeePerKm: data.delivery_fee_per_km ?? localSettings.deliveryFeePerKm ?? DEFAULT_STORE_SETTINGS.deliveryFeePerKm,
                  baseDeliveryFee: data.base_delivery_fee ?? localSettings.baseDeliveryFee ?? DEFAULT_STORE_SETTINGS.baseDeliveryFee,

                  // JSON or Array columns
                  reviewLinks: data.review_links || [],
                  vibeLinks: data.vibe_links || [],
                  eventGalleryUrls: data.event_gallery_urls || DEFAULT_STORE_SETTINGS.eventGalleryUrls, // Map new column
                  newsItems: data.news_items || []
              });
              if (data.partners && Array.isArray(data.partners)) {
                  setPartners(data.partners);
              }
          }
      } catch (err) { console.error("Settings fetch failed", err); }
  };
  const fetchCustomerProfile = async () => {
      if (!isSupabaseConfigured || !customer) return;
      try {
          // Fetch latest profile including addresses
          const { data } = await supabase.from('customers').select('*').eq('phone', customer.phone).single();
          if (data) {
              // Look up if there are any locally assigned coupons
              let localCoupons = [];
              try {
                  const saved = localStorage.getItem('damac_mock_customers');
                  if (saved) {
                      const list = JSON.parse(saved);
                      const foundLocal = list.find((lc: any) => lc.phone === customer.phone);
                      if (foundLocal && foundLocal.coupons) {
                          localCoupons = foundLocal.foundLocal;
                          localCoupons = foundLocal.coupons;
                      }
                  }
              } catch(e) {}

              const rawFavorites = data.saved_favorites || [];
              const cleanFavorites = rawFavorites.filter((f: any) => f.id !== "SYSTEM_COUPONS_BACKUP");
              const backupItem = rawFavorites.find((f: any) => f.id === "SYSTEM_COUPONS_BACKUP");
              let backupCoupons = [];
              if (backupItem) {
                  try {
                      backupCoupons = JSON.parse(backupItem.name);
                  } catch(e) {}
              }

              const updatedProfile: CustomerProfile = {
                  name: data.name,
                  phone: data.phone,
                  password: data.password,
                  address: data.address,
                  birthday: data.birthday,
                  loyaltyPoints: data.loyalty_points,
                  tier: data.tier,
                  savedFavorites: cleanFavorites,
                  orderHistory: data.order_history || [],
                  pdpaAccepted: data.pdpa_accepted,
                  savedAddresses: data.saved_addresses || [],
                  coupons: (data.coupons && data.coupons.length > 0) ? data.coupons : (backupCoupons.length > 0 ? backupCoupons : (localCoupons.length > 0 ? localCoupons : generateInitialCoupons()))
              };
              setCustState(updatedProfile);
              try {
                localStorage.setItem('damac_customer', JSON.stringify(updatedProfile));
              } catch(e) { console.warn("Customer Storage Full", e); }
          }
      } catch (err) { console.error("Profile fetch failed", err); }
  }
  
  useEffect(() => {
    if (isSupabaseConfigured) {
        fetchMenu();
        fetchToppings();
        fetchOrders();
        fetchSettings();
        fetchPromoCodes();
        
        const subscription = supabase.channel('realtime_updates')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload: any) => {
            fetchOrders(); // Reload orders when change happens
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, fetchMenu)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'toppings' }, fetchToppings) // Subscribe to toppings
        .on('postgres_changes', { event: '*', schema: 'public', table: 'store_settings' }, fetchSettings)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'promo_codes' }, fetchPromoCodes)
        .subscribe();
        
        // Polling fallback every 5 seconds to ensure status updates even if realtime is flaky
        const interval = setInterval(() => {
             fetchOrders();
        }, 5000);
        
        return () => { 
            subscription.unsubscribe(); 
            clearInterval(interval);
        }
    } else {
        try {
            const saved = localStorage.getItem('damac_mock_orders');
            if (saved) {
                setOrders(JSON.parse(saved));
            }
        } catch (e) {
            console.error("Failed to load local mock orders", e);
        }
    }
  }, []);

  // Persist orders to local storage for offline fallback and backup
  useEffect(() => {
      if (orders.length > 0) {
          try {
              localStorage.setItem('damac_mock_orders', JSON.stringify(orders));
          } catch (e) {
              console.warn("Storage Full: Mock orders could not be saved locally.", e);
          }
      }
  }, [orders]);

  // Update customer profile on load if logged in
  useEffect(() => {
      if (isSupabaseConfigured && customer) {
          fetchCustomerProfile();
      }
  }, []);

  // Actions
  const addPizza = async (pizza: Pizza) => {
      if (isSupabaseConfigured) {
          try {
            await supabase.from('menu_items').insert([{
                id: pizza.id, name: pizza.name, name_th: pizza.nameTh, 
                description: pizza.description, description_th: pizza.descriptionTh,
                base_price: pizza.basePrice, image: pizza.image, available: pizza.available, category: pizza.category,
                combo_count: pizza.comboCount, is_best_seller: pizza.isBestSeller || false,
                raw_cost: pizza.rawCost, grab_price: pizza.grabPrice, lineman_price: pizza.linemanPrice
            }]);
          } catch (e) { console.error(e); }
      } 
      // Always update local state for immediate feedback
      setMenu(prev => [...prev, pizza]);
  };
  const updatePizza = async (pizza: Pizza) => {
      if (isSupabaseConfigured) {
          try {
            await supabase.from('menu_items').upsert({
                id: pizza.id,
                name: pizza.name, name_th: pizza.nameTh, 
                description: pizza.description, description_th: pizza.descriptionTh,
                base_price: pizza.basePrice, image: pizza.image, available: pizza.available, category: pizza.category,
                combo_count: pizza.comboCount, is_best_seller: pizza.isBestSeller || false,
                raw_cost: pizza.rawCost, grab_price: pizza.grabPrice, lineman_price: pizza.linemanPrice
            });
          } catch(e) { console.error(e); }
      }
      // Always update local
      setMenu(prev => {
          const exists = prev.some(p => p.id === pizza.id);
          if (exists) {
              return prev.map(p => p.id === pizza.id ? pizza : p);
          } else {
              return [...prev, pizza];
          }
      });
  };
  const deletePizza = async (id: string) => {
      if (isSupabaseConfigured) {
          try { await supabase.from('menu_items').delete().eq('id', id); } catch(e) { console.error(e); }
      }
      setMenu(prev => prev.filter(p => p.id !== id));
  };
  const updatePizzaPrice = async (id: string, newPrice: number) => {
      const p = menu.find(i => i.id === id);
      if (p) await updatePizza({ ...p, basePrice: newPrice });
  };
  const togglePizzaAvailability = async (id: string) => {
      const p = menu.find(i => i.id === id);
      if (p) await updatePizza({ ...p, available: !p.available });
  };
  const toggleBestSeller = async (id: string) => {
      const p = menu.find(i => i.id === id);
      if (p) {
          const newVal = !p.isBestSeller;
          if (isSupabaseConfigured) {
              try {
                await supabase.from('menu_items').update({ is_best_seller: newVal }).eq('id', id);
              } catch(e) { console.error(e); }
          }
          setMenu(prev => prev.map(item => item.id === id ? {...item, isBestSeller: newVal} : item));
      }
  }

  const generateLuckyPizza = () => {
      const pizzaBase = menu.find(p => p.name.includes("Create Your Own"));
      if (!pizzaBase) return null;
      
      const randomToppings: Topping[] = [];
      const numToppings = Math.floor(Math.random() * 3) + 2; // 2-4 toppings
      const shuffled = [...toppings].sort(() => 0.5 - Math.random());
      
      for(let i=0; i<numToppings; i++) {
          if (shuffled[i]) randomToppings.push(shuffled[i]);
      }
      return { pizza: pizzaBase, toppings: randomToppings };
  };

  const seedDatabase = async () => {
      if (!isSupabaseConfigured) {
          alert("Database not connected. Cannot upload.");
          return;
      }
      const confirmUpload = window.confirm("This will upload all the latest Menu Items and Toppings from the code to the Database. It will overwrite existing items with the same ID. Continue?");
      if (!confirmUpload) return;

      try {
          // Upload Menu
          for (const p of INITIAL_MENU) {
              const { error } = await supabase.from('menu_items').upsert({
                  id: p.id, name: p.name, name_th: p.nameTh, 
                  base_price: p.basePrice, description: p.description, 
                  description_th: p.descriptionTh, image: p.image, 
                  category: p.category, available: p.available, 
                  is_best_seller: p.isBestSeller, combo_count: p.comboCount
              });
              if (error) console.error("Menu Seed Error", error);
          }
          // Upload Toppings
          for (const t of INITIAL_TOPPINGS) {
              const { error } = await supabase.from('toppings').upsert({
                  id: t.id, name: t.name, name_th: t.nameTh, price: t.price,
                  category: t.category, image: t.image, available: t.available
              });
              if (error) console.error("Topping Seed Error", error);
          }
          alert("Menu uploaded to database successfully! Your app is now in sync.");
          fetchMenu(); // Refresh
          fetchToppings(); // Refresh
      } catch (err) {
          console.error("Seeding failed", err);
          alert("Seeding failed. Check console for details.");
      }
  };

  const addTopping = async (topping: Topping) => {
      if (isSupabaseConfigured) {
          try {
            await supabase.from('toppings').insert([{
                id: topping.id, name: topping.name, name_th: topping.nameTh, price: topping.price, 
                category: topping.category, image: topping.image, available: topping.available
            }]);
          } catch(e) { console.error(e); }
      }
      setToppings(prev => [...prev, topping]);
  };
  
  const updateTopping = async (topping: Topping) => {
      if (isSupabaseConfigured) {
          try {
            await supabase.from('toppings').update({
                name: topping.name, name_th: topping.nameTh, price: topping.price, 
                category: topping.category, image: topping.image, available: topping.available
            }).eq('id', topping.id);
          } catch(e) { console.error(e); }
      }
      setToppings(prev => prev.map(t => t.id === topping.id ? topping : t));
  };

  const deleteTopping = async (id: string) => {
      if (isSupabaseConfigured) {
          try { await supabase.from('toppings').delete().eq('id', id); } catch(e) { console.error(e); }
      }
      setToppings(prev => prev.filter(t => t.id !== id));
  };
  
  // Cart
  const addToCart = (item: CartItem) => setCart(prev => [...prev, item]);
  const updateCartItemQuantity = (itemId: string, delta: number) => {
      setCart(prev => prev.map(item => {
          if (item.id === itemId) {
              const newQty = Math.max(1, item.quantity + delta);
              return { ...item, quantity: newQty, totalPrice: (item.totalPrice / item.quantity) * newQty };
          }
          return item;
      }));
  };
  const updateCartItem = (updatedItem: CartItem) => {
      setCart(prev => prev.map(item => item.id === updatedItem.id ? updatedItem : item));
  };
  const removeFromCart = (itemId: string) => setCart(prev => prev.filter(item => item.id !== itemId));
  const clearCart = () => setCart([]);
  const cartTotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);

  // Customer
  const setCustomer = async (profile: CustomerProfile) => {
      setCustState(profile);
      try {
        localStorage.setItem('damac_customer', JSON.stringify(profile));
      } catch(e) { console.warn("Customer Storage Full", e); }
      
      // Update Offline Backup
      try {
        const saved = localStorage.getItem('damac_mock_customers');
        let list = saved ? JSON.parse(saved) : [];
        list = list.filter((c: any) => c.phone !== profile.phone);
        list.push(profile);
        localStorage.setItem('damac_mock_customers', JSON.stringify(list));
      } catch(e) { console.warn("Mock Customer Storage Full", e); }

      // Sync to DB if connected
      if (isSupabaseConfigured) {
          try {
            const cleanFavorites = (profile.savedFavorites || []).filter((f: any) => f.id !== "SYSTEM_COUPONS_BACKUP");
            const backupItem = {
                id: "SYSTEM_COUPONS_BACKUP",
                name: JSON.stringify(profile.coupons || []),
                pizzaId: "system_coupons",
                toppings: []
            };
            const favoritesWithBackup = [...cleanFavorites, backupItem];

            const payload: any = {
                phone: profile.phone, 
                name: profile.name, 
                address: profile.address, 
                birthday: profile.birthday, 
                password: profile.password,
                loyalty_points: profile.loyaltyPoints, 
                tier: profile.tier,
                saved_favorites: favoritesWithBackup, 
                order_history: profile.orderHistory,
                coupons: profile.coupons || []
            };
            
            if (profile.pdpaAccepted !== undefined) payload.pdpa_accepted = profile.pdpaAccepted;
            if (profile.savedAddresses !== undefined) payload.saved_addresses = profile.savedAddresses;

            let { error: upsertError } = await supabase.from('customers').upsert(payload);
            if (upsertError) {
                // Resilient fallback logic: If db schema is older and lacks pdpa_accepted, saved_addresses or coupons
                if (upsertError.message && upsertError.message.includes("column") && 
                    (upsertError.message.includes("pdpa_accepted") || upsertError.message.includes("saved_addresses") || upsertError.message.includes("coupons") || upsertError.message.includes("schema cache"))) {
                    console.warn("Database structure is missing columns. Retrying sync with a stripped payload.");
                    const strippedPayload = { ...payload };
                    delete strippedPayload.pdpa_accepted;
                    delete strippedPayload.saved_addresses;
                    delete strippedPayload.coupons;
                    const { error: retryError } = await supabase.from('customers').upsert(strippedPayload);
                    upsertError = retryError;
                }
            }
            if (upsertError) {
                console.error("Customer sync failed:", upsertError);
                throw upsertError;
            }
          } catch(e: any) { 
            console.error("Customer sync failed with exception", e);
            throw e;
          }
      }
  };
  
  // Smart Register / Reset Password
  const registerCustomer = async (newProfile: CustomerProfile): Promise<'created' | 'updated'> => {
      let existingPoints = 0;
      let existingHistory: string[] = [];
      let existingFavorites: SavedFavorite[] = [];
      let existingTier: 'Bronze' | 'Silver' | 'Gold' | undefined = undefined;
      let existingSavedAddresses: string[] = [];
      let existingCoupons: Coupon[] = [];
      let action: 'created' | 'updated' = 'created';

      if (isSupabaseConfigured) {
          // Check if user exists
          try {
              const { data } = await supabase.from('customers').select('*').eq('phone', newProfile.phone).single();
              if (data) {
                  existingPoints = data.loyalty_points;
                  existingHistory = data.order_history || [];
                  existingFavorites = data.saved_favorites || [];
                  existingTier = data.tier;
                  existingSavedAddresses = data.saved_addresses || [];
                  existingCoupons = data.coupons || [];
                  if (existingCoupons.length === 0) {
                      try {
                          const saved = localStorage.getItem('damac_mock_customers');
                          if (saved) {
                              const list = JSON.parse(saved);
                              const foundLocal = list.find((lc: any) => lc.phone === newProfile.phone);
                              if (foundLocal && foundLocal.coupons) {
                                  existingCoupons = foundLocal.coupons;
                              }
                          }
                      } catch(e) {}
                  }
                  action = 'updated';
              }
          } catch(e) {}
      } else {
           // Local Storage fallback for mock
           const saved = localStorage.getItem('damac_mock_customers');
           if (saved) {
               const list = JSON.parse(saved);
               const found = list.find((c: any) => c.phone === newProfile.phone);
               if (found) {
                   existingPoints = found.loyaltyPoints;
                   existingHistory = found.orderHistory;
                   existingFavorites = found.savedFavorites;
                   existingTier = found.tier;
                   existingSavedAddresses = found.savedAddresses;
                   existingCoupons = found.coupons || [];
                   action = 'updated';
               }
           }
      }

      const finalProfile: CustomerProfile = {
          ...newProfile,
          loyaltyPoints: existingPoints,
          orderHistory: existingHistory,
          savedFavorites: existingFavorites,
          tier: existingTier,
          savedAddresses: existingSavedAddresses.length > 0 ? existingSavedAddresses : (newProfile.address ? [newProfile.address] : []),
          coupons: existingCoupons.length > 0 ? existingCoupons : (newProfile.coupons || generateInitialCoupons())
      };

      await setCustomer(finalProfile);
      return action;
  };

  const customerLogin = async (phone: string, pass: string): Promise<boolean> => {
      // First try DB if connected
      if (isSupabaseConfigured) {
          const { data } = await supabase.from('customers').select('*').eq('phone', phone).single();
          if (data && data.password === pass) {
              // Look up if there are any locally assigned coupons
              let localCoupons = [];
              try {
                  const saved = localStorage.getItem('damac_mock_customers');
                  if (saved) {
                      const list = JSON.parse(saved);
                      const foundLocal = list.find((lc: any) => lc.phone === phone);
                      if (foundLocal && foundLocal.coupons) {
                          localCoupons = foundLocal.coupons;
                      }
                  }
              } catch(e) {}

              const rawFavorites = data.saved_favorites || [];
              const cleanFavorites = rawFavorites.filter((f: any) => f.id !== "SYSTEM_COUPONS_BACKUP");
              const backupItem = rawFavorites.find((f: any) => f.id === "SYSTEM_COUPONS_BACKUP");
              let backupCoupons = [];
              if (backupItem) {
                  try {
                      backupCoupons = JSON.parse(backupItem.name);
                  } catch(e) {}
              }

              const profile: CustomerProfile = {
                  name: data.name,
                  phone: data.phone,
                  password: data.password,
                  address: data.address,
                  birthday: data.birthday,
                  loyaltyPoints: data.loyalty_points,
                  tier: data.tier,
                  savedFavorites: cleanFavorites,
                  orderHistory: data.order_history || [],
                  pdpaAccepted: data.pdpa_accepted,
                  savedAddresses: data.saved_addresses || [],
                  coupons: (data.coupons && data.coupons.length > 0) ? data.coupons : (backupCoupons.length > 0 ? backupCoupons : (localCoupons.length > 0 ? localCoupons : generateInitialCoupons()))
              };
              await setCustomer(profile);
              return true;
          }
      } 
      
      // Fallback to local mock data (for testing or offline)
      const saved = localStorage.getItem('damac_mock_customers');
      if (saved) {
           const list = JSON.parse(saved);
           const found = list.find((c: any) => c.phone === phone && c.password === pass);
           if (found) {
               if (!found.coupons || found.coupons.length === 0) {
                   found.coupons = generateInitialCoupons();
               }
               setCustState(found);
               try {
                localStorage.setItem('damac_customer', JSON.stringify(found));
               } catch(e) { console.warn("Login Storage Error", e); }
               return true;
           }
      }
      return false;
  };

  const getAllCustomers = async () => {
      let dbCustomers: any[] = [];
      let localCustomers: any[] = [];

      if (isSupabaseConfigured) {
          const { data } = await supabase.from('customers').select('*');
          if (data) {
              dbCustomers = data.map((row: any) => {
                  const rawFavorites = row.saved_favorites || [];
                  const cleanFavorites = rawFavorites.filter((f: any) => f.id !== "SYSTEM_COUPONS_BACKUP");
                  const backupItem = rawFavorites.find((f: any) => f.id === "SYSTEM_COUPONS_BACKUP");
                  let backupCoupons = [];
                  if (backupItem) {
                      try {
                          backupCoupons = JSON.parse(backupItem.name);
                      } catch(e) {}
                  }

                  return {
                      phone: row.phone,
                      name: row.name,
                      address: row.address,
                      birthday: row.birthday,
                      password: row.password,
                      loyaltyPoints: row.loyalty_points || 0,
                      tier: row.tier || 'Bronze',
                      savedFavorites: cleanFavorites,
                      orderHistory: row.order_history || [],
                      pdpaAccepted: row.pdpa_accepted,
                      savedAddresses: row.saved_addresses || [],
                      coupons: (row.coupons && row.coupons.length > 0) ? row.coupons : (backupCoupons.length > 0 ? backupCoupons : generateInitialCoupons())
                  };
              });
          }
      }
      
      // Merge with offline data
      const saved = localStorage.getItem('damac_mock_customers');
      if (saved) {
          try {
              localCustomers = JSON.parse(saved);
          } catch(e) {}
      }

      // Map localCustomers to have consistent types and fields
      localCustomers = localCustomers.map((c: any) => ({
          ...c,
          loyaltyPoints: c.loyaltyPoints !== undefined ? c.loyaltyPoints : (c.loyalty_points || 0),
          savedFavorites: c.savedFavorites || c.saved_favorites || [],
          orderHistory: c.orderHistory || c.order_history || [],
          savedAddresses: c.savedAddresses || c.saved_addresses || [],
          coupons: c.coupons || []
      }));

      // Merge database customers with local coupons/data if DB is missing coupons column
      const combined = dbCustomers.map((dbCust: any) => {
          const matchingLocal = localCustomers.find((lc: any) => lc.phone === dbCust.phone);
          if (matchingLocal) {
              return {
                  ...dbCust,
                  // If DB coupons are missing or empty, prefer local assigned coupons
                  coupons: (dbCust.coupons && dbCust.coupons.length > 0) ? dbCust.coupons : (matchingLocal.coupons || [])
              };
          }
          return dbCust;
      });

      // Combine arrays, adding any local-only customers
      for (const local of localCustomers) {
          if (!combined.find(c => c.phone === local.phone)) {
              combined.push(local);
          }
      }
      
      return combined;
  }

  const adminUpdateCustomerCoupons = async (customerPhone: string, coupons: Coupon[]) => {
      // Find and update in localStorage damac_mock_customers
      try {
          const saved = localStorage.getItem('damac_mock_customers');
          let list = saved ? JSON.parse(saved) : [];
          let found = false;
          list = list.map((c: any) => {
              if (c.phone === customerPhone) {
                  found = true;
                  return { ...c, coupons };
              }
              return c;
          });
          if (!found) {
              // If not found offline, let's fetch the customer and save
              list.push({ phone: customerPhone, coupons, loyaltyPoints: 0, savedFavorites: [], orderHistory: [] });
          }
          localStorage.setItem('damac_mock_customers', JSON.stringify(list));
      } catch(e) { console.error(e); }

      // Also if the currently logged-in customer is this customer, update their state
      if (customer && customer.phone === customerPhone) {
          setCustState(prev => prev ? { ...prev, coupons } : null);
          localStorage.setItem('damac_customer', JSON.stringify({ ...customer, coupons }));
      }

      // Sync to DB if connected
      if (isSupabaseConfigured) {
          try {
              const { error } = await supabase.from('customers').update({ coupons }).eq('phone', customerPhone);
              
              // We also back up to saved_favorites in both cases to make sure it's 100% robust
              const { data } = await supabase.from('customers').select('saved_favorites').eq('phone', customerPhone).single();
              const rawFavorites = data?.saved_favorites || [];
              const cleanFavorites = rawFavorites.filter((f: any) => f.id !== "SYSTEM_COUPONS_BACKUP");
              const backupItem = {
                  id: "SYSTEM_COUPONS_BACKUP",
                  name: JSON.stringify(coupons),
                  pizzaId: "system_coupons",
                  toppings: []
              };
              const favoritesWithBackup = [...cleanFavorites, backupItem];
              await supabase.from('customers').update({ saved_favorites: favoritesWithBackup }).eq('phone', customerPhone);
          } catch(e) { console.error(e); }
      }
  };

  const addToFavorites = async (name: string, pizzaId: string, toppings: Topping[]) => {
      if (!customer) return;
      const newFav: SavedFavorite = { id: Date.now().toString(), name, pizzaId, toppings };
      const updatedFavs = [...customer.savedFavorites, newFav];
      const updatedCustomer = { ...customer, savedFavorites: updatedFavs };
      await setCustomer(updatedCustomer);
  };

  const claimReward = () => {
      if (!customer || customer.loyaltyPoints < 10) return false;
      const updatedCustomer = { ...customer, loyaltyPoints: customer.loyaltyPoints - 10 };
      setCustomer(updatedCustomer);
      return true;
  };

  // Orders
  const placeOrder = async (
    type: OrderType, 
    details?: {
      note?: string;
      delivery?: { address: string; zoneName: string; fee: number | 'pending'; lat?: number; lng?: number; quotationId?: string; };
      paymentMethod?: PaymentMethod;
      pickupTime?: string;
      tableNumber?: string;
      source?: OrderSource;
      status?: OrderStatus;
      deliveryPlatformRef?: string;
      partnerId?: string;
      promoCode?: string;
      discountAmount?: number;
      couponCode?: string;
      couponDiscountAmount?: number;
      couponId?: string;
      isPosOrder?: boolean;
      customerName?: string;
      customerPhone?: string;
    }
  ) => {
      // Check for an existing active order (same table for dine-in, or same customer phone)
      const tableNumberToMatch = details?.tableNumber;
      const phoneToMatch = details?.isPosOrder ? (details?.customerPhone || '') : (customer ? customer.phone : '');

      let existingOrder: Order | undefined = undefined;

      if (tableNumberToMatch && tableNumberToMatch !== 'Walk-in') {
          // Search for any active (not completed, not cancelled) dine-in order for this table
          existingOrder = orders.find(o => 
              o.tableNumber === tableNumberToMatch && 
              o.status !== 'completed' && 
              o.status !== 'cancelled'
          );
      } else if (phoneToMatch) {
          // Search for any active (not completed, not cancelled) order of the same type for this customer
          existingOrder = orders.find(o => 
              o.customerPhone === phoneToMatch && 
              o.type === type &&
              o.status !== 'completed' && 
              o.status !== 'cancelled'
          );
      }

      if (existingOrder) {
          // Merge items
          const mergedItems = [...existingOrder.items];
          for (const newItem of cart) {
              const existingItemIndex = mergedItems.findIndex(existingItem => {
                  if (existingItem.pizzaId !== newItem.pizzaId) return false;
                  if ((existingItem.specialInstructions || '') !== (newItem.specialInstructions || '')) return false;
                  
                  // Compare Toppings
                  const oldToppings = existingItem.selectedToppings || [];
                  const newToppings = newItem.selectedToppings || [];
                  if (oldToppings.length !== newToppings.length) return false;
                  const allToppingsMatch = oldToppings.every(ot => newToppings.some(nt => nt.id === ot.id));
                  if (!allToppingsMatch) return false;

                  // Compare SubItems (combos)
                  const oldSub = existingItem.subItems || [];
                  const newSub = newItem.subItems || [];
                  if (oldSub.length !== newSub.length) return false;
                  const allSubMatch = oldSub.every((os, idx) => {
                      const ns = newSub[idx];
                      if (!os && !ns) return true;
                      if (!os || !ns) return false;
                      if (os.pizzaId !== ns.pizzaId) return false;
                      
                      const osT = os.toppings || [];
                      const nsT = ns.toppings || [];
                      if (osT.length !== nsT.length) return false;
                      return osT.every(ot => nsT.some(nt => nt.id === ot.id));
                  });
                  if (!allSubMatch) return false;

                  return true;
              });

              if (existingItemIndex > -1) {
                  // Merge quantities & update price
                  const existingItem = mergedItems[existingItemIndex];
                  const newQty = existingItem.quantity + newItem.quantity;
                  const itemUnitPrice = existingItem.totalPrice / existingItem.quantity;
                  mergedItems[existingItemIndex] = {
                      ...existingItem,
                      quantity: newQty,
                      totalPrice: Math.round(itemUnitPrice * newQty)
                  };
              } else {
                  // Append new item
                  mergedItems.push({ ...newItem });
              }
          }

          // Recalculate total amount for the merged order
          const newSubtotal = mergedItems.reduce((sum, item) => sum + item.totalPrice, 0);
          const deliveryFee = existingOrder.deliveryFee === 'pending' ? 0 : (existingOrder.deliveryFee || 0);
          const newTotalAmount = newSubtotal + deliveryFee;

          // Calculate Net (GP Deduction)
          const gpRate = GP_RATES[existingOrder.source] || 0;
          const newNetAmount = newTotalAmount * (1 - gpRate);

          // Append to note if there is a new note
          let newNote = existingOrder.note || '';
          if (details?.note) {
              newNote = newNote ? `${newNote} | Add: ${details.note}` : `Add: ${details.note}`;
          }

          // Build updated order object
          const updatedOrder: Order = {
              ...existingOrder,
              items: mergedItems,
              totalAmount: newTotalAmount,
              netAmount: newNetAmount,
              note: newNote,
          };

          // Save to Supabase
          if (isSupabaseConfigured) {
              try {
                  const { error } = await supabase
                      .from('orders')
                      .update({
                          items: updatedOrder.items,
                          total_amount: updatedOrder.totalAmount,
                          net_amount: updatedOrder.netAmount,
                          note: updatedOrder.note
                      })
                      .eq('id', existingOrder.id);
                  if (error) throw error;
              } catch (e: any) {
                  console.error("Failed to update and merge order in Supabase:", e);
                  alert("Failed to update order: " + (e?.message || String(e)));
                  return false;
              }
          }

          // Update local state
          setOrders(prev => prev.map(o => o.id === existingOrder.id ? updatedOrder : o));

          // Loyalty calculations: 1 point per newly added pizza item
          if (customer) {
              const addedPizzas = cart.filter(i => {
                   const itemDef = menu.find(m => m.id === i.pizzaId);
                   return itemDef?.category === 'pizza' || itemDef?.category === 'promotion';
              }).reduce((sum, i) => sum + i.quantity, 0);

              if (addedPizzas > 0) {
                  const newPoints = customer.loyaltyPoints + addedPizzas;
                  const updatedCustomer = { 
                      ...customer, 
                      loyaltyPoints: newPoints
                  };
                  await setCustomer(updatedCustomer);
              }
          }

          // Clear cart
          clearCart();
          return true;
      }

      // Calculate Total
      const subtotal = cart.reduce((sum, item) => sum + item.totalPrice, 0);
      const deliveryFee = details?.delivery?.fee === 'pending' ? 0 : (details?.delivery?.fee || 0);
      const discount = (details?.discountAmount || 0) + (details?.couponDiscountAmount || 0);
      const totalAmount = Math.max(0, subtotal + deliveryFee - discount);
      
      // Calculate Net (GP Deduction)
      const source = details?.source || 'store';
      const gpRate = GP_RATES[source] || 0;
      const netAmount = Math.max(0, totalAmount * (1 - gpRate));

      // Partner Commission calculation
      let partnerCommissionAmount = 0;
      if (details?.partnerId) {
          const foundPartner = partners.find(p => p.id === details.partnerId);
          if (foundPartner) {
              partnerCommissionAmount = Math.round(totalAmount * (foundPartner.commissionPercent / 100));
          }
      }

      let computedNote = details?.note || '';
      if (details?.deliveryPlatformRef) {
          computedNote = `Ref: ${details.deliveryPlatformRef}${computedNote ? ' | ' + computedNote : ''}`;
      }
      if (details?.promoCode && details?.discountAmount) {
          const promoStr = `[Promo: ${details.promoCode} (-${details.discountAmount} THB)]`;
          computedNote = computedNote ? `${computedNote} | ${promoStr}` : promoStr;
      }
      if (details?.couponCode && details?.couponDiscountAmount) {
          const couponStr = `[Coupon: ${details.couponCode} (-${details.couponDiscountAmount} THB)]`;
          computedNote = computedNote ? `${computedNote} | ${couponStr}` : couponStr;
      }

      const newOrder: Order = {
          id: Date.now().toString(),
          customerName: details?.isPosOrder 
              ? (details?.customerName || (details?.tableNumber ? `Table ${details.tableNumber}` : 'Guest'))
              : (customer ? customer.name : (details?.tableNumber ? `Table ${details.tableNumber}` : 'Guest')),
          customerPhone: details?.isPosOrder 
              ? (details?.customerPhone || '')
              : (customer ? customer.phone : ''),
          type,
          source: source,
          status: details?.status || 'pending',
          items: [...cart],
          totalAmount,
          netAmount,
          createdAt: new Date().toISOString(),
          note: computedNote,
          deliveryAddress: details?.delivery?.address,
          deliveryZone: details?.delivery?.zoneName,
          deliveryFee: details?.delivery?.fee,
          dropoff_lat: details?.delivery?.lat,
          dropoff_lng: details?.delivery?.lng,
          delivery_type: type === 'delivery' ? 'delivery' : (type === 'pickup' ? 'pickup' : undefined),
          lalamove_quotation_id: details?.delivery?.quotationId,
          delivery_status: type === 'delivery' ? 'pending' : undefined,
          paymentMethod: details?.paymentMethod,
          pickupTime: details?.pickupTime,
          tableNumber: details?.tableNumber,
          deliveryPlatformRef: details?.deliveryPlatformRef,
          partnerId: details?.partnerId,
          partnerCommissionAmount: partnerCommissionAmount,
          promoCode: details?.promoCode,
          discountAmount: details?.discountAmount,
          couponCode: details?.couponCode,
          couponDiscountAmount: details?.couponDiscountAmount
      };

      if (isSupabaseConfigured) {
          try {
             // Construct delivery_zone JSON if we have delivery coordinates
             const lalaData: any = {};
             if (newOrder.deliveryZone) lalaData.deliveryZone = newOrder.deliveryZone;
             if (newOrder.deliveryLat !== undefined) lalaData.deliveryLat = newOrder.deliveryLat;
             if (newOrder.deliveryLng !== undefined) lalaData.deliveryLng = newOrder.deliveryLng;
             if (newOrder.lalamoveStatus) lalaData.lalamoveStatus = newOrder.lalamoveStatus;

             const payload: any = {
                 id: newOrder.id,
                 customer_name: newOrder.customerName,
                 customer_phone: newOrder.customerPhone,
                 type: newOrder.type,
                 source: newOrder.source,
                 status: newOrder.status,
                 items: newOrder.items,
                 total_amount: newOrder.totalAmount,
                 net_amount: newOrder.netAmount,
                 created_at: newOrder.createdAt,
                 note: newOrder.note,
                 delivery_address: newOrder.deliveryAddress,
                 delivery_zone: newOrder.deliveryZone,
                 dropoff_lat: newOrder.dropoff_lat,
                 dropoff_lng: newOrder.dropoff_lng,
                 delivery_type: newOrder.delivery_type,
                 lalamove_quotation_id: newOrder.lalamove_quotation_id,
                 delivery_status: newOrder.delivery_status,
                 delivery_fee: newOrder.deliveryFee === 'pending' ? null : newOrder.deliveryFee,
                 payment_method: newOrder.paymentMethod,
                 pickup_time: newOrder.pickupTime,
                 table_number: newOrder.tableNumber
             };
             const {error} = await supabase.from('orders').insert([payload]); if (error) { console.error('Supabase order insert error:', error); throw error; }
          } catch(e: any) { console.error("Order placement failed", e); alert("Order placement failed: " + (e?.message || String(e))); return false; }
      }

      setOrders(prev => [newOrder, ...prev]);
      
      // Update promo code usage count
      if (details?.promoCode) {
          const promoToUpdate = promoCodes.find(p => p.code.toUpperCase() === details.promoCode?.toUpperCase());
          if (promoToUpdate) {
              const todayStr = new Date().toISOString().split('T')[0];
              const isToday = promoToUpdate.lastUseDate === todayStr;
              const newCurrentUses = isToday ? (promoToUpdate.currentUses || 0) + 1 : 1;
              const maxUses = promoToUpdate.maxUsesPerDay;
              
              // Automatically disable if max uses reached
              const shouldDisable = (maxUses && maxUses > 0 && newCurrentUses >= maxUses);
              
              const updatedPromo = {
                  ...promoToUpdate,
                  currentUses: newCurrentUses,
                  lastUseDate: todayStr,
                  isActive: shouldDisable ? false : promoToUpdate.isActive
              };
              updatePromoCode(updatedPromo);
          }
      }
      
      // Save ID for Guest Tracking
      try {
        localStorage.setItem('damac_last_order', newOrder.id);
      } catch(e) {}
      
      // Update Customer (Loyalty + History + Saved Address + Coupon Prevention)
      const targetPhone = details?.isPosOrder ? (details?.customerPhone || '') : (customer?.phone || newOrder.customerPhone);
      if (targetPhone) {
          // Let's resolve the customer's profile (either active logged in customer, or offline/online profile)
          let targetCustomerProfile: CustomerProfile | null = null;
          let isCurrentLoggedIn = false;

          if (customer && customer.phone === targetPhone) {
              targetCustomerProfile = customer;
              isCurrentLoggedIn = true;
          } else {
              // Retrieve from offline backup
              try {
                  const saved = localStorage.getItem('damac_mock_customers');
                  const list = saved ? JSON.parse(saved) : [];
                  const found = list.find((c: any) => c.phone === targetPhone);
                  if (found) {
                      targetCustomerProfile = found;
                  }
              } catch(e) {}

              // Retrieve from Supabase if DB is active and not found yet
              if (!targetCustomerProfile && isSupabaseConfigured) {
                  try {
                      const { data } = await supabase.from('customers').select('*').eq('phone', targetPhone).single();
                      if (data) {
                          targetCustomerProfile = {
                              phone: data.phone,
                              name: data.name || '',
                              address: data.address || '',
                              birthday: data.birthday || '',
                              password: data.password || '',
                              loyaltyPoints: data.loyalty_points || 0,
                              tier: data.tier || 'Bronze',
                              savedFavorites: data.saved_favorites || [],
                              orderHistory: data.order_history || [],
                              coupons: data.coupons || [],
                              pdpaAccepted: data.pdpa_accepted || false,
                              savedAddresses: data.saved_addresses || []
                          };
                      }
                  } catch(e) {}
              }
          }

          if (targetCustomerProfile) {
              // Loyalty calculation
              const pizzaCount = cart.filter(i => {
                   const itemDef = menu.find(m => m.id === i.pizzaId);
                   return itemDef?.category === 'pizza' || itemDef?.category === 'promotion';
              }).reduce((sum, i) => sum + i.quantity, 0);

              const newPoints = targetCustomerProfile.loyaltyPoints + pizzaCount;
              const newHistory = targetCustomerProfile.orderHistory.includes(newOrder.id) 
                  ? targetCustomerProfile.orderHistory 
                  : [newOrder.id, ...targetCustomerProfile.orderHistory];

              let newSavedAddresses = targetCustomerProfile.savedAddresses || [];
              if (type === 'delivery' && details?.delivery?.address) {
                  if (!newSavedAddresses.includes(details.delivery.address)) {
                      newSavedAddresses = [details.delivery.address, ...newSavedAddresses].slice(0, 5);
                  }
              }

              // Update Coupons Status
              let updatedCoupons = targetCustomerProfile.coupons || [];
              if (details?.couponId || details?.couponCode) {
                  let matched = false;
                  updatedCoupons = updatedCoupons.map(c => {
                      const matchesId = details.couponId && c.id === details.couponId;
                      const matchesCode = !details.couponId && details.couponCode && c.code.toUpperCase() === details.couponCode.toUpperCase() && !c.isUsed && !matched;
                      if (matchesId || matchesCode) {
                          matched = true;
                          return { ...c, isUsed: true };
                      }
                      return c;
                  });
              }

              const updatedCustomerProfile = {
                  ...targetCustomerProfile,
                  loyaltyPoints: newPoints,
                  orderHistory: newHistory,
                  savedAddresses: newSavedAddresses,
                  coupons: updatedCoupons
              };

              // Persist profile
              if (isCurrentLoggedIn) {
                  await setCustomer(updatedCustomerProfile);
              } else {
                  // Save offline list
                  try {
                      const saved = localStorage.getItem('damac_mock_customers');
                      let list = saved ? JSON.parse(saved) : [];
                      list = list.filter((c: any) => c.phone !== targetPhone);
                      list.push(updatedCustomerProfile);
                      localStorage.setItem('damac_mock_customers', JSON.stringify(list));
                  } catch(e) {}

                  // Save to Supabase
                  if (isSupabaseConfigured) {
                      try {
                          await supabase.from('customers').update({
                              loyalty_points: updatedCustomerProfile.loyaltyPoints,
                              order_history: updatedCustomerProfile.orderHistory,
                              saved_addresses: updatedCustomerProfile.savedAddresses,
                              coupons: updatedCustomerProfile.coupons
                          }).eq('phone', targetPhone);
                      } catch(e) {}
                  }
              }
          }
      }
      
      // Clear Cart if online/delivery or if specifically requested (Store orders might keep cart for next? No, clear it)
      clearCart();
      return true;
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
      if (isSupabaseConfigured) {
          await supabase.from('orders').update({ status }).eq('id', orderId);
      }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
  };

  const updateOrderTypeToPickup = async (orderId: string) => {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;
      
      const currentDeliveryFee = order.deliveryFee === 'pending' ? 0 : (order.deliveryFee || 0);
      const subtotal = order.totalAmount - currentDeliveryFee;
      const newNet = subtotal * (1 - (GP_RATES[order.source] || 0));

      if (isSupabaseConfigured) {
          await supabase.from('orders').update({ 
              type: 'pickup', 
              delivery_fee: 0,
              total_amount: subtotal,
              net_amount: newNet
          }).eq('id', orderId);
      }
      
      setOrders(prev => prev.map(o => o.id === orderId ? { 
          ...o, 
          type: 'pickup', 
          deliveryFee: 0,
          totalAmount: subtotal,
          netAmount: newNet
      } : o));
  };
  
  const updateOrderDeliveryFee = async (orderId: string, fee: number) => {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;
      
      const currentDeliveryFee = order.deliveryFee === 'pending' ? 0 : (order.deliveryFee || 0);
      const subtotal = order.totalAmount - currentDeliveryFee;
      const newTotal = subtotal + fee;
      const newNet = newTotal * (1 - (GP_RATES[order.source] || 0));
      
      if (isSupabaseConfigured) {
          await supabase.from('orders').update({ 
              delivery_fee: fee,
              total_amount: newTotal,
              net_amount: newNet
          }).eq('id', orderId);
      }
      setOrders(prev => prev.map(o => o.id === orderId ? { 
          ...o, 
          deliveryFee: fee,
          totalAmount: newTotal,
          netAmount: newNet
      } : o));
  };
  
  const updateOrderNetAmount = async (orderId: string, netAmount: number) => {
      if (isSupabaseConfigured) {
          await supabase.from('orders').update({ 
              net_amount: netAmount
          }).eq('id', orderId);
      }
      setOrders(prev => prev.map(o => o.id === orderId ? { 
          ...o, 
          netAmount: netAmount
      } : o));
  };
  
  const completeOrder = async (orderId: string, paymentDetails: { paymentMethod: PaymentMethod, note?: string }) => {
      if (isSupabaseConfigured) {
          await supabase.from('orders').update({ 
              status: 'completed', 
              payment_method: paymentDetails.paymentMethod,
              note: paymentDetails.note // Append or overwrite? Overwrite for now or handle logic
          }).eq('id', orderId);
      }
      setOrders(prev => prev.map(o => o.id === orderId ? { 
          ...o, 
          status: 'completed', 
          paymentMethod: paymentDetails.paymentMethod,
          note: paymentDetails.note ? (o.note ? o.note + '. ' + paymentDetails.note : paymentDetails.note) : o.note
      } : o));
  };

  const deleteOrder = async (orderId: string) => {
      if (isSupabaseConfigured) {
          await supabase.from('orders').delete().eq('id', orderId);
      }
      setOrders(prev => prev.filter(o => o.id !== orderId));
  };

  const updateOrderFields = async (orderId: string, fields: Partial<Order>) => {
      const existingOrder = orders.find(o => o.id === orderId);
      const mergedOrder = existingOrder ? { ...existingOrder, ...fields } : fields;

      if (isSupabaseConfigured) {
          const payload: any = {};
          if (fields.customerName !== undefined) payload.customer_name = fields.customerName;
          if (fields.customerPhone !== undefined) payload.customer_phone = fields.customerPhone;
          if (fields.type !== undefined) payload.type = fields.type;
          if (fields.source !== undefined) payload.source = fields.source;
          if (fields.status !== undefined) payload.status = fields.status;
          if (fields.items !== undefined) payload.items = fields.items;
          if (fields.totalAmount !== undefined) payload.total_amount = fields.totalAmount;
          if (fields.netAmount !== undefined) payload.net_amount = fields.netAmount;
          if (fields.createdAt !== undefined) payload.created_at = fields.createdAt;
          if (fields.note !== undefined) payload.note = fields.note;
          if (fields.deliveryAddress !== undefined) payload.delivery_address = fields.deliveryAddress;
          
          // Construct JSON to put into delivery_zone
          const lalaData: any = {};
          if (mergedOrder.deliveryZone !== undefined && !String(mergedOrder.deliveryZone).trim().startsWith('{')) {
              lalaData.deliveryZone = mergedOrder.deliveryZone;
          } else if (existingOrder && existingOrder.deliveryZone && !String(existingOrder.deliveryZone).trim().startsWith('{')) {
              lalaData.deliveryZone = existingOrder.deliveryZone;
          } else if (existingOrder && existingOrder.deliveryZone && String(existingOrder.deliveryZone).trim().startsWith('{')) {
              try {
                  const parsed = JSON.parse(existingOrder.deliveryZone);
                  if (parsed.deliveryZone) lalaData.deliveryZone = parsed.deliveryZone;
              } catch (e) {}
          }

          if (mergedOrder.lalamoveStatus !== undefined) lalaData.lalamoveStatus = mergedOrder.lalamoveStatus;
          if (mergedOrder.lalamoveTrackingId !== undefined) lalaData.lalamoveTrackingId = mergedOrder.lalamoveTrackingId;
          if (mergedOrder.lalamoveRiderName !== undefined) lalaData.lalamoveRiderName = mergedOrder.lalamoveRiderName;
          if (mergedOrder.lalamoveRiderPhone !== undefined) lalaData.lalamoveRiderPhone = mergedOrder.lalamoveRiderPhone;
          if (mergedOrder.lalamoveVehicleType !== undefined) lalaData.lalamoveVehicleType = mergedOrder.lalamoveVehicleType;
          if (mergedOrder.deliveryLat !== undefined) lalaData.deliveryLat = mergedOrder.deliveryLat;
          if (mergedOrder.deliveryLng !== undefined) lalaData.deliveryLng = mergedOrder.deliveryLng;

          if (Object.keys(lalaData).length > 0) {
              payload.delivery_zone = JSON.stringify(lalaData);
          } else if (fields.deliveryZone !== undefined) {
              payload.delivery_zone = fields.deliveryZone;
          }

          if (fields.deliveryFee !== undefined) {
              const currentFee = existingOrder && existingOrder.deliveryFee !== 'pending' ? (existingOrder.deliveryFee || 0) : 0;
              const subtotal = existingOrder ? (existingOrder.totalAmount - currentFee) : 0;
              const newFee = fields.deliveryFee === 'pending' ? 0 : (fields.deliveryFee || 0);
              const newTotal = subtotal + newFee;
              const newNet = newTotal * (1 - (GP_RATES[existingOrder?.source || 'store'] || 0));

              payload.delivery_fee = fields.deliveryFee === 'pending' ? null : fields.deliveryFee;
              payload.total_amount = newTotal;
              payload.net_amount = newNet;

              fields.totalAmount = newTotal;
              fields.netAmount = newNet;
          }
          if (fields.paymentMethod !== undefined) payload.payment_method = fields.paymentMethod;
          if (fields.pickupTime !== undefined) payload.pickup_time = fields.pickupTime;
          if (fields.tableNumber !== undefined) payload.table_number = fields.tableNumber;
          if (fields.rating !== undefined) payload.rating = fields.rating;
          if (fields.comment !== undefined) payload.comment = fields.comment;

          try {
              const { error } = await supabase.from('orders').update(payload).eq('id', orderId);
              if (error) console.error("Supabase order update error:", error);
          } catch(e) {
              console.error("Failed to update order in Supabase:", e);
          }
      }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, ...fields } : o));
  };

  const reorderItem = (orderId: string) => {
      const order = orders.find(o => o.id === orderId);
      if (order) {
          order.items.forEach(item => {
               addToCart({ ...item, id: Date.now() + Math.random().toString() });
          });
      }
  };

  const submitOrderFeedback = async (orderId: string, rating: number, comment: string) => {
      if (isSupabaseConfigured) {
          try {
              const { error } = await supabase.from('orders').update({ rating, comment }).eq('id', orderId);
              if (error) console.error("Error updating order feedback", error);
          } catch (e) {
              console.error("Supabase feedback update failed", e);
          }
      }
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, rating, comment } : o));
  };

  // Expenses
  const addExpense = async (expense: Expense) => {
      if (isSupabaseConfigured) {
          try {
              const payload = {
                  id: expense.id, 
                  description: expense.description, 
                  amount: expense.amount, 
                  category: expense.category, 
                  date: expense.date, 
                  note: expense.note,
                  quantity: expense.quantity,
                  unit: expense.unit,
                  unit_price: expense.unitPrice,
                  vendor: expense.vendor,
                  bill_number: expense.billNumber
              };
              let { error } = await supabase.from('expenses').insert([payload]);
              if (error) {
                  console.warn("Retrying insert with basic fields in case table lacks custom columns.");
                  await supabase.from('expenses').insert([{
                      id: expense.id, description: expense.description, amount: expense.amount, 
                      category: expense.category, date: expense.date, note: expense.note
                  }]);
              }
          } catch(e) { console.error(e); }
      }
      setExpenses(prev => [...prev, expense]);
  };
  const deleteExpense = async (id: string) => {
      if (isSupabaseConfigured) {
           await supabase.from('expenses').delete().eq('id', id);
      }
      setExpenses(prev => prev.filter(e => e.id !== id));
  };

  // Store Settings
  const toggleStoreStatus = async (isOpen: boolean, message?: string) => {
      const updates: any = { is_open: isOpen };
      if (message !== undefined) updates.closed_message = message;
      
      if (isSupabaseConfigured) {
          await supabase.from('store_settings').update(updates).eq('id', 1); // Assuming single row ID 1
      }
      setStoreSettings(prev => ({ ...prev, isOpen, closedMessage: message || prev.closedMessage }));
  };

  const updateStoreSettings = async (settings: Partial<StoreSettings>) => {
      if (isSupabaseConfigured) {
          // Map camelCase to snake_case for DB
          const payload: any = {};
          if (settings.isOpen !== undefined) payload.is_open = settings.isOpen;
          if (settings.closedMessage !== undefined) payload.closed_message = settings.closedMessage;
          if (settings.promoBannerUrl !== undefined) payload.promo_banner_url = settings.promoBannerUrl;
          if (settings.promoContentType !== undefined) payload.promo_content_type = settings.promoContentType;
          if (settings.reviewLinks !== undefined) payload.review_links = settings.reviewLinks;
          if (settings.vibeLinks !== undefined) payload.vibe_links = settings.vibeLinks;
          if (settings.eventGalleryUrls !== undefined) payload.event_gallery_urls = settings.eventGalleryUrls;
          if (settings.holidayStart !== undefined) payload.holiday_start = settings.holidayStart;
          if (settings.holidayEnd !== undefined) payload.holiday_end = settings.holidayEnd;
          if (settings.reviewUrl !== undefined) payload.review_url = settings.reviewUrl;
          if (settings.facebookUrl !== undefined) payload.facebook_url = settings.facebookUrl;
          if (settings.lineUrl !== undefined) payload.line_url = settings.lineUrl;
          if (settings.mapUrl !== undefined) payload.map_url = settings.mapUrl;
          if (settings.contactPhone !== undefined) payload.contact_phone = settings.contactPhone;
          if (settings.promptPayNumber !== undefined) payload.prompt_pay_number = settings.promptPayNumber;
          if (settings.partners !== undefined) payload.partners = settings.partners;
          
          if (settings.storeLocationGps !== undefined) payload.store_location_gps = settings.storeLocationGps;
          if (settings.freeDeliveryRadiusKm !== undefined) payload.free_delivery_radius_km = settings.freeDeliveryRadiusKm;
          if (settings.deliveryFeePerKm !== undefined) payload.delivery_fee_per_km = settings.deliveryFeePerKm;
          if (settings.baseDeliveryFee !== undefined) payload.base_delivery_fee = settings.baseDeliveryFee;

          if (Object.keys(payload).length > 0) {
             const { error } = await supabase.from('store_settings').update(payload).eq('id', 1);
             if (error) {
                 await supabase.from('store_settings').insert([{ id: 1, ...payload }]);
             }
          }
      }
      setStoreSettings(prev => ({ ...prev, ...settings }));
  };
  
  const generateTimeSlots = (dateOffset: number = 0) => {
      const slots: string[] = [];
      const startHour = OPERATING_HOURS.open;
      const endHour = OPERATING_HOURS.close;
      const now = new Date();
      
      // If today, start from current time + 30 mins
      let current = startHour;
      
      // Loop in 30 min increments
      while (current < endHour) {
          const hour = Math.floor(current);
          const minute = (current % 1) * 60;
          
          if (dateOffset === 0) {
              // For Today: Filter past times
              const slotTime = new Date();
              slotTime.setHours(hour, minute, 0, 0);
              const bufferTime = new Date(now.getTime() + 30 * 60000); // +30 mins prep time
              
              if (slotTime > bufferTime) {
                  slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
              }
          } else {
              // Future dates
              slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
          }
          current += 0.5;
      }
      return slots;
  };
  
  const addNewsItem = async (item: NewsItem) => {
       const updatedNews = [item, ...(storeSettings.newsItems || [])];
       if (isSupabaseConfigured) {
           await supabase.from('store_settings').update({ news_items: updatedNews }).eq('id', 1);
       }
       setStoreSettings(prev => ({ ...prev, newsItems: updatedNews }));
  };
  
  const deleteNewsItem = async (id: string) => {
      const updatedNews = (storeSettings.newsItems || []).filter(n => n.id !== id);
      if (isSupabaseConfigured) {
          await supabase.from('store_settings').update({ news_items: updatedNews }).eq('id', 1);
      }
      setStoreSettings(prev => ({ ...prev, newsItems: updatedNews }));
  };

  const reorderMenu = (sortedIds: string[]) => {
      setMenu(prev => {
          const sorted = [...prev];
          sorted.sort((a, b) => {
              let indexA = sortedIds.indexOf(a.id);
              let indexB = sortedIds.indexOf(b.id);
              if (indexA === -1) indexA = 9999;
              if (indexB === -1) indexB = 9999;
              return indexA - indexB;
          });
          return sorted;
      });
  };

  const value = {
      language, toggleLanguage, t, getLocalizedItem,
      currentView, trackingOrderId, navigateTo,
      isAdminLoggedIn, adminLogin, adminLogout,
      shopLogo, updateShopLogo,
      menu, addPizza, updatePizza, deletePizza, updatePizzaPrice, togglePizzaAvailability, toggleBestSeller, generateLuckyPizza, seedDatabase, reorderMenu,
      toppings, addTopping, updateTopping, deleteTopping,
      cart, addToCart, removeFromCart, updateCartItemQuantity, updateCartItem, clearCart, cartTotal,
      customer, setCustomer, registerCustomer, customerLogin, getAllCustomers, adminUpdateCustomerCoupons, addToFavorites, claimReward,
      orders, placeOrder, updateOrderStatus, updateOrderTypeToPickup, updateOrderDeliveryFee, updateOrderNetAmount, completeOrder, deleteOrder, updateOrderFields, reorderItem, fetchOrders, submitOrderFeedback,
      expenses, addExpense, deleteExpense,
      isStoreOpen, isHoliday, closedMessage: storeSettings.closedMessage, storeSettings, toggleStoreStatus, updateStoreSettings, generateTimeSlots, canOrderForToday,
      addNewsItem, deleteNewsItem,
      tableSession,
      partnerSession,
      setPartnerSession,
      paperSize, setPaperSize,
      printerIpAddress, setPrinterIpAddress,
      printerPort, setPrinterPort,
      printerType, setPrinterType,
      receiptFontSize, setReceiptFontSize,
      receiptPadding, setReceiptPadding,
      autoPrintNewOrders, setAutoPrintNewOrders,
      vatEnabled, setVatEnabled,
      partners, addPartner, updatePartner, deletePartner,
      promoCodes, addPromoCode, updatePromoCode, deletePromoCode,
      btDevice, setBtDevice,
      btCharacteristic, setBtCharacteristic,
      btStatus, setBtStatus,
      connectBluetoothPrinter, disconnectBluetoothPrinter, resetBluetoothConnection,
      triggerReceiptPrint, triggerKitchenPrint,
      generateEscPosData, generateKitchenEscPosData,
      writeBtInChunks,
      thaiCodePage, setThaiCodePage
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (context === undefined) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};
