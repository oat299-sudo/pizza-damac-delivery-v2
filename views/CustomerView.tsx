
import React, { useState, useEffect, useMemo } from 'react';
import { useStore } from '../context/StoreContext';
import { Pizza, CartItem, Topping, PaymentMethod, ProductCategory, SubItem, OrderStatus, SavedFavorite, parseAnyMapLink, Coupon } from '../types';
import { INITIAL_TOPPINGS, CATEGORIES, RESTAURANT_LOCATION, DEFAULT_STORE_SETTINGS } from '../constants';
import { ShoppingCart, Plus, Minus, Trash2, X, User, ChefHat, Sparkles, MapPin, Truck, Clock, Banknote, QrCode, ShoppingBag, Star, ExternalLink, Heart, History, Gift, ArrowRight, ArrowLeft, Dices, Navigation, Globe, AlertTriangle, CalendarDays, PlayCircle, Info, ChevronRight, Check, Lock, CheckCircle2, Droplets, Utensils, Carrot, Youtube, Newspaper, Activity, Facebook, Phone, MessageCircle, RotateCw, Layers, ChevronUp, RefreshCw, Download } from 'lucide-react';
import { calculateDistanceKm, reverseGeocode } from '../utils/geo';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { generatePromptPayPayload } from '../utils/promptpay';
import DeliveryMap from '../src/components/DeliveryMap';
import { getLalamoveQuote, fetchRealLalamoveQuote } from '../services/lalamoveService';

// ... (VideoCard Component remains unchanged) ...
const VideoCard: React.FC<{ url: string; key?: string }> = ({ url }) => {
    if (!url) return null;
    
    let embedSrc = '';
    let isIframe = false;
    let label = 'Watch Video';
    let icon = <PlayCircle size={48} className="mb-2 group-hover:scale-110 transition"/>;
    let bgColor = 'bg-gray-900';
    let textColor = 'text-white';
    
    // YouTube Detection
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
        let videoId = '';
        if (url.includes('v=')) {
            videoId = url.split('v=')[1]?.split('&')[0];
        } else if (url.includes('youtu.be')) {
            videoId = url.split('/').pop()?.split('?')[0] || '';
        } else if (url.includes('/shorts/')) {
            videoId = url.split('/shorts/')[1]?.split('?')[0] || '';
        }
        if (videoId) {
            // Add autoplay=1, mute=1 (required for autoplay), loop=1
            embedSrc = `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}`;
            isIframe = true;
        }
    } 
    // Facebook Detection
    else if (url.includes('facebook.com')) {
        // FB Embed Plugin
        embedSrc = `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=0&width=560`;
        isIframe = true;
        label = "Watch on Facebook";
    }
    // TikTok Detection
    else if (url.includes('tiktok.com')) {
            // TikTok requires complex oEmbed or specific SDK. Fallback to external link card.
            label = "Watch on TikTok";
            bgColor = "bg-black";
            // Simulate TikTok vibe
            icon = (
                <div className="mb-2 group-hover:scale-110 transition flex gap-1">
                    <div className="w-8 h-8 rounded-full bg-[#00f2ea] mix-blend-screen animate-pulse"></div>
                    <div className="w-8 h-8 rounded-full bg-[#ff0050] mix-blend-screen -ml-4 animate-pulse"></div>
                </div>
            );
    }
    // Lemon8 Detection
    else if (url.includes('lemon8-app.com')) {
        label = "View on Lemon8";
        bgColor = "bg-yellow-400";
        textColor = "text-gray-900";
        icon = <div className="text-2xl font-bold mb-2 group-hover:scale-110 transition">L8</div>;
    }
    else {
            // Generic Link
            label = "View Link";
    }

    if (isIframe) {
        return (
            <div className="rounded-xl overflow-hidden shadow-lg bg-black aspect-video relative group w-72 md:w-96 flex-shrink-0 snap-start">
                <iframe 
                    src={embedSrc} 
                    className="w-full h-full" 
                    title="Video player" 
                    frameBorder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                    allowFullScreen
                ></iframe>
            </div>
        );
    }

    return (
        <a href={url} target="_blank" rel="noopener noreferrer" className={`rounded-xl overflow-hidden shadow-lg ${bgColor} aspect-video relative group w-72 md:w-96 flex-shrink-0 snap-start flex items-center justify-center`}>
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-50 group-hover:opacity-70 transition"></div>
            <div className={`relative z-10 flex flex-col items-center ${textColor}`}>
                {icon}
                <span className="font-bold">{label}</span>
                <div className="flex items-center gap-1 text-xs mt-1 opacity-80"><ExternalLink size={12}/> Opens in new tab</div>
            </div>
        </a>
    );
};

