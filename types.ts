

export interface Topping {
  id: string;
  name: string;
  nameTh?: string; // Thai Name
  price: number;
  category?: 'sauce' | 'cheese' | 'meat' | 'vegetable' | 'seasoning' | 'other';
  image?: string; // New: Topping Image
  available?: boolean; // New: Stock status
}

export type ProductCategory = 'pizza' | 'pasta' | 'appetizer' | 'salad' | 'drink' | 'promotion' | 'cake' | 'rice';

export interface Pizza {
  id: string;
  name: string;
  nameTh?: string; // Thai Name
  basePrice: number;
  description: string;
  descriptionTh?: string; // Thai Description
  image: string;
  available: boolean;
  category: ProductCategory;
  isBestSeller?: boolean;
  comboCount?: number; // New: How many pizzas allowed in this combo
  allowedPromotions?: string[]; // IDs of promotions this item can be added to. If empty/undefined, allowed in all.
  badge?: string; // Promo badge (e.g., 'New', 'Promo')
  badgeTh?: string; // Thai Promo badge (e.g., 'เมนูใหม่', 'เมนูประจำเดือน')
  rawCost?: number; // Raw ingredient cost (ต้นทุนวัตถุดิบ)
  grabPrice?: number; // Price on Grab platform
  linemanPrice?: number; // Price on LineMan platform
}

export interface SubItem {
    pizzaId: string;
    name: string;
    nameTh?: string;
    toppings: Topping[];
}

export interface CartItem {
  id: string;
  pizzaId: string;
  name: string;
  nameTh?: string; // Store localized name in cart
  basePrice: number;
  selectedToppings: Topping[];
  quantity: number;
  totalPrice: number;
  subItems?: SubItem[]; // New: Stores choices for combos
  specialInstructions?: string; // New: User comments (e.g. "No Spicy")
}

export interface DeliveryZone {
  id: string;
  name: string;
  nameTh?: string;
  fee: number;
}

export interface SavedFavorite {
  id: string;
  name: string;
  pizzaId: string;
  toppings: Topping[];
}

export interface CustomerProfile {
  name: string;
  phone: string;
  password?: string; // New: Password for login
  favoritePizza?: string;
  address?: string; // Current default address
  savedAddresses?: string[]; // New: History of addresses
  birthday?: string;
  loyaltyPoints: number; // 1 point per pizza ordered
  tier?: 'Bronze' | 'Silver' | 'Gold';
  savedFavorites: SavedFavorite[];
  orderHistory: string[]; // List of Order IDs
  pdpaAccepted?: boolean; // New: PDPA Consent
  coupons?: Coupon[]; // Member coupons / vouchers
}

export type OrderType = 'dine-in' | 'online' | 'delivery';
export type OrderSource = 'store' | 'grab' | 'lineman' | 'robinhood' | 'foodpanda' | 'shopeefood' | 'other';
export type OrderStatus = 'pending' | 'confirmed' | 'acknowledged' | 'cooking' | 'ready' | 'completed' | 'cancelled';
export type PaymentMethod = 'cash' | 'qr_transfer' | 'thai_chuay_thai';
export type AppView = 'customer' | 'kitchen' | 'pos' | 'track';
export type Language = 'en' | 'th';

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  type: OrderType;
  source: OrderSource; // Where did the order come from?
  status: OrderStatus;
  items: CartItem[];
  totalAmount: number; // Gross amount
  netAmount: number; // Amount after GP deduction
  createdAt: string;
  note?: string;
  
  // Delivery Specific
  deliveryAddress?: string;
  deliveryZone?: string;
  deliveryFee?: number | 'pending';
  delivery_type?: 'pickup' | 'delivery';
  dropoff_lat?: number;
  dropoff_lng?: number;
  lalamove_quotation_id?: string;
  lalamove_order_id?: string;
  lalamove_share_link?: string;
  delivery_vehicle?: 'motorcycle' | 'car' | 'pickup';
  delivery_status?: string; // 'pending','assigning','ongoing','picked_up','completed','canceled'
  driver_name?: string;
  driver_phone?: string;
  driver_plate?: string;

  // New Features
  tableNumber?: string;
  paymentMethod?: PaymentMethod;
  pickupTime?: string;
  scheduledAt?: string; // ISO timestamp of pre-order delivery/pickup time (machine-readable)
  deliveryPlatformRef?: string;
  rating?: number;
  comment?: string;

  // Partner Cafe QR parameters
  partnerId?: string;
  partnerCommissionAmount?: number;

  // Discount & Promo code
  promoCode?: string;
  discountAmount?: number;
  couponCode?: string;
  couponDiscountAmount?: number;

  // Recipe costing snapshot (stamped when stock is auto-deducted at "เริ่มทำ")
  cogsAmount?: number;
  stockDeducted?: boolean;

  // Lalamove & Maps Integration
  deliveryLat?: number;
  deliveryLng?: number;
  lalamoveStatus?: 'none' | 'quoting' | 'assigned' | 'picking_up' | 'in_transit' | 'completed' | 'cancelled';
  lalamoveTrackingId?: string;
  lalamoveRiderName?: string;
  lalamoveRiderPhone?: string;
  lalamoveVehicleType?: string;
}

export type CouponDiscountType = 'percentage_most_expensive' | 'fixed_discount' | 'free_delivery' | 'percentage_total' | 'fixed_per_pizza';

export interface Coupon {
  id: string;
  code: string;
  title: string;
  titleTh: string;
  description: string;
  descriptionTh: string;
  discountType: CouponDiscountType;
  discountValue: number; // e.g. 10 for 10% off most expensive pizza, or 50 for ฿50 off
  minOrderAmount?: number;
  applicableOrderTypes?: OrderType[]; // e.g. ['delivery', 'dine-in', 'online']
  requiresPreorder?: boolean; // true = only valid on scheduled (pre-order) orders, not ASAP
  isUsed?: boolean;
  expiryDate?: string; // ISO date format
  badge?: string; // e.g. "สมาชิคใหม่" or "New Member", "Monthly"
  badgeTh?: string;
}

export type PromoDiscountType = 'percentage' | 'fixed_order' | 'fixed_delivery';

export interface PromoCode {
  id: string;
  code: string; // e.g. "BOI3", "FREE50"
  discountType: PromoDiscountType;
  discountValue: number; // percentage value or baht value
  minOrderAmount: number; // 0 if no minimum
  isActive: boolean;
  description?: string;
  descriptionTh?: string;
  maxUsesPerDay?: number;
  currentUses?: number;
  lastUseDate?: string;
  createdAt: string;
}

export interface Partner {
  id: string;
  name: string;
  nameTh?: string;
  commissionPercent: number; // e.g. 10 for 10%
  createdAt: string;
  note?: string;
}

// --- Promotion Campaigns (DB-configurable coupon rules; editable from POS promo board) ---
export type PromoCampaignKind = 'welcome' | 'birthday' | 'pickup_monthly';

export interface CampaignCouponConfig {
  id: string;
  enabled?: boolean;
  code: string;
  title: string;
  titleTh: string;
  description: string;
  descriptionTh: string;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderAmount?: number;
  applicableOrderTypes?: OrderType[];
  requiresPreorder?: boolean;
  badge?: string;
  badgeTh?: string;
}

export interface PromoCampaign {
  id: string;
  kind: PromoCampaignKind;
  enabled: boolean;
  sortOrder: number;
  // birthday/pickup_monthly: CampaignCouponConfig fields (+ perMonth for pickup)
  // welcome: { coupons: CampaignCouponConfig[] }
  config: any;
  staffNoteTh?: string;
  updatedAt?: string;
}

// --- Supplier + Stock system (manual counts, v1) ---
export interface Supplier {
  id: string;
  name: string;
  phone?: string;
  lineId?: string;
  contactPerson?: string;
  categories?: string; // what they sell (free text)
  note?: string;
  active?: boolean;
  createdAt?: string;
}

export type StockCategory = 'dough' | 'cheese' | 'sauce' | 'meat' | 'vegetable' | 'packaging' | 'drink' | 'other';

export interface StockItem {
  id: string;
  name: string;
  unit: string; // กก., ถุง, กล่อง, ใบ, ขวด ...
  category: StockCategory | string;
  minLevel: number; // alert threshold
  currentQty: number;
  costPerUnit?: number; // latest known purchase cost
  supplierId?: string;
  sortOrder?: number;
  active?: boolean;
  updatedAt?: string;
}

export type StockMovementType = 'count' | 'receive' | 'adjust' | 'waste' | 'sale';

export interface StockMovement {
  id: string;
  itemId: string;
  type: StockMovementType;
  session?: 'morning' | 'evening' | string; // for counts
  qty: number; // count: counted value / receive: +qty / waste,adjust: delta / sale: -qty
  qtyBefore?: number;
  qtyAfter?: number;
  unitCost?: number;
  totalCost?: number;
  supplierId?: string;
  supplierName?: string;
  expenseId?: string; // linked expense row when a receive was logged into expenses
  note?: string;
  createdBy?: string;
  createdAt?: string;
}

// --- Recipe costing (สูตร + ต้นทุนต่อเมนู จาก Pizza Damac Cost.xlsx) ---
export interface RecipeLine {
  stockItemId?: string; // linked to stock → cost = qty × stock.costPerUnit + auto-deducts on cooking
  name: string;
  qty: number;
  unit: string;
  fixedCost?: number; // non-stock line: fixed baht per tray (rarely used)
}

export interface MenuRecipe {
  menuItemId: string;
  lines: RecipeLine[];
  note?: string;
  updatedAt?: string;
}

export interface CostOverheadLine {
  name: string;
  amount: number; // baht per MONTH (fixed costs: ค่าแรง ค่าเช่า ค่าไฟ — used for breakeven, NOT per-tray)
}