export const CustomerView: React.FC = () => {
  const { 
    menu, addToCart, cart, cartTotal, customer, setCustomer, registerCustomer, customerLogin, placeOrder, removeFromCart, updateCartItemQuantity, navigateTo, 
    addToFavorites, orders, reorderItem, claimReward, shopLogo, generateLuckyPizza, submitOrderFeedback, updateOrderTypeToPickup,
    language, toggleLanguage, t, getLocalizedItem,
    isStoreOpen, isHoliday, closedMessage, generateTimeSlots, storeSettings, canOrderForToday,
    toppings, fetchOrders, tableSession, partnerSession, setPartnerSession, partners,
    promoCodes
  } = useStore();
  
  // Promo Code States
  const [promoCodeInput, setPromoCodeInput] = useState('');
  const [appliedPromoCode, setAppliedPromoCode] = useState<any | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [promoError, setPromoError] = useState('');

  const storeCoords = useMemo(() => {
    return parseAnyMapLink(storeSettings.storeLocationGps || "13.9239103,100.5220632") || { lat: 13.9239103, lng: 100.5220632 };
  }, [storeSettings.storeLocationGps]);

  const handleApplyPromoCode = () => {
      setPromoError('');
      if (!promoCodeInput.trim()) {
          setPromoError(language === 'th' ? 'กรุณาใส่รหัสส่วนลด' : 'Please enter a promo code');
          return;
      }
      
      const found = promoCodes.find(p => p.code.toUpperCase() === promoCodeInput.trim().toUpperCase());
      if (!found) {
          setPromoError(language === 'th' ? 'ไม่พบรหัสส่วนลดนี้' : 'Promo code not found');
          setAppliedPromoCode(null);
          return;
      }
      
      if (!found.isActive) {
          setPromoError(language === 'th' ? 'รหัสส่วนลดนี้ไม่สามารถใช้งานได้แล้ว' : 'Promo code is inactive');
          setAppliedPromoCode(null);
          return;
      }
      
      const todayStr = new Date().toISOString().split('T')[0];
      if (found.maxUsesPerDay && found.maxUsesPerDay > 0) {
          const usesToday = found.lastUseDate === todayStr ? (found.currentUses || 0) : 0;
          if (usesToday >= found.maxUsesPerDay) {
              setPromoError(language === 'th' ? 'รหัสส่วนลดนี้ใช้ครบสิทธิ์ของวันนี้แล้ว' : 'This promo code has reached its daily limit');
              setAppliedPromoCode(null);
              return;
          }
      }
      
      if (cartTotal < found.minOrderAmount) {
          setPromoError(
              language === 'th' 
              ? `ยอดสั่งซื้อขั้นต่ำสำหรับรหัสนี้คือ ฿${found.minOrderAmount}` 
              : `Minimum order of ฿${found.minOrderAmount} required for this code`
          );
          setAppliedPromoCode(null);
          return;
      }
      
      setAppliedPromoCode(found);
      setPromoError('');
  };

  const handleRemovePromoCode = () => {
      setAppliedPromoCode(null);
      setPromoCodeInput('');
      setPromoError('');
  };

  useEffect(() => {
      if (cart.length === 0) {
          setAppliedPromoCode(null);
          setPromoCodeInput('');
      }
  }, [cart]);
  
  // Feedback Modal States
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackOrderId, setFeedbackOrderId] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);
  const [selectedPizza, setSelectedPizza] = useState<Pizza | null>(null);
  const [selectedToppings, setSelectedToppings] = useState<Topping[]>([]);
  
  // Half-Half customizer states
  const [halfA, setHalfA] = useState<Pizza | null>(null);
  const [halfB, setHalfB] = useState<Pizza | null>(null);

  // Boat customizer states
  const [boatA, setBoatA] = useState<Pizza | null>(null);
  const [boatB, setBoatB] = useState<Pizza | null>(null);
  const [boatPriceA, setBoatPriceA] = useState<number>(0);
  const [boatPriceB, setBoatPriceB] = useState<number>(0);

  useEffect(() => {
    if (selectedPizza?.id === 'p_half_half') {
        setHalfA(null);
        setHalfB(null);
    }
    if (selectedPizza?.id === 'p_boat') {
        setBoatA(null);
        setBoatB(null);
        setBoatPriceA(0);
        setBoatPriceB(0);
    }
  }, [selectedPizza]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [showProfile, setShowProfile] = useState(false);
  const [showLoginCouponsModal, setShowLoginCouponsModal] = useState(false);
  
  // Order History & Search States
  const [showOrderHistory, setShowOrderHistory] = useState(false);
  const [searchOrderId, setSearchOrderId] = useState('');
  const [orderHistoryError, setOrderHistoryError] = useState('');
  const [historyOrderIds, setHistoryOrderIds] = useState<string[]>(() => {
      try {
          const savedIds = localStorage.getItem('damac_history_order_ids');
          const lastId = localStorage.getItem('damac_last_order');
          const initial = savedIds ? JSON.parse(savedIds) : [];
          if (lastId && !initial.includes(lastId)) {
              initial.push(lastId);
          }
          return initial;
      } catch (e) {
          return [];
      }
  });

  const historyOrders = useMemo(() => {
      let list: any[] = [];
      if (customer) {
          list = orders.filter(o => o.customerPhone === customer.phone);
      }
      // Combine with locally tracked order IDs
      historyOrderIds.forEach(id => {
          const ord = orders.find(o => o.id === id);
          if (ord && !list.some(l => l.id === id)) {
              list.push(ord);
          }
      });
      return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [orders, customer, historyOrderIds]);

  const handleSearchOrder = (e: React.FormEvent) => {
      e.preventDefault();
      setOrderHistoryError('');
      if (!searchOrderId.trim()) return;
      
      const query = searchOrderId.trim().toLowerCase();
      const found = orders.find(o => 
          o.id.toLowerCase() === query || 
          (query.length >= 4 && o.id.toLowerCase().endsWith(query))
      );
      
      if (found) {
          setHistoryOrderIds(prev => {
              if (prev.includes(found.id)) return prev;
              const nextList = [found.id, ...prev];
              try {
                  localStorage.setItem('damac_history_order_ids', JSON.stringify(nextList));
              } catch (e) {}
              return nextList;
          });
          setSearchOrderId('');
      } else {
          setOrderHistoryError(t('orderNotFound' as any));
      }
  };

  const [showTracker, setShowTracker] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [activeCategory, setActiveCategory] = useState<ProductCategory>('promotion');
  const [regName, setRegName] = useState(customer?.name || '');
  const [regPhone, setRegPhone] = useState(customer?.phone || '');
  const [regPassword, setRegPassword] = useState('');
  const [regAddress, setRegAddress] = useState(customer?.address || '');
  const [regBirthday, setRegBirthday] = useState(customer?.birthday || '');
  const [regPdpa, setRegPdpa] = useState(customer?.pdpaAccepted || false);
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [orderType, setOrderType] = useState<'online' | 'delivery' | 'dine-in'>('online');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('qr_transfer');
  const [pickupTime, setPickupTime] = useState('');
  const [asapOrder, setAsapOrder] = useState(true);
  const [deliveryPhone, setDeliveryPhone] = useState(customer?.phone || '');
  const [deliveryLat, setDeliveryLat] = useState<number>(13.9239103);
  const [deliveryLng, setDeliveryLng] = useState<number>(100.5220632);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [mapSearch, setMapSearch] = useState('');
  const [hasMapPin, setHasMapPin] = useState(false);
  const [deliveryDistanceKm, setDeliveryDistanceKm] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);
  const [deliveryLocationName, setDeliveryLocationName] = useState<string>('');
  
  const calculatedDiscount = useMemo(() => {
      if (!appliedPromoCode) return 0;
      if (cartTotal < appliedPromoCode.minOrderAmount) return 0;
      
      if (appliedPromoCode.discountType === 'percentage') {
          return Math.round(cartTotal * (appliedPromoCode.discountValue / 100));
      } else if (appliedPromoCode.discountType === 'fixed_order') {
          return Math.min(cartTotal, appliedPromoCode.discountValue);
      } else if (appliedPromoCode.discountType === 'fixed_delivery') {
          if (orderType !== 'delivery') return 0;
          return appliedPromoCode.discountValue;
      }
      return 0;
  }, [appliedPromoCode, cartTotal, orderType]);

  const calculatedCouponDiscount = useMemo(() => {
      if (!appliedCoupon) return 0;
      if (cartTotal < (appliedCoupon.minOrderAmount || 0)) return 0;
      
      // Check order type applicability if specified
      if (appliedCoupon.applicableOrderTypes && appliedCoupon.applicableOrderTypes.length > 0) {
          const matched = appliedCoupon.applicableOrderTypes.includes(orderType);
          if (!matched) return 0;
      }
      
      if (appliedCoupon.discountType === 'percentage_most_expensive') {
          // Find the most expensive single pizza item
          let maxPizzaPrice = 0;
          cart.forEach(item => {
              const itemDef = menu.find(m => m.id === item.pizzaId);
              if (itemDef?.category === 'pizza' || itemDef?.category === 'promotion') {
                  const unitPrice = item.totalPrice / item.quantity;
                  if (unitPrice > maxPizzaPrice) {
                      maxPizzaPrice = unitPrice;
                  }
              }
          });
          return Math.round(maxPizzaPrice * ((appliedCoupon.discountValue || 0) / 100));
      } else if (appliedCoupon.discountType === 'fixed_discount') {
          return Math.min(cartTotal, appliedCoupon.discountValue || 0);
      } else if (appliedCoupon.discountType === 'free_delivery') {
          if (orderType !== 'delivery') return 0;
          return Math.min(deliveryFee || 0, appliedCoupon.discountValue || 0);
      } else if (appliedCoupon.discountType === 'percentage_total') {
          return Math.round(cartTotal * ((appliedCoupon.discountValue || 0) / 100));
      }
      return 0;
  }, [appliedCoupon, cartTotal, orderType, cart, menu, deliveryFee]);
  
  const [addressSaveType, setAddressSaveType] = useState<'home' | 'work' | 'none'>('none');
  const [savedProfiles, setSavedProfiles] = useState<{ [key: string]: { address: string, phone: string, mapSearch: string, lat: number, lng: number, hasPin: boolean } }>(() => {
      try {
          if (typeof window !== 'undefined') {
              return JSON.parse(localStorage.getItem('damac_delivery_profiles') || '{}');
          }
      } catch (e) {}
      return {};
  });

  const loadProfile = (type: 'home' | 'work') => {
      const p = savedProfiles[type];
      if (p) {
          setDeliveryAddress(p.address || '');
          setDeliveryPhone(p.phone || '');
          setMapSearch(p.mapSearch || '');
          if (p.hasPin) {
              setDeliveryLat(p.lat || 13.9239103);
              setDeliveryLng(p.lng || 100.5220632);
              setHasMapPin(true);
          }
      }
  };
  
  const [orderDate, setOrderDate] = useState<'today' | 'tomorrow'>(() => {
      if (isStoreOpen || canOrderForToday()) return 'today';
      return 'tomorrow';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customName, setCustomName] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [isComboBuilderOpen, setIsComboBuilderOpen] = useState(false);
  const [comboSelections, setComboSelections] = useState<SubItem[]>([]);
  const [currentComboSlot, setCurrentComboSlot] = useState<number | null>(null);
  const [localOrderId, setLocalOrderId] = useState(() => {
      if (typeof window !== 'undefined') return localStorage.getItem('damac_last_order');
      return null;
  });

  // Track previous order statuses to trigger real-time notifications
  const [prevStatuses, setPrevStatuses] = useState<Record<string, string>>(() => {
      const initial: Record<string, string> = {};
      orders.forEach(o => {
          initial[o.id] = o.status;
      });
      return initial;
  });

  const [activeNotification, setActiveNotification] = useState<{
      id: string;
      orderId: string;
      oldStatus: string;
      newStatus: string;
      timestamp: number;
  } | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrAmount, setQrAmount] = useState(0);

  const [lalamoveQuotationId, setLalamoveQuotationId] = useState<string | undefined>(undefined);

  useEffect(() => {
      let isMounted = true;
      if (hasMapPin && orderType === 'delivery') {
          const storeLat = storeCoords.lat;
          const storeLng = storeCoords.lng;
          
          if (!isNaN(storeLat) && !isNaN(storeLng)) {
              const d = calculateDistanceKm(storeLat, storeLng, deliveryLat, deliveryLng);
              setDeliveryDistanceKm(d);
              
              // Try real quote first
              fetchRealLalamoveQuote(deliveryLat, deliveryLng, deliveryAddress, customer?.name || 'Customer', deliveryPhone).then(realQuotes => {
                  if (isMounted) {
                      if (realQuotes && realQuotes.length > 0) {
                          const mcQuote = realQuotes.find(q => q.vehicleType === 'motorcycle');
                          if (mcQuote) {
                              setDeliveryFee(mcQuote.totalFare);
                              setLalamoveQuotationId(mcQuote.quotationId);
                          }
                      } else {
                          // Fallback to simulator
                          const quotes = getLalamoveQuote(d);
                          const mcQuote = quotes.find(q => q.vehicleType === 'motorcycle');
                          const calculatedFee = mcQuote ? mcQuote.totalFare : Math.round(33 + Math.ceil(d) * (storeSettings.deliveryFeePerKm ?? 10));
                          setDeliveryFee(calculatedFee);
                          setLalamoveQuotationId(undefined);
                      }
                  }
              });
          }
          
          reverseGeocode(deliveryLat, deliveryLng).then(name => {
              if (isMounted && name) setDeliveryLocationName(name);
          });
      } else {
          setDeliveryDistanceKm(0);
          setDeliveryFee(null);
          setDeliveryLocationName('');
          setLalamoveQuotationId(undefined);
      }
      return () => { isMounted = false; };
  }, [hasMapPin, deliveryLat, deliveryLng, orderType, storeSettings]);

  const handleDownloadQR = (id: string, refNo?: string) => {
      const canvas = document.getElementById(id) as HTMLCanvasElement | null;
      if (canvas) {
          try {
              // Create high-resolution offscreen canvas (800x800 px) for a pristine scan experience on bank apps
              const offCanvas = document.createElement('canvas');
              offCanvas.width = 800;
              offCanvas.height = 800;
              
              const ctx = offCanvas.getContext('2d');
              if (ctx) {
                  // Disable image smoothing to maintain ultra-sharp QR pixels when resizing
                  ctx.imageSmoothingEnabled = false;
                  
                  // 1. Fill background with absolute solid white
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(0, 0, 800, 800);
                  
                  // 2. Draw outer border to help camera scanners detect boundaries easily
                  ctx.strokeStyle = '#f1f5f9';
                  ctx.lineWidth = 12;
                  ctx.strokeRect(20, 20, 760, 760);
                  
                  // 3. Draw the original QR code in the center (scaled beautifully to 640x640 px with 80px quiet zones)
                  ctx.drawImage(canvas, 80, 80, 640, 640);
                  
                  // 4. Export as a high-contrast, non-transparent solid JPEG image
                  const url = offCanvas.toDataURL('image/jpeg', 1.0);
                  const link = document.createElement('a');
                  link.download = `PromptPay_Order_${refNo || 'Payment'}.jpg`;
                  link.href = url;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
              } else {
                  throw new Error("Could not construct 2D context");
               }
          } catch (err) {
              console.error('Failed to save QR Code', err);
              alert(language === 'th' ? 'ไม่สามารถบันทึกรูปภาพได้ในเบราว์เซอร์นี้' : 'Cannot save image in this browser.');
          }
      } else {
          alert('QR Code element not found.');
      }
  };

  useEffect(() => {
      if (!activeNotification) return;
      const timer = setTimeout(() => {
          setActiveNotification(null);
      }, 10000); // Keep it visible for 10 seconds, plenty of time to read
      return () => clearTimeout(timer);
  }, [activeNotification]);

  useEffect(() => {
      // Find orders that are relevant to this customer
      const relevantOrders = orders.filter(o => 
          (customer && o.customerPhone === customer.phone) ||
          (historyOrderIds.includes(o.id)) ||
          (o.id === localOrderId)
      );

      const nextStatuses = { ...prevStatuses };
      let updatedNotification: any = null;

      relevantOrders.forEach(order => {
          const prevStatus = prevStatuses[order.id];
          
          // Trigger notification only if status has updated from an existing tracked state
          if (prevStatus && prevStatus !== order.status) {
              updatedNotification = {
                  id: order.id + '-' + Date.now(),
                  orderId: order.id,
                  oldStatus: prevStatus,
                  newStatus: order.status,
                  timestamp: Date.now()
              };
          }
          nextStatuses[order.id] = order.status;
      });

      // Maintain tracking list
      relevantOrders.forEach(order => {
          if (!nextStatuses[order.id]) {
              nextStatuses[order.id] = order.status;
          }
      });

      setPrevStatuses(nextStatuses);

      if (updatedNotification) {
          setActiveNotification(updatedNotification);
          
          // Ascending chime buzzer to alert customer elegantly
          try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              
              osc.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              
              osc.type = 'sine';
              osc.frequency.setValueAtTime(698.46, audioCtx.currentTime); // F5
              gainNode.gain.setValueAtTime(0.08, audioCtx.currentTime);
              
              osc.frequency.setValueAtTime(880.00, audioCtx.currentTime + 0.12); // A5
              gainNode.gain.setValueAtTime(0.06, audioCtx.currentTime + 0.12);
              gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
              
              osc.start();
              osc.stop(audioCtx.currentTime + 0.5);
          } catch (e) {
              console.warn("Audio chime failed to play", e);
          }
      }
  }, [orders, customer, historyOrderIds, localOrderId]);

  const timeSlots = generateTimeSlots(orderDate === 'today' ? 0 : 1);

  const activeOrder = useMemo(() => {
    return orders.find(o => 
        (customer && o.customerPhone === customer.phone && o.status !== 'completed' && o.status !== 'cancelled') ||
        (o.id === localOrderId && o.status !== 'completed' && o.status !== 'cancelled')
    );
  }, [orders, customer, localOrderId]);

  // Quick Access / Buy Again Logic
  const recentItems = useMemo(() => {
    if (!customer || !orders) return [];
    const myOrders = orders.filter(o => o.customerPhone === customer.phone);
    const uniqueItems = new Map<string, Pizza>();
    
    myOrders.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    for (const order of myOrders) {
        for (const item of order.items) {
            if (!uniqueItems.has(item.pizzaId)) {
                const original = menu.find(m => m.id === item.pizzaId);
                if (original) {
                   uniqueItems.set(item.pizzaId, original);
                }
            }
            if (uniqueItems.size >= 5) break;
        }
        if (uniqueItems.size >= 5) break;
    }
    return Array.from(uniqueItems.values());
  }, [orders, customer, menu]);

  // ... (Effects and Handlers remain same until render) ...
  useEffect(() => {
    if (customer?.address) setDeliveryAddress(customer.address);
    if (customer?.phone) setDeliveryPhone(customer.phone);
  }, [customer]);
  
  useEffect(() => {
      if (tableSession) setOrderType('dine-in');
  }, [tableSession]);
  
  useEffect(() => {
      if (isStoreOpen) {
          if (orderDate === 'tomorrow' && !pickupTime) {
              setOrderDate('today');
          }
      } else {
          setAsapOrder(false); // Force pre-order when store is closed
          if (!canOrderForToday()) {
              setOrderDate('tomorrow');
          }
      }
  }, [isStoreOpen]);

  const handleFeedbackSubmit = async () => {
      if (!feedbackOrderId) return;
      await submitOrderFeedback(feedbackOrderId, feedbackRating, feedbackComment);
      setFeedbackSuccess(true);
      setTimeout(() => {
          setShowFeedbackModal(false);
          setFeedbackSuccess(false);
          setFeedbackOrderId(null);
          setFeedbackRating(5);
          setFeedbackComment("");
      }, 1500);
  };

  const handleCustomize = (pizza: Pizza) => {
    if (!pizza.available) return;
    setSelectedPizza(pizza);
    setSelectedToppings([]);
    setCustomName('');
    setSpecialInstructions('');
    if (pizza.category === 'promotion' && (pizza.comboCount || 0) > 0) {
        setIsComboBuilderOpen(true);
        setComboSelections(new Array(pizza.comboCount).fill(null));
    }
  };

  const toggleTopping = (topping: Topping) => {
    if (selectedPizza?.id === 'custom_base' && topping.category === 'sauce') {
        setSelectedToppings(prev => {
            const others = prev.filter(t => t.category !== 'sauce');
            return [...others, topping];
        });
        return;
    }
    if (selectedToppings.find(t => t.id === topping.id)) {
      setSelectedToppings(prev => prev.filter(t => t.id !== topping.id));
    } else {
      setSelectedToppings(prev => [...prev, topping]);
    }
  };

  const handleAddToCart = () => {
    if (!selectedPizza) return;
    const toppingsPrice = selectedToppings.reduce((sum, t) => sum + t.price, 0);

    if (selectedPizza.id === 'p_boat') {
        if (!boatA || !boatB) {
            alert(language === 'th' ? 'กรุณาเลือกหน้าพิซซ่าให้ครบทั้งสองชิ้นสำหรับพิซซ่าโบ๊ท' : 'Please select both parts of the Pizza Boat.');
            return;
        }
        const calculatedBasePrice = Number(boatPriceA) + Number(boatPriceB);
        const total = calculatedBasePrice + toppingsPrice;
        const nameEn = `Pizza Boat (${boatA.name} [฿${boatPriceA}] / ${boatB.name} [฿${boatPriceB}])`;
        const nameTh = `พิซซ่าโบ๊ท (${boatA.nameTh || boatA.name} [฿${boatPriceA}] / ${boatB.nameTh || boatB.name} [฿${boatPriceB}])`;
        
        const item: CartItem = {
          id: Date.now().toString() + Math.random().toString(),
          pizzaId: selectedPizza.id,
          name: nameEn,
          nameTh: nameTh, 
          basePrice: calculatedBasePrice,
          selectedToppings: selectedToppings,
          quantity: 1,
          totalPrice: total,
          subItems: [
              { pizzaId: boatA.id, name: `Boat Side A: ${boatA.name} (฿${boatPriceA})`, nameTh: `โบ๊ทชิ้นแรก: ${boatA.nameTh || boatA.name} (฿${boatPriceA})`, toppings: [] },
              { pizzaId: boatB.id, name: `Boat Side B: ${boatB.name} (฿${boatPriceB})`, nameTh: `โบ๊ทชิ้นหลัง: ${boatB.nameTh || boatB.name} (฿${boatPriceB})`, toppings: [] }
          ],
          specialInstructions: specialInstructions
        };
        addToCart(item);
        setSelectedPizza(null);
        setSelectedToppings([]);
        setSpecialInstructions('');
        setBoatA(null);
        setBoatB(null);
        setBoatPriceA(0);
        setBoatPriceB(0);
        return;
    }

    if (selectedPizza.id === 'p_half_half') {
        if (!halfA || !halfB) {
            alert(language === 'th' ? 'กรุณาเลือกหน้าพิซซ่าให้ครบทั้งสองครึ่ง' : 'Please select both halves of the pizza.');
            return;
        }
        const calculatedBasePrice = Math.round((halfA.basePrice / 2) + (halfB.basePrice / 2) + 20);
        const total = calculatedBasePrice + toppingsPrice;
        const nameEn = `Half-Half Pizza (${halfA.name} / ${halfB.name})`;
        const nameTh = `พิซซ่าครึ่ง-ครึ่ง (${halfA.nameTh || halfA.name} / ${halfB.nameTh || halfB.name})`;
        
        const item: CartItem = {
          id: Date.now().toString() + Math.random().toString(),
          pizzaId: selectedPizza.id,
          name: nameEn,
          nameTh: nameTh, 
          basePrice: calculatedBasePrice,
          selectedToppings: selectedToppings,
          quantity: 1,
          totalPrice: total,
          subItems: [
              { pizzaId: halfA.id, name: `Half A: ${halfA.name}`, nameTh: `ครึ่งแรก: ${halfA.nameTh || halfA.name}`, toppings: [] },
              { pizzaId: halfB.id, name: `Half B: ${halfB.name}`, nameTh: `ครึ่งหลัง: ${halfB.nameTh || halfB.name}`, toppings: [] }
          ],
          specialInstructions: specialInstructions
        };
        addToCart(item);
        setSelectedPizza(null);
        setSelectedToppings([]);
        setSpecialInstructions('');
        setHalfA(null);
        setHalfB(null);
        return;
    }

    if (selectedPizza.id === 'custom_base') {
        const hasSauce = selectedToppings.some(t => t.category === 'sauce');
        if (!hasSauce) {
            alert(language === 'th' ? 'กรุณาเลือกซอสอย่างน้อย 1 อย่าง' : 'Please select a base sauce.');
            return;
        }
    }
    const localizedPizza = getLocalizedItem(selectedPizza);
    let finalName = localizedPizza.name;
    if (selectedPizza.name === "Create Your Own Pizza") {
        finalName = customName ? `${t('nameCreation')}: ${customName}` : localizedPizza.name;
    }
    const item: CartItem = {
      id: Date.now().toString() + Math.random().toString(),
      pizzaId: selectedPizza.id,
      name: finalName,
      nameTh: language === 'th' ? finalName : undefined, 
      basePrice: selectedPizza.basePrice,
      selectedToppings: selectedToppings,
      quantity: 1,
      totalPrice: selectedPizza.basePrice + toppingsPrice,
      specialInstructions: specialInstructions
    };
    addToCart(item);
    setSelectedPizza(null);
    setSelectedToppings([]);
    setSpecialInstructions('');
  };

  const handleDirectAddToCart = (e: React.MouseEvent, item: Pizza) => {
    e.stopPropagation();
    if (!item.available) return;

    if (item.id === 'custom_base' || item.id === 'p_half_half' || (item.category === 'promotion' && (item.comboCount || 0) > 0)) {
        handleCustomize(item);
        return;
    }

    const localizedPizza = getLocalizedItem(item);
    const cartItem: CartItem = {
      id: Date.now().toString() + Math.random().toString(),
      pizzaId: item.id,
      name: localizedPizza.name,
      nameTh: language === 'th' ? localizedPizza.name : undefined, 
      basePrice: item.basePrice,
      selectedToppings: [],
      quantity: 1,
      totalPrice: item.basePrice,
      specialInstructions: ''
    };
    addToCart(cartItem);
  };

  const handleOpenComboSlot = (index: number) => setCurrentComboSlot(index);
  const handleSelectComboPizza = (pizza: Pizza) => {
      if (currentComboSlot === null) return;
      const newSelections = [...comboSelections];
      newSelections[currentComboSlot] = {
          pizzaId: pizza.id,
          name: pizza.name,
          nameTh: pizza.nameTh,
          toppings: [] 
      };
      setComboSelections(newSelections);
      setCurrentComboSlot(null); 
  };

  const handleAddComboToCart = () => {
      if (!selectedPizza) return;
      const extraToppingsPrice = comboSelections.reduce((sum, item) => {
          return sum + (item?.toppings.reduce((tSum, t) => tSum + t.price, 0) || 0);
      }, 0);
      const extraPremiumPrice = comboSelections.reduce((sum, item) => {
          if (!item) return sum;
          const p = menu.find(m => m.id === item.pizzaId);
          if (p && p.basePrice > 380) {
              return sum + (p.basePrice - 380);
          }
          return sum;
      }, 0);
      const localized = getLocalizedItem(selectedPizza);
      const item: CartItem = {
          id: Date.now().toString() + Math.random(),
          pizzaId: selectedPizza.id,
          name: localized.name,
          nameTh: selectedPizza.nameTh,
          basePrice: selectedPizza.basePrice + extraPremiumPrice,
          selectedToppings: [],
          subItems: comboSelections, 
          quantity: 1,
          totalPrice: selectedPizza.basePrice + extraToppingsPrice + extraPremiumPrice,
          specialInstructions: specialInstructions
      };
      addToCart(item);
      setIsComboBuilderOpen(false);
      setSelectedPizza(null);
      setComboSelections([]);
      setSpecialInstructions('');
  };

  const handleSaveFavorite = async () => {
      if (!selectedPizza) return;
      if (!customer) {
          alert(t('mustRegister'));
          setShowAuthModal(true);
          return;
      }
      await addToFavorites(
          selectedPizza.name === "Create Your Own Pizza" && customName ? `${t('nameCreation')}: ${customName}` : selectedPizza.name,
          selectedPizza.id,
          selectedToppings
      );
      alert(t('saveFavorite') + " Success!");
  };
  
  const handleOrderFavorite = (fav: SavedFavorite) => {
      const basePizza = menu.find(p => p.id === fav.pizzaId);
      if (!basePizza) {
          alert("This item is no longer available.");
          return;
      }
      const toppingsPrice = fav.toppings.reduce((sum, t) => sum + t.price, 0);
      const totalPrice = basePizza.basePrice + toppingsPrice;
      const item: CartItem = {
          id: Date.now().toString() + Math.random().toString(),
          pizzaId: basePizza.id,
          name: fav.name,
          basePrice: basePizza.basePrice,
          selectedToppings: fav.toppings,
          quantity: 1,
          totalPrice: totalPrice,
          specialInstructions: ''
      };
      addToCart(item);
      setShowProfile(false);
      setIsCartOpen(true);
  };

  const handlePlaceOrderClick = async () => {
     if (!customer && !tableSession) {
        setShowAuthModal(true);
        return;
     }
     
     // Limit to 1 coupon per account per day
     if (appliedCoupon && customer) {
        const todayStr = new Date().toLocaleDateString('en-CA');
        const usedCouponToday = orders.some(o => {
            if (o.customerPhone !== customer.phone || !o.couponCode || o.status === 'cancelled') return false;
            try {
                return new Date(o.createdAt).toLocaleDateString('en-CA') === todayStr;
            } catch(e) { return false; }
        });
        if (usedCouponToday) {
            alert(language === 'th' ? 'คุณใช้คูปองไปแล้วในวันนี้ (จำกัด 1 คูปอง/วัน)' : 'You have already used a coupon today (limit 1 coupon per day).');
            setAppliedCoupon(null);
            return;
        }
     }

     if (orderType === 'delivery') {
        if (!hasMapPin) {
           alert(language === 'th' ? 'กรุณากด "ดึงพิกัดปัจจุบัน" เพื่อคำนวณค่าส่ง' : 'Please tap "Use Live GPS" to calculate delivery fee.');
           return;
        }
        if (!deliveryAddress) {
           alert(t('addressMissing'));
           return;
        }
        if (!deliveryPhone) {
           alert(language === 'th' ? 'กรุณาระบุเบอร์โทรศัพท์สำหรับจัดส่ง' : 'Please provide a contact phone number for delivery.');
           return;
         }
     }
     setIsSubmitting(true);
     
     let finalDeliveryAddress = deliveryAddress;
     if (orderType === 'delivery') {
         if (deliveryPhone) {
             finalDeliveryAddress += ` [Phone: ${deliveryPhone}]`;
         }
         if (hasMapPin) {
             finalDeliveryAddress += ` [GPS Pin: ${deliveryLat.toFixed(5)}, ${deliveryLng.toFixed(5)}]`;
          }
          if (mapSearch && (mapSearch.includes('maps') || mapSearch.includes('goo.gl'))) {
              finalDeliveryAddress += ` [Google Maps Link: ${mapSearch.trim()}]`;
         }

         // Save profile if selected, limit to 2
         if (addressSaveType === 'home' || addressSaveType === 'work') {
             const updatedProfiles = {
                 ...savedProfiles,
                 [addressSaveType]: {
                     address: deliveryAddress,
                     phone: deliveryPhone,
                     mapSearch: mapSearch,
                     lat: deliveryLat,
                     lng: deliveryLng,
                     hasPin: hasMapPin
                 }
             };
             setSavedProfiles(updatedProfiles);
             try {
                 localStorage.setItem('damac_delivery_profiles', JSON.stringify(updatedProfiles));
             } catch(e) {}
         }
     }

     const success = await placeOrder(orderType, {
        note: orderNote,
        delivery: orderType === 'delivery' ? {
            address: finalDeliveryAddress,
            zoneName: deliveryLocationName || 'Standard',
            fee: deliveryFee || 'pending',
            lat: deliveryLat,
            lng: deliveryLng,
            quotationId: lalamoveQuotationId
        } : undefined,
        paymentMethod: paymentMethod,
        pickupTime: asapOrder ? 'ASAP' : `Pre-order: ${orderDate === 'today' ? 'Today' : 'Tomorrow'} ${pickupTime || 'asap'}`,
        tableNumber: tableSession || undefined, 
        source: 'store',
        partnerId: partnerSession || undefined, 
        promoCode: appliedPromoCode?.code || undefined, 
        discountAmount: calculatedDiscount || undefined,
        couponCode: appliedCoupon?.code || undefined,
        couponDiscountAmount: calculatedCouponDiscount || undefined,
        couponId: appliedCoupon?.id || undefined
     });
     setIsSubmitting(false);
     if (success) {
        setIsCartOpen(false);
        setOrderNote('');
        setAppliedPromoCode(null);
        setAppliedCoupon(null);
        setPromoCodeInput('');
        const lastId = localStorage.getItem('damac_last_order');
        setLocalOrderId(lastId);
        if (lastId) {
            setHistoryOrderIds(prev => {
                if (prev.includes(lastId)) return prev;
                const updated = [lastId, ...prev];
                try {
                    localStorage.setItem('damac_history_order_ids', JSON.stringify(updated));
                } catch (e) {}
                return updated;
            });
        }
        if (lastId) {
            if (paymentMethod === 'qr_transfer') {
                setShowQRModal(false);
            }
            navigateTo('track', lastId);
        }
     }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regPdpa) {
        alert(t('pdpaRequired'));
        return;
    }
    if (!regPassword) {
        alert("Password is required");
        return;
    }
    try {
        const result = await registerCustomer({
            name: regName,
            phone: regPhone,
            password: regPassword,
            address: regAddress,
            birthday: regBirthday,
            pdpaAccepted: regPdpa,
            loyaltyPoints: 0,
            savedFavorites: [],
            orderHistory: []
        });
        if (result === 'updated') {
            alert(language === 'th' ? "บัญชีนี้มีอยู่แล้ว! ระบบได้รีเซ็ตรหัสผ่านและอัปเดตข้อมูลของคุณแล้ว ยินดีต้อนรับกลับครับ!" : "Account exists! Password has been reset and details updated. Welcome back!");
        } else {
            alert(language === 'th' ? "สร้างบัญชีผู้ใช้ใหม่สำเร็จ! ยินดีต้อนรับสู่ Pizza Damac!" : "Account created successfully! Welcome to Pizza Damac!");
        }
        setShowAuthModal(false);
        setShowLoginCouponsModal(true);
    } catch (err: any) {
        console.error("Registration failed:", err);
        alert(language === 'th' ? `การสมัครสมาชิกไม่สำเร็จ: ${err?.message || err}` : `Registration failed: ${err?.message || err}`);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      const success = await customerLogin(loginPhone, loginPassword);
      if (success) {
          setShowAuthModal(false);
          setShowLoginCouponsModal(true);
      } else {
          alert("Invalid phone or password");
      }
  };
  
  const handleManualRefresh = async () => {
      setIsRefreshing(true);
      await fetchOrders();
      setTimeout(() => setIsRefreshing(false), 500);
  };
  
  const getStatusColor = (status: OrderStatus) => {
      switch(status) {
          case 'pending': return 'bg-yellow-100 text-yellow-800';
          case 'confirmed': return 'bg-blue-100 text-blue-800';
          case 'acknowledged': return 'bg-indigo-100 text-indigo-800';
          case 'cooking': return 'bg-orange-100 text-orange-800';
          case 'ready': return 'bg-green-100 text-green-700';
          case 'completed': return 'bg-green-100 text-green-700';
          case 'cancelled': return 'bg-red-100 text-red-700';
          default: return 'bg-gray-100 text-gray-700';
      }
  };

  const renderHeroMedia = () => {
      if (!storeSettings.promoBannerUrl) return null;
      if (storeSettings.promoBannerUrl.includes('youtube.com') || storeSettings.promoBannerUrl.includes('youtu.be')) {
          let videoId = '';
          if (storeSettings.promoBannerUrl.includes('v=')) {
              videoId = storeSettings.promoBannerUrl.split('v=')[1]?.split('&')[0];
          } else if (storeSettings.promoBannerUrl.includes('youtu.be')) {
              videoId = storeSettings.promoBannerUrl.split('/').pop() || '';
          }
          if (videoId) {
              return (
                  <iframe 
                      className="absolute inset-0 w-full h-full object-cover"
                      src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=1&loop=1&playlist=${videoId}&controls=0&showinfo=0`}
                      allow="autoplay; encrypted-media"
                      frameBorder="0"
                  />
              );
          }
      }
      if (storeSettings.promoContentType === 'video') {
          return (
             <video className="absolute inset-0 w-full h-full object-cover" autoPlay muted loop playsInline>
                 <source src={storeSettings.promoBannerUrl} type="video/mp4" />
             </video>
          );
      }
      return <img src={storeSettings.promoBannerUrl} className="absolute inset-0 w-full h-full object-cover" />;
  };
  
  const groupedToppings = {
      sauce: toppings.filter(t => t.category === 'sauce'),
      cheese: toppings.filter(t => t.category === 'cheese'),
      seasoning: toppings.filter(t => t.category === 'seasoning'),
      meat: toppings.filter(t => t.category === 'meat'),
      vegetable: toppings.filter(t => t.category === 'vegetable'),
      other: toppings.filter(t => !t.category || t.category === 'other'),
  };

  const cateringImages = (storeSettings.eventGalleryUrls && storeSettings.eventGalleryUrls.length > 0)
        ? storeSettings.eventGalleryUrls
        : (DEFAULT_STORE_SETTINGS.eventGalleryUrls || []);

  return (
    <div className="min-h-screen bg-orange-50 pb-32 md:pb-0 font-sans text-gray-900 flex flex-col relative w-full max-w-full overflow-x-hidden">
        {/* --- REAL-TIME ORDER STATUS UPDATES NOTIFICATION --- */}
        {activeNotification && (
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-fade-in">
                <div className="bg-gray-950 border-2 border-brand-500 text-white rounded-2xl shadow-2xl p-4 flex flex-col gap-3 relative overflow-hidden">
                    {/* Corner accent glow */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/15 rounded-full blur-xl pointer-events-none"></div>

                    <div className="flex items-start justify-between relative z-10">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 bg-brand-600 rounded-xl text-white shadow-md">
                                <Sparkles size={20} className="text-yellow-400 animate-pulse"/>
                            </div>
                            <div>
                                <h4 className="font-bold text-sm text-yellow-300">
                                    {language === 'th' ? '🍕 อัปเดตสถานะออเดอร์!' : '🍕 Order Status Updated!'}
                                </h4>
                                <p className="text-[11px] text-gray-400 font-mono mt-0.5">
                                    #{activeNotification.orderId}
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={() => setActiveNotification(null)}
                            className="bg-white/10 hover:bg-white/20 p-1.5 rounded-full text-white/70 hover:text-white transition"
                        >
                            <X size={14}/>
                        </button>
                    </div>
                    
                    <div className="bg-white/5 rounded-xl p-3 flex flex-col gap-2.5 border border-white/5 relative z-10">
                        {/* Before/After Badges with elegant pointing arrow */}
                        <div className="grid grid-cols-3 items-center gap-1 bg-black/40 p-2.5 rounded-lg border border-white/5">
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] text-gray-400 uppercase tracking-wider font-bold">{language === 'th' ? 'ก่อนหน้า' : 'Before'}</span>
                                <span className="text-xs font-semibold text-gray-300 mt-0.5">
                                    {t(activeNotification.oldStatus as any)}
                                </span>
                            </div>
                            <div className="flex justify-center text-brand-400">
                                <ArrowRight size={16} className="animate-pulse"/>
                            </div>
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] text-brand-400 uppercase tracking-wider font-bold">{language === 'th' ? 'ปัจจุบัน' : 'Current'}</span>
                                <span className="text-sm font-extrabold text-green-400 mt-0.5 drop-shadow-[0_2px_4px_rgba(74,222,128,0.2)] animate-pulse">
                                    {t(activeNotification.newStatus as any)}
                                </span>
                            </div>
                        </div>
                        
                        <p className="text-xs text-gray-200 text-center font-medium leading-relaxed px-1">
                            {activeNotification.newStatus === 'confirmed' && (language === 'th' ? '👍 ร้านค้ายืนยันและยอมรับคำสั่งซื้อของคุณแล้ว!' : '👍 The shop has accepted and confirmed your order!')}
                            {activeNotification.newStatus === 'acknowledged' && (language === 'th' ? '👨‍🍳 เชฟเริ่มทำการเตรียมท็อปปิ้งแป้งพิซซ่าแล้ว!' : '👨‍🍳 The kitchen team has started preparing your pizza dough!')}
                            {activeNotification.newStatus === 'cooking' && (language === 'th' ? '🔥 พิซซ่าอบในเตาร้อนๆ กลิ่นเริ่มหอมแล้วค่ะ!' : '🔥 Pizza is inside the oven. It is smelling delicious!')}
                            {activeNotification.newStatus === 'ready' && (language === 'th' ? '✨ อบเสร็จส่งตรงจากเตา! ออเดอร์ของคุณพร้อมจัดส่ง/เสิร์ฟแล้วค่ะ' : '✨ Out of the oven! Your pizza is package ready and hot!')}
                            {activeNotification.newStatus === 'completed' && (language === 'th' ? '🎉 เสิร์ฟเรียบร้อย! ทานให้อร่อยนะคะ ขอบคุณที่อุดหนุนค่ะ' : '🎉 Delivered & Completed! Enjoy your meal, thank you!')}
                            {activeNotification.newStatus === 'cancelled' && (language === 'th' ? '❌ คำสั่งซื้อนี้ถูกยกเลิกแล้ว หากมีข้อสงสัยโปรดติดต่อร้านค้า' : '❌ Your order has been cancelled. Please contact the store.')}
                        </p>
                    </div>

                    <div className="flex gap-2 relative z-10">
                        <button 
                            onClick={() => {
                                setLocalOrderId(activeNotification.orderId);
                                setShowTracker(true);
                                setActiveNotification(null);
                            }}
                            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1.5 shadow-lg shadow-brand-600/20 border border-brand-500"
                        >
                            <Activity size={13} className="animate-pulse"/>
                            {language === 'th' ? 'ดูสถานะแบบเรียลไทม์' : 'Track Status Real-time'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Header */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md shadow-sm border-b border-orange-100">
           <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-2">
                 {shopLogo ? <img src={shopLogo} className="w-10 h-10 rounded-full object-cover border-2 border-brand-500"/> : <div className="w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center text-white"><ChefHat/></div>}
                 <h1 className="font-bold text-xl tracking-tight hidden md:block text-gray-900">Pizza Damac</h1>
              </div>

              <div className="flex items-center gap-3">
                 {storeSettings.lineUrl && (
                     <a href={storeSettings.lineUrl} target="_blank" rel="noopener noreferrer" className="rounded-full bg-[#00B900]/10 text-[#00B900] px-3 py-1.5 flex items-center gap-1 hover:bg-[#00B900]/20 transition text-xs font-bold shadow-sm border border-[#00B900]/20 hidden sm:flex">
                        <MessageCircle size={14}/> Line
                     </a>
                 )}
                 {storeSettings.contactPhone && (
                     <a href={`tel:${storeSettings.contactPhone}`} className="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1.5 flex items-center gap-1 hover:bg-emerald-100 transition text-xs font-bold shadow-sm border border-emerald-200 hidden sm:flex">
                        <Phone size={14}/> Call Us
                     </a>
                 )}
                 <button onClick={toggleLanguage} className="w-9 h-9 rounded-full bg-orange-100 font-bold text-xs text-brand-700 hover:bg-orange-200 transition">{language.toUpperCase()}</button>
                 {/* TABLE QR BANNER */}
                 {tableSession ? (
                    <div className="bg-green-600 text-white px-3 py-1.5 rounded-full text-xs font-bold animate-pulse flex items-center gap-1">
                        <Utensils size={12}/> Table {tableSession}
                    </div>
                 ) : customer ? (
                     <button onClick={() => setShowProfile(true)} className="flex items-center gap-2 bg-orange-100 rounded-full py-1.5 px-3 hover:bg-orange-200 transition">
                         <User size={16} className="text-brand-700"/>
                         <span className="text-sm font-bold hidden md:inline text-brand-900">{customer.name}</span>
                         <div className="bg-brand-50 text-white text-[10px] px-1.5 rounded-full">{customer.loyaltyPoints}pts</div>
                     </button>
                 ) : (
                     <button onClick={() => setShowAuthModal(true)} className="bg-gray-900 text-white px-4 py-2 rounded-full text-sm font-bold shadow-lg hover:bg-black transition">{t('login')}</button>
                 )}
                 <button onClick={() => {}} className="hidden">dummy</button>
                  <button 
                      onClick={() => setShowOrderHistory(true)} 
                      className="p-2 text-gray-700 hover:bg-orange-100 rounded-full transition"
                      title={t('orderHistory')}
                      id="order-history-nav-btn"
                  >
                      <History size={24}/>
                  </button>
                  <button onClick={() => setIsCartOpen(true)} className="relative p-2 text-gray-700 hover:bg-orange-150 rounded-full transition">
                     <ShoppingBag size={24}/>
                     {cart.length > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce-short">{cart.reduce((s,i)=>s+i.quantity,0)}</span>}
                 </button>
              </div>
           </div>
        </header>
        
        {/* TABLE MODE BANNER */}
        {tableSession && (
             <div className="bg-green-600 text-white p-3 text-center relative z-20 shadow-md">
                 <div className="font-bold text-lg flex items-center justify-center gap-2">
                     <Utensils size={20}/> You are ordering for Table {tableSession}
                 </div>
                 <p className="text-xs opacity-90">Please place your order, and we will bring it to your table.</p>
             </div>
        )}

        {/* PARTNER REFERRAL BANNER */}
        {(() => {
             if (!partnerSession) return null;
             const partner = partners?.find(p => p.id === partnerSession);
             if (!partner) return null;
             return (
                 <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white p-3 text-center relative z-20 shadow-md flex items-center justify-center gap-4">
                     <div className="font-bold text-sm md:text-base flex items-center justify-center gap-2">
                         <span className="animate-bounce">☕️</span>
                         {language === 'th' ? `ยินดีต้อนรับ สั่งส่งตรงจากร้านกาแฟ ${partner.nameTh || partner.name}` : `Referral order from ${partner.name}`}
                     </div>
                     <button onClick={() => setPartnerSession(null)} className="text-[10px] bg-white text-amber-600 px-2.5 py-1 rounded-full font-bold hover:bg-amber-50 transition shrink-0 uppercase">Dismiss</button>
                 </div>
             );
        })()}

        {/* STORE CLOSED / HOLIDAY BANNER */}
        {!isStoreOpen && (
             <div className="bg-amber-50 border-b border-amber-200 text-amber-900 p-4 relative z-20 shadow-sm">
                 <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                     <div className="flex gap-3 items-start">
                         <div className="bg-amber-100 text-amber-800 p-2.5 rounded-xl shrink-0 mt-0.5">
                             <Clock size={20} className="animate-pulse" />
                         </div>
                         <div>
                             <h4 className="font-extrabold text-sm md:text-base flex items-center gap-1.5">
                                 {language === 'th' ? '🔴 ขณะนี้ร้านปิดรับออเดอร์ทันที (เปิดสั่งล่วงหน้าได้ค่ะ)' : '🔴 Store is Closed for ASAP Orders (Pre-orders Open)'}
                             </h4>
                             <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                                 {isHoliday ? (
                                     <span>
                                         {language === 'th' 
                                             ? `🏖️ ร้านหยุดเทศกาล/วันหยุดพิเศษ${storeSettings.holidayStart ? ` ตั้งแต่วันที่ ${storeSettings.holidayStart}` : ''}${storeSettings.holidayEnd ? ` ถึงวันที่ ${storeSettings.holidayEnd}` : ''}` 
                                             : `🏖️ Shop is closed for holiday${storeSettings.holidayStart ? ` from ${storeSettings.holidayStart}` : ''}${storeSettings.holidayEnd ? ` to ${storeSettings.holidayEnd}` : ''}`}
                                     </span>
                                 ) : !storeSettings.isOpen ? (
                                     <span>
                                         {storeSettings.closedMessage || (language === 'th' ? 'ขออภัยในความไม่สะดวก ร้านปิดให้บริการชั่วคราวค่ะ' : 'We are temporarily closed. Sorry for any inconvenience.')}
                                     </span>
                                 ) : (
                                     <span>
                                         {language === 'th' 
                                             ? `🕒 นอกเวลาทำการปกติของร้าน (เวลาเปิดทำการ: ทุกวัน 11:00 น. - 20:30 น.)` 
                                             : `🕒 Outside normal business hours (Hours: Daily 11:00 AM - 8:30 PM)`}
                                     </span>
                                 )}
                             </p>
                             {storeSettings.closedMessage && (isHoliday || !storeSettings.isOpen) && (
                                 <p className="text-xs font-semibold text-amber-950 mt-1.5 bg-white/60 px-2.5 py-1.5 rounded-lg border border-amber-200/50 inline-block">
                                     📢 {storeSettings.closedMessage}
                                 </p>
                             )}
                         </div>
                     </div>
                     <div className="text-left md:text-right shrink-0">
                         <span className="inline-block bg-amber-600 text-white text-[10px] md:text-xs font-bold px-3 py-1.5 rounded-full shadow-sm">
                             {language === 'th' ? 'สั่งอาหารล่วงหน้า (Pre-order) ได้เลย!' : 'Pre-order available now!'}
                         </span>
                     </div>
                 </div>
             </div>
        )}

        {/* Categories */}
        <div className="bg-white border-b sticky top-16 z-30 shadow-sm w-full max-w-full overflow-hidden">
            <div className="max-w-7xl mx-auto px-4 overflow-x-auto no-scrollbar py-3 flex flex-nowrap gap-3">
                {CATEGORIES.map(cat => (
                    <button 
                        key={cat.id} 
                        onClick={() => setActiveCategory(cat.id)}
                        className={`whitespace-nowrap px-5 py-2 rounded-full text-sm font-bold transition-all transform shrink-0 ${activeCategory === cat.id ? 'bg-brand-600 text-white shadow-lg scale-105 ring-2 ring-brand-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                        {language === 'th' ? cat.labelTh : cat.label}
                    </button>
                ))}
            </div>
        </div>

        {/* Hero Section (Banner) */}
        {activeCategory === 'promotion' && (
            <div className="relative w-full h-56 md:h-96 overflow-hidden bg-gray-900">
                {renderHeroMedia()}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col items-center justify-end pb-8">
                     {shopLogo && <img src={shopLogo} className="w-20 h-20 md:w-32 md:h-32 rounded-full border-4 border-white shadow-xl mb-3 object-cover animate-fade-in"/>}
                     <h2 className="text-white font-bold text-2xl md:text-5xl text-center shadow-black drop-shadow-lg">Pizza Damac</h2>
                     <p className="text-gray-200 text-sm md:text-lg mt-1 font-medium">Authentic Italian Taste</p>
                </div>
            </div>
        )}

        {/* Guest Banner */}
        {!customer && activeCategory === 'promotion' && !tableSession && (
            <div className="bg-brand-600 text-white py-3 text-center cursor-pointer hover:bg-brand-700 transition" onClick={() => setShowAuthModal(true)}>
                <span className="font-bold flex items-center justify-center gap-2 text-sm md:text-base">
                    <User size={18}/> Please Login or Register to order!
                </span>
            </div>
        )}

        {/* --- IMPROVED BUY AGAIN SECTION (Logged In) --- */}
        {customer && recentItems.length > 0 && activeCategory === 'promotion' && (
            <section className="max-w-7xl mx-auto px-4 py-6 border-b bg-orange-50/50 w-full max-w-full overflow-hidden">
                <div className="flex justify-between items-end mb-4">
                    <h2 className="text-lg font-bold flex items-center gap-2 text-brand-800">
                         <History size={20} className="text-brand-600"/> {t('buyAgain')}
                    </h2>
                    <button onClick={() => setShowProfile(true)} className="text-xs text-brand-600 font-bold hover:underline">View History</button>
                </div>
                <div className="flex flex-nowrap gap-4 overflow-x-auto no-scrollbar pb-2">
                    {recentItems.map(item => {
                         const localized = getLocalizedItem(item);
                         return (
                            <div key={'recent-'+item.id} onClick={() => handleCustomize(item)} className="min-w-[150px] w-[150px] shrink-0 bg-white rounded-xl shadow-sm p-3 border border-orange-100 cursor-pointer hover:shadow-md transition group hover:border-brand-300">
                                <div className="aspect-square rounded-lg overflow-hidden mb-2 relative">
                                    <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition duration-500"/>
                                    {!item.available && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[10px] font-bold">{t('soldOut')}</div>}
                                    <button 
                                        onClick={(e) => handleDirectAddToCart(e, item)}
                                        className="absolute bottom-1 right-1 bg-white hover:bg-brand-600 hover:text-white p-1.5 rounded-full shadow-sm text-brand-600 transition cursor-pointer z-10"
                                        title={language === 'th' ? 'สั่งตรง' : 'Quick Add'}
                                    >
                                        <Plus size={14}/>
                                    </button>
                                </div>
                                <h3 className="font-bold text-sm text-gray-800 truncate">{localized.name}</h3>
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-brand-600 font-bold text-xs">฿{item.basePrice}</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
        )}

        {/* --- MEMBER COUPONS DASHBOARD SECTION (Logged In) --- */}
        {customer && customer.coupons && customer.coupons.filter(c => !c.isUsed).length > 0 && activeCategory === 'promotion' && (
            <section className="max-w-7xl mx-auto px-4 py-6 border-b bg-gradient-to-r from-amber-500/10 via-orange-500/5 to-transparent w-full max-w-full overflow-hidden">
                <div className="flex justify-between items-end mb-4">
                    <h2 className="text-lg font-black flex items-center gap-2 text-brand-800">
                         <Gift size={22} className="text-brand-600 shrink-0"/> 
                         <span>{language === 'th' ? 'คูปองสมาชิกของคุณ (แนะนำให้ใช้เลย!)' : 'Your Member Coupons (Recommended!)'}</span>
                    </h2>
                    <span className="text-xs font-bold text-brand-600 bg-brand-100 px-2 py-0.5 rounded-full">
                        {customer.coupons.filter(c => !c.isUsed).length} {language === 'th' ? 'คูปองพร้อมใช้' : 'Coupons ready'}
                    </span>
                </div>
                
                <div className="flex flex-nowrap gap-4 overflow-x-auto no-scrollbar pb-3">
                    {customer.coupons.filter(c => !c.isUsed).map(c => {
                        const isSelected = appliedCoupon?.id === c.id;
                        const isMinSpentOk = cartTotal >= (c.minOrderAmount || 0);
                        return (
                            <div 
                                key={'dashboard-coupon-'+c.id} 
                                onClick={() => setAppliedCoupon(isSelected ? null : c)}
                                className={`min-w-[280px] md:min-w-[320px] shrink-0 bg-white rounded-2xl shadow-sm border p-4 cursor-pointer hover:shadow-md transition relative overflow-hidden flex flex-col justify-between ${
                                    isSelected 
                                        ? 'border-brand-500 bg-brand-50/10 ring-1 ring-brand-500' 
                                        : 'border-orange-100 hover:border-brand-300'
                                }`}
                            >
                                {/* Ticket cutout effect left side */}
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-6 bg-gray-200 rounded-r-full border-y border-r border-orange-100"></div>
                                {/* Ticket cutout effect right side */}
                                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-6 bg-gray-200 rounded-l-full border-y border-l border-orange-100"></div>

                                <div>
                                    <div className="flex justify-between items-start gap-2 mb-2">
                                        <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                                            {c.code}
                                        </span>
                                        {c.expiryDate && (
                                            <span className="text-[10px] text-gray-400 font-medium">
                                                Exp: {c.expiryDate}
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="font-extrabold text-sm md:text-base text-gray-800">
                                        {language === 'th' ? c.titleTh || c.title : c.title}
                                    </h3>
                                    <p className="text-xs text-gray-500 mt-1 font-medium line-clamp-2 leading-relaxed">
                                        {language === 'th' ? c.descriptionTh || c.description : c.description}
                                    </p>
                                </div>

                                <div className="mt-4 flex items-center justify-between border-t border-dashed border-gray-100 pt-3">
                                    <div className="text-left">
                                        {c.minOrderAmount && c.minOrderAmount > 0 ? (
                                            <span className={`text-[10px] font-black block ${isMinSpentOk ? 'text-green-600' : 'text-amber-600'}`}>
                                                {language === 'th' 
                                                    ? `ขั้นต่ำ ฿${c.minOrderAmount} (ในรถเข็น: ฿${cartTotal})` 
                                                    : `Min. spend ฿${c.minOrderAmount} (Cart: ฿${cartTotal})`}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-gray-400 font-medium block">
                                                {language === 'th' ? 'ไม่มีขั้นต่ำ' : 'No minimum spend'}
                                            </span>
                                        )}
                                    </div>

                                    <button 
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setAppliedCoupon(isSelected ? null : c);
                                        }}
                                        className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                                            isSelected 
                                                ? 'bg-brand-600 text-white shadow-sm' 
                                                : 'bg-orange-50 text-brand-700 hover:bg-orange-100 border border-orange-200'
                                        }`}
                                    >
                                        {isSelected 
                                            ? (language === 'th' ? '✓ เลือกแล้ว' : '✓ Applied') 
                                            : (language === 'th' ? 'กดใช้คูปอง' : 'Use Coupon')}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </section>
        )}

        {/* REORDER: PROMOTIONS GRID */}
        {activeCategory === 'promotion' && (
            <main className="max-w-7xl mx-auto px-4 py-8 border-b">
                 <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-brand-800">
                    <Star className="text-yellow-500" fill="currentColor"/> Special Offers
                </h2>
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                    {menu.filter(p => p.category === 'promotion').map(item => {
                        const localized = getLocalizedItem(item);
                        return (
                            <div key={item.id} onClick={() => handleCustomize(item)} className={`bg-white rounded-2xl p-2 md:p-3 shadow-sm hover:shadow-lg transition cursor-pointer border border-transparent hover:border-brand-200 group ${!item.available ? 'opacity-60 grayscale' : ''}`}>
                                <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-2 md:mb-3">
                                    <img src={item.image} alt={localized.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500"/>
                                    
                                    {/* Promotional Badge tag */}
                                    {(() => {
                                        const activeBadge = language === 'th' ? (item.badgeTh || item.badge) : (item.badge || item.badgeTh);
                                        return activeBadge ? (
                                            <div className="absolute top-1.5 left-1.5 md:top-2 md:left-2 z-10 bg-gradient-to-r from-red-600 to-amber-500 text-white font-black text-[8px] md:text-[11px] uppercase tracking-wider py-0.5 px-1.5 md:py-1 md:px-2.5 rounded shadow-md animate-pulse">
                                                {activeBadge}
                                            </div>
                                        ) : null;
                                    })()}

                                    {!item.available && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold">{t('soldOut')}</div>}
                                </div>
                                <div className="px-1">
                                    <div className="flex flex-wrap gap-1 mb-1 items-center">
                                        {item.isBestSeller && (
                                            <span className="bg-yellow-400 text-white text-[8px] md:text-[10px] font-black uppercase tracking-wider py-0.5 px-1.5 rounded-md flex items-center gap-0.5 shadow-sm">
                                                <Star size={8} fill="currentColor" className="md:w-2.5 md:h-2.5"/> Hit
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-sm md:text-lg leading-tight mb-1 line-clamp-2">{localized.name}</h3>
                                    <p className="text-gray-500 text-xs md:text-sm line-clamp-2 mb-2 md:mb-3 h-8 md:h-10">{localized.description}</p>
                                    <div className="flex justify-between items-center">
                                        <span className="text-base md:text-lg font-bold text-brand-600">฿{item.basePrice}</span>
                                        <button 
                                            onClick={(e) => handleDirectAddToCart(e, item)}
                                            className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center hover:bg-brand-600 hover:text-white transition cursor-pointer"
                                            title={language === 'th' ? 'สั่งทันที' : 'Add Direct'}
                                        >
                                            <Plus size={16}/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>
        )}

        {/* ... (Review Video, News, Regular Menu, Events, Footer remain same) ... */}
        {/* --- REVIEW VIDEO SECTION --- */}
        {activeCategory === 'promotion' && storeSettings.reviewLinks && storeSettings.reviewLinks.filter(l => l).length > 0 && (
            <section className="bg-white py-8 border-b w-full max-w-full overflow-hidden">
                <div className="max-w-7xl mx-auto px-4">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                        <PlayCircle className="text-red-500" fill="currentColor" /> {t('customerReviews')}
                    </h2>
                    <div className="flex overflow-x-auto pb-4 gap-4 snap-x no-scrollbar">
                        {storeSettings.reviewLinks.filter((l): l is string => !!l).map((link, idx) => (
                            <VideoCard key={`review-${idx}`} url={link} />
                        ))}
                    </div>
                </div>
            </section>
        )}

        {/* NEWS & EVENTS SECTION */}
        {activeCategory === 'promotion' && storeSettings.newsItems && storeSettings.newsItems.length > 0 && (
            <section className="bg-orange-100/50 py-6 border-b">
                 <div className="max-w-7xl mx-auto px-4">
                     <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-brand-800">
                        <Newspaper className="text-brand-600" /> {t('newsEvents')}
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {storeSettings.newsItems.map(news => (
                             <div key={news.id} className="bg-white rounded-xl p-4 shadow-sm border border-orange-200 flex flex-col md:flex-row gap-4 items-center">
                                <div className="w-full md:w-32 h-32 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                                    <img src={news.imageUrl} className="w-full h-full object-cover"/>
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-bold text-gray-800">{news.title}</h3>
                                    <p className="text-sm text-gray-600 mt-1 line-clamp-2">{news.summary}</p>
                                    <div className="flex justify-between items-center mt-2">
                                        <span className="text-xs text-gray-400">{new Date(news.date).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })}</span>
                                        {news.linkUrl && (
                                            <a href={news.linkUrl} target="_blank" className="text-brand-600 text-xs font-bold flex items-center gap-1 hover:underline">
                                                Read More <ArrowRight size={12}/>
                                            </a>
                                        )}
                                    </div>
                                </div>
                             </div>
                        ))}
                    </div>
                 </div>
            </section>
        )}

        {/* Regular Menu Grid */}
        {activeCategory !== 'promotion' && (
            <main className="max-w-7xl mx-auto px-4 py-8">
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
                    {(() => {
                        const rawItems = menu.filter(p => p.category === activeCategory && p.id !== 'p_half_half' && p.id !== 'p_boat');
                        if (activeCategory === 'pizza') {
                            const savedHalfHalf = menu.find(p => p.id === 'p_half_half');
                            const virtualHalfHalfPizza: Pizza = {
                                id: 'p_half_half',
                                name: savedHalfHalf?.name || 'Half-Half Pizza (Create Your Own)',
                                nameTh: savedHalfHalf?.nameTh || 'พิซซ่าครึ่ง-ครึ่ง (รวม 2 หน้าในถาดเดียว)',
                                basePrice: savedHalfHalf?.basePrice || 0, 
                                description: savedHalfHalf?.description || 'Choose 2 flavors in 1 pizza tray! Price is (Average base price + 20 THB).',
                                descriptionTh: savedHalfHalf?.descriptionTh || 'เลือกผสม 2 หน้าที่คุณชอบในถาดเดียว! ราคาคิดเฉลี่ยสองหน้า + 20 บาท',
                                image: savedHalfHalf?.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
                                available: savedHalfHalf !== undefined ? savedHalfHalf.available : true,
                                category: 'pizza',
                                badge: savedHalfHalf?.badge || 'Mix 2-in-1',
                                badgeTh: savedHalfHalf?.badgeTh || 'แบ่งครึ่งผสมผสาน'
                            };

                            const savedPizzaBoat = menu.find(p => p.id === 'p_boat');
                            const virtualPizzaBoat: Pizza = {
                                id: 'p_boat',
                                name: savedPizzaBoat?.name || 'Pizza Boat (2-Piece Custom)',
                                nameTh: savedPizzaBoat?.nameTh || 'พิซซ่าทรงเรือ (เลือกหน้า-ราคากลางแต่ละครึ่ง)',
                                basePrice: savedPizzaBoat?.basePrice || 0, 
                                description: savedPizzaBoat?.description || 'Delicious double boat pizzas! Choose your own custom flavors and custom pricing for each half.',
                                descriptionTh: savedPizzaBoat?.descriptionTh || 'พิซซ่าทรงเรือคู่แสนอร่อย! สามารถเลือกรสชาติและปรับตั้งราคาของแต่ละครึ่งได้อิสระ',
                                image: savedPizzaBoat?.image || 'https://images.unsplash.com/photo-1628840042765-356cda07504e?auto=format&fit=crop&w=800&q=80',
                                available: savedPizzaBoat !== undefined ? savedPizzaBoat.available : true,
                                category: 'pizza',
                                badge: savedPizzaBoat?.badge || 'New Boat',
                                badgeTh: savedPizzaBoat?.badgeTh || 'รูปทรงเรือคู่'
                            };

                            return [virtualPizzaBoat, virtualHalfHalfPizza, ...rawItems];
                        }
                        return rawItems;
                    })().map(item => {
                        const localized = getLocalizedItem(item);
                        return (
                            <div key={item.id} onClick={() => handleCustomize(item)} className={`bg-white rounded-2xl p-2 md:p-3 shadow-sm hover:shadow-lg transition cursor-pointer border border-transparent hover:border-brand-200 group ${!item.available ? 'opacity-60 grayscale' : ''}`}>
                                <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-2 md:mb-3">
                                    <img src={item.image} alt={localized.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-500"/>
                                    
                                    {/* Promotional Badge tag */}
                                    {(() => {
                                        const activeBadge = language === 'th' ? (item.badgeTh || item.badge) : (item.badge || item.badgeTh);
                                        return activeBadge ? (
                                            <div className="absolute top-1.5 left-1.5 md:top-2 md:left-2 z-10 bg-gradient-to-r from-red-600 to-amber-500 text-white font-black text-[8px] md:text-[11px] uppercase tracking-wider py-0.5 px-1.5 md:py-1 md:px-2.5 rounded shadow-md animate-pulse">
                                                {activeBadge}
                                            </div>
                                        ) : null;
                                    })()}

                                    {!item.available && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold">{t('soldOut')}</div>}
                                </div>
                                <div className="px-1">
                                    <div className="flex flex-wrap gap-1 mb-1 items-center">
                                        {item.isBestSeller && (
                                            <span className="bg-yellow-400 text-white text-[8px] md:text-[10px] font-black uppercase tracking-wider py-0.5 px-1.5 rounded-md flex items-center gap-0.5 shadow-sm">
                                                <Star size={8} fill="currentColor" className="md:w-2.5 md:h-2.5"/> Hit
                                            </span>
                                        )}
                                    </div>
                                    <h3 className="font-bold text-gray-900 text-sm md:text-lg leading-tight mb-1 line-clamp-2">{localized.name}</h3>
                                    <p className="text-gray-500 text-xs md:text-sm line-clamp-2 mb-2 md:mb-3 h-8 md:h-10">{localized.description}</p>
                                    <div className="flex justify-between items-center">
                                        <span className="text-base md:text-md font-bold text-brand-600">
                                            {item.id === 'p_half_half' ? (language === 'th' ? 'เลือก 2 หน้า' : 'Select halves') : `฿${item.basePrice}`}
                                        </span>
                                        <button 
                                            onClick={(e) => handleDirectAddToCart(e, item)}
                                            className="w-7 h-7 md:w-8 md:h-8 rounded-full bg-brand-50 text-brand-600 flex items-center justify-center hover:bg-brand-600 hover:text-white transition cursor-pointer"
                                            title={language === 'th' ? 'สั่งทันที' : 'Add Direct'}
                                        >
                                            <Plus size={16}/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </main>
        )}
        
        {/* --- EVENTS & CATERING SECTION (DYNAMIC) --- */}
        {activeCategory === 'promotion' && (
        <section className="bg-gray-900 text-white py-12">
            <div className="max-w-7xl mx-auto px-4">
                <div className="text-center mb-10">
                    <h2 className="text-3xl font-bold mb-4 flex items-center justify-center gap-2">
                        <Sparkles className="text-yellow-400" /> {t('hireForEvents')}
                    </h2>
                    <p className="text-gray-300 max-w-2xl mx-auto">
                        {t('eventDesc')}
                    </p>
                    <div className="mt-6 flex justify-center gap-4">
                        <a href={storeSettings.lineUrl} target="_blank" className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-full font-bold flex items-center gap-2 transition transform hover:scale-105">
                            <MessageCircle size={20} /> {t('contactLine')}
                        </a>
                        <a href={`tel:${storeSettings.contactPhone}`} className="bg-white hover:bg-gray-100 text-gray-900 px-6 py-3 rounded-full font-bold flex items-center gap-2 transition transform hover:scale-105">
                            <Phone size={20} /> {t('callUs')}
                        </a>
                    </div>
                </div>

                {/* Event Gallery Dynamic */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {cateringImages.map((img, i) => (
                        <div key={i} className="rounded-xl overflow-hidden shadow-lg h-64 relative group">
                            <img src={img} className="w-full h-full object-cover transition duration-500 group-hover:scale-110" />
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition"></div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
        )}
        
        {/* --- FOOTER --- */}
        <footer className="bg-gray-900 text-white py-12 mt-auto">
            <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-3 gap-8 text-center md:text-left">
                <div>
                     <h3 className="font-bold text-xl mb-4 text-brand-500 flex items-center justify-center md:justify-start gap-2"><ChefHat/> Pizza Damac</h3>
                     <p className="text-gray-400 text-sm">Authentic Italian Pizza in Nonthaburi.<br/>Fresh ingredients, delicious taste.</p>
                </div>
                <div className="flex flex-col items-center md:items-start">
                    <h3 className="font-bold text-lg mb-4">{t('findUs')}</h3>
                    <div className="flex gap-4">
                        <a href={storeSettings.mapUrl} target="_blank" className="bg-gray-800 p-2 rounded-full hover:bg-brand-600 transition"><MapPin size={20}/></a>
                        <a href={storeSettings.facebookUrl} target="_blank" className="bg-gray-800 p-2 rounded-full hover:bg-brand-600 transition"><Facebook size={20}/></a>
                        <a href={storeSettings.lineUrl} target="_blank" className="bg-gray-800 p-2 rounded-full hover:bg-brand-600 transition"><MessageCircle size={20}/></a>
                        <a href={`tel:${storeSettings.contactPhone}`} className="bg-gray-800 p-2 rounded-full hover:bg-brand-600 transition"><Phone size={20}/></a>
                    </div>
                </div>
                <div className="flex flex-col items-center md:items-start">
                    <h3 className="font-bold text-lg mb-4">Opening Hours</h3>
                    <p className="text-gray-400 text-sm">Everyday: 11:00 - 20:30</p>
                </div>
            </div>
            
            <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-500 text-xs">
                <div className="flex justify-center gap-4 mb-4">
                    <button onClick={() => navigateTo('kitchen')} className="hover:text-white transition flex items-center gap-1"><Lock size={10}/> Kitchen Display</button>
                    <button onClick={() => navigateTo('pos')} className="hover:text-white transition flex items-center gap-1"><Lock size={10}/> POS System</button>
                </div>
                <p>&copy; 2024 Pizza Damac. All rights reserved.</p>
            </div>
        </footer>

        {/* --- LIVE ORDER TRACKER --- */}
        {activeOrder && !showTracker && !isCartOpen && (
             <div className={`fixed right-4 z-40 animate-bounce-short ${cart.length > 0 ? 'bottom-24' : 'bottom-4'}`}>
                 <button onClick={() => setShowTracker(true)} className="bg-brand-600 text-white p-3 rounded-full shadow-lg border-2 border-white flex items-center gap-2">
                     <Activity className="animate-pulse"/>
                     <span className="font-bold text-sm hidden md:inline">{t('trackOrder')}</span>
                 </button>
             </div>
        )}

        {showTracker && activeOrder && (
             <div className="fixed bottom-4 left-4 right-4 md:left-auto md:w-80 z-40 max-h-[85vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-200 animate-fade-in custom-scrollbar">
                 <div className="bg-brand-600 p-3 text-white sticky top-0 z-10 flex justify-between items-center shadow-sm">
                     <h3 className="font-bold flex items-center gap-2"><Activity size={18}/> {language === 'th' ? 'สถานะ:' : 'Status:'} {t(activeOrder.status as any)}</h3>
                     <div className="flex gap-2">
                         <button onClick={handleManualRefresh} className={`p-1 hover:bg-white/20 rounded ${isRefreshing ? 'animate-spin' : ''}`}><RotateCw size={16}/></button>
                         <button onClick={() => setShowTracker(false)}><X size={18}/></button>
                     </div>
                 </div>
                 <div className="p-4 space-y-4">
                     <div className="flex justify-between items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                         <span className="text-xs text-gray-500 font-bold">{language === 'th' ? 'หมายเลขอ้างอิง' : 'Ref No:'}</span>
                         <span className="text-sm font-mono font-bold text-gray-900 px-2 py-1 bg-white rounded border border-gray-200">#{activeOrder.id.slice(-4)}</span>
                     </div>
                     <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
                         <div className={`h-full transition-all duration-1000 ${
                             activeOrder.status === 'pending' ? 'w-1/6 bg-yellow-400' :
                             activeOrder.status === 'confirmed' ? 'w-2/6 bg-blue-500' :
                             activeOrder.status === 'acknowledged' ? 'w-3/6 bg-indigo-500' :
                             activeOrder.status === 'cooking' ? 'w-4/6 bg-orange-500 animate-pulse' :
                             activeOrder.status === 'ready' ? 'w-5/6 bg-green-500' :
                             'w-full bg-green-600'
                         }`}></div>
                     </div>
                     <p className="text-xs text-center text-gray-500">
                          {activeOrder.status === 'cooking' ? 'Your delicious pizza is in the oven!' : 'We are preparing your order.'}
                     </p>

                     {/* Delivery Fee Info */}
                     {activeOrder.type === 'delivery' && (
                         <div className="bg-gray-50 p-2 rounded-lg text-xs space-y-1">
                             <div className="flex justify-between text-gray-600">
                                 <span>{language === 'th' ? 'ค่าจัดส่ง:' : 'Delivery Fee:'}</span>
                                 <span className="font-bold">{activeOrder.deliveryFee === 'pending' ? (language === 'th' ? 'รอตรวจสอบ' : 'Pending') : `฿${activeOrder.deliveryFee}`}</span>
                             </div>
                             <div className="flex justify-between font-bold text-brand-700">
                                 <span>{language === 'th' ? 'ยอดรวมสุทธิ:' : 'Net Total:'}</span>
                                 <span className="text-base">฿{activeOrder.totalAmount}</span>
                             </div>
                             
                             {activeOrder.status === 'pending' && (
                                <button className="mt-2 text-brand-600 font-bold underline bg-brand-50 w-full rounded py-1 hover:bg-brand-100 transition"
                                        onClick={async () => {
                                            if (confirm(language === 'th' ? "ยืนยันการเปลี่ยนเป็น 'ไปรับเองที่ร้าน' (ค่าส่งจะเป็น 0 บาท)?" : "Switch to pickup in-store (Delivery free)?")) {
                                                await updateOrderTypeToPickup(activeOrder.id);
                                            }
                                        }}
                                >
                                     {language === 'th' ? 'เปลี่ยนเป็น 🚶 มารับเอง (ไม่มีค่าส่ง)' : 'Switch to 🚶 Pickup (No fee)'}
                                </button>
                             )}
                         </div>
                     )}

                     {/* QR Payment Code logic inside tracker */}
                     {activeOrder.paymentMethod === 'qr_transfer' && activeOrder.status === 'pending' && (
                         <div className="border border-brand-200 rounded-xl p-3 bg-white shadow-inner flex flex-col items-center">
                              {activeOrder.deliveryFee === 'pending' ? (
                                  <div className="text-center font-bold text-orange-500 text-xs py-4">
                                      <Clock className="w-8 h-8 mx-auto mb-2 animate-bounce"/>
                                      {language === 'th' ? 'กรุณารอสักครู่... ร้านกำลังตรวจสอบค่าจัดส่ง' : 'Please wait... Check delivery fee'}
                                  </div>
                              ) : (
                                  <>
                                      <h4 className="text-xs font-bold text-gray-600 mb-2">{language === 'th' ? 'สแกนเพื่อชำระเงิน' : 'Scan via Bank App'}</h4>
                                      <div className="p-2 border border-gray-100 rounded-lg bg-white inline-block">
                                        <QRCodeCanvas id="promptpay-qr-tracker" value={generatePromptPayPayload(storeSettings.promptPayNumber || DEFAULT_STORE_SETTINGS.promptPayNumber!, activeOrder.totalAmount)} size={150} level="M" includeMargin={true} />
                                      </div>
                                      <button 
                                          type="button"
                                          onClick={() => handleDownloadQR('promptpay-qr-tracker', activeOrder.id.slice(-4))}
                                          className="mt-2 mb-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-brand-600 text-white hover:bg-brand-700 active:scale-95 text-[11px] font-bold rounded-lg transition shadow-xs w-full max-w-[160px]"
                                      >
                                          <Download size={12} className="text-white"/>
                                          <span>{language === 'th' ? 'บันทึกรูป QR ลงเครื่อง' : 'Save QR Image'}</span>
                                      </button>
                                      <p className="text-brand-600 font-extrabold text-lg mt-1">฿{activeOrder.totalAmount}</p>
                                      <p className="text-[10px] text-gray-400 text-center mt-2 leading-tight">
                                          {language === 'th' ? 'ชำระแล้วให้ส่งสลิปมาที่ Line ร้าน' : 'After payment, send slip to our Line'}
                                      </p>
                                  </>
                              )}
                         </div>
                     )}

                     {/* Thai Chuay Thai Payment inside tracker */}
                     {activeOrder.paymentMethod === 'thai_chuay_thai' && activeOrder.status === 'pending' && (
                         <div className="border border-sky-300 rounded-xl p-4 bg-sky-50 shadow-xs flex flex-col items-center text-center space-y-3">
                             <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 animate-bounce shrink-0">
                                 <Sparkles size={24}/>
                             </div>
                             <div>
                                 <h4 className="text-xs font-black text-sky-950 uppercase">{language === 'th' ? 'ชำระผ่านโครงการไทยช่วยไทย (เป๋าตัง)' : 'Paid via Thai Chuay Thai (Paotang)'}</h4>
                                 <p className="text-[10px] text-sky-700 font-medium mt-1 leading-normal">
                                     {language === 'th' 
                                         ? 'ร้านค้าต้องสร้าง QR Code แบบระบุยอดเงินด้วยแอป "ถุงเงิน" เพื่อเปิดให้สแกนจ่ายและตัดสิทธิ์รับการช่วยเหลือ' 
                                         : 'Store needs to generate an order QR Code from their "Tungngern" app.'}
                                 </p>
                             </div>

                             <div className="bg-white p-2.5 rounded-lg border border-sky-200.5 w-full font-bold">
                                 <p className="text-[9px] text-gray-400 uppercase font-black">{language === 'th' ? 'ยอดที่ต้องการสแกนสิทธิ์' : 'Amount to scan'}</p>
                                 <p className="text-lg font-black text-sky-600">฿{activeOrder.totalAmount}</p>
                             </div>

                             <div className="text-[10.5px] text-gray-600 leading-normal font-sans font-medium space-y-1 text-left w-full border-t border-sky-100 pt-2.5">
                                 <p className="font-extrabold text-sky-950 mb-1">{language === 'th' ? '👉 แนะนำขั้นตอนถัดไป' : '👉 Next Steps'}</p>
                                 <p>{language === 'th' ? '1. เตรียมแอปพลิเคชัน "เป๋าตัง" ของท่านให้พร้อม' : '1. Prepare your Paotang app.'}</p>
                                 <p>{language === 'th' ? '2. ทำการสแกน QR Code โครงการกับทางร้านค้าเพื่อชำระเงิน' : '2. Scan the project QR code directly at the store to pay.'}</p>
                             </div>
                         </div>
                     )}

                     {/* Contact Options */}
                     <div className="grid grid-cols-2 gap-2 text-xs">
                          {storeSettings.contactPhone && (
                              <a href={`tel:${storeSettings.contactPhone}`} className="flex flex-col items-center justify-center p-2 rounded-lg bg-emerald-50 text-emerald-700 font-bold hover:bg-emerald-100">
                                  <Phone size={16} className="mb-1"/> Call Store
                              </a>
                          )}
                          {storeSettings.lineUrl && (
                              <a href={storeSettings.lineUrl} target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-2 rounded-lg bg-[#00B900]/10 text-[#00B900] font-bold hover:bg-[#00B900]/20">
                                  <MessageCircle size={16} className="mb-1"/> Line Us
                              </a>
                          )}
                     </div>

                     <a href={storeSettings.reviewUrl} target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1">
                         <Star size={12} fill="orange" className="text-orange-400"/> {t('reviewGoogle')}
                     </a>
                 </div>
             </div>
        )}

        {/* --- FLOATING BOTTOM CART BAR (MOBILE ONLY) --- */}
        {cart.length > 0 && !isCartOpen && (
            <div className="fixed bottom-4 left-4 right-4 z-40 md:hidden animate-fade-in">
                <button 
                    onClick={() => setIsCartOpen(true)}
                    className="w-full bg-brand-600 text-white p-4 rounded-xl shadow-2xl flex justify-between items-center border-2 border-white/20 backdrop-blur-md"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-white text-brand-600 font-bold w-8 h-8 rounded-full flex items-center justify-center shadow-sm">
                            {cart.reduce((s,i)=>s+i.quantity,0)}
                        </div>
                        <span className="font-bold text-lg tracking-tight">{t('yourOrder')}</span>
                    </div>
                    <div className="flex items-center gap-2 font-bold text-xl">
                        <span>฿{cartTotal}</span>
                        <ChevronRight size={24} className="animate-pulse"/>
                    </div>
                </button>
            </div>
        )}

        {/* --- CUSTOMIZATION MODAL (Remains unchanged) --- */}
        {selectedPizza && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                {isComboBuilderOpen ? (
                     <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                         <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
                             <h2 className="text-xl font-bold flex items-center gap-2"><Layers className="text-brand-600"/> Build Your {selectedPizza.name}</h2>
                             <button onClick={() => {setIsComboBuilderOpen(false); setSelectedPizza(null)}} className="text-gray-400 hover:text-gray-600"><X size={24}/></button>
                         </div>
                         <div className="flex-1 overflow-y-auto p-6 bg-gray-100">
                             {/* Combo Slots */}
                             {!currentComboSlot && currentComboSlot !== 0 ? (
                                 <div className="space-y-4">
                                     <p className="text-center text-gray-500 mb-4">Select {selectedPizza.comboCount} pizzas for your bundle.</p>
                                     <div className="grid grid-cols-1 gap-4">
                                         {Array.from({length: selectedPizza.comboCount || 2}).map((_, idx) => (
                                             <button 
                                                 key={idx}
                                                 onClick={() => handleOpenComboSlot(idx)}
                                                 className={`w-full p-4 rounded-xl border-2 border-dashed flex items-center justify-between transition ${comboSelections[idx] ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-brand-300 bg-white'}`}
                                             >
                                                 <div className="flex items-center gap-3">
                                                     <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${comboSelections[idx] ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                                                         {idx + 1}
                                                     </div>
                                                     <span className={`font-bold ${comboSelections[idx] ? 'text-gray-900' : 'text-gray-400'}`}>
                                                         {comboSelections[idx] ? comboSelections[idx].name : 'Select Pizza...'}
                                                     </span>
                                                 </div>
                                                 <ChevronRight size={20} className="text-gray-400"/>
                                             </button>
                                         ))}
                                     </div>
                                     
                                     {/* Special Instructions for Combo */}
                                     <div className="bg-white p-4 rounded-xl border border-gray-200 mt-4">
                                         <label className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><MessageCircle size={14}/> Special Instructions</label>
                                         <textarea 
                                             className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-brand-500 outline-none transition text-sm" 
                                             placeholder="e.g. No spicy, Less salt..."
                                             rows={2}
                                             value={specialInstructions}
                                             onChange={e => setSpecialInstructions(e.target.value)}
                                         />
                                     </div>
                                 </div>
                             ) : (
                                 // Pizza Selector for Slot
                                 <div>
                                     <button onClick={() => setCurrentComboSlot(null)} className="mb-4 text-sm font-bold text-gray-500 flex items-center gap-1 hover:text-gray-800"><ArrowLeft size={16}/> Back to Bundle</button>
                                     <h3 className="font-bold text-lg mb-4">Choose Pizza #{currentComboSlot + 1}</h3>
                                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                         {/* Updated Filter: Exclude Promotions, respect allowedPromotions & enforce pizza category */}
                                         {menu.filter(p => {
                                             if (p.category !== 'pizza') return false;
                                             if (p.id === 'custom_base' || p.id === 'p_half_half') return false;
                                             if (!p.available) return false;
                                             if ((p.comboCount || 0) > 0) return false;
                                             // Check eligibility
                                             if (p.allowedPromotions && p.allowedPromotions.length > 0) {
                                                 return p.allowedPromotions.includes(selectedPizza.id);
                                             }
                                             return true; // Allowed in all if empty
                                         }).map(pizza => (
                                             <button 
                                                 key={pizza.id} 
                                                 onClick={() => handleSelectComboPizza(pizza)}
                                                 className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border hover:border-brand-500 text-left transition"
                                             >
                                                 <img src={pizza.image} className="w-12 h-12 rounded-lg object-cover"/>
                                                 <div>
                                                    <div className="font-bold text-sm text-gray-800 flex items-center gap-1.5">{(() => { const subB = language === 'th' ? (pizza.badgeTh || pizza.badge) : (pizza.badge || pizza.badgeTh); return subB ? <span className="bg-gradient-to-r from-red-600 to-amber-500 text-white text-[8px] font-black uppercase px-1.5 py-0.5 rounded shadow-sm shrink-0 animate-pulse">{subB}</span> : null; })()}{getLocalizedItem(pizza).name}</div>
                                                    <div className="text-xs text-gray-400 font-bold mt-0.5">฿{pizza.basePrice}</div>
                                                    {pizza.basePrice > 380 && (
                                                        <div className="mt-1">
                                                            <span className="bg-orange-50 text-orange-700 text-[10px] font-black px-2 py-0.5 rounded-lg border border-orange-200">
                                                                +{pizza.basePrice - 380} ฿
                                                            </span>
                                                        </div>
                                                    )}
                                                 </div>
                                             </button>
                                         ))}
                                     </div>
                                 </div>
                             )}
                         </div>
                         <div className="p-4 border-t bg-white flex justify-between items-center">
                             <div>
                                 <div className="text-[10px] font-extrabold text-gray-400 uppercase leading-none mb-1">{language === 'th' ? 'ยอดรวมเซ็ตนี้' : 'Bundle Price'}</div>
                                 <div className="font-black text-2xl text-brand-600">
                                     ฿{selectedPizza.basePrice + comboSelections.reduce((sum, item) => {
                                         if (!item) return sum;
                                         const p = menu.find(m => m.id === item.pizzaId);
                                         if (p && p.basePrice > 380) {
                                             return sum + (p.basePrice - 380);
                                         }
                                         return sum;
                                     }, 0)}
                                 </div>
                             </div>
                             {!currentComboSlot && currentComboSlot !== 0 && (
                                 <button 
                                     disabled={comboSelections.filter(Boolean).length < (selectedPizza.comboCount || 0)}
                                     onClick={handleAddComboToCart}
                                     className="bg-brand-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                 >
                                     Add Bundle
                                 </button>
                             )}
                         </div>
                     </div>
                ) : (
                    // Standard Customization
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        {/* Header */}
                        <div className="relative h-48 md:h-56">
                            <img src={selectedPizza.image} className="w-full h-full object-cover"/>
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                            <button onClick={() => setSelectedPizza(null)} className="absolute top-4 right-4 bg-black/30 hover:bg-black/50 text-white p-2 rounded-full backdrop-blur-sm transition"><X size={20}/></button>
                            <div className="absolute bottom-4 left-4 text-white">
                                <h2 className="text-2xl md:text-3xl font-bold">{getLocalizedItem(selectedPizza).name}</h2>
                                <p className="text-white/80 text-sm mt-1">{getLocalizedItem(selectedPizza).description}</p>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
                            {/* Make Your Own Logic */}
                            {selectedPizza.id === 'custom_base' && (
                                <div className="mb-6">
                                     <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">{t('nameCreation')}</label>
                                     <input 
                                         type="text" 
                                         className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-brand-500 outline-none transition" 
                                         placeholder="e.g. My Super Pizza"
                                         value={customName}
                                         onChange={e => setCustomName(e.target.value)}
                                     />
                                </div>
                            )}
                            
                            {/* Half-Half Pizza customizer picker views */}
                            {selectedPizza.id === 'p_half_half' && (
                                <div className="mb-6 bg-amber-50/50 p-4 rounded-2xl border border-amber-200 text-left shadow-sm">
                                     <h3 className="font-bold text-amber-900 flex items-center gap-2 mb-4 text-left">
                                         <span className="p-1.5 bg-amber-100 text-amber-600 rounded-lg text-sm">🌓</span> 
                                         {language === 'th' ? 'เลือกหน้าผสม 2 ฝั่ง' : 'Customize Your Two Halves'}
                                     </h3>
                                     
                                     <div className="space-y-4">
                                          {/* Half A */}
                                          <div className="text-left">
                                               <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">
                                                   {language === 'th' ? 'ครึ่งแรก (ฝั่งซ้าย)' : 'First Half (Side A)'}
                                               </label>
                                               <select 
                                                   className="w-full border-2 border-gray-250 rounded-xl p-3 focus:border-amber-500 outline-none text-sm font-bold bg-white text-gray-850"
                                                   value={halfA?.id || ''}
                                                   onChange={(e) => {
                                                       const found = menu.find(p => p.id === e.target.value);
                                                       setHalfA(found || null);
                                                   }}
                                               >
                                                   <option value="">{language === 'th' ? '-- เลือกหน้าสำหรับครึ่งแรก --' : '-- Choose side A --'}</option>
                                                   {menu.filter(p => p.category === 'pizza' && p.id !== 'custom_base' && p.id !== 'p_half_half' && p.available).map(pItem => (
                                                       <option key={pItem.id} value={pItem.id}>
                                                           {language === 'th' ? pItem.nameTh || pItem.name : pItem.name} (฿{pItem.basePrice})
                                                       </option>
                                                   ))}
                                               </select>
                                               {halfA && (
                                                   <div className="mt-2 flex items-center gap-3 p-2 bg-white rounded-xl border border-gray-150 shadow-sm animate-fade-in text-left">
                                                       <img src={halfA.image} className="w-10 h-10 object-cover rounded-lg" />
                                                       <div>
                                                           <div className="text-xs font-bold text-gray-800">{language === 'th' ? halfA.nameTh || halfA.name : halfA.name}</div>
                                                           <div className="text-[10px] text-gray-500">฿{halfA.basePrice / 2}</div>
                                                       </div>
                                                   </div>
                                               )}
                                          </div>

                                          {/* Half B */}
                                          <div className="text-left">
                                               <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">
                                                   {language === 'th' ? 'ครึ่งหลัง (ฝั่งขวา)' : 'Second Half (Side B)'}
                                               </label>
                                               <select 
                                                   className="w-full border-2 border-gray-250 rounded-xl p-3 focus:border-amber-500 outline-none text-sm font-bold bg-white text-gray-850"
                                                   value={halfB?.id || ''}
                                                   onChange={(e) => {
                                                       const found = menu.find(p => p.id === e.target.value);
                                                       setHalfB(found || null);
                                                   }}
                                               >
                                                   <option value="">{language === 'th' ? '-- เลือกหน้าสำหรับครึ่งหลัง --' : '-- Choose side B --'}</option>
                                                   {menu.filter(p => p.category === 'pizza' && p.id !== 'custom_base' && p.id !== 'p_half_half' && p.available).map(pItem => (
                                                       <option key={pItem.id} value={pItem.id}>
                                                           {language === 'th' ? pItem.nameTh || pItem.name : pItem.name} (฿{pItem.basePrice})
                                                       </option>
                                                   ))}
                                               </select>
                                               {halfB && (
                                                   <div className="mt-2 flex items-center gap-3 p-2 bg-white rounded-xl border border-gray-150 shadow-sm animate-fade-in text-left">
                                                       <img src={halfB.image} className="w-10 h-10 object-cover rounded-lg" />
                                                       <div>
                                                           <div className="text-xs font-bold text-gray-800">{language === 'th' ? halfB.nameTh || halfB.name : halfB.name}</div>
                                                           <div className="text-[10px] text-gray-500">฿{halfB.basePrice / 2}</div>
                                                       </div>
                                                   </div>
                                               )}
                                          </div>
                                     </div>
                                </div>
                            )}

                            {/* Special Instructions */}
                            {/* Pizza Boat Customizer picker views */}
                            {selectedPizza.id === 'p_boat' && (
                                <div className="mb-6 bg-blue-50/50 p-4 rounded-2xl border border-blue-200 text-left shadow-sm animate-fade-in">
                                     <h3 className="font-bold text-blue-950 flex items-center gap-2 mb-4 text-left">
                                         <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg text-sm">⛵</span> 
                                         {language === 'th' ? 'แต่งหน้าพิซซ่าทรงเรือ 2 ชิ้น' : 'Customize Pizza Boat (2 Pieces)'}
                                     </h3>
                                     
                                     <div className="space-y-4">
                                          {/* Piece A */}
                                          <div className="text-left bg-white p-3.5 rounded-xl border border-blue-100">
                                               <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">
                                                   {language === 'th' ? 'ชิ้นที่ 1 (Side A)' : 'Piece 1 (Side A)'}
                                               </label>
                                               <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                   <select 
                                                       className="w-full border-2 border-gray-250 rounded-xl p-2.5 focus:border-blue-500 outline-none text-sm font-bold bg-white text-gray-850"
                                                       value={boatA?.id || ''}
                                                       onChange={(e) => {
                                                           const found = menu.find(p => p.id === e.target.value);
                                                           setBoatA(found || null);
                                                           setBoatPriceA(found ? Math.round(found.basePrice / 2) : 0);
                                                       }}
                                                   >
                                                       <option value="">{language === 'th' ? '-- เลือกรสชาติชิ้นที่ 1 --' : '-- Choose Flavor A --'}</option>
                                                       {menu.filter(p => p.category === 'pizza' && p.id !== 'custom_base' && p.id !== 'p_half_half' && p.id !== 'p_boat' && p.available).map(pItem => (
                                                           <option key={pItem.id} value={pItem.id}>
                                                               {language === 'th' ? pItem.nameTh || pItem.name : pItem.name} (฿{pItem.basePrice})
                                                           </option>
                                                       ))}
                                                   </select>
                                                   
                                                   <div>
                                                       <div className="flex items-center border-2 border-gray-250 bg-white rounded-xl overflow-hidden focus-within:border-blue-500 transition">
                                                           <span className="bg-gray-100 px-3 py-2 text-xs font-bold text-gray-500 border-r border-gray-250">฿</span>
                                                           <input 
                                                               type="number" 
                                                               placeholder={language === 'th' ? 'ราคาชิ้นแรก' : 'Price A'}
                                                               value={boatPriceA || ''} 
                                                               onChange={(e) => setBoatPriceA(Number(e.target.value))}
                                                               className="w-full px-3 py-2 text-sm font-extrabold outline-none bg-transparent"
                                                           />
                                                       </div>
                                                       <span className="text-[10px] text-gray-400 mt-0.5 block">{language === 'th' ? 'ปรับเปลี่ยนราคาของชิ้นนี้เองได้' : 'Can set custom price for this part'}</span>
                                                    </div>
                                                </div>
                                           </div>

                                           {/* Piece B */}
                                           <div className="text-left bg-white p-3.5 rounded-xl border border-blue-100">
                                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">
                                                    {language === 'th' ? 'ชิ้นที่ 2 (Side B)' : 'Piece 2 (Side B)'}
                                                </label>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <select 
                                                        className="w-full border-2 border-gray-250 rounded-xl p-2.5 focus:border-blue-500 outline-none text-sm font-bold bg-white text-gray-850"
                                                        value={boatB?.id || ''}
                                                        onChange={(e) => {
                                                            const found = menu.find(p => p.id === e.target.value);
                                                            setBoatB(found || null);
                                                            setBoatPriceB(found ? Math.round(found.basePrice / 2) : 0);
                                                        }}
                                                    >
                                                        <option value="">{language === 'th' ? '-- เลือกรสชาติชิ้นที่ 2 --' : '-- Choose Flavor B --'}</option>
                                                        {menu.filter(p => p.category === 'pizza' && p.id !== 'custom_base' && p.id !== 'p_half_half' && p.id !== 'p_boat' && p.available).map(pItem => (
                                                            <option key={pItem.id} value={pItem.id}>
                                                                {language === 'th' ? pItem.nameTh || pItem.name : pItem.name} (฿{pItem.basePrice})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    
                                                    <div>
                                                        <div className="flex items-center border-2 border-gray-250 bg-white rounded-xl overflow-hidden focus-within:border-blue-500 transition">
                                                            <span className="bg-gray-100 px-3 py-2 text-xs font-bold text-gray-500 border-r border-gray-250">฿</span>
                                                            <input 
                                                                type="number" 
                                                                placeholder={language === 'th' ? 'ราคาชิ้นหลัง' : 'Price B'}
                                                                value={boatPriceB || ''} 
                                                                onChange={(e) => setBoatPriceB(Number(e.target.value))}
                                                                className="w-full px-3 py-2 text-sm font-extrabold outline-none bg-transparent"
                                                            />
                                                        </div>
                                                        <span className="text-[10px] text-gray-400 mt-0.5 block">{language === 'th' ? 'ปรับเปลี่ยนราคาของชิ้นนี้เองได้' : 'Can set custom price for this part'}</span>
                                                    </div>
                                                </div>
                                           </div>
                                      </div>
                                 </div>
                             )}



                            <div className="mb-6">
                                 <label className="text-xs font-bold text-gray-500 uppercase mb-2 flex items-center gap-1"><MessageCircle size={14}/> Special Instructions</label>
                                 <textarea 
                                     className="w-full border-2 border-gray-200 rounded-xl p-3 focus:border-brand-500 outline-none transition text-sm" 
                                     placeholder="e.g. No spicy, Less salt, No olive..."
                                     rows={2}
                                     value={specialInstructions}
                                     onChange={e => setSpecialInstructions(e.target.value)}
                                 />
                            </div>

                            {/* Toppings Section */}
                            {selectedPizza.category === 'pizza' && (
                                <>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><ChefHat size={18}/> {t('customizeToppings')}</h3>
                                        <button onClick={() => {
                                            const lucky = generateLuckyPizza();
                                            if (lucky) {
                                                setSelectedPizza(lucky.pizza);
                                                setSelectedToppings(lucky.toppings);
                                            }
                                        }} className="text-xs font-bold text-purple-600 bg-purple-100 px-2 py-1 rounded-full flex items-center gap-1 hover:bg-purple-200 transition">
                                            <Dices size={12}/> {t('fateDecide')}
                                        </button>
                                    </div>
                                    
                                    {/* Categorized Toppings */}
                                    {Object.entries(groupedToppings).map(([key, group]) => {
                                        // Only show available toppings
                                        const availableGroup = group.filter(t => t.available !== false);
                                        if (availableGroup.length === 0) return null;
                                        
                                        // Only show Sauce section for Custom Pizza
                                        if (key === 'sauce' && selectedPizza.id !== 'custom_base') return null;

                                        return (
                                            <div key={key} className="mb-6">
                                                <h4 className="text-xs font-bold text-gray-500 uppercase mb-2 ml-1">{key}</h4>
                                                <div className="grid grid-cols-2 gap-3">
                                                    {availableGroup.map(topping => {
                                                        const isSelected = selectedToppings.some(t => t.id === topping.id);
                                                        return (
                                                            <button
                                                                key={topping.id}
                                                                onClick={() => toggleTopping(topping)}
                                                                className={`p-2 rounded-xl border text-left transition relative flex items-center gap-3 overflow-hidden ${isSelected ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'}`}
                                                            >
                                                                <div className="w-10 h-10 bg-gray-100 rounded-lg shrink-0 overflow-hidden">
                                                                    {topping.image ? (
                                                                        <img src={topping.image} className="w-full h-full object-cover"/>
                                                                    ) : (
                                                                        <div className="w-full h-full flex items-center justify-center text-gray-300"><ChefHat size={16}/></div>
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <div className="flex justify-between items-center relative z-10">
                                                                        <span className="font-bold text-sm">{language === 'th' ? topping.nameTh : topping.name}</span>
                                                                    </div>
                                                                    <div className="text-xs opacity-70 mt-0.5 relative z-10">{topping.price > 0 ? `+฿${topping.price}` : 'Free'}</div>
                                                                </div>
                                                                {isSelected && <CheckCircle2 size={18} className="absolute top-2 right-2 text-brand-600"/>}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 md:p-6 bg-white border-t border-gray-100 flex justify-between items-center shrink-0">
                            <div className="flex flex-col text-left">
                                <span className="text-xs text-gray-400 uppercase font-bold">Total Price</span>
                                <span className="text-2xl font-bold text-gray-900">
                                    ฿{selectedPizza.id === 'p_half_half' 
                                        ? (halfA && halfB 
                                            ? Math.round((halfA.basePrice / 2) + (halfB.basePrice / 2) + 20) + selectedToppings.reduce((s,t) => s + t.price, 0)
                                            : 20 + selectedToppings.reduce((s,t) => s + t.price, 0))
                                        : selectedPizza.id === 'p_boat'
                                        ? ((Number(boatPriceA || 0) + Number(boatPriceB || 0)) + selectedToppings.reduce((s,t) => s + t.price, 0))
                                        : selectedPizza.basePrice + selectedToppings.reduce((s,t) => s + t.price, 0)}
                                </span>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={handleSaveFavorite} className="p-3 rounded-xl border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-200 transition">
                                    <Heart size={24}/>
                                </button>
                                <button onClick={handleAddToCart} className="bg-brand-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-brand-700 shadow-lg shadow-brand-200 transition flex items-center gap-2">
                                    <Plus size={20}/> {t('addToOrder')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* ... (Cart Modal remains same) ... */}
        {isCartOpen && (
            <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm animate-fade-in">
                <div className="bg-white w-full md:w-[450px] h-full shadow-2xl flex flex-col animate-slide-in">
                    <div className="p-5 border-b flex justify-between items-center bg-gray-50">
                        <h2 className="font-bold text-xl flex items-center gap-2"><ShoppingBag className="text-brand-600"/> {t('yourOrder')}</h2>
                        <button onClick={() => setIsCartOpen(false)} className="bg-gray-200 p-2 rounded-full hover:bg-gray-300"><X size={20}/></button>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
                                <ShoppingBag size={64} className="text-gray-200"/>
                                <p className="font-medium">{t('cartEmpty')}</p>
                                <button onClick={() => setIsCartOpen(false)} className="text-brand-600 font-bold hover:underline">Browse Menu</button>
                            </div>
                        ) : (
                            <>
                                {/* Order Type Selector */}
                                <div className="bg-white p-1 rounded-xl shadow-sm border border-gray-200 flex mb-6">
                                    {tableSession ? (
                                        <button className="flex-1 py-2 text-sm font-bold rounded-lg bg-green-100 text-green-700">
                                            Table {tableSession}
                                        </button>
                                    ) : (
                                        <>
                                            <button 
                                                type="button"
                                                onClick={() => setOrderType('dine-in')} 
                                                className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition ${orderType === 'dine-in' ? 'bg-brand-100 text-brand-700' : 'text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                {language === 'th' ? 'ทานที่ร้าน' : 'Dine-In'}
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => setOrderType('online')} 
                                                className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition ${orderType === 'online' ? 'bg-brand-100 text-brand-700' : 'text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                {language === 'th' ? 'กลับบ้าน' : 'Takeaway'}
                                            </button>
                                            <button 
                                                type="button"
                                                onClick={() => setOrderType('delivery')} 
                                                className={`flex-1 py-2 text-xs md:text-sm font-bold rounded-lg transition ${orderType === 'delivery' ? 'bg-brand-100 text-brand-700' : 'text-gray-500 hover:bg-gray-50'}`}
                                            >
                                                {language === 'th' ? 'เดลิเวอรี่' : 'Delivery'}
                                            </button>
                                        </>
                                    )}
                                </div>
                                
                                {/* Items List */}
                                <div className="space-y-4 mb-6">
                                    {cart.map(item => (
                                        <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative group">
                                            <div className="flex justify-between items-start mb-2">
                                                <div className="pr-6">
                                                    <h4 className="font-bold text-gray-800">{item.name}</h4>
                                                    {item.specialInstructions && <div className="text-xs text-red-500 italic mt-0.5">"{item.specialInstructions}"</div>}
                                                    <p className="text-xs text-gray-500">
                                                        {(item.selectedToppings || []).map(t => language === 'th' ? t.nameTh : t.name).join(', ')}
                                                        {(item.subItems || []).filter(s => s).map(s => `+ ${s.name}`).join(', ')}
                                                    </p>
                                                </div>
                                                <div className="font-bold text-gray-900">฿{item.totalPrice}</div>
                                            </div>
                                            <div className="flex items-center justify-between mt-3">
                                                <div className="flex items-center bg-gray-50 rounded-lg p-1 border border-gray-100">
                                                    <button type="button" onClick={() => item.quantity > 1 ? updateCartItemQuantity(item.id, -1) : removeFromCart(item.id)} className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-white rounded-md shadow-sm transition"><Minus size={16}/></button>
                                                    <span className="w-10 text-center font-bold text-sm">{item.quantity}</span>
                                                    <button type="button" onClick={() => updateCartItemQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-white rounded-md shadow-sm transition"><Plus size={16}/></button>
                                                </div>
                                                <button type="button" onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 p-2"><Trash2 size={20}/></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Order Options */}
                                <div className="space-y-4">
                                     {/* Address for Delivery with interactive pinning map */}
                                     {orderType === 'delivery' && (
                                         <div className="space-y-5 animate-fade-in pb-4">
                                             <div className="bg-brand-50 p-4 rounded-xl border border-brand-200">
                                                 <h3 className="font-bold text-brand-800 flex items-center gap-2 mb-2"><Navigation size={18}/> {language === 'th' ? 'ข้อมูลการจัดส่ง' : 'Delivery Details'}</h3>
                                                 <p className="text-xs text-brand-700 leading-relaxed mb-4">
                                                     {language === 'th' 
                                                         ? 'กรุณากรอกที่อยู่ให้ชัดเจน และใส่ลิงก์พิกัด Google Maps หากมี เพื่อให้พี่ไรเดอร์ไปส่งได้แม่นยำที่สุด'
                                                         : 'Please provide a clear address and a Google Maps link if possible for accurate delivery.'}
                                                 </p>
                                                 
                                                 {/* Profile Address Selection */}
                                                 <div className="flex gap-2 mb-4">
                                                     <button type="button" onClick={() => loadProfile('home')} disabled={!savedProfiles['home']} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1.5 ${savedProfiles['home'] ? 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50 hover:border-gray-400' : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'}`}>
                                                         {language === 'th' ? '🏠 ใช้ที่อยู่บ้าน' : '🏠 Use Home'}
                                                     </button>
                                                     <button type="button" onClick={() => loadProfile('work')} disabled={!savedProfiles['work']} className={`flex-1 py-2 rounded-lg text-xs font-bold border transition flex items-center justify-center gap-1.5 ${savedProfiles['work'] ? 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50 hover:border-gray-400' : 'bg-gray-50 text-gray-400 border-gray-200 cursor-not-allowed opacity-50'}`}>
                                                         {language === 'th' ? '🏢 ใช้ที่อยู่ที่ทำงาน' : '🏢 Use Work'}
                                                     </button>
                                                 </div>

                                                 <div className="space-y-4">
                                                     {/* 1. Address Text */}
                                                     <div className="space-y-1.5">
                                                         <label className="text-xs font-extrabold text-gray-700 uppercase flex items-center gap-1">
                                                             <span className="w-5 h-5 rounded-full bg-brand-200 text-brand-700 flex items-center justify-center text-[10px]">1</span>
                                                             {language === 'th' ? 'ตรวจสอบและพิมพ์ที่อยู่จัดส่งของคุณ' : 'Check & Enter Delivery Address'} <span className="text-red-500">*</span>
                                                         </label>
                                                         <textarea 
                                                            className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none min-h-[80px]" 
                                                            placeholder={language === 'th' ? "เช่น 99/9 หมู่ 1 ซอยพหลโยธิน 2 แขวงสามเสนใน พญาไท กทม 10400" : "Enter house no, street, sub-district, etc..."}
                                                            value={deliveryAddress}
                                                            onChange={e => setDeliveryAddress(e.target.value)}
                                                         />
                                                     </div>

                                                     {/* Phone Number */}
                                                     <div className="space-y-1.5">
                                                         <label className="text-xs font-extrabold text-gray-700 uppercase flex items-center gap-1">
                                                             <Phone size={14} className="text-brand-500 ml-1"/> {language === 'th' ? 'เบอร์โทรติดต่อลูกค้า' : 'Contact Phone'} <span className="text-red-500">*</span>
                                                         </label>
                                                         <input 
                                                             type="tel"
                                                             className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none font-bold"
                                                             placeholder={language === 'th' ? 'เช่น 0891234567' : 'e.g. 0891234567'}
                                                             value={deliveryPhone}
                                                             onChange={e => setDeliveryPhone(e.target.value)}
                                                         />
                                                     </div>

                                                     {/* 2. Google Maps URL or Coordinates */}
                                                     <div className="space-y-1.5 pt-2 border-t border-brand-200/50">
                                                         <label className="text-xs font-extrabold text-gray-700 uppercase flex items-center gap-1">
                                                             <span className="w-5 h-5 rounded-full bg-brand-200 text-brand-700 flex items-center justify-center text-[10px]">2</span>
                                                             {language === 'th' ? 'ใส่ลิงก์พิกัดจาก Google Maps (ถ้ามี)' : 'Paste Google Maps Link (If Any)'}
                                                         </label>
                                                         <div className="relative">
                                                             <Globe size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                                                             <input 
                                                                 type="text"
                                                                 className="w-full border border-gray-300 rounded-lg pl-10 pt-3 pb-3 pr-8 text-sm focus:ring-2 focus:ring-brand-500 outline-none"
                                                                 placeholder={language === 'th' ? "วางลิงก์ https://maps.app.goo.gl/... หรือ 13.88, 100.52" : "Paste maps link or coords here..."}
                                                                 value={mapSearch}
                                                                 onChange={(e) => {
                                                                    const val = e.target.value;
                                                                    setMapSearch(val);
                                                                    const trimmed = val.trim();
                                                                    if (!trimmed) {
                                                                        setHasMapPin(false);
                                                                        return;
                                                                    }

                                                                    const coords = parseAnyMapLink(trimmed);
                                                                    if (coords) {
                                                                        setDeliveryLat(coords.lat);
                                                                        setDeliveryLng(coords.lng);
                                                                        setHasMapPin(true);
                                                                    } else {
                                                                        setHasMapPin(false);
                                                                        // Check if it's a shortlink
                                                                        if (trimmed.includes('maps.app.goo.gl') || trimmed.includes('goo.gl/maps')) {
                                                                            setGpsLoading(true);
                                                                            fetch('/api/resolve-link', {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({ url: trimmed })
                                                                            })
                                                                            .then(res => res.json())
                                                                            .then(data => {
                                                                                if (data && data.targetUrl) {
                                                                                    const resolvedCoords = parseAnyMapLink(data.targetUrl);
                                                                                    if (resolvedCoords) {
                                                                                        setDeliveryLat(resolvedCoords.lat);
                                                                                        setDeliveryLng(resolvedCoords.lng);
                                                                                        setHasMapPin(true);
                                                                                    }
                                                                                }
                                                                            })
                                                                            .catch(err => console.error("Failed to resolve link:", err))
                                                                            .finally(() => setGpsLoading(false));
                                                                        }
                                                                    }
                                                                }}
                                                             />
                                                             {mapSearch && (
                                                                 <button type="button" onClick={() => { setMapSearch(''); setHasMapPin(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={16}/></button>
                                                             )}
                                                         </div>
                                                         
                                                         {mapSearch && !hasMapPin && (
                                                             <div className="bg-orange-50 border border-orange-200 text-orange-800 px-3 py-2 rounded-lg text-xs font-bold flex items-start gap-2 mt-2">
                                                                 <AlertTriangle size={16} className="text-orange-600 shrink-0 mt-0.5"/> 
                                                                 <div className="leading-relaxed">
                                                                     {language === 'th' 
                                                                         ? 'ไม่สามารถอ่านพิกัดจากลิงก์สั้น (maps.app.goo.gl) ได้อัตโนมัติ กรุณากดเข้าลิงก์ไปบนกูเกิลแมพแล้วก็อปลิงก์ในบราวเซอร์หรือพิมพ์พิกัดโดยตรง (เช่น 13.88, 100.52)' 
                                                                         : 'Unable to parse coordinates from this short link automatically. Please open the link in a browser and copy the full URL, or paste direct coordinates.'}
                                                                 </div>
                                                             </div>
                                                         )}

                                                         {hasMapPin && (
                                                             <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2 mt-2">
                                                                 <CheckCircle2 size={16} className="text-emerald-600 shrink-0"/> 
                                                                 <div className="w-full">
                                                                     <div className="flex justify-between items-center bg-white/50 px-2 py-1 rounded">
                                                                         <span>{language === 'th' ? `ระยะทางจัดส่ง:` : `Distance:`}</span>
                                                                         <span className="font-extrabold text-emerald-900 bg-white px-2 py-0.5 rounded shadow-sm">{deliveryDistanceKm.toFixed(2)} km</span>
                                                                     </div>
                                                                     <div className="text-[10px] font-normal leading-tight mt-1 text-emerald-600/90 text-center">
                                                                         {deliveryDistanceKm <= (storeSettings.freeDeliveryRadiusKm || 5) 
                                                                             ? (language === 'th' ? '🛵 จัดส่งโดยไรเดอร์ตามระยะทางจริง' : '🛵 Standard distance-based delivery')
                                                                             : (language === 'th' ? '🛵 จัดส่งโดยไรเดอร์ตามระยะทางจริง' : '🛵 Standard distance-based delivery')}
                                                                         <div className="text-emerald-800 font-medium mt-1.5 leading-tight flex items-start gap-1 text-left bg-emerald-100/50 p-2 rounded">
                                                                             <AlertTriangle size={12} className="shrink-0 mt-0.5 text-amber-500"/>
                                                                             <span>{language === 'th' ? 'ระยะทางที่แสดงผลนี้อาจจะไม่ถูกต้อง 100% ทางร้านจะตรวจเช็คระยะทางจริงจาก Google Map และแจ้งค่าจัดส่งที่แน่ชัดอีกครั้ง' : 'Distance shown is estimated. The store will verify the exact distance via Google Maps and confirm the final fee.'}</span>
                                                                         </div>
                                                                     </div>
                                                                 </div>
                                                             </div>
                                                         )}
                                                     </div>

                                                     {/* 2.5 Google Interactive Map Selector */}
                                                     <div className="pt-2">
                                                         <DeliveryMap 
                                                             lat={deliveryLat}
                                                             lng={deliveryLng}
                                                             storeLat={storeCoords.lat}
                                                             storeLng={storeCoords.lng}
                                                             language={language}
                                                             onChange={(newLat, newLng, dist, addrName) => {
                                                                 setDeliveryLat(newLat);
                                                                 setDeliveryLng(newLng);
                                                                 setHasMapPin(true);
                                                                 setDeliveryAddress(addrName);
                                                             }}
                                                         />
                                                     </div>

                                                     {/* 3. Options to save address (Max 2) */}
                                                     <div className="space-y-1.5 pt-2 border-t border-brand-200/50">
                                                         <label className="text-xs font-extrabold text-gray-700 uppercase flex items-center gap-1">
                                                             <span className="w-5 h-5 rounded-full bg-brand-200 text-brand-700 flex items-center justify-center text-[10px]">3</span>
                                                             {language === 'th' ? 'บันทึกที่อยู่นี้ไว้ใช้ครั้งหน้าไหม?' : 'Save this address for next time?'}
                                                         </label>
                                                         <div className="flex gap-2">
                                                             <label className={`flex-1 flex flex-col items-center justify-center border rounded-lg p-3 cursor-pointer transition ${addressSaveType === 'home' ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                                                                 <input type="radio" name="addressSave" className="hidden" checked={addressSaveType === 'home'} onChange={() => setAddressSaveType('home')} />
                                                                 <span className="text-sm">🏠</span>
                                                                 <span className="text-xs font-bold mt-1">{language === 'th' ? 'ตั้งเป็นบ้าน' : 'Home'}</span>
                                                             </label>
                                                             <label className={`flex-1 flex flex-col items-center justify-center border rounded-lg p-3 cursor-pointer transition ${addressSaveType === 'work' ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                                                                 <input type="radio" name="addressSave" className="hidden" checked={addressSaveType === 'work'} onChange={() => setAddressSaveType('work')} />
                                                                 <span className="text-sm">🏢</span>
                                                                 <span className="text-xs font-bold mt-1">{language === 'th' ? 'ตั้งเป็นที่ทำงาน' : 'Work'}</span>
                                                             </label>
                                                             <label className={`flex-1 flex flex-col items-center justify-center border rounded-lg p-3 cursor-pointer transition ${addressSaveType === 'none' ? 'bg-gray-700 border-gray-700 text-white' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                                                                 <input type="radio" name="addressSave" className="hidden" checked={addressSaveType === 'none'} onChange={() => setAddressSaveType('none')} />
                                                                 <span className="text-sm">❌</span>
                                                                 <span className="text-xs font-bold mt-1">{language === 'th' ? 'ไม่บันทึก' : 'Do not save'}</span>
                                                             </label>
                                                         </div>
                                                     </div>
                                                     
                                                 </div>
                                             </div>
                                         </div>
                                     )}

                                     {/* Payment Method */}
                                     <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                         <label className="text-xs font-bold text-gray-500 uppercase mb-3 block">{t('paymentMethod')}</label>
                                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                             <button 
                                                 type="button"
                                                 onClick={() => setPaymentMethod('qr_transfer')}
                                                 className={`p-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition ${paymentMethod === 'qr_transfer' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600'}`}
                                             >
                                                 <QrCode size={16}/> {t('qrTransfer')}
                                             </button>
                                             <button 
                                                 type="button"
                                                 onClick={() => setPaymentMethod('cash')}
                                                 className={`p-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition ${paymentMethod === 'cash' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600'}`}
                                             >
                                                 <Banknote size={16}/> {t('cash')}
                                             </button>
                                             <button 
                                                 type="button"
                                                 onClick={() => setPaymentMethod('thai_chuay_thai')}
                                                 className={`p-3 rounded-lg border text-xs font-bold flex items-center justify-center gap-2 transition ${paymentMethod === 'thai_chuay_thai' ? 'border-sky-500 bg-sky-50 text-sky-700 font-extrabold shadow-sm' : 'border-gray-200 text-gray-600'}`}
                                             >
                                                 <Sparkles size={16} className={paymentMethod === 'thai_chuay_thai' ? 'text-sky-600 animate-pulse' : 'text-gray-400'}/> {t('thaiChuayThai')}
                                             </button>
                                         </div>
                                         
                                         {paymentMethod === 'thai_chuay_thai' && (
                                             <div className="mt-3 p-3 bg-sky-50 border border-sky-100 rounded-lg text-xs text-sky-800 leading-relaxed animate-fade-in font-medium">
                                                 <p className="font-extrabold text-sky-950 flex items-center gap-1 mb-1">
                                                     <span>💡 {language === 'th' ? 'ชำระด้วยสิทธิ์ไทยช่วยไทย' : 'Thai Chuay Thai Discount'}</span>
                                                 </p>
                                                 <p>
                                                     {language === 'th' 
                                                         ? 'เตรียมแอปเป๋าตังของท่านให้พร้อมเพื่อสแกนสิทธิ์เข้าร่วมโครงการชำระเงินกับทางร้าน' 
                                                         : 'Please prepare your Paotang app to scan and pay at the store.'}
                                                 </p>
                                             </div>
                                         )}
                                     </div>

                                     {/* Scheduling Pre-order Box (Dine-in, Takeaway, and Delivery) */}
                                     {(!tableSession) && (
                                         <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                             <label className="text-xs font-bold text-gray-500 uppercase mb-3 block flex items-center gap-1.5">
                                                 <Clock size={14} className="text-brand-600"/> {language === 'th' ? 'การตั้งเวลาสั่งอาหาร / สั่งล่วงหน้า' : 'Pre-order / Preparation Time'}
                                             </label>
                                             
                                             <div className="grid grid-cols-2 gap-2 mb-3">
                                                 <button 
                                                     type="button"
                                                     disabled={!isStoreOpen}
                                                     onClick={() => {
                                                         setAsapOrder(true);
                                                         setPickupTime('');
                                                     }}
                                                     className={`py-2 text-xs font-bold rounded-lg border transition ${!isStoreOpen ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' : asapOrder ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600'}`}
                                                 >
                                                     {language === 'th' ? 'เตรียมทันที (ร้านปิด)' : 'Prepare ASAP (Closed)'}
                                                 </button>
                                                 <button 
                                                     type="button"
                                                     onClick={() => {
                                                         setAsapOrder(false);
                                                         if (!pickupTime && timeSlots.length > 0) setPickupTime(timeSlots[0]);
                                                     }}
                                                     className={`py-2 text-xs font-bold rounded-lg border transition ${!asapOrder ? 'border-brand-500 bg-brand-50 text-brand-700 font-extrabold' : 'border-gray-200 text-gray-600'}`}
                                                 >
                                                     {language === 'th' ? 'สั่งอาหารล่วงหน้า' : 'Schedule Pre-order'}
                                                 </button>
                                             </div>

                                             {!isStoreOpen && (
                                                 <p className="text-[10px] text-amber-700 font-extrabold mb-3 leading-tight">
                                                     ⚠️ {language === 'th' ? 'ขณะนี้ร้านอยู่นอกเวลาทำการหรือปิดชั่วคราว จึงไม่สามารถสั่งอาหารให้ส่งทันทีได้ แต่คุณยังสั่งซื้อล่วงหน้า (Pre-order) ด้านล่างนี้ได้ค่ะ' : 'The store is currently closed/outside hours. ASAP ordering is disabled, but you can schedule a pre-order below!'}
                                                 </p>
                                             )}

                                             {!asapOrder && (
                                                 <div className="space-y-3 pt-2.5 border-t border-dashed border-gray-100">
                                                     <div className="flex gap-2">
                                                         <button 
                                                             type="button"
                                                             onClick={() => setOrderDate('today')}
                                                             className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition border ${orderDate === 'today' ? 'bg-brand-50 text-brand-700 border-brand-300' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                                                         >
                                                             {language === 'th' ? 'วันนี้' : 'Today'}
                                                         </button>
                                                         <button 
                                                             type="button"
                                                             onClick={() => setOrderDate('tomorrow')}
                                                             className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition border ${orderDate === 'tomorrow' ? 'bg-brand-50 text-brand-700 border-brand-300' : 'bg-gray-50 text-gray-500 border-gray-200'}`}
                                                         >
                                                             {language === 'th' ? 'พรุ่งนี้' : 'Tomorrow'}
                                                         </button>
                                                     </div>

                                                     <select 
                                                        className="w-full p-2.5 bg-gray-50 border rounded-lg text-sm font-bold text-gray-700 outline-none"
                                                        value={pickupTime}
                                                        onChange={e => setPickupTime(e.target.value)}
                                                     >
                                                         {timeSlots.map(slot => (
                                                             <option key={slot} value={slot}>
                                                                 {language === 'th' ? (orderDate === 'tomorrow' ? 'พรุ่งนี้ เวลา ' : 'วันนี้ เวลา ') : (orderDate === 'tomorrow' ? 'Tomorrow ' : 'Today ')} {slot}
                                                             </option>
                                                         ))}
                                                     </select>
                                                 </div>
                                             )}
                                         </div>
                                     )}

                                     {/* General Order Special Requests */}
                                     <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200">
                                         <label className="text-xs font-bold text-gray-500 uppercase mb-2.5 block flex items-center gap-1.5 align-middle">
                                             <MessageCircle size={14} className="text-brand-600 shrink-0"/> 
                                             <span>{language === 'th' ? 'หมายเหตุเพิ่มเติมถึงร้าน (เช่น ไม่ใส่หอมใหญ่, เผ็ดมาก)' : 'Special Requests / Order Notes (e.g., no onions, extra spicy)'}</span>
                                         </label>
                                         <textarea 
                                             className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-brand-500 outline-none min-h-[75px] resize-none" 
                                             placeholder={language === 'th' ? "เช่น ไม่ใส่พริก/หัวหอม, ขอซอสมะเขือเทศเพิ่ม..." : "e.g., no onions, extra spicy, extra tomato sauce..."}
                                             value={orderNote}
                                             onChange={e => setOrderNote(e.target.value)}
                                         />
                                     </div>
                                </div>
                            </>
                        )}
                        
                        {/* Promo Code Input */}
                        <div className="mb-4 pt-6 border-t border-gray-100">
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                {language === 'th' ? 'รหัสส่วนลด / โปรโมชั่น' : 'Promo Code / Discount'}
                            </label>
                            {!appliedPromoCode ? (
                                <div className="space-y-1.5">
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            placeholder={language === 'th' ? 'ใส่รหัสส่วนลด' : 'Enter promo code'}
                                            value={promoCodeInput}
                                            onChange={(e) => setPromoCodeInput(e.target.value)}
                                            className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-brand-500 font-mono uppercase font-bold"
                                        />
                                        <button
                                            onClick={handleApplyPromoCode}
                                            className="bg-gray-900 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-gray-800 transition shrink-0"
                                        >
                                            {language === 'th' ? 'ใช้รหัส' : 'Apply'}
                                        </button>
                                    </div>
                                    {promoError && (
                                        <p className="text-xs text-red-500 font-bold">{promoError}</p>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center justify-between bg-green-50 border border-green-150 p-2.5 rounded-xl">
                                    <div className="flex items-center gap-2">
                                        <div className="bg-green-500 text-white text-[10px] font-black px-2 py-0.5 rounded font-mono">
                                            {appliedPromoCode.code}
                                        </div>
                                        <div className="text-xs text-green-800 font-bold leading-tight">
                                            {language === 'th' ? appliedPromoCode.descriptionTh : appliedPromoCode.description}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={handleRemovePromoCode}
                                        className="text-green-800 hover:text-red-600 p-1"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Member Coupons Section */}
                        {customer && (
                            <div className="mb-4 border-b border-gray-100 pb-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                    <Gift size={14} className="text-brand-600 shrink-0"/>
                                    <span>{language === 'th' ? 'คูปองสมาชิกของคุณ' : 'Your Member Coupons'}</span>
                                </label>
                                
                                {customer.coupons && customer.coupons.filter(c => !c.isUsed).length > 0 ? (
                                    <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                                        {customer.coupons.filter(c => !c.isUsed).map(c => {
                                            const todayStr = new Date().toLocaleDateString('en-CA');
                                            const usedCouponToday = orders.some(o => {
                                                if (o.customerPhone !== customer.phone || !o.couponCode || o.status === 'cancelled') return false;
                                                try {
                                                    return new Date(o.createdAt).toLocaleDateString('en-CA') === todayStr;
                                                } catch(e) { return false; }
                                            });

                                            const isMinSpentOk = cartTotal >= (c.minOrderAmount || 0);
                                            const isOrderTypeOk = !c.applicableOrderTypes || c.applicableOrderTypes.length === 0 || c.applicableOrderTypes.includes(orderType);
                                            const isEligible = isMinSpentOk && isOrderTypeOk && !usedCouponToday;
                                            const isSelected = appliedCoupon?.id === c.id;
                                            
                                            let errorMsg = '';
                                            if (usedCouponToday) {
                                                errorMsg = language === 'th' ? 'จำกัด 1 คูปอง/วัน (คุณใช้สิทธิ์วันนี้ไปแล้ว)' : 'Limit 1 coupon/day (used today)';
                                            } else if (!isMinSpentOk) {
                                                errorMsg = language === 'th' ? `ขั้นต่ำ ฿${c.minOrderAmount}` : `Min. order ฿${c.minOrderAmount}`;
                                            } else if (!isOrderTypeOk) {
                                                errorMsg = language === 'th' ? 'ไม่รองรับการสั่งซื้อประเภทนี้' : 'Unsupported order type';
                                            }

                                            return (
                                                <div 
                                                    key={c.id}
                                                    onClick={() => {
                                                        if (isEligible) {
                                                            setAppliedCoupon(isSelected ? null : c);
                                                        }
                                                    }}
                                                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex items-start gap-2.5 relative ${
                                                        isSelected 
                                                            ? 'border-brand-500 bg-brand-50/50 ring-1 ring-brand-500' 
                                                            : isEligible 
                                                                ? 'border-gray-200 bg-white hover:bg-gray-50' 
                                                                : 'border-gray-150 bg-gray-50/75 opacity-60 cursor-not-allowed'
                                                    }`}
                                                >
                                                    <div className={`p-1.5 rounded-lg text-white shrink-0 mt-0.5 ${
                                                        isSelected 
                                                            ? 'bg-brand-600' 
                                                            : isEligible 
                                                                ? 'bg-amber-500' 
                                                                : 'bg-gray-400'
                                                    }`}>
                                                        <Gift size={16} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="text-xs font-black text-gray-900 font-mono tracking-tight bg-gray-100 px-1.5 py-0.5 rounded">
                                                                {c.code}
                                                            </span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 font-bold rounded ${
                                                                isSelected 
                                                                    ? 'bg-brand-100 text-brand-700' 
                                                                    : isEligible 
                                                                        ? 'bg-amber-100 text-amber-800' 
                                                                        : 'bg-gray-200 text-gray-600'
                                                            }`}>
                                                                {language === 'th' ? c.badgeTh || c.badge : c.badge}
                                                            </span>
                                                        </div>
                                                        <h4 className="text-xs font-bold text-gray-800 mt-1">
                                                            {language === 'th' ? c.titleTh || c.title : c.title}
                                                        </h4>
                                                        <p className="text-[10px] text-gray-500 mt-0.5 leading-normal">
                                                            {language === 'th' ? c.descriptionTh || c.description : c.description}
                                                        </p>
                                                        {!isEligible && (
                                                            <span className="text-[10px] text-red-500 font-bold mt-1 block">
                                                                ⚠️ {errorMsg}
                                                            </span>
                                                        )}
                                                    </div>
                                                    
                                                    {isEligible && (
                                                        <div className="shrink-0 self-center">
                                                            <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                                                                isSelected 
                                                                    ? 'bg-brand-600 border-brand-600 text-white' 
                                                                    : 'border-gray-300'
                                                            }`}>
                                                                {isSelected && <Check size={12} strokeWidth={3}/>}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center p-3 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                        <p className="text-xs text-gray-400 font-bold">
                                            {language === 'th' ? 'ไม่มีคูปองที่สามารถใช้งานได้ในขณะนี้' : 'No coupons available at the moment'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* Footer */}
                    <div className="p-6 bg-white border-t shrink-0 pb-safe">

                        {orderType === 'delivery' && deliveryFee !== null ? (
                            <>
                                <div className="flex justify-between items-center mb-1 text-sm font-bold text-gray-500">
                                    <span>Food Subtotal</span>
                                    <span>฿{cartTotal}</span>
                                </div>
                                <div className="flex flex-col mb-2 text-sm text-brand-600 font-bold border-b border-gray-100 pb-2 gap-1.5">
                                    <div className="flex justify-between items-center w-full">
                                        <span>+ Delivery Fee ({deliveryDistanceKm.toFixed(1)} km)</span>
                                        <span>฿{deliveryFee}</span>
                                    </div>
                                    <div className="text-[10px] font-normal leading-tight text-brand-500 bg-brand-50 p-1.5 rounded flex items-start gap-1 w-full">
                                        <AlertTriangle size={12} className="shrink-0 mt-px text-brand-500/80"/>
                                        <span>{language === 'th' ? 'ค่าจัดส่งนี้เป็นการประเมินเบื้องต้น ทางร้านจะตรวจสอบเส้นทางจริงจาก Google Map และแจ้งค่าขนส่งที่ถูกต้องอีกครั้ง' : 'Fee is estimated. The exact delivery fee will be confirmed after checking Google Maps.'}</span>
                                    </div>
                                </div>
                                {calculatedDiscount > 0 && (
                                    <div className="flex justify-between items-center mb-1.5 text-sm font-bold text-green-600">
                                        <span>Discount ({appliedPromoCode?.code})</span>
                                        <span>-฿{calculatedDiscount}</span>
                                    </div>
                                )}
                                {calculatedCouponDiscount > 0 && (
                                    <div className="flex justify-between items-center mb-1.5 text-sm font-bold text-green-600">
                                        <span>Coupon ({appliedCoupon?.code})</span>
                                        <span>-฿{calculatedCouponDiscount}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center mb-4 text-xl font-bold text-gray-900 border-t border-gray-100 pt-2">
                                    <span>Total</span>
                                    <span>฿{Math.max(0, cartTotal + deliveryFee - calculatedDiscount - calculatedCouponDiscount)}</span>
                                </div>
                            </>
                        ) : orderType === 'delivery' ? (
                            <>
                                <div className="flex justify-between items-center mb-1 text-sm font-bold text-gray-500">
                                    <span>Food Subtotal</span>
                                    <span>฿{cartTotal}</span>
                                </div>
                                <div className="flex justify-between items-center mb-2 text-sm text-orange-600 font-bold border-b border-gray-100 pb-2">
                                    <span>+ Delivery Fee</span>
                                    <span>{hasMapPin ? 'Calculating...' : language === 'th' ? 'กรุณาระบุที่อยู่' : 'Pin location to calc'}</span>
                                </div>
                                {calculatedDiscount > 0 && (
                                    <div className="flex justify-between items-center mb-1.5 text-sm font-bold text-green-600">
                                        <span>Discount ({appliedPromoCode?.code})</span>
                                        <span>-฿{calculatedDiscount}</span>
                                    </div>
                                )}
                                {calculatedCouponDiscount > 0 && (
                                    <div className="flex justify-between items-center mb-1.5 text-sm font-bold text-green-600">
                                        <span>Coupon ({appliedCoupon?.code})</span>
                                        <span>-฿{calculatedCouponDiscount}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center mb-4 text-xl font-bold text-gray-900 border-t border-gray-100 pt-2">
                                    <span>Total (Excl. delivery)</span>
                                    <span>฿{Math.max(0, cartTotal - calculatedDiscount - calculatedCouponDiscount)}</span>
                                </div>
                            </>
                        ) : (
                            <>
                                {calculatedDiscount > 0 && (
                                    <div className="flex justify-between items-center mb-1.5 text-sm font-bold text-green-600">
                                        <span>Discount ({appliedPromoCode?.code})</span>
                                        <span>-฿{calculatedDiscount}</span>
                                    </div>
                                )}
                                {calculatedCouponDiscount > 0 && (
                                    <div className="flex justify-between items-center mb-1.5 text-sm font-bold text-green-600">
                                        <span>Coupon ({appliedCoupon?.code})</span>
                                        <span>-฿{calculatedCouponDiscount}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-center mb-4 text-xl font-bold text-gray-900 border-t border-gray-100 pt-2">
                                    <span>Total</span>
                                    <span>฿{Math.max(0, cartTotal - calculatedDiscount - calculatedCouponDiscount)}</span>
                                </div>
                            </>
                        )}
                        <button 
                            onClick={handlePlaceOrderClick}
                            disabled={cart.length === 0 || isSubmitting}
                            className="w-full bg-brand-600 text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-0.5 transition"
                        >
                            <span className="flex items-center gap-2">
                                {isSubmitting ? 'Processing...' : (orderType === 'delivery' ? (language === 'th' ? 'ส่งให้ร้านเช็คและแจ้งกลับ' : 'Send for Shop to Check') : t('placeOrder'))}
                                {!isSubmitting && <ArrowRight size={20}/>}
                            </span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* NEW MEMBER COUPONS WELCOME MODAL */}
        {showLoginCouponsModal && customer && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
                <div className="bg-gradient-to-b from-brand-50 to-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-brand-200 animate-slide-up flex flex-col max-h-[90vh]">
                     <div className="p-6 text-center bg-gradient-to-r from-brand-600 to-amber-500 text-white relative shrink-0">
                         <button onClick={() => setShowLoginCouponsModal(false)} className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/20 hover:bg-black/40 p-1.5 rounded-full transition"><X size={18}/></button>
                         <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 animate-bounce-short">
                             <Gift size={32} className="text-white" />
                         </div>
                         <h2 className="text-xl md:text-2xl font-black tracking-tight">
                             {language === 'th' ? `ยินดีต้อนรับคุณ ${customer.name}! 🎉` : `Welcome, ${customer.name}! 🎉`}
                         </h2>
                         <p className="text-xs md:text-sm text-brand-100 mt-1 font-medium">
                             {language === 'th' ? 'เราขอมอบคูปองพิเศษสำหรับสมาชิกให้คุณทันที!' : 'We have exclusive member coupons ready for you!'}
                         </p>
                     </div>
                     
                     <div className="p-6 overflow-y-auto flex-1 space-y-4">
                         <div className="bg-amber-50/70 border border-amber-200/60 p-3.5 rounded-2xl flex items-start gap-2.5">
                             <Sparkles className="text-amber-500 shrink-0 mt-0.5" size={16}/>
                             <div className="text-left">
                                 <span className="text-xs font-extrabold text-amber-800 uppercase block tracking-wider">
                                     {language === 'th' ? 'ข้อแนะนำในการใช้งาน' : 'Special Suggestion'}
                                 </span>
                                 <p className="text-xs text-amber-700/90 mt-0.5 font-medium leading-relaxed">
                                     {language === 'th' 
                                         ? 'คุณสามารถคลิกเลือกเปิดใช้งานคูปองได้ทันทีตั้งแต่ตอนนี้! คูปองจะถูกจองไว้และนำไปคำนวณส่วนลดโดยอัตโนมัติเมื่อสั่งเมนูที่ร่วมรายการ' 
                                         : 'You can activate a coupon right now! The coupon will be applied automatically when you add matching items.'}
                                 </p>
                             </div>
                         </div>

                         <div className="space-y-3">
                             <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">
                                 {language === 'th' ? 'รายการคูปองของคุณ' : 'Your Available Coupons'}
                             </h3>
                             
                             {!customer.coupons || customer.coupons.filter(c => !c.isUsed).length === 0 ? (
                                 <div className="text-center py-6 text-gray-400 text-sm font-bold bg-white rounded-2xl border border-dashed border-gray-200">
                                     🎟️ {language === 'th' ? 'ไม่พบคูปองคงเหลือ' : 'No coupons available'}
                                 </div>
                             ) : (
                                 customer.coupons.filter(c => !c.isUsed).map(c => {
                                     const isSelected = appliedCoupon?.id === c.id;
                                     return (
                                         <div 
                                             key={c.id}
                                             className={`border-2 rounded-2xl bg-white overflow-hidden transition flex flex-col md:flex-row md:items-center justify-between p-4 gap-4 relative ${
                                                 isSelected 
                                                     ? 'border-brand-500 ring-1 ring-brand-500 bg-brand-50/10' 
                                                     : 'border-gray-150 hover:border-brand-200 hover:shadow-md'
                                             }`}
                                         >
                                             {/* Left Side: Ticket Style Layout */}
                                             <div className="flex items-start gap-3 flex-1">
                                                 <div className={`p-2.5 rounded-xl shrink-0 text-white mt-0.5 ${isSelected ? 'bg-brand-600' : 'bg-gradient-to-br from-amber-400 to-orange-500'}`}>
                                                     <Gift size={20} />
                                                 </div>
                                                 <div className="text-left">
                                                     <div className="flex items-center gap-1.5 flex-wrap">
                                                         <span className="font-extrabold text-sm md:text-base text-gray-800">
                                                             {language === 'th' ? c.titleTh || c.title : c.title}
                                                         </span>
                                                         <span className="bg-brand-100 text-brand-700 text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider">
                                                             {c.code}
                                                         </span>
                                                     </div>
                                                     <p className="text-xs text-gray-500 mt-1 font-medium leading-relaxed">
                                                         {language === 'th' ? c.descriptionTh || c.description : c.description}
                                                     </p>
                                                     {c.minOrderAmount && c.minOrderAmount > 0 && (
                                                         <p className="text-[10px] text-amber-600 font-extrabold mt-1">
                                                             {language === 'th' ? `*ขั้นต่ำ ฿${c.minOrderAmount}` : `*Min. spend ฿${c.minOrderAmount}`}
                                                         </p>
                                                     )}
                                                 </div>
                                             </div>
                                             
                                             {/* Right Side: Apply Button */}
                                             <button 
                                                 onClick={() => {
                                                     setAppliedCoupon(isSelected ? null : c);
                                                 }}
                                                 className={`px-4 py-2 rounded-xl text-xs font-black tracking-wide shrink-0 transition-all ${
                                                     isSelected 
                                                         ? 'bg-brand-100 text-brand-700 border border-brand-300' 
                                                         : 'bg-brand-600 text-white hover:bg-brand-700 shadow-md hover:shadow-lg'
                                                 }`}
                                             >
                                                 {isSelected 
                                                     ? (language === 'th' ? '✓ เปิดใช้งานอยู่' : '✓ Active Now') 
                                                     : (language === 'th' ? 'เปิดใช้งานคูปองนี้' : 'Activate Coupon')}
                                             </button>
                                         </div>
                                     );
                                 })
                             )}
                         </div>
                     </div>
                     
                     <div className="p-5 bg-gray-50 border-t border-gray-100 flex flex-col gap-2 shrink-0">
                         <button 
                             onClick={() => setShowLoginCouponsModal(false)}
                             className="w-full bg-brand-600 hover:bg-brand-700 text-white py-3.5 rounded-2xl font-black text-sm tracking-wide shadow-lg hover:shadow-xl transition transform active:scale-95 flex items-center justify-center gap-1.5"
                         >
                             <span>{language === 'th' ? 'ตกลง, เริ่มสั่งพิซซ่าเลย! 🍕' : 'Great, Let\'s Order Pizza! 🍕'}</span>
                             <ArrowRight size={16}/>
                         </button>
                     </div>
                </div>
            </div>
        )}

        {/* ... (Auth Modal) ... */}
        {showAuthModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                     <div className="relative h-32 bg-brand-600 flex items-center justify-center shrink-0">
                         <div className="absolute inset-0 bg-black/20"></div>
                         <h2 className="relative text-white font-bold text-3xl">{authMode === 'login' ? 'Welcome Back' : 'Join Us'}</h2>
                         <button onClick={() => setShowAuthModal(false)} className="absolute top-4 right-4 text-white/80 hover:text-white"><X size={24}/></button>
                     </div>
                     
                     <div className="p-6 flex-1 overflow-y-auto">
                         {authMode === 'login' ? (
                             <form onSubmit={handleLogin} className="space-y-4">
                                 <div>
                                     <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Phone Number</label>
                                     <div className="relative">
                                         <Phone className="absolute left-3 top-3 text-gray-400" size={18}/>
                                         <input type="tel" required className="w-full pl-10 p-3 border rounded-xl bg-gray-50 focus:bg-white transition" placeholder="0812345678" value={loginPhone} onChange={e => setLoginPhone(e.target.value)}/>
                                     </div>
                                 </div>
                                 <div>
                                     <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Password</label>
                                     <div className="relative">
                                         <Lock className="absolute left-3 top-3 text-gray-400" size={18}/>
                                         <input type="password" required className="w-full pl-10 p-3 border rounded-xl bg-gray-50 focus:bg-white transition" placeholder="••••••" value={loginPassword} onChange={e => setLoginPassword(e.target.value)}/>
                                     </div>
                                 </div>
                                 <button type="submit" className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black shadow-lg mt-2">Login</button>
                                 <p className="text-center text-sm text-gray-500 mt-4">
                                     New here? <button type="button" onClick={() => setAuthMode('register')} className="text-brand-600 font-bold hover:underline">Create Account</button>
                                 </p>
                             </form>
                         ) : (
                             <form onSubmit={handleRegister} className="space-y-4">
                                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Name</label>
                                        <input type="text" required className="w-full p-3 border rounded-xl bg-gray-50" placeholder="John Doe" value={regName} onChange={e => setRegName(e.target.value)}/>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Phone</label>
                                        <input type="tel" required className="w-full p-3 border rounded-xl bg-gray-50" placeholder="081..." value={regPhone} onChange={e => setRegPhone(e.target.value)}/>
                                    </div>
                                 </div>
                                 <div>
                                     <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Create Password</label>
                                     <input type="password" required className="w-full p-3 border rounded-xl bg-gray-50" placeholder="••••••" value={regPassword} onChange={e => setRegPassword(e.target.value)}/>
                                 </div>
                                 <div>
                                     <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Birthday (Optional)</label>
                                     <input type="date" className="w-full p-3 border rounded-xl bg-gray-50" value={regBirthday} onChange={e => setRegBirthday(e.target.value)}/>
                                 </div>
                                 <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                                     <input type="checkbox" required id="pdpa" className="mt-1" checked={regPdpa} onChange={e => setRegPdpa(e.target.checked)}/>
                                     <label htmlFor="pdpa" className="text-xs text-gray-600 cursor-pointer">{t('pdpaLabel')}</label>
                                 </div>
                                 <button type="submit" className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 shadow-lg mt-2">Register & Reset Password</button>
                                 <p className="text-center text-sm text-gray-500 mt-4">
                                     Already have an account? <button type="button" onClick={() => setAuthMode('login')} className="text-brand-600 font-bold hover:underline">Login</button>
                                 </p>
                             </form>
                         )}
                     </div>
                </div>
            </div>
        )}
        
        {/* PROFILE MODAL (Improved) */}
        {showProfile && customer && (
             <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                 <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col">
                     <div className="bg-gray-900 p-6 text-white text-center relative shrink-0">
                         <button onClick={() => setShowProfile(false)} className="absolute top-4 right-4 text-white/60 hover:text-white"><X size={24}/></button>
                         <div className="w-20 h-20 bg-brand-500 rounded-full flex items-center justify-center text-3xl font-bold mx-auto mb-3 shadow-lg border-4 border-gray-800">
                             {customer.name.charAt(0)}
                         </div>
                         <h2 className="text-2xl font-bold">{customer.name}</h2>
                         <p className="text-brand-300 font-medium">{customer.loyaltyPoints} Points</p>
                     </div>
                     
                     <div className="p-6 flex-1 overflow-y-auto bg-gray-50">
                         {/* Points Progress */}
                         <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6">
                             <div className="flex justify-between items-center mb-2">
                                 <span className="font-bold text-gray-700 text-sm">Reward Progress</span>
                                 <span className="text-xs font-bold text-brand-600">{customer.loyaltyPoints} / 10</span>
                             </div>
                             <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden mb-3">
                                 <div className="bg-brand-500 h-full transition-all" style={{ width: `${Math.min(100, (customer.loyaltyPoints / 10) * 100)}%` }}></div>
                             </div>
                             {customer.loyaltyPoints >= 10 ? (
                                 <button onClick={() => { claimReward(); setShowProfile(false); setIsCartOpen(true); }} className="w-full py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-bold rounded-lg shadow-md animate-pulse">
                                     {t('claimReward')}
                                 </button>
                             ) : (
                                 <p className="text-xs text-center text-gray-500">{10 - customer.loyaltyPoints} more points {t('toFreePizza')}</p>
                             )}
                         </div>

                          {/* MEMBER COUPONS LIST */}
                          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 mb-6 font-sans">
                              <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-1.5">
                                  <Gift size={16} className="text-brand-600 shrink-0"/>
                                  <span>{language === 'th' ? 'คูปองส่วนลดของฉัน' : 'My Discount Coupons'}</span>
                              </h3>
                              
                              {customer.coupons && customer.coupons.length > 0 ? (
                                  <div className="space-y-2.5">
                                      {customer.coupons.map((c, i) => (
                                          <div 
                                              key={c.id || i} 
                                              className={`p-3 rounded-xl border text-left flex items-start gap-3 ${
                                                  c.isUsed 
                                                      ? 'border-gray-200 bg-gray-50 opacity-60' 
                                                      : 'border-brand-200 bg-brand-50/10'
                                              }`}
                                          >
                                              <div className={`p-2 rounded-lg text-white shrink-0 ${
                                                  c.isUsed ? 'bg-gray-400' : 'bg-brand-600'
                                              }`}>
                                                  <Gift size={16} />
                                              </div>
                                              <div className="flex-1 min-w-0">
                                                  <div className="flex items-center gap-1.5 flex-wrap">
                                                      <span className="text-xs font-black text-gray-900 font-mono tracking-tight bg-gray-100 px-1.5 py-0.5 rounded">
                                                          {c.code}
                                                      </span>
                                                      <span className={`text-[10px] px-1.5 py-0.5 font-bold rounded ${
                                                          c.isUsed 
                                                              ? 'bg-gray-200 text-gray-600' 
                                                              : 'bg-brand-100 text-brand-700'
                                                      }`}>
                                                          {c.isUsed ? (language === 'th' ? 'ใช้แล้ว' : 'Used') : (language === 'th' ? c.badgeTh || c.badge : c.badge)}
                                                      </span>
                                                  </div>
                                                  <h4 className={`text-xs font-bold mt-1 ${c.isUsed ? 'text-gray-500 line-through' : 'text-gray-800'}`}>
                                                      {language === 'th' ? c.titleTh || c.title : c.title}
                                                  </h4>
                                                  <p className="text-[10px] text-gray-500 mt-0.5 leading-normal">
                                                      {language === 'th' ? c.descriptionTh || c.description : c.description}
                                                  </p>
                                                  {c.minOrderAmount ? (
                                                      <p className="text-[9px] text-gray-400 font-bold mt-1">
                                                          * {language === 'th' ? `ยอดสั่งซื้อขั้นต่ำ ฿${c.minOrderAmount}` : `Minimum spend ฿${c.minOrderAmount}`}
                                                      </p>
                                                  ) : null}
                                              </div>
                                          </div>
                                      ))}
                                  </div>
                              ) : (
                                  <div className="text-center p-4 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                      <p className="text-xs text-gray-400 font-bold">
                                          {language === 'th' ? 'ไม่มีคูปองสมาชิกสะสม' : 'No coupons accumulated yet'}
                                      </p>
                                  </div>
                              )}
                          </div>

                         {/* ACTIVE ORDER CARD */}
                         {activeOrder && (
                             <div className="bg-white p-4 rounded-xl shadow-md border-l-4 border-brand-500 mb-6 relative overflow-hidden group cursor-pointer" onClick={() => { setShowProfile(false); setShowTracker(true); }}>
                                 <div className="flex justify-between items-start mb-3 relative z-10">
                                     <div>
                                         <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                             <Activity size={18} className="text-brand-600 animate-pulse"/> 
                                             Active Order
                                         </h3>
                                         <span className="text-xs text-gray-500">#{activeOrder.id.slice(-4)} • {activeOrder.items.length} items</span>
                                     </div>
                                     <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${getStatusColor(activeOrder.status)}`}>
                                         {t(activeOrder.status as any)}
                                     </span>
                                 </div>
                                 
                                 <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-3 relative z-10">
                                     <div className={`h-full transition-all duration-1000 ${
                                         activeOrder.status === 'pending' ? 'w-1/6 bg-yellow-400' :
                                         activeOrder.status === 'confirmed' ? 'w-2/6 bg-blue-500' :
                                         activeOrder.status === 'acknowledged' ? 'w-3/6 bg-indigo-500' :
                                         activeOrder.status === 'cooking' ? 'w-4/6 bg-orange-500' :
                                         activeOrder.status === 'ready' ? 'w-5/6 bg-green-500' :
                                         'w-full bg-green-600'
                                     }`}></div>
                                 </div>
                                 
                                 <div className="text-center text-xs font-bold text-brand-600 flex items-center justify-center gap-1">
                                     Tap to Track <ArrowRight size={12}/>
                                 </div>
                             </div>
                         )}
                         
                         {/* Favorites */}
                         <div className="mb-6">
                             <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><Heart size={16} className="text-red-500"/> {t('savedFavorites')}</h3>
                             <div className="space-y-3">
                                 {customer.savedFavorites && customer.savedFavorites.length > 0 ? (
                                     customer.savedFavorites.map(fav => (
                                         <div key={fav.id} className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex justify-between items-center">
                                             <div>
                                                 <div className="font-bold text-sm">{fav.name}</div>
                                                 <div className="text-xs text-gray-500 line-clamp-1">{fav.toppings.map(t => t.name).join(', ')}</div>
                                             </div>
                                             <button 
                                                onClick={() => handleOrderFavorite(fav)}
                                                className="bg-brand-100 text-brand-600 p-2 rounded-full hover:bg-brand-200"
                                                title="Add to Cart"
                                             >
                                                <Plus size={16}/>
                                             </button>
                                         </div>
                                     ))
                                 ) : <p className="text-xs text-gray-400 text-center py-4 bg-white rounded-xl border border-dashed">No favorites yet</p>}
                             </div>
                         </div>
                         
                         {/* IMPROVED Order History */}
                         <div>
                             <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><History size={16}/> {t('recentOrders')}</h3>
                             <div className="space-y-4">
                                 {orders.filter(o => o.customerPhone === customer.phone).slice(0, 5).map(order => (
                                     <div key={order.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                         {/* Card Header */}
                                         <div className="bg-gray-50 p-3 border-b border-gray-100 flex justify-between items-center">
                                              <div>
                                                  <div className="text-xs font-bold text-gray-500">{new Date(order.createdAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })} • {new Date(order.createdAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute:'2-digit' })}</div>
                                                  <div className={`text-[10px] font-bold uppercase mt-1 inline-block ${order.status === 'completed' ? 'text-green-600' : 'text-gray-500'}`}>{order.status}</div>
                                              </div>
                                              <div className="font-bold text-gray-900 text-lg">
                                                  ฿{order.totalAmount}
                                                  {order.deliveryFee === 'pending' && <span className="text-[10px] text-orange-500 block text-right">+ {t('deliveryTBD')}</span>}
                                                  {typeof order.deliveryFee === 'number' && order.deliveryFee > 0 && <span className="text-[10px] text-gray-500 block text-right">(Incl. ฿{order.deliveryFee} delivery)</span>}
                                              </div>
                                         </div>
                                         
                                         {/* Card Body */}
                                         <div className="p-3">
                                              <div className="space-y-1 mb-3">
                                                  {order.items.map((item, idx) => (
                                                      <div key={idx} className="flex justify-between text-sm">
                                                          <span className="text-gray-800 font-medium">{item.quantity}x {item.name}</span>
                                                          <span className="text-gray-400 text-xs">฿{item.totalPrice}</span>
                                                      </div>
                                                  ))}
                                              </div>
                                              
                                              {/* Feedback section */}
                                              {order.rating ? (
                                                  <div className="mb-2 p-2 bg-yellow-50 rounded-lg border border-yellow-105 text-xs flex flex-col gap-1 text-left">
                                                      <div className="flex items-center gap-1 font-bold text-yellow-700">
                                                          {Array.from({ length: 5 }).map((_, i) => (
                                                              <Star 
                                                                  key={i} 
                                                                  size={10} 
                                                                  className={`${i < (order.rating || 0) ? 'fill-yellow-400 text-yellow-500' : 'text-gray-300'}`} 
                                                              />
                                                          ))}
                                                          <span className="ml-1 text-[11px] text-yellow-800 font-bold">{order.rating} / 5</span>
                                                      </div>
                                                      {order.comment && <div className="italic text-gray-600 font-medium mt-0.5">"{order.comment}"</div>}
                                                  </div>
                                              ) : (
                                                  <button 
                                                      onClick={() => {
                                                          setFeedbackOrderId(order.id);
                                                          setFeedbackRating(5);
                                                          setFeedbackComment("");
                                                          setShowFeedbackModal(true);
                                                      }} 
                                                      className="w-full mb-2 bg-yellow-50 text-yellow-700 hover:bg-yellow-101 py-2 rounded-lg font-bold text-sm transition flex items-center justify-center gap-2 border border-yellow-200"
                                                  >
                                                      <Star size={14} className="fill-yellow-400 text-yellow-500" /> {t('giveFeedback')}
                                                  </button>
                                              )}

                                              <button 
                                                  onClick={() => { reorderItem(order.id); setShowProfile(false); setIsCartOpen(true); }} 
                                                  className="w-full bg-brand-50 text-brand-600 py-2 rounded-lg font-bold text-sm hover:bg-brand-100 transition flex items-center justify-center gap-2"
                                              >
                                                  <RefreshCw size={14}/> {t('reorder')} All Items
                                              </button>
                                         </div>
                                     </div>
                                 ))}
                             </div>
                         </div>
                     </div>
                     
                     <div className="p-4 bg-white border-t">
                         <button onClick={() => { setCustomer(null as any); localStorage.removeItem('damac_customer'); setShowProfile(false); }} className="w-full py-3 border border-gray-300 rounded-xl font-bold text-gray-600 hover:bg-gray-50">Log Out</button>
                      </div>
                  </div>
              </div>
         )}

         {/* ORDER HISTORY MODAL */}
         {showOrderHistory && (() => {
             const getStatusColor = (status: string) => {
                 switch (status) {
                     case 'pending': return 'bg-yellow-100/80 text-yellow-800 border border-yellow-250';
                     case 'confirmed': return 'bg-blue-50 text-blue-800 border border-blue-200';
                     case 'acknowledged': return 'bg-indigo-50 text-indigo-800 border border-indigo-200';
                     case 'cooking': return 'bg-orange-50 text-orange-850 border border-orange-200 animate-pulse';
                     case 'ready': return 'bg-green-50 text-green-800 border border-green-200 font-bold';
                     case 'completed': return 'bg-green-100/80 text-green-900 border border-green-300';
                     case 'cancelled': return 'bg-red-50 text-red-800 border border-red-250';
                     default: return 'bg-gray-50 text-gray-800 border border-gray-200';
                 }
             };

             return (
                 <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" id="order-history-overlay">
                     <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden relative max-h-[90vh] flex flex-col" id="order-history-modal">
                         {/* Header */}
                         <div className="bg-gray-950 p-5 text-white flex justify-between items-center shrink-0">
                             <div className="flex items-center gap-2">
                                 <History className="text-brand-500" size={24}/>
                                 <h2 className="text-xl font-bold">{t('orderHistory')}</h2>
                             </div>
                             <button 
                                 onClick={() => { setShowOrderHistory(false); setOrderHistoryError(''); }} 
                                 className="text-white/60 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition"
                             >
                                 <X size={20}/>
                             </button>
                         </div>
                         
                         {/* Search Section */}
                         <div className="p-4 bg-gray-50 border-b border-gray-200 shrink-0">
                             <form onSubmit={handleSearchOrder} className="flex gap-2">
                                 <input 
                                     type="text" 
                                     placeholder={t('searchOrderPlaceholder')} 
                                     value={searchOrderId}
                                     onChange={e => { setSearchOrderId(e.target.value); setOrderHistoryError(''); }}
                                     className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white text-sm"
                                 />
                                 <button 
                                     type="submit" 
                                     className="bg-brand-600 hover:bg-brand-700 text-white font-bold px-4 rounded-xl text-sm transition flex items-center gap-1 shrink-0"
                                 >
                                     {t('search')}
                                 </button>
                             </form>
                             {orderHistoryError && (
                                 <p className="text-red-500 text-xs mt-2 font-semibold bg-red-50 p-2 rounded-lg border border-red-100 flex items-center gap-1">
                                     <AlertTriangle size={12}/> {orderHistoryError}
                                 </p>
                             )}
                         </div>
                         
                         {/* History List */}
                         <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-gray-50/50">
                             {historyOrders.length === 0 ? (
                                 <div className="py-12 flex flex-col items-center justify-center text-center text-gray-400 space-y-3 bg-white border border-dashed rounded-2xl">
                                     <History size={48} className="text-gray-300 stroke-[1.5] animate-pulse"/>
                                     <p className="font-bold text-gray-600">{language === 'th' ? 'ไม่มีประวัติคำสั่งซื้อ' : 'No past orders yet'}</p>
                                     <p className="text-xs max-w-[250px]">{language === 'th' ? 'คุณสามารถค้นหาข้อมูลออเดอร์ด้วยรหัสที่ได้รับได้ที่นี่' : 'Enter an Order ID above to track status or save it to this list.'}</p>
                                 </div>
                             ) : (
                                 historyOrders.map(order => (
                                     <div key={order.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col transition hover:border-gray-300">
                                         {/* Item Header */}
                                         <div className="bg-gray-50/80 p-3.5 border-b border-gray-100 flex justify-between items-start gap-2">
                                             <div>
                                                 <div className="font-mono text-xs font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded inline-block select-all">
                                                     #{order.id}
                                                 </div>
                                                 <p className="text-[11px] text-gray-500 font-medium mt-1">
                                                     {new Date(order.createdAt).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' })} • {new Date(order.createdAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute:'2-digit' })}
                                                 </p>
                                             </div>
                                             <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase shrink-0 ${getStatusColor(order.status)}`}>
                                                 {t(order.status as any)}
                                             </span>
                                         </div>
                                         
                                         {/* Item Details */}
                                         <div className="p-3.5">
                                             <div className="space-y-1 text-sm border-b pb-3 mb-3">
                                                 {order.items.map((item: any, idx: number) => (
                                                     <div key={idx} className="flex justify-between items-start text-xs text-gray-700">
                                                         <p className="font-medium text-left">
                                                             {item.quantity}x {item.name}
                                                             {item.specialInstructions && <span className="text-[10px] text-red-500 block italic">"{item.specialInstructions}"</span>}
                                                             {item.selectedToppings && item.selectedToppings.length > 0 && (
                                                                 <span className="text-[10px] text-gray-400 block">
                                                                     + {item.selectedToppings.map((t: any) => language === 'th' ? t.nameTh : t.name).join(', ')}
                                                                 </span>
                                                             )}
                                                         </p>
                                                         <span className="font-bold text-gray-900 shrink-0">฿{item.totalPrice}</span>
                                                     </div>
                                                 ))}
                                             </div>

                                             {/* Lalamove Real-time Customer Tracking Widget */}
                                             {order.lalamoveStatus && order.lalamoveStatus !== 'none' && (
                                                 <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 mb-3.5 space-y-2 animate-fade-in text-xs text-left">
                                                     <div className="flex justify-between items-center pb-1.5 border-b border-orange-100">
                                                         <span className="font-extrabold text-orange-700 flex items-center gap-1">
                                                             Ref. 🛵 {language === 'th' ? 'ข้อมูลคนขับลาร่ามูฟ (Lalamove)' : 'Lalamove Delivery Tracker'}
                                                         </span>
                                                         <span className="font-mono text-[9px] bg-white border border-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-black">
                                                             {order.lalamoveTrackingId}
                                                         </span>
                                                     </div>

                                                     {/* Real-time status display */}
                                                     <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-orange-100/40 font-bold">
                                                         <span className="text-xl animate-bounce">
                                                             {order.lalamoveStatus === 'assigned' ? '🤝' : 
                                                              order.lalamoveStatus === 'picking_up' ? '🏭' :
                                                              order.lalamoveStatus === 'in_transit' ? '🛣️' : '🎁'}
                                                         </span>
                                                         <div>
                                                             <div className="text-gray-800 text-[11px] font-extrabold">
                                                                 {order.lalamoveStatus === 'assigned' && (language === 'th' ? 'จับคู่ไรเดอร์สำเร็จ! กำลังเตรียมตัว' : 'Driver Found! Preparing to start')}
                                                                 {order.lalamoveStatus === 'picking_up' && (language === 'th' ? 'ไรเดอร์กำลังเดินทางมาที่ร้าน Pizza Damac' : 'Driver is on the way to Pizza Damac')}
                                                                 {order.lalamoveStatus === 'in_transit' && (language === 'th' ? 'ไรเดอร์ได้รับอาหารแล้ว กำลังรีบส่งไปให้คุณ!' : 'On the way! Driver is heading to your address')}
                                                                 {order.lalamoveStatus === 'completed' && (language === 'th' ? 'สินค้าจัดส่งเรียบร้อยแล้ว ทานให้อร่อยนะครับ! 🎉' : 'Arrived! Pizza delivered successfully. Enjoy! 🎉')}
                                                             </div>
                                                             <div className="text-[9px] text-gray-400 mt-0.5 font-medium">
                                                                 {order.lalamoveStatus !== 'completed' ? (language === 'th' ? 'อัพเดทสถานะล่าสุดแบบเรียลไทม์' : 'Real-time automatic transit updates') : (language === 'th' ? 'ขอบคุณที่ใช้บริการ' : 'Thank you for ordering')}
                                                             </div>
                                                         </div>
                                                     </div>

                                                     {/* Rider details */}
                                                     <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-600">
                                                         <div className="bg-white/50 p-1.5 rounded border border-orange-100/30">
                                                             <span className="text-gray-400 block text-[9px]">{language === 'th' ? 'ชื่อคนขับ' : 'Rider Name'}</span>
                                                             <span className="text-gray-700 block">{order.lalamoveRiderName}</span>
                                                         </div>
                                                         <div className="bg-white/50 p-1.5 rounded border border-orange-100/30">
                                                             <span className="text-gray-400 block text-[9px]">{language === 'th' ? 'เบอร์โทรศัพท์' : 'Rider Phone'}</span>
                                                             <a href={`tel:${order.lalamoveRiderPhone}`} className="text-blue-600 block underline">{order.lalamoveRiderPhone}</a>
                                                         </div>
                                                     </div>
                                                 </div>
                                             )}
                                             
                                             {/* Totals and Metadata */}
                                             <div className="flex justify-between items-end mb-3">
                                                 <div className="text-[11px] text-gray-500 text-left">
                                                     <div>{order.type === 'delivery' ? (language === 'th' ? 'จัดส่ง' : 'Delivery') : (order.type === 'online' ? (language === 'th' ? 'รับที่ร้าน' : 'Pickup') : (language === 'th' ? 'ทานที่ร้าน' : 'Dine-In'))}</div>
                                                     {order.tableNumber && <div className="text-green-600 font-bold">{language === 'th' ? 'โต๊ะ' : 'Table'} {order.tableNumber}</div>}
                                                     {order.pickupTime && <div className="mt-0.5">{language === 'th' ? 'เวลา' : 'Time'}: {order.pickupTime}</div>}
                                                 </div>
                                                 <div className="text-right">
                                                     <div className="text-lg font-extrabold text-brand-600">฿{order.totalAmount}</div>
                                                     {order.deliveryFee === 'pending' ? (
                                                         <span className="text-[10px] text-orange-500 font-bold">{t('deliveryTBD')}</span>
                                                     ) : (
                                                         typeof order.deliveryFee === 'number' && order.deliveryFee > 0 && (
                                                             <span className="text-[10px] text-gray-400 font-medium">{language === 'th' ? `รวมค่าส่ง ฿${order.deliveryFee}` : `Incl. ฿${order.deliveryFee} shipping`}</span>
                                                         )
                                                     )}
                                                 </div>
                                             </div>
                                             
                                             {/* Actions - Feedback & Follow */}
                                             <div className="flex flex-col gap-2 pt-2 border-t border-gray-101">
                                                 {order.rating ? (
                                                     <div className="p-2.5 bg-yellow-50 rounded-xl border border-yellow-100 text-xs text-left mb-1">
                                                         <div className="flex items-center gap-1 font-bold text-yellow-700">
                                                             {Array.from({ length: 5 }).map((_, i) => (
                                                                 <Star 
                                                                     key={i} 
                                                                     size={11} 
                                                                     className={`${i < (order.rating || 0) ? 'fill-yellow-400 text-yellow-500' : 'text-gray-300'}`} 
                                                                 />
                                                             ))}
                                                             <span className="ml-1 text-[11px] text-yellow-800 font-bold">{order.rating} / 5</span>
                                                         </div>
                                                         {order.comment && <div className="italic text-gray-600 font-medium mt-1">"{order.comment}"</div>}
                                                     </div>
                                                 ) : (
                                                     <button 
                                                         onClick={() => {
                                                             setFeedbackOrderId(order.id);
                                                             setFeedbackRating(5);
                                                             setFeedbackComment("");
                                                             setShowFeedbackModal(true);
                                                         }} 
                                                         className="w-full bg-yellow-50 hover:bg-yellow-101 text-yellow-700 py-2 rounded-xl text-xs font-extrabold transition flex items-center justify-center gap-1.5 border border-yellow-250"
                                                     >
                                                         <Star size={13} className="fill-yellow-400 text-yellow-500" /> {t('giveFeedback')}
                                                     </button>
                                                 )}
                                                 
                                                 <div className="grid grid-cols-2 gap-2">
                                                     <button 
                                                         onClick={() => { reorderItem(order.id); setShowOrderHistory(false); setIsCartOpen(true); }} 
                                                         className="bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1"
                                                     >
                                                         <RefreshCw size={13}/> {t('reorder')}
                                                     </button>
                                                     {order.status !== 'completed' && order.status !== 'cancelled' ? (
                                                         <button 
                                                             onClick={() => { setLocalOrderId(order.id); setShowTracker(true); setShowOrderHistory(false); }} 
                                                             className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-1 shadow-sm"
                                                         >
                                                             <Activity size={13} className="animate-pulse"/> {t('trackOrder')}
                                                         </button>
                                                     ) : (
                                                         <div className="bg-gray-100 text-gray-400 text-xs font-bold py-2.5 rounded-xl flex items-center justify-center select-none">
                                                             Finished
                                                         </div>
                                                     )}
                                                 </div>
                                             </div>
                                         </div>
                                     </div>
                                 ))
                             )}
                         </div>
                     </div>
                 </div>
             );
         })()}

         {/* dummy wrapper continuation */}
         {false && (
             <div>
                 <div>
                     <div>
                         <button onClick={async () => {}} className="hidden">
                             Log Out
                         </button>
                     </div>
                 </div>
             </div>
        )}

        {/* FEEDBACK MODAL */}
        {showFeedbackModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden relative p-6">
                    <button 
                        onClick={() => setShowFeedbackModal(false)} 
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
                    >
                        <X size={24}/>
                    </button>
                    
                    {feedbackSuccess ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
                            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                                <Check size={36} className="stroke-[3]" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2">{t('feedbackSubmitted')}</h3>
                        </div>
                    ) : (
                        <div className="flex flex-col">
                            <h3 className="text-lg font-bold text-gray-950 mb-4 flex items-center gap-2">
                                <Star size={20} className="text-yellow-500 fill-yellow-400" />
                                {t('feedbackTitle', { id: feedbackOrderId || '' })}
                            </h3>
                            
                            {/* Rating Stars Section */}
                            <div className="mb-6 flex flex-col items-center">
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">{t('rating')}</label>
                                <div className="flex items-center gap-2">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            type="button"
                                            onClick={() => setFeedbackRating(star)}
                                            className="transform hover:scale-125 transition duration-150 p-1"
                                        >
                                            <Star
                                                size={36}
                                                className={`transition-colors duration-150 ${
                                                    star <= feedbackRating
                                                        ? "fill-yellow-400 text-yellow-500"
                                                        : "text-gray-201"
                                                }`}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            {/* Comment Section */}
                            <div className="mb-6">
                                <label className="text-xs font-bold text-gray-500 uppercase mb-2 block">
                                    {t('comment')}
                                </label>
                                <textarea
                                    value={feedbackComment}
                                    onChange={(e) => setFeedbackComment(e.target.value)}
                                    placeholder={t('commentPlaceholder')}
                                    rows={4}
                                    className="w-full p-3 border border-gray-200 rounded-xl bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                                />
                            </div>
                            
                            {/* Submit Button */}
                            <button
                                onClick={handleFeedbackSubmit}
                                className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold hover:bg-brand-700 shadow-md transition"
                            >
                                {t('submitFeedback')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* QR Code Payment Modal */}
        {showQRModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center shadow-brand-500/10">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{language === 'th' ? 'สแกนเพื่อชำระเงิน' : 'Scan to Pay'}</h3>
                    <p className="text-gray-500 mb-6 text-sm">{language === 'th' ? 'กรุณาสแกน QR Code นี้ผ่านแอปธนาคาร' : 'Please scan this QR Code via your bank app'}</p>
                    
                    <div className="flex flex-col items-center justify-center p-4 bg-gray-50 rounded-xl mb-4 border-2 border-brand-100 mx-auto w-fit">
                         <QRCodeCanvas id="promptpay-qr-modal" value={generatePromptPayPayload(storeSettings.promptPayNumber || DEFAULT_STORE_SETTINGS.promptPayNumber!, qrAmount)} size={200} level="M" includeMargin={true} />
                         <button 
                             type="button"
                             onClick={() => handleDownloadQR('promptpay-qr-modal', 'Payment')}
                             className="mt-3 flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-600 text-white hover:bg-brand-700 active:scale-95 text-xs font-bold rounded-lg transition shadow-md w-full"
                         >
                             <Download size={13} className="text-white"/>
                             <span>{language === 'th' ? 'บันทึกรูป QR ลงเครื่อง' : 'Save QR Image'}</span>
                         </button>
                    </div>
                    
                    <div className="text-3xl font-extrabold text-brand-600 mb-6">฿{qrAmount}</div>
                    
                    <p className="text-xs text-gray-400 mb-6">
                        {language === 'th' ? 'กรุณาแสดงหน้าจอนี้ต่อพนักงาน หรือแนบสลิปผ่านทาง Line Official ของร้าน หากสั่งออนไลน์' : 'Please show this to staff, or send the slip to our Line OA'}
                    </p>
                    <button 
                        onClick={() => { setShowQRModal(false); setShowTracker(true); }}
                        className="w-full bg-brand-600 active:bg-brand-700 text-white font-bold py-4 rounded-xl shadow-lg transition"
                    >
                        {language === 'th' ? 'ชำระเงินเรียบร้อยแแล้ว' : 'I have paid'}
                    </button>
                </div>
            </div>
        )}

    </div>
  );
};