export interface CostSettings {
  overheadLines: CostOverheadLine[]; // monthly fixed costs
  workingDays?: number; // เปิดกี่วัน/เดือน (default 30) — ใช้คิดค่าคงที่ต่อวัน + จุดคุ้มทุน
}

// Accounting
export type ExpenseCategory = 'COGS' | 'Labor' | 'Rent' | 'Utilities' | 'Marketing' | 'Maintenance' | 'Other';

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
  note?: string;
  quantity?: number;     // จำนวน
  unit?: string;         // หน่วย (เช่น กิโลกรัม, แพ็ค, กล่อง, ชิ้น)
  unitPrice?: number;    // ราคาต่อหน่วย
  vendor?: string;       // ร้านค้า/ซัพพลายเออร์
  billNumber?: string;   // เลขที่บิล
}

export interface NewsItem {
    id: string;
    title: string;
    summary: string;
    imageUrl: string;
    linkUrl?: string;
    date: string;
}

export interface StoreSettings {
  isOpen: boolean;
  closedMessage: string;
  // Promo / Marketing
  promoBannerUrl?: string; // URL for image or video
  promoContentType?: 'image' | 'video';
  // Holiday
  holidayStart?: string; // ISO Date
  holidayEnd?: string; // ISO Date
  // Contact & Links (Editable)
  reviewUrl?: string; // Main Google Review URL
  facebookUrl?: string;
  lineUrl?: string;
  mapUrl?: string;
  contactPhone?: string;
  
  // Payment
  promptPayNumber?: string; // New: Mobile or Tax ID

  // Delivery 
  storeLocationGps?: string;
  freeDeliveryRadiusKm?: number;
  deliveryFeePerKm?: number;
  baseDeliveryFee?: number;

  // Media Lists
  reviewLinks?: string[]; // Up to 5
  vibeLinks?: string[]; // Up to 5
  eventGalleryUrls?: string[]; // New: Catering Images
  
  newsItems?: NewsItem[];
  partners?: Partner[];
}

export function parseAnyMapLink(text?: string): { lat: number, lng: number } | null {
  if (!text) return null;
  
  // Hardcoded for the specific Pizza Damac short link
  if (text.includes('AipUucBBovnz24gR8')) {
      return { lat: 13.9239103, lng: 100.5220632 };
  }

  // Google Maps URL with 3d...4d, query=, q=, @, ll=, cbll=, or path place/dir/search
  const urlMatch = text.match(/3d(-?\d+(?:\.\d+)?).*?4d(-?\d+(?:\.\d+)?)/) || 
                   text.match(/\/place\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ||
                   text.match(/\/dir\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ||
                   text.match(/\/search\/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ||
                   text.match(/[?&]query=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ||
                   text.match(/[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ||
                   text.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ||
                   text.match(/[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/) ||
                   text.match(/[?&]cbll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (urlMatch) {
      return { lat: parseFloat(urlMatch[1]), lng: parseFloat(urlMatch[2]) };
  }

  // Look for any raw "lat,lng" string (e.g. 13.9239103, 100.5220632)
  // Use a refined heuristic requiring at least 3 decimal places to prevent clashing with street names or house numbers
  const coordMatch = text.match(/(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
  if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          return { lat, lng };
      }
  }

  // Fallback to more permissive match ONLY if no other numbers exist, but protect common integer cases
  const looseMatch = text.match(/(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (looseMatch) {
      const lat = parseFloat(looseMatch[1]);
      const lng = parseFloat(looseMatch[2]);
      // Only treat as lat/lng if at least one of them has a decimal, to avoid plain integers
      if ((looseMatch[1].includes('.') || looseMatch[2].includes('.')) && 
          (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180)) {
          return { lat, lng };
      }
  }

  return null;
}

export function parseGPSCoordinates(address?: string) {
  if (!address) return null;
  const match = address.match(/\[(?:พิกัด GPS|GPS Pin):\s*([\d.-]+),\s*([\d.-]+)\]/);
  const linkMatch = address.match(/\[(?:Google Maps Link):\s*(https?:\/\/[^\s\]]+)\]/);
  
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    return {
      lat,
      lng,
      url: linkMatch ? linkMatch[1] : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
    };
  } else if (linkMatch) {
    const coords = parseAnyMapLink(linkMatch[1]);
    return {
      lat: coords ? coords.lat : 13.9239103, // Default to Pizza Damac if unresolvable shortlink
      lng: coords ? coords.lng : 100.5220632,
      url: linkMatch[1]
    };
  }

  // EXTRA RESILIENT FALLBACK: Try parsing coordinates directly from the raw address string
  const directCoords = parseAnyMapLink(address);
  if (directCoords) {
    return {
      lat: directCoords.lat,
      lng: directCoords.lng,
      url: address.includes('http') ? address : `https://www.google.com/maps/search/?api=1&query=${directCoords.lat},${directCoords.lng}`
    };
  }

  return null;
}

export function parseDeliveryPhone(address?: string) {
  if (!address) return null;
  const match = address.match(/\[(?:ติดต่อโทร|Phone):\s*([^\]]+)\]/);
  return match ? match[1] : null;
}

