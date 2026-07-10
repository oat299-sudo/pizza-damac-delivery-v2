
import React, { useState, useEffect, useMemo } from 'react';
import { useStore, grantBirthdayCouponIfEligible } from '../context/StoreContext';
import { supabase } from '../services/supabaseClient';
import { Pizza, Topping, CartItem, ProductCategory, OrderSource, ExpenseCategory, PaymentMethod, Order, OrderStatus, SubItem, parseGPSCoordinates, parseDeliveryPhone, parseAnyMapLink } from '../types';
import { CATEGORIES, EXPENSE_CATEGORIES, PRESET_EXPENSES } from '../constants';
import { generatePromptPayPayload } from '../utils/promptpay';
import { calculateDistanceKm } from '../utils/geo';
import LalamoveDispatchPanel from '../src/components/LalamoveDispatchPanel';
import { LalamoveSettingsCard } from '../src/components/LalamoveSettingsCard';
import { Plus, Minus, Trash2, ShoppingBag, DollarSign, Settings, User, X, Edit2, Power, LogOut, Upload, Image as ImageIcon, Bike, Store, List, PieChart, Calculator, Globe, ToggleLeft, ToggleRight, Camera, ChevronUp, ChevronDown, ChevronLeft, AlertCircle, Calendar, Link, Star, Layers, Database, MousePointerClick, MessageCircle, MapPin, Facebook, Phone, CheckCircle, Video, PlayCircle, Newspaper, Save, Download, QrCode, Printer, CheckCircle2, ChefHat, Banknote, CreditCard, Lock, Unlock, ArrowRight, Utensils, RefreshCw, Send, Check, ChevronRight, ArrowLeft, Filter, FileSpreadsheet, Maximize2, Sparkles, Receipt, Eye, Volume2, VolumeX, Clock, Search, Tag, Ticket, Gift, Truck } from 'lucide-react';

const convertGoogleDriveUrl = (url: string): string => {
    if (!url) return '';
    const trimmed = url.trim();
    if (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com') || trimmed.includes('googleusercontent.com')) {
        let fileId = '';
        const dMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]{15,80})/);
        const dShortMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]{15,80})/);
        const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]{15,80})/);
        const lhMatch = trimmed.match(/\/d\/([a-zA-Z0-9_-]{15,80})/);

        if (dMatch && dMatch[1]) {
            fileId = dMatch[1];
        } else if (dShortMatch && dShortMatch[1]) {
            fileId = dShortMatch[1];
        } else if (idMatch && idMatch[1]) {
            fileId = idMatch[1];
        } else if (lhMatch && lhMatch[1]) {
            fileId = lhMatch[1];
        }

        if (fileId) {
            // drive.google.com/thumbnail is serving-safe and bypasses third-party cookie restrictions
            return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;
        }
    }
    return trimmed;
};

const isDriveUrl = (url: string): boolean => {
    if (!url) return false;
    return url.includes('drive.google.com/thumbnail') || url.includes('lh3.googleusercontent.com') || url.includes('drive.google.com') || url.includes('docs.google.com');
};

const isPhotosUrl = (url: string): boolean => {
    if (!url) return false;
    return url.includes('photos.app.goo.gl') || url.includes('photos.google.com');
};

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

export const POSView: React.FC = () => {
    const { 
        menu, addToCart, removeFromCart, cart, cartTotal, clearCart, placeOrder, orders, deleteOrder, updateOrderFields,
        updatePizzaPrice, togglePizzaAvailability, addPizza, deletePizza, updatePizza, toggleBestSeller, reorderMenu,
        toppings, addTopping, updateTopping, deleteTopping, updateCartItemQuantity, updateCartItem,
        adminLogout, shopLogo, updateShopLogo,
        expenses, addExpense, deleteExpense,
        t, toggleLanguage, language, getLocalizedItem,
        isStoreOpen, toggleStoreStatus, storeSettings, updateStoreSettings, seedDatabase,
        partners, addPartner, updatePartner, deletePartner,
        addNewsItem, deleteNewsItem, getAllCustomers, adminUpdateCustomerCoupons, completeOrder, updateOrderStatus, updateOrderDeliveryFee, updateOrderNetAmount,
        paperSize, setPaperSize,
        printerIpAddress, setPrinterIpAddress,
        printerPort, setPrinterPort,
        printerType, setPrinterType,
        receiptFontSize, setReceiptFontSize,
        receiptPadding, setReceiptPadding,
        autoPrintNewOrders, setAutoPrintNewOrders,
        vatEnabled, setVatEnabled,
        btDevice, btCharacteristic, btStatus,
        connectBluetoothPrinter, disconnectBluetoothPrinter, resetBluetoothConnection,
        triggerReceiptPrint, generateEscPosData, writeBtInChunks,
        thaiCodePage, setThaiCodePage,
        promoCodes, addPromoCode, updatePromoCode, deletePromoCode
    } = useStore();
    
    // Unified Tab State
    const [customCP, setCustomCP] = useState<string>("18");
    const [activeTab, setActiveTab] = useState<string>('order');
    const [salesSubTab, setSalesSubTab] = useState<'orders' | 'daily' | 'expenses' | 'cost_analysis'>('orders');
    const [selectedPizza, setSelectedPizza] = useState<Pizza | null>(null);
    const [registeredCustomers, setRegisteredCustomers] = useState<any[]>([]);
    const [loadingCustomers, setLoadingCustomers] = useState<boolean>(false);
    const [customerSearchTerm, setCustomerSearchTerm] = useState<string>('');
    const [selectedCouponCustomer, setSelectedCouponCustomer] = useState<any | null>(null);
    const [newCouponCode, setNewCouponCode] = useState('');
    const [newCouponTitleEn, setNewCouponTitleEn] = useState('');
    const [newCouponTitleTh, setNewCouponTitleTh] = useState('');
    const [newCouponDescEn, setNewCouponDescEn] = useState('');
    const [newCouponDescTh, setNewCouponDescTh] = useState('');
    const [newCouponType, setNewCouponType] = useState<string>('percentage_most_expensive');
    const [newCouponValue, setNewCouponValue] = useState<number>(10);
    const [newCouponMinOrder, setNewCouponMinOrder] = useState<number>(0);
    const [newCouponBadgeEn, setNewCouponBadgeEn] = useState('New Member');
    const [newCouponBadgeTh, setNewCouponBadgeTh] = useState('สมาชิกใหม่');

    // Sales Report Security states
    const [salesPasswordInput, setSalesPasswordInput] = useState<string>('');
    const [isSalesUnlocked, setIsSalesUnlocked] = useState<boolean>(false);
    const [salesPasswordError, setSalesPasswordError] = useState<boolean>(false);
    
    // Half-Half customizer states for POS
    const [halfA, setHalfA] = useState<Pizza | null>(null);
    const [halfB, setHalfB] = useState<Pizza | null>(null);

    // Pizza Boat customizer states for POS
    const [boatA, setBoatA] = useState<Pizza | null>(null);
    const [boatB, setBoatB] = useState<Pizza | null>(null);
    const [boatPriceA, setBoatPriceA] = useState<number>(0);
    const [boatPriceB, setBoatPriceB] = useState<number>(0);

    // Partners form states
    const [newPartnerName, setNewPartnerName] = useState('');
    const [newPartnerComm, setNewPartnerComm] = useState<number>(10);

    // Promo form states
    const [newPromoCode, setNewPromoCode] = useState('');
    const [newPromoDescEn, setNewPromoDescEn] = useState('');
    const [newPromoDescTh, setNewPromoDescTh] = useState('');
    const [newPromoType, setNewPromoType] = useState<'percentage' | 'fixed_order' | 'fixed_delivery'>('percentage');
    const [newPromoValue, setNewPromoValue] = useState<number>(3);
    const [newPromoMinOrder, setNewPromoMinOrder] = useState<number>(500);
    const [newPromoMaxUses, setNewPromoMaxUses] = useState<number>(0);

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

    useEffect(() => {
        if (activeTab !== 'sales') {
            setIsSalesUnlocked(false);
            setSalesPasswordInput('');
            setSalesPasswordError(false);
        }
    }, [activeTab]);

    useEffect(() => {
        if (activeTab === 'manage') {
            const fetchCustomersList = async () => {
                setLoadingCustomers(true);
                try {
                    const data = await getAllCustomers();
                    setRegisteredCustomers(data || []);
                } catch (e) {
                    console.error("Error fetching customers list:", e);
                } finally {
                    setLoadingCustomers(false);
                }
            };
            fetchCustomersList();
        }
    }, [activeTab, getAllCustomers]);

    const handleAddCouponToCustomer = async () => {
        if (!selectedCouponCustomer) return;
        if (!newCouponCode) {
            alert(language === 'th' ? 'กรุณากรอกรหัสคูปอง' : 'Please enter coupon code');
            return;
        }

        const newCoupon = {
            id: 'coupon_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            code: newCouponCode.trim().toUpperCase(),
            title: newCouponTitleEn || 'Custom Discount',
            titleTh: newCouponTitleTh || 'ส่วนลดพิเศษ',
            description: newCouponDescEn || 'Special discount coupon',
            descriptionTh: newCouponDescTh || 'คูปองส่วนลดพิเศษ',
            badge: newCouponBadgeEn || 'Member',
            badgeTh: newCouponBadgeTh || 'สมาชิก',
            discountType: newCouponType,
            discountValue: Number(newCouponValue || 0),
            minOrderAmount: Number(newCouponMinOrder || 0),
            isUsed: false
        };

        const currentCoupons = selectedCouponCustomer.coupons || [];
        const updatedCoupons = [...currentCoupons, newCoupon];

        // Call StoreContext function
        await adminUpdateCustomerCoupons(selectedCouponCustomer.phone, updatedCoupons);

        // Update local state for modal
        setSelectedCouponCustomer((prev: any) => prev ? { ...prev, coupons: updatedCoupons } : null);

        // Update list of registered customers to reflect immediately
        setRegisteredCustomers(prev => prev.map(c => 
            c.phone === selectedCouponCustomer.phone ? { ...c, coupons: updatedCoupons } : c
        ));

        // Reset form
        setNewCouponCode('');
        setNewCouponTitleEn('');
        setNewCouponTitleTh('');
        setNewCouponDescEn('');
        setNewCouponDescTh('');
        setNewCouponValue(10);
        setNewCouponMinOrder(0);
        setNewCouponBadgeEn('Member');
        setNewCouponBadgeTh('สมาชิก');
    };

    const handleRemoveCouponFromCustomer = async (couponId: string) => {
        if (!selectedCouponCustomer) return;
        const currentCoupons = selectedCouponCustomer.coupons || [];
        const updatedCoupons = currentCoupons.filter((c: any) => c.id !== couponId);

        await adminUpdateCustomerCoupons(selectedCouponCustomer.phone, updatedCoupons);

        setSelectedCouponCustomer((prev: any) => prev ? { ...prev, coupons: updatedCoupons } : null);
        setRegisteredCustomers(prev => prev.map(c => 
            c.phone === selectedCouponCustomer.phone ? { ...c, coupons: updatedCoupons } : c
        ));
    };

    const handleToggleCouponUsedStatus = async (couponId: string) => {
        if (!selectedCouponCustomer) return;
        const currentCoupons = selectedCouponCustomer.coupons || [];
        const updatedCoupons = currentCoupons.map((c: any) => 
            c.id === couponId ? { ...c, isUsed: !c.isUsed } : c
        );

        await adminUpdateCustomerCoupons(selectedCouponCustomer.phone, updatedCoupons);

        setSelectedCouponCustomer((prev: any) => prev ? { ...prev, coupons: updatedCoupons } : null);
        setRegisteredCustomers(prev => prev.map(c => 
            c.phone === selectedCouponCustomer.phone ? { ...c, coupons: updatedCoupons } : c
        ));
    };

    const handleSelectCouponTemplate = (templateName: string) => {
        if (templateName === 'new_member') {
            setNewCouponCode('NEWMEMBER10');
            setNewCouponTitleEn('10% Off Pizza Boat / Pizza');
            setNewCouponTitleTh('ลด 10% พิซซ่าถาดที่แพงที่สุด');
            setNewCouponDescEn('10% discount on the single most expensive pizza in your order');
            setNewCouponDescTh('ส่วนลด 10% สำหรับพิซซ่า 1 ถาดที่ราคาแพงที่สุดในออเดอร์นั้น');
            setNewCouponBadgeEn('New Member');
            setNewCouponBadgeTh('สมาชิกใหม่');
            setNewCouponType('percentage_most_expensive');
            setNewCouponValue(10);
            setNewCouponMinOrder(0);
        } else if (templateName === 'monthly_promo') {
            setNewCouponCode('MONTHLYPROMO');
            setNewCouponTitleEn('15% Off Total Order');
            setNewCouponTitleTh('คูปองลดพิเศษประจำเดือน 15%');
            setNewCouponDescEn('15% discount on your order (pickup, delivery, dine-in)');
            setNewCouponDescTh('ส่วนลด 15% สำหรับทุกช่องทางสั่งซื้อ');
            setNewCouponBadgeEn('Promo');
            setNewCouponBadgeTh('โปรโมชั่น');
            setNewCouponType('percentage_total');
            setNewCouponValue(15);
            setNewCouponMinOrder(300);
        } else if (templateName === 'free_delivery') {
            setNewCouponCode('FREESHIP');
            setNewCouponTitleEn('Free Delivery up to 100 THB');
            setNewCouponTitleTh('คูปองส่งฟรี สูงสุด 100 บาท');
            setNewCouponDescEn('Free delivery on orders above 500 THB');
            setNewCouponDescTh('ฟรีค่าจัดส่งสูงสุด 100 บาท สำหรับสั่งเดลิเวอรี่');
            setNewCouponBadgeEn('Free Delivery');
            setNewCouponBadgeTh('ส่งฟรี');
            setNewCouponType('free_delivery');
            setNewCouponValue(100);
            setNewCouponMinOrder(500);
        } else if (templateName === 'member_discount') {
            setNewCouponCode('MEMBER50');
            setNewCouponTitleEn('50 THB Discount');
            setNewCouponTitleTh('ส่วนลดเงินสด 50 บาท');
            setNewCouponDescEn('Get 50 THB off your order');
            setNewCouponDescTh('ส่วนลดเงินสด 50 บาท สำหรับทุกเมนู เมื่อสั่งขั้นต่ำ 300 บาท');
            setNewCouponBadgeEn('Member');
            setNewCouponBadgeTh('สมาชิก');
            setNewCouponType('fixed_discount');
            setNewCouponValue(50);
            setNewCouponMinOrder(300);
        }
    };

    const handleAddPromoCodeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPromoCode.trim()) {
            alert(language === 'th' ? 'กรุณาใส่รหัสส่วนลด' : 'Please enter a promo code');
            return;
        }
        
        const promo: any = {
            id: Date.now().toString(),
            code: newPromoCode.trim().toUpperCase(),
            description: newPromoDescEn.trim() || `${newPromoValue}% off on orders above ฿${newPromoMinOrder}`,
            descriptionTh: newPromoDescTh.trim() || `ส่วนลด ${newPromoValue}${newPromoType === 'percentage' ? '%' : ' บาท'} เมื่อสั่งขั้นต่ำ ฿${newPromoMinOrder}`,
            discountType: newPromoType,
            discountValue: Number(newPromoValue) || 0,
            minOrderAmount: Number(newPromoMinOrder) || 0,
            maxUsesPerDay: Number(newPromoMaxUses) || 0,
            isActive: true,
            createdAt: new Date().toISOString()
        };
        
        await addPromoCode(promo);
        
        // Reset form
        setNewPromoCode('');
        setNewPromoDescEn('');
        setNewPromoDescTh('');
        setNewPromoType('percentage');
        setNewPromoValue(3);
        setNewPromoMinOrder(500);
        setNewPromoMaxUses(0);
    };

    const handleUpdateGPDeduction = async (order: Order) => {
        const suggestion = (order.totalAmount - (order.netAmount || order.totalAmount)).toFixed(2);
        const deductionStr = prompt(`Enter GP Deduction Amount for Order #${String(order.id).slice(-4)}:`, suggestion);
        if (deductionStr !== null) {
            const deduction = parseFloat(deductionStr);
            if (!isNaN(deduction) && deduction >= 0) {
                const newNetAmount = order.totalAmount - deduction;
                await updateOrderNetAmount(order.id, newNetAmount);
            } else {
                alert("Invalid deduction amount.");
            }
        }
    };

    const isoToDatetimeLocal = (isoStr: string) => {
        try {
            if (!isoStr) return '';
            const date = new Date(isoStr);
            const pad = (num: number) => String(num).padStart(2, '0');
            const year = date.getFullYear();
            const month = pad(date.getMonth() + 1);
            const day = pad(date.getDate());
            const hours = pad(date.getHours());
            const minutes = pad(date.getMinutes());
            return `${year}-${month}-${day}T${hours}:${minutes}`;
        } catch (e) {
            return '';
        }
    };

    const datetimeLocalToIso = (localStr: string) => {
        try {
            if (!localStr) return new Date().toISOString();
            const date = new Date(localStr);
            return date.toISOString();
        } catch (e) {
            return new Date().toISOString();
        }
    };

    const handleDeleteOrderPrompt = async (order: Order) => {
        const confirmMsg = language === 'th' 
            ? `คุณแน่ใจหรือไม่ว่าต้องการลบออเดอร์ #${String(order.id).slice(-4)} ของคุณ ${order.customerName}? (การลบนี้จะไม่สามารถย้อนกลับได้และข้อมูลในฐานข้อมูลจะถูกลบถาวร)` 
            : `Are you sure you want to delete order #${String(order.id).slice(-4)} for ${order.customerName}? (This action cannot be undone and data will be permanently removed from database)`;
        if (confirm(confirmMsg)) {
            try {
                await deleteOrder(order.id);
                alert(language === 'th' ? "ลบออเดอร์สำเร็จแล้ว!" : "Order deleted successfully!");
            } catch (e: any) {
                alert("Error deleting order: " + e.message);
            }
        }
    };

    const handleStartEditOrder = (order: Order) => {
        setEditingOrder(order);
        setEditOrderForm({
            customerName: order.customerName || '',
            customerPhone: order.customerPhone || '',
            status: order.status,
            source: order.source,
            paymentMethod: order.paymentMethod || 'cash',
            totalAmount: order.totalAmount,
            netAmount: order.netAmount || order.totalAmount,
            createdAt: order.createdAt,
            tableNumber: order.tableNumber || '',
            note: order.note || ''
        });
        setShowEditOrderModal(true);
    };

    const handleSaveOrderEdit = async () => {
        if (!editingOrder) return;
        try {
            await updateOrderFields(editingOrder.id, {
                customerName: editOrderForm.customerName,
                customerPhone: editOrderForm.customerPhone,
                status: editOrderForm.status,
                source: editOrderForm.source,
                paymentMethod: editOrderForm.paymentMethod,
                totalAmount: Number(editOrderForm.totalAmount),
                netAmount: Number(editOrderForm.netAmount),
                createdAt: editOrderForm.createdAt,
                tableNumber: editOrderForm.tableNumber,
                note: editOrderForm.note
            });
            setShowEditOrderModal(false);
            setEditingOrder(null);
            alert(language === 'th' ? "บันทึกการแก้ไขออเดอร์สำเร็จแล้ว!" : "Order details saved successfully!");
        } catch (e: any) {
            alert("Error updating order: " + e.message);
        }
    };

    const startEditingOrderItems = (order: Order) => {
        const password = prompt(language === 'th' ? "กรุณากรอกรหัสผ่านเพื่อแก้ไขรายการออเดอร์:" : "Please enter the password to edit this order:");
        if (password !== '1234' && password !== 'Wachirus299*') {
            alert(language === 'th' ? "รหัสผ่านไม่ถูกต้อง!" : "Incorrect password!");
            return;
        }
        setEditingOrderForItems(order);
        setEditedItemsList(JSON.parse(JSON.stringify(order.items || []))); // deep clone
        setEditedOrderNote(order.note || '');
        setEditedOrderTableNumber(order.tableNumber || '');
        setEditedOrderCustomerName(order.customerName || '');
        setEditedOrderSource(order.source || 'store');
        setAddSearchQuery('');
        setAddCategoryFilter('all');
        setShowOrderItemsEditor(true);
    };

    const handleSaveEditedOrderItems = async () => {
        if (!editingOrderForItems) return;
        
        if (editedItemsList.length === 0) {
            alert(language === 'th' ? "กรุณาใส่รายการอาหารอย่างน้อย 1 รายการ!" : "Please include at least 1 item in the order!");
            return;
        }

        const totalAmount = editedItemsList.reduce((sum, item) => sum + item.totalPrice, 0);
        
        // Retain delivery settings if any
        const oldTotal = editingOrderForItems.totalAmount || 1;
        const oldNet = editingOrderForItems.netAmount || oldTotal;
        const gpDeductionRatio = (oldTotal - oldNet) / oldTotal;
        const netAmount = Math.max(0, totalAmount - Math.round(totalAmount * gpDeductionRatio));

        try {
            await updateOrderFields(editingOrderForItems.id, {
                items: editedItemsList,
                totalAmount: totalAmount,
                netAmount: netAmount,
                note: editedOrderNote,
                tableNumber: editedOrderTableNumber,
                customerName: editedOrderCustomerName,
                source: editedOrderSource
            });
            
            setShowOrderItemsEditor(false);
            setEditingOrderForItems(null);
            playAlertSound();
            alert(language === 'th' ? "💾 บันทึกการแก้ไขรายการออเดอร์สำเร็จแล้ว!" : "💾 Order items updated successfully!");
        } catch (e: any) {
            alert("Error saving: " + e.message);
        }
    };

    const incrementEditedItemQty = (id: string) => {
        setEditedItemsList(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = item.quantity + 1;
                const unitPrice = item.totalPrice / item.quantity;
                return { ...item, quantity: newQty, totalPrice: unitPrice * newQty };
            }
            return item;
        }));
    };

    const decrementEditedItemQty = (id: string) => {
        setEditedItemsList(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(1, item.quantity - 1);
                const unitPrice = item.totalPrice / item.quantity;
                return { ...item, quantity: newQty, totalPrice: unitPrice * newQty };
            }
            return item;
        }));
    };

    const deleteEditedItem = (id: string) => {
        if (confirm(language === 'th' ? "ลบรายการนี้ออกจากออเดอร์?" : "Remove this item from the order?")) {
            setEditedItemsList(prev => prev.filter(item => item.id !== id));
        }
    };

    const addMenuItemToEditedList = (pizza: Pizza) => {
        setEditedItemsList(prev => {
            const existing = prev.find(item => item.pizzaId === pizza.id && (!item.selectedToppings || item.selectedToppings.length === 0));
            if (existing) {
                const unitPrice = existing.totalPrice / existing.quantity;
                return prev.map(item => item.id === existing.id ? { ...item, quantity: item.quantity + 1, totalPrice: unitPrice * (item.quantity + 1) } : item);
            } else {
                const newItem: CartItem = {
                    id: Date.now() + Math.random().toString(),
                    pizzaId: pizza.id,
                    name: pizza.name,
                    nameTh: pizza.nameTh || pizza.name,
                    basePrice: pizza.basePrice,
                    selectedToppings: [],
                    quantity: 1,
                    totalPrice: pizza.basePrice,
                    subItems: []
                };
                return [...prev, newItem];
            }
        });
    };
    const [selectedToppings, setSelectedToppings] = useState<Topping[]>([]);
    const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);
    const [activeCategory, setActiveCategory] = useState<ProductCategory>('pizza');
    const [showMobileCart, setShowMobileCart] = useState(false);
    const [specialInstructions, setSpecialInstructions] = useState('');
    const [quantity, setQuantity] = useState(1);
    
    // Combo Builder State
    const [comboSelections, setComboSelections] = useState<SubItem[]>([]);
    const [activeComboSlot, setActiveComboSlot] = useState<number | null>(null);

    // Admin / Edit features
    const [isEditMode, setIsEditMode] = useState(false);
    const [tableNumber, setTableNumber] = useState('');
    const [deliveryPlatformRef, setDeliveryPlatformRef] = useState('');
    const [posOrderType, setPosOrderType] = useState<OrderType>('dine-in');
    const [posDeliveryAddress, setPosDeliveryAddress] = useState('');
    const [posCustomerPhone, setPosCustomerPhone] = useState('');
    const [posDeliveryLat, setPosDeliveryLat] = useState<number | null>(null);
    const [posDeliveryLng, setPosDeliveryLng] = useState<number | null>(null);
    const [posResolvingGps, setPosResolvingGps] = useState(false);
    const [posDiscount, setPosDiscount] = useState<number>(0);
    // --- Member coupon redemption (walk-in customers) ---
    const [showMemberCouponModal, setShowMemberCouponModal] = useState(false);
    const [memberLookupPhone, setMemberLookupPhone] = useState('');
    const [memberLookupLoading, setMemberLookupLoading] = useState(false);
    const [memberProfile, setMemberProfile] = useState<any | null>(null);
    const [posMemberCoupon, setPosMemberCoupon] = useState<any | null>(null);
    const [profileCustomer, setProfileCustomer] = useState<any | null>(null); // CRM full-profile drawer
    const [posPromoId, setPosPromoId] = useState<string>('');
    const [tempClosedMsg, setTempClosedMsg] = useState(storeSettings.closedMessage);
    const [orderSource, setOrderSource] = useState<OrderSource>('store');

    // Debounced coordinate extraction & short link resolution for POS Delivery
    useEffect(() => {
        if (posOrderType !== 'delivery' || !posDeliveryAddress) {
            setPosDeliveryLat(null);
            setPosDeliveryLng(null);
            return;
        }

        const timer = setTimeout(async () => {
            const trimmed = posDeliveryAddress.trim();
            // Try parsing coordinates directly first from the address
            const direct = parseAnyMapLink(trimmed);
            if (direct) {
                setPosDeliveryLat(direct.lat);
                setPosDeliveryLng(direct.lng);
                return;
            }

            // Look for any link inside the text
            const linkMatch = trimmed.match(/(https?:\/\/[^\s]+)/);
            if (linkMatch) {
                const url = linkMatch[1].replace(/[\]]/g, ''); // strip any trailing brackets
                if (url.includes('maps') || url.includes('goo.gl')) {
                    setPosResolvingGps(true);
                    try {
                        const res = await fetch('/api/resolve-link', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ url })
                        });
                        const data = await res.json();
                        if (data && data.targetUrl) {
                            const resolvedCoords = parseAnyMapLink(data.targetUrl);
                            if (resolvedCoords) {
                                setPosDeliveryLat(resolvedCoords.lat);
                                setPosDeliveryLng(resolvedCoords.lng);
                            }
                        }
                    } catch (err) {
                        console.error("Failed to resolve POS maps link:", err);
                    } finally {
                        setPosResolvingGps(false);
                    }
                }
            }
        }, 600);

        return () => clearTimeout(timer);
    }, [posDeliveryAddress, posOrderType]);

    const getPizzaPrice = (pizza: Pizza, source: OrderSource): number => {
        if (source === 'grab' && pizza.grabPrice !== undefined && pizza.grabPrice > 0) {
            return pizza.grabPrice;
        }
        if (source === 'lineman' && pizza.linemanPrice !== undefined && pizza.linemanPrice > 0) {
            return pizza.linemanPrice;
        }
        return pizza.basePrice;
    };
    
    // Reporting State
    const [salesFilter, setSalesFilter] = useState<'day' | 'month' | 'year' | 'all'>('day');
    const [selectedSalesDate, setSelectedSalesDate] = useState<Date>(new Date());
    
    // Add/Edit Item State
    const [showItemModal, setShowItemModal] = useState(false);
    const [itemForm, setItemForm] = useState<Partial<Pizza>>({
        name: '', nameTh: '', description: '', descriptionTh: '', basePrice: 0, image: '', available: true, category: 'pizza', comboCount: 0, allowedPromotions: []
    });
    const [ingredientCostsMap, setIngredientCostsMap] = useState<Record<string, { id: string; name: string; cost: number }[]>>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('damac_ingredient_costs');
            if (saved) {
                try { return JSON.parse(saved); } catch(e) {}
            }
        }
        return {
            'p_damac': [
                { id: '1', name: 'Pizza Dough Base', cost: 35 },
                { id: '2', name: 'Signature Tomato Sauce', cost: 20 },
                { id: '3', name: 'Premium Mozzarella Cheese', cost: 65 },
                { id: '4', name: 'Italian Prosciutto', cost: 80 },
                { id: '5', name: 'Fresh Basil & Olive Oil', cost: 15 }
            ],
            'p_custom': [
                { id: '1', name: 'Pizza Dough Base', cost: 30 },
                { id: '2', name: 'Basic Tomato Sauce', cost: 15 },
                { id: '3', name: 'Mozzarella Cheese', cost: 45 }
            ],
            'p_margherita': [
                { id: '1', name: 'Pizza Dough Base', cost: 30 },
                { id: '2', name: 'Classic Marinara Sauce', cost: 15 },
                { id: '3', name: 'Fresh Mozzarella Cheese', cost: 50 },
                { id: '4', name: 'Fresh Basil Leaves', cost: 5 },
                { id: '5', name: 'Extra Virgin Olive Oil', cost: 10 }
            ],
            'p_pepperoni': [
                { id: '1', name: 'Pizza Dough Base', cost: 30 },
                { id: '2', name: 'Classic Marinara Sauce', cost: 15 },
                { id: '3', name: 'Fresh Mozzarella Cheese', cost: 50 },
                { id: '4', name: 'Spicy Pepperoni Slices', cost: 75 }
            ]
        };
    });
    const [modalIngredients, setModalIngredients] = useState<{ id: string; name: string; cost: number }[]>([]);
    const [newIngredientName, setNewIngredientName] = useState('');
    const [newIngredientCost, setNewIngredientCost] = useState<number>(0);
    
    // Manage Toppings State
    const [showToppingsModal, setShowToppingsModal] = useState(false);
    const [toppingForm, setToppingForm] = useState<Partial<Topping>>({
        name: '', nameTh: '', price: 0, category: 'other', available: true, image: ''
    });

    // Expense Form State
    const [expenseForm, setExpenseForm] = useState({
        description: '',
        amount: '',
        category: 'COGS' as ExpenseCategory,
        note: '',
        quantity: 1,
        unit: 'แพ็ค',
        unitPrice: 0,
        vendor: '',
        billNumber: '',
        saveAsTemplate: false
    });

    const [expenseTemplates, setExpenseTemplates] = useState<any[]>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('damac_expense_templates');
            if (saved) {
                try { return JSON.parse(saved); } catch(e) {}
            }
        }
        return [
            { id: 'tpl-1', description: 'แป้งพิซซ่าอเนกประสงค์', quantity: 10, unit: 'กิโลกรัม', unitPrice: 35, amount: 350, category: 'COGS', vendor: 'แม็คโคร', note: '' },
            { id: 'tpl-2', description: 'มอสซาเรลล่าชีส 2kg', quantity: 2, unit: 'ถุง', unitPrice: 580, amount: 1160, category: 'COGS', vendor: 'แม็คโคร', note: '' },
            { id: 'tpl-3', description: 'กล่องพิซซ่า 10 นิ้ว', quantity: 100, unit: 'ใบ', unitPrice: 8.5, amount: 850, category: 'COGS', vendor: 'โรงพิมพ์แพ็คเกจ', note: '' },
            { id: 'tpl-4', description: 'ซอสมะเขือเทศเข้มข้น', quantity: 5, unit: 'กระป๋อง', unitPrice: 120, amount: 600, category: 'COGS', vendor: 'แม็คโคร', note: '' },
            { id: 'tpl-5', description: 'ค่าน้ำไฟประจำเดือน', quantity: 1, unit: 'เดือน', unitPrice: 4200, amount: 4200, category: 'Utility', vendor: 'การไฟฟ้า/ประปา', note: '' }
        ];
    });

    useEffect(() => {
        try {
            localStorage.setItem('damac_expense_templates', JSON.stringify(expenseTemplates));
        } catch(e) {}
    }, [expenseTemplates]);

    // News Form State
    const [newsForm, setNewsForm] = useState({
        title: '',
        summary: '',
        imageUrl: '',
        linkUrl: ''
    });
    
    // Table QR State
    const [qrTableNum, setQrTableNum] = useState('1');
    const [qrBaseUrl, setQrBaseUrl] = useState(() => (typeof window !== 'undefined' ? window.location.origin : ''));
    const [showQrFullScreen, setShowQrFullScreen] = useState(false);

    // --- PAYMENT MODAL STATE ---
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
    const [cashReceived, setCashReceived] = useState<string>('');
    const [taxInvoice, setTaxInvoice] = useState({ isRequested: false, companyName: '', taxId: '', address: '' });
    const [change, setChange] = useState<number>(0);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    const posCalculatedDiscount = useMemo(() => {
        if (!posPromoId) return posDiscount || 0;
        const promo = promoCodes.find(p => p.id === posPromoId);
        if (!promo) return posDiscount || 0;
        
        let d = 0;
        if (promo.discountType === 'percentage') {
            d = Math.round(cartTotal * (promo.discountValue / 100));
        } else if (promo.discountType === 'fixed_order') {
            d = Math.min(cartTotal, promo.discountValue);
        }
        return d;
    }, [posPromoId, posDiscount, cartTotal, promoCodes]);

    // Member coupon: discount for the CURRENT cart (same rules as customer checkout)
    const posMemberCouponDiscount = useMemo(() => {
        const c = posMemberCoupon;
        if (!c) return 0;
        if (cartTotal < (c.minOrderAmount || 0)) return 0;
        if (c.expiryDate) {
            const exp = new Date(`${c.expiryDate}T23:59:59`);
            if (!isNaN(exp.getTime()) && new Date() > exp) return 0;
        }
        if (c.applicableOrderTypes && c.applicableOrderTypes.length > 0 && !c.applicableOrderTypes.includes(posOrderType)) return 0;
        if (c.discountType === 'percentage_most_expensive') {
            let maxUnit = 0;
            cart.forEach(item => {
                const itemDef = menu.find(m => m.id === item.pizzaId);
                if (itemDef?.category === 'pizza' || itemDef?.category === 'promotion') {
                    const unitPrice = item.totalPrice / item.quantity;
                    if (unitPrice > maxUnit) maxUnit = unitPrice;
                }
            });
            return Math.round(maxUnit * ((c.discountValue || 0) / 100));
        } else if (c.discountType === 'fixed_discount') {
            return Math.min(cartTotal, c.discountValue || 0);
        } else if (c.discountType === 'percentage_total') {
            return Math.round(cartTotal * ((c.discountValue || 0) / 100));
        }
        return 0; // free_delivery is not applicable for POS orders
    }, [posMemberCoupon, cartTotal, posOrderType, cart, menu]);

    const handleMemberLookup = async () => {
        const ph = (memberLookupPhone || '').trim();
        if (!ph) return;
        setMemberLookupLoading(true);
        setMemberProfile(null);
        try {
            const { data } = await supabase.rpc('loyalty_lookup', { p_phone: ph }).single();
            if (data && (data as any).phone) {
                const d: any = data;
                let coupons = Array.isArray(d.coupons) ? d.coupons : [];
                // Auto-grant the birthday gift if this is the customer's birth month
                const bdayGift = grantBirthdayCouponIfEligible(d.birthday, coupons);
                if (bdayGift) {
                    coupons = [...coupons, bdayGift];
                    try { await supabase.rpc('loyalty_update', { p_phone: ph, p: { coupons } }); } catch (e) { console.warn('birthday grant save failed', e); }
                }
                setMemberProfile({ phone: d.phone, name: d.name || '', points: d.loyalty_points || 0, coupons });
            } else {
                alert(language === 'th' ? 'ไม่พบสมาชิกเบอร์นี้ (ให้ลูกค้าสมัครที่ pizzadamac.com ก่อนครับ)' : 'No member found for this phone.');
            }
        } catch (e) {
            alert(language === 'th' ? 'ไม่พบสมาชิกเบอร์นี้ (ให้ลูกค้าสมัครที่ pizzadamac.com ก่อนครับ)' : 'No member found for this phone.');
        } finally {
            setMemberLookupLoading(false);
        }
    };

    const posCheckoutTotal = useMemo(() => {
        return selectedOrder ? selectedOrder.totalAmount : Math.max(0, cartTotal - posCalculatedDiscount - posMemberCouponDiscount);
    }, [selectedOrder, cartTotal, posCalculatedDiscount, posMemberCouponDiscount]);

    // --- EDIT ORDER STATE ---
    const [editingOrder, setEditingOrder] = useState<Order | null>(null);
    const [showEditOrderModal, setShowEditOrderModal] = useState(false);
    const [editOrderForm, setEditOrderForm] = useState<{
        customerName: string;
        customerPhone: string;
        status: OrderStatus;
        source: OrderSource;
        paymentMethod: PaymentMethod;
        totalAmount: number;
        netAmount: number;
        createdAt: string;
        tableNumber: string;
        note: string;
    }>({
        customerName: '',
        customerPhone: '',
        status: 'pending',
        source: 'store',
        paymentMethod: 'cash',
        totalAmount: 0,
        netAmount: 0,
        createdAt: '',
        tableNumber: '',
        note: ''
    });

    // --- ACTIVE ORDER ITEMS EDIT STATES ---
    const [editingOrderForItems, setEditingOrderForItems] = useState<Order | null>(null);
    const [showOrderItemsEditor, setShowOrderItemsEditor] = useState<boolean>(false);
    const [editedItemsList, setEditedItemsList] = useState<CartItem[]>([]);
    const [editedOrderNote, setEditedOrderNote] = useState<string>('');
    const [editedOrderTableNumber, setEditedOrderTableNumber] = useState<string>('');
    const [editedOrderCustomerName, setEditedOrderCustomerName] = useState<string>('');
    const [editedOrderSource, setEditedOrderSource] = useState<OrderSource>('store');
    const [addSearchQuery, setAddSearchQuery] = useState<string>('');
    const [addCategoryFilter, setAddCategoryFilter] = useState<ProductCategory | 'all'>('all');

    // --- POS AUDIO ALERTS AND SYSTEM SOUND FEEDBACK ---
    const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
        try {
            const saved = localStorage.getItem('damac_pos_sound');
            return saved !== null ? JSON.parse(saved) : true;
        } catch (e) {
            return true;
        }
    });
    const [audioUnlocked, setAudioUnlocked] = useState<boolean>(false);
    const audioCtxRef = React.useRef<AudioContext | null>(null);

    const initAudio = () => {
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            if (audioCtxRef.current.state === 'suspended') {
                audioCtxRef.current.resume();
            }
            setAudioUnlocked(true);
        } catch (e) {
            console.warn("Failed to initialize or resume AudioContext", e);
        }
    };

    useEffect(() => {
        const handleUserGesture = () => {
            if (!audioUnlocked) {
                initAudio();
            }
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
            localStorage.setItem('damac_pos_sound', JSON.stringify(next));
            return next;
        });
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

    // --- LOCAL STATE FOR SETTINGS FORMS ---
    const [mediaForm, setMediaForm] = useState({
        promoBannerUrl: '',
        reviewLinks: [] as string[],
        vibeLinks: [] as string[],
        eventGalleryUrls: [] as string[]
    });

    const [contactForm, setContactForm] = useState({
        reviewUrl: '',
        mapUrl: '',
        facebookUrl: '',
        lineUrl: '',
        contactPhone: '',
        promptPayNumber: '' 
    });

    const [deliveryForm, setDeliveryForm] = useState({
        storeLocationGps: '',
        freeDeliveryRadiusKm: 5,
        deliveryFeePerKm: 10,
        baseDeliveryFee: 0
    });

    const [storeStatusForm, setStoreStatusForm] = useState({
        isOpen: true,
        closedMessage: '',
        holidayStart: '',
        holidayEnd: ''
    });
    
    // Robust Receipt Data Interface
    interface ReceiptData {
        storeName: string;
        address: string;
        taxId: string;
        phone: string;
        orderId: string;
        date: string;
        tableOrType: string;
        source: string;
        customerName: string;
        customerPhone?: string;
        deliveryAddress?: string;
        deliveryFee?: number | 'pending';
        items: CartItem[];
        subtotal: number;
        vat: number; // 7%
        total: number;
        paymentMethod: string;
        received?: number;
        change: number;
        note?: string;
        queueNo?: string;
        deliveryPlatformRef?: string;
        taxInvoice?: {
            isRequested: boolean;
            companyName: string;
            taxId: string;
            address: string;
        };
        isPaid?: boolean;
    }
    const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);

    // Sync local forms when storeSettings loads/updates
    useEffect(() => {
        if (storeSettings) {
            setMediaForm({
                promoBannerUrl: storeSettings.promoBannerUrl || '',
                reviewLinks: storeSettings.reviewLinks || [],
                vibeLinks: storeSettings.vibeLinks || [],
                eventGalleryUrls: storeSettings.eventGalleryUrls || []
            });
            setContactForm({
                reviewUrl: storeSettings.reviewUrl || '',
                mapUrl: storeSettings.mapUrl || '',
                facebookUrl: storeSettings.facebookUrl || '',
                lineUrl: storeSettings.lineUrl || '',
                contactPhone: storeSettings.contactPhone || '',
                promptPayNumber: storeSettings.promptPayNumber || ''
            });
            setDeliveryForm({
                storeLocationGps: storeSettings.storeLocationGps || '13.9239103,100.5220632',
                freeDeliveryRadiusKm: storeSettings.freeDeliveryRadiusKm ?? 5,
                deliveryFeePerKm: storeSettings.deliveryFeePerKm ?? 10,
                baseDeliveryFee: storeSettings.baseDeliveryFee ?? 0
            });
            setStoreStatusForm({
                isOpen: storeSettings.isOpen ?? true,
                closedMessage: storeSettings.closedMessage || '',
                holidayStart: storeSettings.holidayStart || '',
                holidayEnd: storeSettings.holidayEnd || ''
            });
            setTempClosedMsg(storeSettings.closedMessage);
        }
    }, [storeSettings]);

    // --- HELPER: IMAGE COMPRESSION ---
    // Prevents app crash by resizing large images before saving to state/localStorage
    const compressImage = (file: File, maxWidth: number = 800): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    
                    // Resize logic
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    
                    // Compress to JPEG at 0.5 quality to save space
                    resolve(canvas.toDataURL('image/jpeg', 0.5));
                };
                img.onerror = (error) => reject(error);
            };
            reader.onerror = (error) => reject(error);
        });
    };

    // --- HELPER: UPLOAD IMAGE TO SUPABASE STORAGE (menu-images bucket) ---
    // Keeps the DB tiny: the image file lives on the CDN, the DB stores only a short URL.
    // Falls back to the inline base64 image if the upload fails, so nothing ever breaks.
    const uploadImageToStorage = async (dataUrl: string, prefix: string): Promise<string> => {
        try {
            const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,/);
            if (!m) return dataUrl; // already a URL or unknown format
            const mime = m[1];
            const ext = mime.split('/')[1].replace('jpeg', 'jpg').replace('svg+xml', 'svg');
            const bin = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const path = `${prefix}-${Date.now()}.${ext}`;
            const { error } = await supabase.storage.from('menu-images').upload(path, bytes, { contentType: mime, upsert: true });
            if (error) { console.error('Storage upload failed, keeping inline image', error); return dataUrl; }
            const { data } = supabase.storage.from('menu-images').getPublicUrl(path);
            return data?.publicUrl || dataUrl;
        } catch (e) {
            console.error('Storage upload error, keeping inline image', e);
            return dataUrl;
        }
    };

    // Active Tables Logic - Show active or unpaid orders
    const activeTables = (orders || []).filter(o => 
        o && 
        o.status &&
        o.status !== 'completed' && 
        o.status !== 'cancelled'
    );

    // Calculate Change
    useEffect(() => {
        const total = posCheckoutTotal;
        if (paymentMethod === 'cash' && cashReceived) {
            const received = parseFloat(cashReceived);
            setChange(received - total);
        } else {
            setChange(0);
        }
    }, [cashReceived, posCheckoutTotal, paymentMethod, selectedOrder]);

    // Stable transition tracker for silent initial load & real-time auto-prints
    const sessionStartTimeRef = React.useRef(Date.now());
    const prevOrdersRef = React.useRef<Order[]>([]);

    useEffect(() => {
        if (!orders) return;

        // If this is the initial mount/load or prevOrders is empty, we record current orders as pre-existing
        const validOrders = orders.filter(Boolean);
        if (prevOrdersRef.current.length === 0 && validOrders.length > 0) {
            prevOrdersRef.current = validOrders;
            return;
        }

        if (!autoPrintNewOrders) {
            prevOrdersRef.current = validOrders;
            return;
        }

        validOrders.forEach(order => {
            if (!order || !order.id) return;
            const prevOrder = prevOrdersRef.current.find(o => o && o.id === order.id);

            if (!prevOrder) {
                // New Order added to list in this active session
                const orderTime = order.createdAt ? new Date(order.createdAt).getTime() : Date.now();
                const isNewSessionOrder = orderTime > sessionStartTimeRef.current - 15000; // within 15 seconds of or after session start

                if (isNewSessionOrder) {
                    // Auto-print any newly received orders (pending/confirmed/completed) regardless of order type
                    if (order.status === 'pending' || order.status === 'confirmed' || order.status === 'completed') {
                        handleReprintOrder(order);
                    }
                }
            } else {
                // Pre-existing order modified: check status transition to completed/paid
                if (prevOrder.status !== 'completed' && order.status === 'completed') {
                    handleReprintOrder(order);
                }
            }
        });

        prevOrdersRef.current = validOrders;
    }, [orders, autoPrintNewOrders]);

    // PromptPay QR Payload Generator
    const promptPayQRUrl = useMemo(() => {
        if (paymentMethod !== 'qr_transfer') return '';
        const amount = posCheckoutTotal;
        const ppNumber = storeSettings.promptPayNumber || '0994979199';
        const payload = generatePromptPayPayload(ppNumber, amount);
        return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(payload)}&t=${Date.now()}`;
    }, [paymentMethod, selectedOrder, posCheckoutTotal, storeSettings.promptPayNumber]);

    // Helper Functions
    const filterByDate = (dateString: string, filter: 'day'|'month'|'year'|'all') => {
        if (filter === 'all') return true;
        const d = new Date(dateString);
        if (filter === 'day') {
            return d.toDateString() === selectedSalesDate.toDateString();
        }
        const now = new Date();
        if (filter === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        if (filter === 'year') return d.getFullYear() === now.getFullYear();
        return true;
    };

    const downloadCSV = (data: any[], filename: string) => {
        if (data.length === 0) { alert("No data"); return; }
        const headers = Object.keys(data[0]);
        const csvContent = [headers.join(','), ...data.map(row => headers.map(header => `"${('' + (row[header]??'')).replace(/"/g, '""')}"`).join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const getCleanQrUrl = () => (qrBaseUrl || '').replace(/\/$/, "");
    
    // Print Table Card
    const handlePrintQrCard = () => {
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(getCleanQrUrl() + '?table=' + qrTableNum)}`;
        const printWindow = window.open('', '', 'width=600,height=800');
        if (printWindow) {
            printWindow.document.write(`
                <html><head><title>Table ${qrTableNum}</title><style>body{font-family:sans-serif;text-align:center;padding:40px;}.card{border:3px solid black;padding:60px 40px;border-radius:20px;display:inline-block;}img.qr{width:300px;height:300px;}</style></head>
                <body><div class="card"><h1>Table ${qrTableNum}</h1><p>Scan to Order</p><img src="${qrUrl}" class="qr" /></div>
                <script>window.onload=function(){setTimeout(function(){window.print();},500);}</script></body></html>`);
            printWindow.document.close();
        }
    };

    // Cart Customization
    const handleCustomize = (pizza: Pizza) => {
        if (isEditMode && activeTab === 'order') return;
        playClickSound();
        setSelectedPizza({...pizza}); 
        setSelectedToppings([]);
        setEditingCartItem(null);
        setComboSelections([]);
        setActiveComboSlot(null);
        setSpecialInstructions('');
        setQuantity(1);
        if (pizza.category === 'promotion' && (pizza.comboCount || 0) > 0) {
            setComboSelections(new Array(pizza.comboCount).fill(null));
        }
    };

    const handleEditCartItem = (item: CartItem) => {
        playClickSound();
        const pizza = menu.find(p => p.id === item.pizzaId);
        if (pizza) {
            setSelectedPizza({...pizza});
            setSelectedToppings(item.selectedToppings);
            setEditingCartItem(item);
            setSpecialInstructions(item.specialInstructions || '');
            setQuantity(item.quantity);
            if (item.subItems) setComboSelections(item.subItems);
            if (window.innerWidth < 768) setShowMobileCart(false);
        }
    };

    const toggleTopping = (topping: Topping) => {
        playClickSound();
        if (selectedToppings.find(t => t.id === topping.id)) {
            setSelectedToppings(prev => prev.filter(t => t.id !== topping.id));
        } else {
            setSelectedToppings(prev => [...prev, topping]);
        }
    };

    const confirmAddToCart = () => {
        if (!selectedPizza) return;
        playSuccessFeedback();
        const toppingsPrice = selectedToppings.reduce((sum, t) => sum + t.price, 0);

        if (selectedPizza.id === 'p_boat') {
            if (!boatA || !boatB) {
                alert("Please select both parts of the Pizza Boat!");
                return;
            }
            const calculatedBasePrice = Number(boatPriceA) + Number(boatPriceB);
            const itemTotal = (calculatedBasePrice + toppingsPrice) * quantity;
            const nameEn = `Pizza Boat (${boatA.name} [฿${boatPriceA}] / ${boatB.name} [฿${boatPriceB}])`;
            const nameTh = `พิซซ่าโบ๊ท (${boatA.nameTh || boatA.name} [฿${boatPriceA}] / ${boatB.nameTh || boatB.name} [฿${boatPriceB}])`;

            const item: CartItem = {
                id: editingCartItem ? editingCartItem.id : Date.now().toString() + Math.random().toString(),
                pizzaId: selectedPizza.id,
                name: nameEn,
                nameTh: nameTh,
                basePrice: calculatedBasePrice,
                selectedToppings: selectedToppings,
                quantity: quantity,
                totalPrice: itemTotal,
                subItems: [
                    { pizzaId: boatA.id, name: `Boat Side A: ${boatA.name} (฿${boatPriceA})`, nameTh: `โบ๊ทชิ้นแรก: ${boatA.nameTh || boatA.name} (฿${boatPriceA})`, toppings: [] },
                    { pizzaId: boatB.id, name: `Boat Side B: ${boatB.name} (฿${boatPriceB})`, nameTh: `โบ๊ทชิ้นหลัง: ${boatB.nameTh || boatB.name} (฿${boatPriceB})`, toppings: [] }
                ],
                specialInstructions: specialInstructions
            };
            if (editingCartItem) updateCartItem(item); else addToCart(item);
            setSelectedPizza(null); setSelectedToppings([]); setEditingCartItem(null); setSpecialInstructions(''); setQuantity(1);
            setBoatA(null); setBoatB(null); setBoatPriceA(0); setBoatPriceB(0);
            if (editingCartItem && window.innerWidth < 768) setShowMobileCart(true);
            return;
        }

        if (selectedPizza.id === 'p_half_half') {
            if (!halfA || !halfB) {
                alert("Please select both halves for the Half-Half pizza!");
                return;
            }
            const calculatedBasePrice = Math.round((getPizzaPrice(halfA, orderSource) / 2) + (getPizzaPrice(halfB, orderSource) / 2) + 20);
            const itemTotal = (calculatedBasePrice + toppingsPrice) * quantity;
            const nameEn = `Half-Half Pizza (${halfA.name} / ${halfB.name})`;
            const nameTh = `พิซซ่าครึ่ง-ครึ่ง (${halfA.nameTh || halfA.name} / ${halfB.nameTh || halfB.name})`;

            const item: CartItem = {
                id: editingCartItem ? editingCartItem.id : Date.now().toString() + Math.random().toString(),
                pizzaId: selectedPizza.id,
                name: nameEn,
                nameTh: nameTh,
                basePrice: calculatedBasePrice,
                selectedToppings: selectedToppings,
                quantity: quantity,
                totalPrice: itemTotal,
                subItems: [
                    { pizzaId: halfA.id, name: `Half A: ${halfA.name}`, nameTh: `ครึ่งแรก: ${halfA.nameTh || halfA.name}`, toppings: [] },
                    { pizzaId: halfB.id, name: `Half B: ${halfB.name}`, nameTh: `ครึ่งหลัง: ${halfB.nameTh || halfB.name}`, toppings: [] }
                ],
                specialInstructions: specialInstructions
            };
            if (editingCartItem) updateCartItem(item); else addToCart(item);
            setSelectedPizza(null); setSelectedToppings([]); setEditingCartItem(null); setSpecialInstructions(''); setQuantity(1);
            setHalfA(null); setHalfB(null);
            if (editingCartItem && window.innerWidth < 768) setShowMobileCart(true);
            return;
        }

        const localized = getLocalizedItem(selectedPizza);
        const activePrice = getPizzaPrice(selectedPizza, orderSource);
        const item: CartItem = {
            id: editingCartItem ? editingCartItem.id : Date.now().toString() + Math.random().toString(),
            pizzaId: selectedPizza.id,
            name: localized.name,
            nameTh: selectedPizza.nameTh,
            basePrice: activePrice,
            selectedToppings: selectedToppings,
            quantity: quantity,
            totalPrice: (activePrice + toppingsPrice) * quantity,
            specialInstructions: specialInstructions
        };
        if (editingCartItem) updateCartItem(item); else addToCart(item);
        
        setSelectedPizza(null); setSelectedToppings([]); setEditingCartItem(null); setSpecialInstructions(''); setQuantity(1);
        if (editingCartItem && window.innerWidth < 768) setShowMobileCart(true);
    };

    const handleDirectAddToCart = (e: React.MouseEvent, item: Pizza) => {
        e.stopPropagation();
        if (!item.available) return;
        
        if (item.id === 'custom_base' || item.id === 'p_half_half' || item.id === 'p_boat' || (item.category === 'promotion' && (item.comboCount || 0) > 0)) {
            handleCustomize(item);
            return;
        }

        playSuccessFeedback();
        const localized = getLocalizedItem(item);
        const cartItem: CartItem = {
            id: Date.now().toString() + Math.random().toString(),
            pizzaId: item.id,
            name: localized.name,
            nameTh: item.nameTh,
            basePrice: item.basePrice,
            selectedToppings: [],
            quantity: 1,
            totalPrice: item.basePrice,
            specialInstructions: ''
        };
        addToCart(cartItem);
    };
    
    // Combo Logic
    const handleComboSlotClick = (index: number) => setActiveComboSlot(index);
    const handleComboPizzaSelect = (pizza: Pizza) => {
        if (activeComboSlot === null) return;
        const newSelections = [...comboSelections];
        newSelections[activeComboSlot] = {
            pizzaId: pizza.id, name: pizza.name, nameTh: pizza.nameTh, toppings: []
        };
        setComboSelections(newSelections); setActiveComboSlot(null);
    }
    const confirmAddComboToCart = () => {
        if (!selectedPizza) return;
        playSuccessFeedback();
        const localized = getLocalizedItem(selectedPizza);
        const extraPremiumPrice = comboSelections.reduce((sum, item) => {
            if (!item) return sum;
            const p = menu.find(m => m.id === item.pizzaId);
            if (p && p.basePrice > 380) {
                return sum + (p.basePrice - 380);
            }
            return sum;
        }, 0);
        const item: CartItem = {
            id: Date.now().toString() + Math.random().toString(),
            pizzaId: selectedPizza.id, name: localized.name, nameTh: selectedPizza.nameTh,
            basePrice: selectedPizza.basePrice + extraPremiumPrice, selectedToppings: [], subItems: comboSelections,
            quantity: quantity, totalPrice: (selectedPizza.basePrice + extraPremiumPrice) * quantity, specialInstructions: specialInstructions
        };
        addToCart(item); setSelectedPizza(null); setComboSelections([]);
    }

    // POS Order Logic
    const handleSendToKitchen = async () => {
        if (!tableNumber && posOrderType === 'dine-in' && orderSource === 'store') { alert("Please enter a Table Number for store orders."); return; }
        if (posOrderType === 'delivery' && !posDeliveryAddress) { alert("Please enter a delivery address."); return; }
        playSuccessFeedback();

        let finalDeliveryAddress = posDeliveryAddress;
        if (posOrderType === 'delivery') {
            if (posCustomerPhone && !finalDeliveryAddress.includes('[Phone:')) {
                finalDeliveryAddress += ` [Phone: ${posCustomerPhone}]`;
            }
            if (posDeliveryLat && posDeliveryLng && !finalDeliveryAddress.includes('[GPS Pin:')) {
                finalDeliveryAddress += ` [GPS Pin: ${posDeliveryLat.toFixed(7)}, ${posDeliveryLng.toFixed(7)}]`;
            }
            // Just let `parseAnyMapLink` in `types.ts` pick up raw Google Maps links.
            if (finalDeliveryAddress.includes('maps') || finalDeliveryAddress.includes('goo.gl')) {
                if (!finalDeliveryAddress.includes('[Google Maps Link:')) {
                    // Extract the link and wrap it
                    const linkMatch = finalDeliveryAddress.match(/(https?:\/\/[^\s]+)/);
                    if (linkMatch) {
                        finalDeliveryAddress += ` [Google Maps Link: ${linkMatch[1]}]`;
                    }
                }
            }
        }

        const selectedPromo = promoCodes.find(p => p.id === posPromoId);

        const success = await placeOrder(posOrderType, {
            tableNumber: tableNumber || (orderSource !== 'store' ? orderSource.toUpperCase() : (posOrderType === 'delivery' ? 'Delivery' : 'Walk-in')),
            source: orderSource, paymentMethod: undefined, status: 'confirmed', 
            note: orderSource === 'store' ? 'Pay Later' : `${orderSource.toUpperCase()} Order`,
            deliveryPlatformRef: deliveryPlatformRef,
            isPosOrder: true,
            customerPhone: posCustomerPhone,
            customerName: tableNumber || undefined, // use table/name field as customer name
            promoCode: selectedPromo ? selectedPromo.code : undefined,
            discountAmount: posCalculatedDiscount > 0 ? posCalculatedDiscount : undefined,
            couponCode: posMemberCoupon && posMemberCouponDiscount > 0 ? posMemberCoupon.code : undefined,
            couponId: posMemberCoupon && posMemberCouponDiscount > 0 ? posMemberCoupon.id : undefined,
            couponDiscountAmount: posMemberCouponDiscount > 0 ? posMemberCouponDiscount : undefined,
            delivery: posOrderType === 'delivery' ? {
                address: finalDeliveryAddress,
                zoneName: 'Standard',
                fee: 'pending',
                lat: posDeliveryLat || undefined,
                lng: posDeliveryLng || undefined
            } : undefined
        });
        if (success) { 
            setTableNumber(''); 
            setDeliveryPlatformRef(''); 
            setPosCustomerPhone('');
            setPosMemberCoupon(null);
            setMemberProfile(null);
            setPosDeliveryAddress('');
            setPosDeliveryLat(null);
            setPosDeliveryLng(null);
            setPosOrderType('dine-in');
            setShowMobileCart(false); 
            setOrderSource('store');
            setPosPromoId('');
            setPosDiscount(0);
            setActiveTab('tables'); 
        }
    };

    const handleCheckBill = () => {
        if (cart.length === 0) return;
        playClickSound();
        setSelectedOrder(null); setCashReceived(''); setPaymentMethod('cash'); setShowPaymentModal(true);
    };
    
    const handleCheckTableBill = (order: Order) => {
        playClickSound();
        setSelectedOrder(order); setCashReceived(''); setPaymentMethod('cash'); setShowPaymentModal(true);
    }
    
    const handleCloseTable = async (orderId: string) => {
        if(confirm("Close this table? (Mark as completed)")) {
            playSuccessFeedback();
            await completeOrder(orderId, { paymentMethod: 'cash' });
        }
    }
    
    const handleConfirmPaymentAndCook = async (orderId: string) => {
        if(confirm(language === 'th' ? "ยืนยันว่าได้รับเงินแล้วและส่งออเดอร์ให้ครัวเริ่มทำ?" : "Confirm payment received and start cooking?")) {
            playSuccessFeedback();
            await updateOrderStatus(orderId, 'cooking');
        }
    }
    
    const handleCancelTable = async (orderId: string) => {
        if(confirm("Force Cancel/Delete this table order?")) {
            playAlertSound();
            await updateOrderStatus(orderId, 'cancelled');
        }
    }

    const handleUpdateDeliveryFee = async (order: Order) => {
        const feeStr = prompt(`Enter delivery fee for Order #${String(order.id).slice(-4)}:`, order.deliveryFee === 'pending' ? '' : String(order.deliveryFee));
        if (feeStr !== null) {
            const fee = parseFloat(feeStr);
            if (!isNaN(fee) && fee >= 0) {
                await updateOrderDeliveryFee(order.id, fee);
            } else {
                alert("Invalid fee amount.");
            }
        }
    };

    const handleFinalizePayment = async () => {
        if (selectedOrder && selectedOrder.deliveryFee === 'pending') {
            alert("Please update the delivery fee before finalizing payment.");
            return;
        }
        const currentTotal = posCheckoutTotal;
        if (paymentMethod === 'cash' && parseFloat(cashReceived || '0') < currentTotal) { alert("Insufficient cash!"); return; }
        const note = paymentMethod === 'cash' 
            ? `Cash: ${cashReceived}, Change: ${change}` 
            : paymentMethod === 'thai_chuay_thai'
                ? 'Paid via Thai Chuay Thai (Tungngern QR)'
                : 'Paid via QR';
        
        if (selectedOrder) {
            playSuccessFeedback();
            await completeOrder(selectedOrder.id, { paymentMethod: paymentMethod, note: note });
            alert(
                paymentMethod === 'cash' 
                    ? `Paid! Change: ฿${change}` 
                    : paymentMethod === 'thai_chuay_thai'
                        ? "Paid via Thai Chuay Thai Project!"
                        : "Order Paid via QR!"
            );
        } else {
            playSuccessFeedback();

            let finalDeliveryAddress = posDeliveryAddress;
            if (posOrderType === 'delivery') {
                if (posCustomerPhone && !finalDeliveryAddress.includes('[Phone:')) {
                    finalDeliveryAddress += ` [Phone: ${posCustomerPhone}]`;
                }
                if (posDeliveryLat && posDeliveryLng && !finalDeliveryAddress.includes('[GPS Pin:')) {
                    finalDeliveryAddress += ` [GPS Pin: ${posDeliveryLat.toFixed(7)}, ${posDeliveryLng.toFixed(7)}]`;
                }
                if (finalDeliveryAddress.includes('maps') || finalDeliveryAddress.includes('goo.gl')) {
                    if (!finalDeliveryAddress.includes('[Google Maps Link:')) {
                        const linkMatch = finalDeliveryAddress.match(/(https?:\/\/[^\s]+)/);
                        if (linkMatch) {
                            finalDeliveryAddress += ` [Google Maps Link: ${linkMatch[1]}]`;
                        }
                    }
                }
            }

            const selectedPromo = promoCodes.find(p => p.id === posPromoId);

            const success = await placeOrder(posOrderType, {
                tableNumber: tableNumber || (posOrderType === 'delivery' ? 'Delivery' : 'Walk-in'), 
                source: orderSource, paymentMethod: paymentMethod, status: 'completed', note: note, deliveryPlatformRef: deliveryPlatformRef,
                isPosOrder: true,
                customerPhone: posCustomerPhone,
                customerName: tableNumber || undefined,
                promoCode: selectedPromo ? selectedPromo.code : undefined,
                discountAmount: posCalculatedDiscount > 0 ? posCalculatedDiscount : undefined,
                couponCode: posMemberCoupon && posMemberCouponDiscount > 0 ? posMemberCoupon.code : undefined,
                couponId: posMemberCoupon && posMemberCouponDiscount > 0 ? posMemberCoupon.id : undefined,
                couponDiscountAmount: posMemberCouponDiscount > 0 ? posMemberCouponDiscount : undefined,
                delivery: posOrderType === 'delivery' ? {
                    address: finalDeliveryAddress,
                    zoneName: 'Standard',
                    fee: 'pending',
                    lat: posDeliveryLat || undefined,
                    lng: posDeliveryLng || undefined
                } : undefined
            });
            if (success) { 
                alert(
                    paymentMethod === 'cash' 
                        ? `Paid! Change: ฿${change}` 
                        : paymentMethod === 'thai_chuay_thai'
                            ? "Paid via Thai Chuay Thai Project!"
                            : "Paid via QR!"
                ); 
                setTableNumber(''); 
                setDeliveryPlatformRef(''); 
                setPosCustomerPhone('');
                setPosMemberCoupon(null);
                setMemberProfile(null);
                setPosDeliveryAddress('');
                setPosDeliveryLat(null);
                setPosDeliveryLng(null);
                setPosOrderType('dine-in');
                setOrderSource('store'); 
                setPosPromoId('');
                setPosDiscount(0);
                setShowMobileCart(false); 
            }
        }
        setShowPaymentModal(false);
    };

    // --- INTEGRATED RECEIPT TRIGGER (WITH LOCAL RECEIPT DATA CACHING) ---
    const handleTriggerReceiptPrint = async (payload: any) => {
        setReceiptData(payload);
        playSuccessFeedback();
        await triggerReceiptPrint(payload);
    };

    const handlePrintBill = () => {
        const currentItems = selectedOrder ? selectedOrder.items : cart;
        const currentTotal = posCheckoutTotal;
        const tableOrType = selectedOrder ? (selectedOrder.tableNumber ? `Table ${selectedOrder.tableNumber}` : selectedOrder.type.toUpperCase()) : (tableNumber ? `Table ${tableNumber}` : 'Walk-in');
        
        // Calculate VAT (7% included if enabled) => Total * 7 / 107
        const vatAmount = vatEnabled ? (currentTotal * 7) / 107 : 0;
        const subtotal = currentTotal - vatAmount;

        // Payment Details (Use current state if paying now, or defaults)
        const payMethod = selectedOrder?.paymentMethod || paymentMethod;
        const received = parseFloat(cashReceived) || currentTotal; // Default to exact if not specified
        const changeAmt = change || 0;

        // Queue/Table Logic for Header
        let queueNo = '';
        if (selectedOrder?.tableNumber || tableNumber) {
            queueNo = `Table ${selectedOrder?.tableNumber || tableNumber}`;
        } else {
            const id = selectedOrder ? selectedOrder.id : Date.now().toString();
            queueNo = `Q-${String(id).slice(-3)}`;
        }

        const payload = {
            storeName: "Pizza Damac Nonthaburi",
            address: "Nonthaburi, Thailand",
            taxId: storeSettings.promptPayNumber || "0-9949-7919-9", 
            phone: storeSettings.contactPhone || "099-497-9199",
            orderId: selectedOrder ? String(selectedOrder.id).slice(-4) : 'NEW',
            date: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
            tableOrType: tableOrType,
            source: selectedOrder ? selectedOrder.source.toUpperCase() : orderSource.toUpperCase(),
            customerName: selectedOrder?.customerName || 'Guest',
            customerPhone: selectedOrder?.customerPhone || '',
            deliveryAddress: selectedOrder?.deliveryAddress || '',
            deliveryFee: selectedOrder?.deliveryFee,
            note: selectedOrder?.note || '',
            queueNo: queueNo,
            deliveryPlatformRef: selectedOrder ? selectedOrder.deliveryPlatformRef : deliveryPlatformRef,
            items: currentItems,
            subtotal: subtotal,
            vat: vatAmount,
            total: currentTotal,
            paymentMethod: payMethod === 'cash' ? 'CASH' : payMethod === 'thai_chuay_thai' ? 'THAI CHUAY THAI' : 'QR / TRANSFER',
            received: received,
            change: changeAmt,
            taxInvoice: taxInvoice,
            isPaid: selectedOrder ? selectedOrder.status === 'completed' : true
        };

        handleTriggerReceiptPrint(payload);
    };

    // --- REPRINT FOR LOG BOOK ---
    const handleReprintOrder = (order: Order) => {
        // Calculate VAT (7% included if enabled)
        const vatAmount = vatEnabled ? (order.totalAmount * 7) / 107 : 0;
        const subtotal = order.totalAmount - vatAmount;

        // Queue/Table Logic
        let queueNo = '';
        if (order.tableNumber) {
            queueNo = `Table ${order.tableNumber}`;
        } else {
            queueNo = `Q-${String(order.id).slice(-3)}`;
        }

        const payload = {
            storeName: "Pizza Damac Nonthaburi",
            address: "Nonthaburi, Thailand",
            taxId: storeSettings.promptPayNumber || "0-9949-7919-9",
            phone: storeSettings.contactPhone || "099-497-9199",
            orderId: String(order.id).slice(-4),
            date: formatOrderDateTime(order.createdAt),
            tableOrType: order.tableNumber ? `Table ${order.tableNumber}` : order.type.toUpperCase(),
            source: order.source.toUpperCase(),
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            deliveryAddress: order.deliveryAddress,
            deliveryFee: order.deliveryFee,
            note: order.note,
            queueNo: queueNo,
            deliveryPlatformRef: order.deliveryPlatformRef,
            items: order.items,
            subtotal: subtotal,
            vat: vatAmount,
            total: order.totalAmount,
            paymentMethod: order.paymentMethod === 'cash' ? 'CASH' : order.paymentMethod === 'thai_chuay_thai' ? 'THAI CHUAY THAI' : 'QR / TRANSFER',
            received: order.totalAmount, // Assumed exact for history
            change: 0,
            isPaid: order.status === 'completed'
        };

        handleTriggerReceiptPrint(payload);
    };

    const handleDeleteOrder = async (orderId: string) => {
        if (window.confirm("Delete record?")) await deleteOrder(orderId);
    };

    // --- ITEM & TOPPING MANAGEMENT ---
    const handleOpenAddModal = () => {
        setItemForm({ name: '', nameTh: '', description: '', descriptionTh: '', basePrice: 0, image: '', available: true, category: 'pizza', comboCount: 0, allowedPromotions: [], badge: '', badgeTh: '' });
        setModalIngredients([]);
        setShowItemModal(true);
    };
    const handleEditMenuItem = (item: Pizza) => {
        setItemForm({ ...item, comboCount: item.comboCount || 0, allowedPromotions: item.allowedPromotions || [], badge: item.badge || '', badgeTh: item.badgeTh || '' });
        setModalIngredients(ingredientCostsMap[item.id] || []);
        setShowItemModal(true);
    };
    const handleSaveItem = async () => {
        if (itemForm.name && itemForm.basePrice !== undefined) {
            const itemId = itemForm.id || 'p' + Date.now();
            const totalIngredientCost = modalIngredients.reduce((sum, ing) => sum + ing.cost, 0);
            
            const pizzaToSave: Pizza = {
                ...itemForm,
                id: itemId,
                rawCost: totalIngredientCost,
                image: itemForm.image || 'https://via.placeholder.com/150'
            } as Pizza;

            if (itemForm.id) {
                await updatePizza(pizzaToSave);
            } else {
                await addPizza(pizzaToSave);
            }

            // Save ingredients map
            const updatedMap = { ...ingredientCostsMap, [itemId]: modalIngredients };
            setIngredientCostsMap(updatedMap);
            localStorage.setItem('damac_ingredient_costs', JSON.stringify(updatedMap));

            if (itemForm.category) setActiveCategory(itemForm.category);
            setShowItemModal(false);
        }
    };

    const handleAddIngredient = () => {
        if (!newIngredientName.trim()) return;
        const newIng = {
            id: 'ing_' + Date.now(),
            name: newIngredientName.trim(),
            cost: Number(newIngredientCost) || 0
        };
        const updated = [...modalIngredients, newIng];
        setModalIngredients(updated);
        const total = updated.reduce((sum, ing) => sum + ing.cost, 0);
        setItemForm(prev => ({ ...prev, rawCost: total }));
        setNewIngredientName('');
        setNewIngredientCost(0);
    };

    const handleRemoveIngredient = (id: string) => {
        const updated = modalIngredients.filter(ing => ing.id !== id);
        setModalIngredients(updated);
        const total = updated.reduce((sum, ing) => sum + ing.cost, 0);
        setItemForm(prev => ({ ...prev, rawCost: total }));
    };
    
    const handleMoveMenuItem = (pizzaId: string, direction: 'up' | 'down') => {
        // Filter menu by current active category to handle category-scoped reordering or overall reordering
        // Reordering the raw 'menu' array is best, as it represents the stored order of all items.
        const currentIndex = menu.findIndex(p => p.id === pizzaId);
        if (currentIndex === -1) return;
        
        const newMenu = [...menu];
        const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        
        // Boundaries check
        if (targetIndex < 0 || targetIndex >= newMenu.length) return;
        
        // Swap items
        const temp = newMenu[currentIndex];
        newMenu[currentIndex] = newMenu[targetIndex];
        newMenu[targetIndex] = temp;
        
        const sortedIds = newMenu.map(p => p.id);
        reorderMenu(sortedIds);
    };
    
    // UPDATED: Compress Image Handlers
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const compressed = await compressImage(file, 800); // 800px max width for menu
                const url = await uploadImageToStorage(compressed, `menu-${itemForm.id || 'new'}`);
                setItemForm({ ...itemForm, image: url });
            } catch (error) {
                alert("Failed to process image. Try a smaller file.");
            }
        }
    };
    
    // Topping Handlers
    const handleOpenToppingModal = (topping?: Topping) => {
        if (topping) {
            setToppingForm({...topping});
        } else {
            setToppingForm({ name: '', nameTh: '', price: 0, category: 'other', available: true, image: '' });
        }
        setShowToppingsModal(true);
    };
    const handleSaveTopping = async () => {
        if (toppingForm.name && toppingForm.price !== undefined) {
            if (toppingForm.id) {
                await updateTopping(toppingForm as Topping);
            } else {
                await addTopping({ 
                    ...toppingForm as Topping, 
                    id: 't' + Date.now(),
                    category: toppingForm.category || 'other'
                });
            }
            setShowToppingsModal(false);
        }
    };
    const handleToppingImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const compressed = await compressImage(file, 400); // 400px max width for toppings
                const url = await uploadImageToStorage(compressed, 'topping');
                setToppingForm({ ...toppingForm, image: url });
            } catch(e) {
                alert("Image error");
            }
        }
    };

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const compressed = await compressImage(file, 200); // 200px max width for logo
                const url = await uploadImageToStorage(compressed, 'logo');
                updateShopLogo(url);
            } catch(e) { alert("Logo upload failed"); }
        }
    };

    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const compressed = await compressImage(file, 1200); // 1200px max width for banner
                const url = await uploadImageToStorage(compressed, 'banner');
                setMediaForm(p => ({ ...p, promoBannerUrl: url }));
                updateStoreSettings({ promoBannerUrl: url, promoContentType: 'image' });
            } catch(e) { alert("Banner upload failed. Try a smaller image."); }
        }
    };

    const handleEventImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            try {
                const compressed = await compressImage(file, 400); // 400px max width to severely save space
                const url = await uploadImageToStorage(compressed, 'event');
                const newGallery = [...(mediaForm.eventGalleryUrls || []), url];
                setMediaForm(p => ({ ...p, eventGalleryUrls: newGallery }));
            } catch(e) { alert("Gallery upload failed"); }
        }
    };

    // Expenses & News
    const handleAddExpense = (e: React.FormEvent) => {
        e.preventDefault(); 
        if (!expenseForm.description) return;
        
        const qty = expenseForm.quantity || 1;
        const uPrice = expenseForm.unitPrice || 0;
        const totalAmount = uPrice > 0 ? (qty * uPrice) : (parseFloat(expenseForm.amount) || 0);
        
        if (totalAmount <= 0) {
            alert(language === 'th' ? "กรุณากรอกจำนวนเงินมากกว่า 0" : "Please enter an amount greater than 0");
            return;
        }

        const newExpense = {
            id: 'exp-' + Date.now(),
            date: new Date().toISOString(),
            description: expenseForm.description,
            amount: totalAmount,
            category: expenseForm.category,
            note: expenseForm.note,
            quantity: qty,
            unit: expenseForm.unit || 'แพ็ค',
            unitPrice: uPrice > 0 ? uPrice : totalAmount / qty,
            vendor: expenseForm.vendor || '',
            billNumber: expenseForm.billNumber || ''
        };

        addExpense(newExpense);

        if (expenseForm.saveAsTemplate) {
            const exists = expenseTemplates.some(t => t.description.toLowerCase().trim() === expenseForm.description.toLowerCase().trim());
            if (!exists) {
                const newTpl = {
                    id: 'tpl-' + Date.now(),
                    description: expenseForm.description,
                    quantity: qty,
                    unit: expenseForm.unit || 'แพ็ค',
                    unitPrice: uPrice > 0 ? uPrice : totalAmount / qty,
                    amount: totalAmount,
                    category: expenseForm.category,
                    vendor: expenseForm.vendor || '',
                    note: expenseForm.note
                };
                setExpenseTemplates(prev => [...prev, newTpl]);
            }
        }

        setExpenseForm({
            description: '',
            amount: '',
            category: 'COGS',
            note: '',
            quantity: 1,
            unit: 'แพ็ค',
            unitPrice: 0,
            vendor: '',
            billNumber: '',
            saveAsTemplate: false
        });
    };
    const handleAddNews = (e: React.FormEvent) => {
        e.preventDefault(); if (!newsForm.title || !newsForm.summary) return;
        addNewsItem({ id: 'news-' + Date.now(), title: newsForm.title, summary: newsForm.summary, imageUrl: newsForm.imageUrl || 'https://via.placeholder.com/150', linkUrl: newsForm.linkUrl, date: new Date().toISOString() });
        setNewsForm({ title: '', summary: '', imageUrl: '', linkUrl: '' });
    };

    // Save Settings
    const updateLocalMediaLink = (listType: 'review' | 'vibe', index: number, value: string) => {
        if (listType === 'review') { const newList = [...(mediaForm.reviewLinks || [])]; newList[index] = value; setMediaForm(prev => ({ ...prev, reviewLinks: newList })); } 
        else { const newList = [...(mediaForm.vibeLinks || [])]; newList[index] = value; setMediaForm(prev => ({ ...prev, vibeLinks: newList })); }
    };
    const handleSaveMediaSettings = () => {
        const cleanReviews = (mediaForm.reviewLinks || []).filter(l => l && l.trim() !== '');
        const cleanVibes = (mediaForm.vibeLinks || []).filter(l => l && l.trim() !== '');
        const cleanEvents = (mediaForm.eventGalleryUrls || []).filter(l => l && l.trim() !== '');
        updateStoreSettings({ promoBannerUrl: mediaForm.promoBannerUrl, reviewLinks: cleanReviews, vibeLinks: cleanVibes, eventGalleryUrls: cleanEvents });
        setMediaForm(prev => ({ ...prev, reviewLinks: cleanReviews, vibeLinks: cleanVibes, eventGalleryUrls: cleanEvents }));
        alert("Media Saved!");
    };
    const handleSaveContactSettings = () => {
        updateStoreSettings({ reviewUrl: contactForm.reviewUrl, mapUrl: contactForm.mapUrl, facebookUrl: contactForm.facebookUrl, lineUrl: contactForm.lineUrl, contactPhone: contactForm.contactPhone, promptPayNumber: contactForm.promptPayNumber });
        alert("Contact Saved!");
    };

    // Sales Calculations
    const activeOrders = (orders || []).filter(o => o && o.status && o.status !== 'cancelled');
    const filteredOrders = activeOrders.filter(o => o && filterByDate(o.createdAt, salesFilter));
    const filteredExpenses = (expenses || []).filter(e => e && filterByDate(e.date, salesFilter));
    const totalGrossSales = filteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalExpenses = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netProfit = filteredOrders.reduce((sum, o) => sum + (o.netAmount || o.totalAmount || 0), 0) - totalExpenses;

    const bestSellersOfMonth = useMemo(() => {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth();

        // Get all completed/un-cancelled orders in current month
        const monthlyOrders = (orders || []).filter(o => {
            if (!o || o.status === 'cancelled') return false;
            const d = new Date(o.createdAt);
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });

        const counts: { [id: string]: { name: string; nameTh: string; count: number; totalRev: number; img?: string } } = {};
        monthlyOrders.forEach(o => {
            (o.items || []).forEach(item => {
                const id = item.pizzaId || item.name;
                if (!counts[id]) {
                    const menuItem = menu.find(m => m.id === item.pizzaId);
                    counts[id] = {
                        name: item.name,
                        nameTh: item.nameTh || menuItem?.nameTh || item.name,
                        count: 0,
                        totalRev: 0,
                        img: menuItem?.image
                    };
                }
                counts[id].count += item.quantity || 1;
                counts[id].totalRev += item.totalPrice || 0;
            });
        });

        return Object.values(counts)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [orders, menu]);

    const dailySales = useMemo(() => {
        const counts: { [date: string]: { totalSales: number; ordersCount: number; netAmount: number } } = {};
        filteredOrders.forEach(o => {
            const dateStr = o.createdAt.split('T')[0];
            if (!counts[dateStr]) {
                counts[dateStr] = { totalSales: 0, ordersCount: 0, netAmount: 0 };
            }
            counts[dateStr].totalSales += o.totalAmount || 0;
            counts[dateStr].netAmount += o.netAmount || o.totalAmount || 0;
            counts[dateStr].ordersCount += 1;
        });

        return Object.entries(counts)
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [filteredOrders]);

    const filteredMenu = useMemo(() => {
        const raw = menu.filter(item => { const cat = item.category || 'pizza'; return cat === activeCategory && item.id !== 'p_half_half' && item.id !== 'p_boat'; });
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

            return [virtualPizzaBoat, virtualHalfHalfPizza, ...raw];
        }
        return raw;
    }, [menu, activeCategory]);

    const filteredAddMenuMatches = useMemo(() => {
        return menu.filter(item => {
            const matchesCategory = addCategoryFilter === 'all' || item.category === addCategoryFilter;
            const itemSearchStr = `${item.name} ${item.nameTh || ''} ${item.description || ''} ${item.descriptionTh || ''}`.toLowerCase();
            const matchesSearch = itemSearchStr.includes(addSearchQuery.toLowerCase());
            return matchesCategory && matchesSearch;
        });
    }, [menu, addCategoryFilter, addSearchQuery]);

    // Export Handlers
    const handleExportSales = () => {
        if (filteredOrders.length === 0) { alert("No sales data to export"); return; }
        const data = filteredOrders.map(o => ({
            ID: o.id,
            Date: formatOrderDateTime(o.createdAt),
            Customer: o.customerName,
            Type: o.type,
            Source: o.source,
            Status: o.status,
            Total: o.totalAmount,
            Payment: o.paymentMethod || '-',
            Items: (o.items || []).map(i => `${i.quantity}x ${i.name}`).join('; ')
        }));
        downloadCSV(data, `sales_report_${salesFilter}.csv`);
    };

    const handleExportExpenses = () => {
        if (filteredExpenses.length === 0) { alert("No expense data to export"); return; }
        const data = filteredExpenses.map(e => ({
            Date: new Date(e.date).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }),
            Description: e.description,
            Category: e.category,
            Amount: e.amount,
            Note: e.note || ''
        }));
        downloadCSV(data, `expenses_report.csv`);
    };

    const handleExportCustomers = async () => {
        try {
            const data = await getAllCustomers();
            if (data.length === 0) { 
                alert("No customer data found. If this is unexpected, check database connection."); 
                return; 
            }
            downloadCSV(data, 'customers_export.csv');
        } catch (error) {
            console.error("Export Error:", error);
            alert("Export failed. Check console for details.");
        }
    };

    return (
        <div className="flex h-screen bg-gray-100 overflow-hidden flex-col lg:flex-row font-sans print:h-auto print:overflow-visible print:bg-white print:block">
                     {/* --- DYNAMIC PRINTER STYLE INJECTION --- */}
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
                    .printable-area .store-title {
                        font-size: ${receiptFontSize + 3}px !important;
                    }
                }
            ` }} />

            {/* --- ROBUST THAI RECEIPT PRINTER (58mm/80mm Adaptive Channel) --- */}
            <div 
                className={`hidden print:block printable-area ${paperSize === '58mm' ? 'print:w-[58mm]' : 'print:w-[80mm]'} print:font-mono p-0 m-0 bg-white text-black leading-snug`}
                style={{ fontSize: `${receiptFontSize}px` }}
            >
                {receiptData && (
                    <div className={`${paperSize === '58mm' ? 'w-[58mm]' : 'w-[80mm]'} overflow-hidden`}>
                        <div className="text-center font-bold">
                            <div>{paperSize === '58mm' ? '=============================' : '========================================'}</div>
                            <div 
                                className="mt-1 mb-1 font-black store-title"
                                style={{ fontSize: `${receiptFontSize + 3}px` }}
                            >
                                {receiptData.storeName}
                            </div>
                            <div className="mb-1">โทร: {receiptData.phone}</div>
                            {receiptData.deliveryPlatformRef && receiptData.source !== 'STORE' && (
                                <div className="mt-2 mb-1">
                                    {receiptData.source.toUpperCase() === 'GRAB' ? (
                                        <div className="whitespace-pre-wrap text-[11px] font-extrabold bg-gray-150 p-1">Order Grab {receiptData.deliveryPlatformRef}</div>
                                    ) : receiptData.source.toUpperCase() === 'LINEMAN' ? (
                                        <div className="whitespace-pre-wrap text-[11px] font-extrabold bg-gray-150 p-1">Order Lineman {receiptData.deliveryPlatformRef}</div>
                                    ) : (
                                        <div className="whitespace-pre-wrap text-[11px] font-extrabold bg-gray-150 p-1">Order {receiptData.source} {receiptData.deliveryPlatformRef}</div>
                                    )}
                                </div>
                            )}
                            <div>{paperSize === '58mm' ? '=============================' : '========================================'}</div>
                            <div className="mt-1 text-[11px] font-extrabold">ใบเสร็จรับเงิน / ใบสั่งอาหาร</div>
                            <div className="text-[10px] font-bold">(Receipt / Order Bill)</div>
                            <div>{paperSize === '58mm' ? '-----------------------------' : '----------------------------------------'}</div>
                            
                            {receiptData.isPaid ? (
                                <div className="my-1 base-border py-1 px-2 text-center font-black text-[12px] tracking-wider uppercase flex items-center justify-center gap-1 bg-white text-black" style={{ border: '1px solid black' }}>
                                    <span>✔ ชำระเงินแล้ว / PAID</span>
                                </div>
                            ) : (
                                <div className="my-1 base-border py-1 px-2 text-center font-black text-[12px] tracking-wider uppercase flex items-center justify-center gap-1 bg-white text-black" style={{ border: '1px solid black' }}>
                                    <span>⚠️ ยังไม่ชำระเงิน / UNPAID</span>
                                </div>
                            )}

                            {receiptData.deliveryAddress && (
                                <div className="my-1.5 p-1 text-[9px] rounded font-bold leading-normal text-black bg-white" style={{ border: '1px solid black' }}>
                                    <div className="font-extrabold border-b pb-0.5 mb-1 text-[9.5px]" style={{ borderBottom: '1px solid black' }}>
                                        📍 ข้อมูลจัดส่ง / DELIVERY DETAILS:
                                    </div>
                                    <div className="space-y-0.5">
                                        <div>
                                            <span className="font-black">ที่อยู่:</span>{" "}
                                            <span>{receiptData.deliveryAddress.replace(/\[Phone: .*?\]/g, '')}</span>
                                        </div>
                                        {parseDeliveryPhone(receiptData.deliveryAddress) && (
                                            <div>
                                                <span className="font-black">เบอร์โทร:</span>{" "}
                                                <span className="text-[10px] underline font-black">
                                                    {parseDeliveryPhone(receiptData.deliveryAddress)}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="mt-1 mb-1 px-0.5 space-y-0.5 font-bold">
                            <div className="flex justify-between">
                                <span>เลขที่บิล: {receiptData.orderId}</span>
                                <span>วันที่: {receiptData.date.split(' ')[0]}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>โต๊ะ/ประเภท: {receiptData.tableOrType.replace('Table ', '')}</span>
                                <span>เวลา: {receiptData.date.split(' ')[1] || '00:00'} น.</span>
                            </div>
                            <div className="flex justify-between">
                                <span>พนักงาน: Cashier</span>
                                <span>จำนวน: 1 ท่าน</span>
                            </div>
                        </div>

                        <div className="text-center font-bold">{paperSize === '58mm' ? '-----------------------------' : '----------------------------------------'}</div>
                        <table className="w-full text-left font-bold">
                            <thead>
                                <tr className="font-bold border-b border-black">
                                    <th className="w-[50%] py-1">รายการ (Item)</th>
                                    <th className="text-center py-1">จำนวน</th>
                                    <th className="text-right py-1">{paperSize === '58mm' ? 'หน่วย' : 'ราคา/หน่วย'}</th>
                                    <th className="text-right py-1">รวม (Sub)</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td colSpan={4} className="text-center font-bold">{paperSize === '58mm' ? '-----------------------------' : '----------------------------------------'}</td>
                                </tr>
                                 {(receiptData.items || []).map((item, i) => {
                                     const displayName = item.nameTh && item.nameTh !== item.name ? `${item.name} (${item.nameTh})` : item.name;
                                     return (
                                         <React.Fragment key={i}>
                                             <tr className="align-top border-b border-gray-200">
                                                 <td className="pr-1 whitespace-pre-wrap py-1">
                                                     <div className="font-bold">{i + 1}. {displayName}</div>
                                                     {((item.selectedToppings?.length || 0) > 0 || (item.subItems?.length || 0) > 0) && (
                                                         <div className="pl-3 text-[9.5px] text-black mt-1 space-y-0.5">
                                                             {item.selectedToppings?.map(t => {
                                                                 const toppingName = t.nameTh && t.nameTh !== t.name ? `${t.name} (${t.nameTh})` : t.name;
                                                                 return (
                                                                     <div key={t.id} className="font-black">
                                                                         * [เพิ่ม/ADD] {toppingName} (+{t.price}.-)
                                                                     </div>
                                                                 );
                                                             })}
                                                             {item.subItems?.map((s, sIdx) => {
                                                                 const comboItemName = s.nameTh && s.nameTh !== s.name ? `${s.name} (${s.nameTh})` : s.name;
                                                                 return (
                                                                     <div key={sIdx} className="pl-1 font-extrabold text-[9px]">
                                                                         ↳ [เซ็ต/COMBO] {comboItemName}
                                                                         {s.toppings?.length > 0 && (
                                                                             <div className="pl-3 text-[8.5px] font-bold text-gray-750 italic">
                                                                                 {s.toppings.map(t => {
                                                                                     const toppingName = t.nameTh && t.nameTh !== t.name ? `${t.name} (${t.nameTh})` : t.name;
                                                                                     return `+ ${toppingName}`;
                                                                                 }).join(', ')}
                                                                             </div>
                                                                         )}
                                                                     </div>
                                                                 );
                                                             })}
                                                         </div>
                                                     )}
                                                     {item.specialInstructions && (
                                                         <div className="mt-1 pl-2 border-l border-black text-[9px] font-black bg-gray-100 p-1">
                                                             !!! [พิเศษ/REQUEST] : "{item.specialInstructions}" !!!
                                                         </div>
                                                     )}
                                                 </td>
                                                 <td className="text-center font-bold py-1">{item.quantity}</td>
                                                 <td className="text-right py-1">{(item.totalPrice/item.quantity).toFixed(0)}.-</td>
                                                 <td className="text-right font-bold py-1">{item.totalPrice.toFixed(0)}.-</td>
                                             </tr>
                                         </React.Fragment>
                                     );
                                 })}
                             </tbody>
                        </table>
                        
                        {receiptData.note && (
                            <div className="my-2 p-1.5 border border-black text-black">
                                <div className="text-[9.5px] font-black">📝 หมายเหตุออเดอร์ (ORDER NOTE):</div>
                                <div className="text-[10px] font-bold mt-0.5">"{receiptData.note}"</div>
                            </div>
                        )}
                        
                        <div className="text-center font-bold">{paperSize === '58mm' ? '-----------------------------' : '----------------------------------------'}</div>

                        <div className="px-1 mt-1 font-bold">
                            {vatEnabled ? (
                                <>
                                    <div className="flex justify-between">
                                        <span>มูลค่าก่อนภาษี (Subtotal Ex. VAT)</span>
                                        <span>{receiptData.subtotal.toFixed(2)}.-</span>
                                    </div>
                                    <div className="flex justify-between mt-0.5">
                                        <span>ภาษีมูลค่าเพิ่ม 7% (VAT 7%)</span>
                                        <span>{receiptData.vat.toFixed(2)}.-</span>
                                    </div>
                                </>
                            ) : (
                                <div className="flex justify-between">
                                    <span>ราคารวมสินค้า (Items Total)</span>
                                    <span>{(receiptData.total - (receiptData.deliveryFee && receiptData.deliveryFee !== 'pending' ? Number(receiptData.deliveryFee) : 0)).toFixed(0)}.-</span>
                                </div>
                            )}
                            {receiptData.deliveryFee && receiptData.deliveryFee !== 'pending' && (
                                <div className="flex justify-between mt-1 text-[10px]">
                                    <span>ค่าจัดส่ง (Delivery)</span>
                                    <span>{Number(receiptData.deliveryFee).toFixed(0)}.-</span>
                                </div>
                            )}
                            <div className="flex justify-between text-[13px] mt-1">
                                <span>ยอดสุทธิ (Total)</span>
                                <span>{receiptData.total.toFixed(0)}.-</span>
                            </div>
                        </div>

                        <div className="text-center font-bold mt-1">{paperSize === '58mm' ? '-----------------------------' : '----------------------------------------'}</div>
                        <div className="text-center mt-2 mb-2 font-bold px-1">
                            <div className="mb-2 text-[10px]">({receiptData.total} บาทถ้วน)</div>
                            
                            {!receiptData.isPaid && (
                                <div className="my-2 flex flex-col items-center justify-center p-2 rounded-xl bg-gray-50" style={{ border: '1px dashed gray' }}>
                                    <div className="text-[9px] font-black mb-1.5 text-center text-black">
                                        สแกนจ่ายเงินผ่าน THAI QR / PROMPTPAY
                                    </div>
                                    <img 
                                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                                            generatePromptPayPayload(
                                                storeSettings.promptPayNumber || "0-9949-7919-9",
                                                receiptData.total
                                            )
                                        )}`} 
                                        alt="PromptPay QR Code" 
                                        className="w-32 h-32 border border-gray-350 p-1 bg-white rounded mx-auto"
                                    />
                                    <div className="text-[8px] mt-1 text-center font-bold text-gray-700">
                                        PromptPay: {storeSettings.promptPayNumber || "0-9949-7919-9"}
                                    </div>
                                </div>
                            )}

                            <div>ขอบคุณที่ใช้บริการ / Thank You</div>
                        </div>
                        <div className="text-center font-bold">{paperSize === '58mm' ? '=============================' : '========================================'}</div>
                    </div>
                )}
            </div>

            {/* --- MOBILE HEADER --- */}
            <div className="lg:hidden bg-gray-900 text-white p-3 flex justify-between items-center z-30 shadow-md shrink-0 h-14 print:hidden">
                <div className="flex items-center gap-2">
                    {shopLogo ? <img src={shopLogo} alt="Logo" className="w-8 h-8 rounded-full object-cover" /> : <div className="bg-brand-600 p-1 rounded-lg"><DollarSign size={16} /></div>}
                    <span className="font-bold text-lg tracking-tight">POS v2.1</span>
                </div>
                 <div className="flex items-center gap-2.5">
                    {/* Clear prominent language selection button right on mobile POS page */}
                    <button 
                        onClick={() => { playClickSound(); toggleLanguage(); }} 
                        className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-black py-1.5 px-3 rounded-xl flex items-center gap-1 transition active:scale-95 shadow-md shadow-brand-500/20"
                        title={language === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
                    >
                        {language === 'th' ? '🇺🇸 ENG' : '🇹🇭 ภาษาไทย'}
                    </button>
                    {activeTab === 'order' && <button onClick={() => setIsEditMode(!isEditMode)} className={`p-1.5 rounded-full ${isEditMode ? 'bg-red-500 text-white animate-pulse' : 'bg-gray-800 text-gray-400'}`}><Edit2 size={16}/></button>}
                    <div className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 ${isStoreOpen ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}><div className={`w-2 h-2 rounded-full ${isStoreOpen ? 'bg-green-500' : 'bg-red-500'}`}></div>{isStoreOpen ? 'OPEN' : 'CLOSED'}</div>
                 </div>
            </div>

            {/* --- DESKTOP SIDEBAR --- */}
            <aside className="hidden lg:flex w-24 bg-gray-900 flex-col items-center py-6 text-gray-400 z-10 shadow-xl justify-between shrink-0 print:hidden font-sans">
                <div className="flex flex-col items-center gap-6 w-full">
                    <div className="mb-2 relative group cursor-pointer">
                        {shopLogo ? <img src={shopLogo} alt="Logo" className="w-14 h-14 rounded-full object-cover border-2 border-brand-500" /> : <div className="bg-brand-600 p-3 rounded-xl text-white shadow-lg shadow-brand-500/50"><DollarSign size={28} /></div>}
                         <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleLogoUpload}/>
                    </div>
                    <button onClick={() => { playClickSound(); setActiveTab('order'); }} className={`p-4 rounded-2xl transition w-16 h-16 flex items-center justify-center ${activeTab === 'order' ? 'bg-brand-600 text-white shadow-lg' : 'hover:bg-gray-800'}`} title={language === 'th' ? 'สั่งอาหารใหม่' : 'New Order'}><ShoppingBag size={28} /></button>
                    <button onClick={() => { playClickSound(); setActiveTab('tables'); }} className={`p-4 rounded-2xl transition relative w-16 h-16 flex items-center justify-center ${activeTab === 'tables' ? 'bg-brand-600 text-white shadow-lg' : 'hover:bg-gray-800'}`} title={language === 'th' ? 'ออเดอร์ทั้งหมด' : 'Active Orders'}><Layers size={28} />{activeTables.length > 0 && <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>}</button>
                    <button onClick={() => { playClickSound(); setActiveTab('sales'); }} className={`p-4 rounded-2xl transition w-16 h-16 flex items-center justify-center ${activeTab === 'sales' ? 'bg-brand-600 text-white shadow-lg' : 'hover:bg-gray-800'}`} title={language === 'th' ? 'รายงานขาย' : 'Reports'}><PieChart size={28} /></button>
                    <button onClick={() => { playClickSound(); setActiveTab('qr_gen'); }} className={`p-4 rounded-2xl transition w-16 h-16 flex items-center justify-center ${activeTab === 'qr_gen' ? 'bg-brand-600 text-white shadow-lg' : 'hover:bg-gray-800'}`} title={language === 'th' ? 'สร้างคิวอาร์' : 'QR Generator'}><QrCode size={28} /></button>
                    <button onClick={() => { playClickSound(); setActiveTab('partners'); }} className={`p-4 rounded-2xl transition w-16 h-16 flex items-center justify-center ${activeTab === 'partners' ? 'bg-brand-600 text-white shadow-lg' : 'hover:bg-gray-800'}`} title={language === 'th' ? 'พาร์ทเนอร์แนะนำ' : 'Partner Referral Shares'}><Store size={28} /></button>
                    <button onClick={() => { playClickSound(); setActiveTab('promos'); }} className={`p-4 rounded-2xl transition w-16 h-16 flex items-center justify-center ${activeTab === 'promos' ? 'bg-brand-600 text-white shadow-lg' : 'hover:bg-gray-800'}`} title={language === 'th' ? 'โปรโมชั่น & ส่วนลด' : 'Promotions & Discounts'}><Tag size={28} /></button>
                     <button onClick={() => { playClickSound(); setActiveTab('manage'); }} className={`p-4 rounded-2xl transition w-16 h-16 flex items-center justify-center ${activeTab === 'manage' ? 'bg-brand-600 text-white shadow-lg' : 'hover:bg-gray-800'}`} title={language === 'th' ? 'ตั้งค่าร้านค้า' : 'Store Settings'}><Settings size={28} /></button>
                </div>
                <div className="flex flex-col items-center gap-4 w-full">
                    {/* SYSTEM SOUND TOGGLE CONTROLLER */}
                    <button 
                        onClick={toggleSound} 
                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 border cursor-pointer ${soundEnabled ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-gray-800 text-gray-500 border-gray-700/50'}`} 
                        title={soundEnabled ? (language === 'th' ? 'ปิดเสียงแจ้งเตือน' : 'Mute Sound Alerts') : (language === 'th' ? 'เปิดเสียงแจ้งเตือน' : 'Unmute Sound Alerts')}
                    >
                        {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
                    </button>
                    <button onClick={() => { playClickSound(); toggleLanguage(); }} className="text-xs font-bold bg-gray-800 text-gray-300 w-12 h-12 rounded-full flex items-center justify-center hover:bg-gray-700 active:scale-95 transition">{language.toUpperCase()}</button>
                    <button onClick={() => { playAlertSound(); adminLogout(); }} className="p-4 text-red-400 hover:bg-gray-800 rounded-xl transition cursor-pointer" title={language === 'th' ? 'ออกจากระบบ' : 'Logout'}><LogOut size={28} /></button>
                </div>
            </aside>
            
            {/* --- MOBILE BOTTOM NAV --- */}
            <div className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-gray-900 border-t border-gray-800 flex justify-around items-center z-50 px-2 print:hidden font-sans">
                <button onClick={() => { playClickSound(); setActiveTab('order'); setShowMobileCart(false); }} className={`flex flex-col items-center gap-1 ${activeTab === 'order' && !showMobileCart ? 'text-brand-500' : 'text-gray-400'}`}><ShoppingBag size={20}/><span className="text-[10px] font-bold">{language === 'th' ? 'สั่งอาหาร' : 'Order'}</span></button>
                <button onClick={() => { playClickSound(); setActiveTab('tables'); setShowMobileCart(false); }} className={`flex flex-col items-center gap-1 relative ${activeTab === 'tables' ? 'text-brand-500' : 'text-gray-400'}`}><Layers size={20}/>{activeTables.length > 0 && <span className="absolute top-0 right-3 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>}<span className="text-[10px] font-bold">{language === 'th' ? 'กำลังทำ' : 'Active'}</span></button>
                <div className="relative -top-5"><button onClick={() => { playClickSound(); setShowMobileCart(!showMobileCart); }} className="bg-brand-600 text-white w-14 h-14 rounded-full shadow-xl flex items-center justify-center border-4 border-gray-900">{showMobileCart ? <X size={24}/> : (<><ShoppingBag size={24}/>{cart.length > 0 && <span className="absolute top-0 right-0 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">{cart.reduce((s,i)=>s+i.quantity,0)}</span>}</>)}</button></div>
                <button onClick={() => { playClickSound(); setActiveTab('sales'); setShowMobileCart(false); }} className={`flex flex-col items-center gap-1 ${activeTab === 'sales' ? 'text-brand-500' : 'text-gray-400'}`}><PieChart size={20}/><span className="text-[10px] font-bold">{language === 'th' ? 'รายงานขาย' : 'Reports'}</span></button>
                <button onClick={() => { playClickSound(); setActiveTab('manage'); setShowMobileCart(false); }} className={`flex flex-col items-center gap-1 ${activeTab === 'manage' ? 'text-brand-500' : 'text-gray-400'}`}><Settings size={20}/><span className="text-[10px] font-bold">{language === 'th' ? 'ตั้งค่าร้าน' : 'Settings'}</span></button>
            </div>

            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 flex overflow-hidden relative print:hidden">
                {activeTab === 'order' && (
                    <>
                        <div className={`flex-1 flex flex-col h-full bg-gray-100 relative ${showMobileCart ? 'hidden lg:flex' : 'flex'}`}>
                            <div className="bg-white px-4 py-3 shadow-sm border-b shrink-0 overflow-x-auto no-scrollbar flex items-center gap-2">
                                <button onClick={() => setIsEditMode(!isEditMode)} className={`hidden lg:flex p-3 rounded-xl items-center gap-2 mr-2 transition ${isEditMode ? 'bg-red-500 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}><Edit2 size={20}/> <span className="text-sm font-bold">{isEditMode ? (language === 'th' ? 'กำลังแก้ไข' : 'Editing') : (language === 'th' ? 'สั่งอาหาร' : 'Order')}</span></button>
                                {CATEGORIES.map(cat => (<button key={cat.id} onClick={() => setActiveCategory(cat.id)} className={`whitespace-nowrap px-6 py-3 rounded-xl text-base font-bold transition ${activeCategory === cat.id ? 'bg-brand-600 text-white shadow-md scale-105' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>{language === 'th' ? cat.labelTh : cat.label}</button>))}
                                {isEditMode && <button onClick={handleOpenAddModal} className="whitespace-nowrap px-4 py-3 rounded-xl text-sm font-bold bg-green-500 text-white flex items-center gap-1 shadow hover:bg-green-600 ml-auto"><Plus size={18}/> {language === 'th' ? 'เพิ่มเมนูใหม่' : 'New Item'}</button>}
                                
                                {/* Visible desktop language choice right at main POS header */}
                                <button 
                                    onClick={() => { playClickSound(); toggleLanguage(); }}
                                    className="hidden lg:flex items-center gap-1.5 whitespace-nowrap px-4 py-2.5 rounded-xl text-xs font-black bg-brand-50 hover:bg-brand-100 text-brand-700 border border-brand-200 transition scale-100 hover:scale-105 ml-auto cursor-pointer"
                                    title={language === 'th' ? 'Switch to English' : 'เปลี่ยนเป็นภาษาไทย'}
                                >
                                    <span>{language === 'th' ? '🇺🇸 ENG' : '🇹🇭 ภาษาไทย'}</span>
                                </button>
                            </div>
                            
                            {printerType === 'bluetooth' && btStatus !== 'connected' && (
                                <div 
                                    onClick={async () => {
                                        playClickSound();
                                        await resetBluetoothConnection();
                                    }}
                                    className="mx-4 mt-4 bg-amber-500 hover:bg-amber-600 border border-amber-600/30 p-3.5 rounded-2xl flex items-center justify-between text-white font-sans text-xs font-black cursor-pointer shadow-md active:scale-[0.99] transition duration-200 select-none group shrink-0"
                                    title={language === 'th' ? 'คลิกที่นี่เพื่อเชื่อมต่อเครื่องปริ้นเตอร์ Bluetooth ใหม่ทันที' : 'Click to connect / reconnect Bluetooth printer'}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="bg-white/20 p-1.5 rounded-lg text-white">🖨️</span>
                                        <div>
                                            <p className="font-extrabold text-[12.5px] leading-tight flex items-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-red-400 animate-ping"></span>
                                                {language === 'th' ? 'เครื่องพิมพ์บูทูธ ไม่ได้เชื่อมต่ออยู่ หรือค้างไม่ตอบสนอง' : 'Bluetooth printer is disconnected or inactive!'}
                                            </p>
                                            <p className="text-[10.5px] text-amber-50 font-medium">
                                                {language === 'th' ? '👉 แตะที่นี่เพื่อเชื่อมต่อใหม่และล้างบัฟเฟอร์ เพื่อใช้งานพิมพ์ใบเสร็จอัติโนมัติ' : '👉 Tap here to reconnect & reset stream buffers instantly'}
                                            </p>
                                        </div>
                                    </div>
                                    <span className="bg-white text-amber-700 hover:bg-amber-50 px-2.5 py-1 rounded-lg text-xs font-black shadow border border-amber-400 group-hover:scale-105 transition shrink-0 uppercase">
                                        {language === 'th' ? '🔄 รีเฟรชเชื่อมต่อ' : '🔄 Refresh BT'}
                                    </span>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-4 pb-24 lg:pb-4">
                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                                    {filteredMenu.map(item => {
                                        const localized = getLocalizedItem(item);
                                        return (
                                            <div key={item.id} className={`bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col transition h-full group ${!item.available ? 'opacity-60 grayscale' : ''} ${isEditMode ? 'border-dashed border-blue-400 hover:border-solid hover:border-blue-500 cursor-pointer shadow-sm hover:shadow-md' : 'hover:border-brand-400 cursor-pointer active:scale-95'}`}>
                                                <div className="relative aspect-square overflow-hidden cursor-pointer" onClick={() => isEditMode ? handleEditMenuItem(item) : handleCustomize(item)}>
                                                    <img src={item.image} className="w-full h-full object-cover group-hover:scale-105 transition duration-500"/>
                                                    
                                                    {/* Promo Badge Tag */}
                                                    {(() => {
                                                        const activeBadge = language === 'th' ? (item.badgeTh || item.badge) : (item.badge || item.badgeTh);
                                                        return activeBadge ? (
                                                            <div className="absolute top-2 left-2 z-10 bg-gradient-to-r from-red-600 via-orange-500 to-amber-500 text-white font-black text-[10px] uppercase tracking-wider py-1 px-2 rounded-lg shadow-md animate-pulse">
                                                                {activeBadge}
                                                            </div>
                                                        ) : null;
                                                    })()}

                                                    {!item.available && <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-lg">SOLD OUT</div>}
                                                    {isEditMode && (
                                                        <div className="absolute top-2 right-2 flex flex-wrap gap-1 max-w-[125px] justify-end z-20">
                                                            <button onClick={(e) => { e.stopPropagation(); handleMoveMenuItem(item.id, 'up'); }} className="bg-gray-800 text-white p-1.5 rounded-lg shadow hover:bg-black" title="Move Up"><ChevronUp size={14}/></button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleMoveMenuItem(item.id, 'down'); }} className="bg-gray-800 text-white p-1.5 rounded-lg shadow hover:bg-black" title="Move Down"><ChevronDown size={14}/></button>
                                                            <button onClick={(e) => { e.stopPropagation(); handleEditMenuItem(item); }} className="bg-blue-500 text-white p-1.5 rounded-lg shadow hover:bg-blue-600" title="Edit"><Edit2 size={14}/></button>
                                                            <button onClick={(e) => { e.stopPropagation(); togglePizzaAvailability(item.id); }} className={`p-1.5 rounded-lg shadow text-white ${item.available ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'}`} title="Toggle Availability"><Power size={14}/></button>
                                                            <button onClick={(e) => { e.stopPropagation(); toggleBestSeller(item.id); }} className={`p-1.5 rounded-lg shadow text-white ${item.isBestSeller ? 'bg-yellow-400' : 'bg-gray-400'}`} title="Mark Bestseller"><Star size={14} fill="currentColor"/></button>
                                                            {item.id !== 'p_half_half' && item.id !== 'custom_base' && (
                                                                <button onClick={async (e) => { 
                                                                    e.stopPropagation(); 
                                                                    if (confirm(language === 'th' ? `คุณแน่ใจหรือไม่ที่จะลบเมนู "${getLocalizedItem(item).name}" ออกจากระบบ?` : `Are you sure you want to permanently delete "${getLocalizedItem(item).name}"?`)) {
                                                                        await deletePizza(item.id);
                                                                    }
                                                                }} className="bg-red-600 text-white p-1.5 rounded-lg shadow hover:bg-red-700" title="Delete"><Trash2 size={14}/></button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-4 flex flex-col flex-1 cursor-pointer" onClick={() => isEditMode ? handleEditMenuItem(item) : handleCustomize(item)}>
                                                    <h3 className="font-bold text-gray-800 text-base md:text-lg leading-tight mb-1">{localized.name}</h3>
                                                    <div className="mt-auto flex justify-between items-center pt-2">
                                                        <span className="font-bold text-brand-600 text-base md:text-lg">
                                                            {item.id === 'p_half_half' ? (language === 'th' ? 'เลือก 2 หน้า' : 'Select halves') : `฿${getPizzaPrice(item, orderSource)}`}
                                                        </span>
                                                        {!isEditMode && (
                                                            <button 
                                                                onClick={(e) => handleDirectAddToCart(e, item)}
                                                                className="bg-brand-50 text-brand-600 p-2 rounded-lg hover:bg-brand-600 hover:text-white transition cursor-pointer"
                                                                title={language === 'th' ? 'สั่งทันที' : 'Add Direct'}
                                                            >
                                                                <Plus size={24}/>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                        <div className={`w-full lg:w-96 bg-white border-l shadow-xl flex flex-col fixed lg:relative inset-0 lg:inset-auto transition-transform duration-300 ${showMobileCart ? 'translate-y-0 z-[60] lg:z-40' : 'translate-y-full lg:translate-y-0 z-40'}`}>
                            <div className="lg:hidden p-4 bg-gray-900 text-white flex justify-between items-center">
                                <h2 className="font-bold text-lg flex items-center gap-2">
                                    <ShoppingBag/> {language === 'th' ? 'รายการออเดอร์ปัจจุบัน' : 'Current Order'}
                                </h2>
                                <button onClick={() => setShowMobileCart(false)} className="bg-white/20 p-2 rounded-full"><X size={20}/></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                                {cart.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                                        <ShoppingBag size={64} className="mb-4"/>
                                        <p className="font-bold text-xl">{language === 'th' ? 'ยังไม่มีรายการอาหาร' : 'No items yet'}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {cart.map(item => {
                                            const localizedName = language === 'th' && item.nameTh ? item.nameTh : item.name;
                                            return (
                                                <div key={item.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative group active:bg-gray-50">
                                                    <div className="flex justify-between items-start mb-2 cursor-pointer" onClick={() => handleEditCartItem(item)}>
                                                        <div className="pr-6">
                                                            <h4 className="font-bold text-gray-800 text-base">{localizedName}</h4>
                                                            {item.specialInstructions && (
                                                                <div className="text-xs text-red-500 font-bold mt-1 bg-red-55 px-1 rounded inline-block">
                                                                    {language === 'th' ? 'หมายเหตุ: ' : 'Note: '}{item.specialInstructions}
                                                                </div>
                                                            )}
                                                            <p className="text-xs text-gray-500 leading-tight mt-1">
                                                                {(item.selectedToppings || []).map(t => language === 'th' && t.nameTh ? t.nameTh : t.name).join(', ')}
                                                                {(item.subItems || []).filter(Boolean).map(s => `+ ${language === 'th' && s.nameTh ? s.nameTh : s.name}`).join(', ')}
                                                            </p>
                                                        </div>
                                                        <div className="font-bold text-gray-900 text-base">฿{item.totalPrice}</div>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-3">
                                                        <div className="flex items-center bg-gray-100 rounded-lg p-1">
                                                            <button onClick={() => item.quantity > 1 ? updateCartItemQuantity(item.id, -1) : removeFromCart(item.id)} className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-white rounded-md shadow-sm transition"><Minus size={16}/></button>
                                                            <span className="w-10 text-center font-bold text-base">{item.quantity}</span>
                                                            <button onClick={() => updateCartItemQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-white rounded-md shadow-sm transition"><Plus size={16}/></button>
                                                        </div>
                                                        <button onClick={() => removeFromCart(item.id)} className="text-gray-400 hover:text-red-500 p-2"><Trash2 size={20}/></button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <div className="p-4 bg-white border-t space-y-3 pb-24 lg:pb-4">
                                <div className="grid grid-cols-2 gap-2">
                                    <select 
                                        className="border-2 border-gray-200 rounded-xl px-4 py-3 text-base font-bold focus:border-brand-500 outline-none w-full" 
                                        value={posOrderType} 
                                        onChange={e => {
                                            const v = e.target.value as OrderType;
                                            setPosOrderType(v);
                                            if (v === 'delivery' && orderSource === 'store') {
                                                // Delivery requires a phone and address, handled below
                                            }
                                        }}
                                    >
                                        <option value="dine-in">{language === 'th' ? 'ทานในร้าน/รับกลับ' : 'Dine-In/Takeaway'}</option>
                                        <option value="delivery">{language === 'th' ? 'เดลิเวอรี่ (ส่งถึงที่)' : 'Delivery'}</option>
                                    </select>
                                    <select 
                                        className="border-2 border-gray-200 rounded-xl px-4 py-3 text-base font-bold focus:border-brand-500 outline-none w-full" 
                                        value={orderSource} 
                                        onChange={e => setOrderSource(e.target.value as OrderSource)}
                                    >
                                        <option value="store">{language === 'th' ? 'สั่งตรงกับร้าน (Store)' : 'Store Direct'}</option>
                                        <option value="grab">Grab</option>
                                        <option value="lineman">Lineman</option>
                                        <option value="robinhood">Robinhood</option>
                                        <option value="foodpanda">Foodpanda</option>
                                        <option value="shopeefood">ShopeeFood</option>
                                        <option value="other">{language === 'th' ? 'อื่นๆ (Other)' : 'Other / อื่นๆ'}</option>
                                    </select>
                                </div>
                                <div className="w-full">
                                    <input 
                                        type="text" 
                                        placeholder={language === 'th' ? 'ชื่อลูกค้า / โต๊ะ' : 'Customer Name / Table No.'} 
                                        className="border-2 border-gray-200 rounded-xl px-4 py-3 text-base font-bold focus:border-brand-500 outline-none w-full" 
                                        value={tableNumber} 
                                        onChange={e => setTableNumber(e.target.value)}
                                    />
                                </div>
                                
                                {posOrderType === 'delivery' && (
                                    <div className="space-y-2 bg-blue-50/50 p-3 rounded-xl border border-blue-100">
                                        <h4 className="text-sm font-bold text-blue-800 flex items-center gap-1"><Truck size={14} /> {language === 'th' ? 'ข้อมูลจัดส่ง' : 'Delivery Details'}</h4>
                                        <input 
                                            type="tel" 
                                            placeholder={language === 'th' ? 'เบอร์โทรศัพท์ลูกค้า' : 'Customer Phone'} 
                                            className="border-2 border-blue-200 rounded-xl px-4 py-2.5 text-base font-bold focus:border-blue-500 outline-none w-full bg-white" 
                                            value={posCustomerPhone} 
                                            onChange={e => setPosCustomerPhone(e.target.value)}
                                        />
                                        <textarea 
                                            placeholder={language === 'th' ? 'ที่อยู่จัดส่ง / ลิงก์ Google Maps' : 'Delivery Address / Map Link'} 
                                            className="border-2 border-blue-200 rounded-xl px-4 py-2.5 text-base font-bold focus:border-blue-500 outline-none w-full bg-white min-h-[80px]" 
                                            value={posDeliveryAddress} 
                                            onChange={e => setPosDeliveryAddress(e.target.value)}
                                        />

                                        {posResolvingGps && (
                                            <div className="text-xs font-bold text-blue-600 animate-pulse flex items-center gap-1 mt-1">
                                                <RefreshCw size={12} className="animate-spin" />
                                                {language === 'th' ? 'กำลังดึงพิกัด GPS...' : 'Resolving GPS coordinates...'}
                                            </div>
                                        )}
                                        {!posResolvingGps && posDeliveryLat && posDeliveryLng && (
                                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2.5 rounded-lg text-xs font-bold space-y-1 mt-1">
                                                <div className="flex items-center gap-1 text-emerald-700">
                                                    <CheckCircle size={14} className="shrink-0" />
                                                    <span>{language === 'th' ? 'ดึงพิกัด GPS สำเร็จ!' : 'GPS coordinates parsed!'}</span>
                                                </div>
                                                <div className="text-[10px] font-mono text-emerald-600">
                                                    Lat: {posDeliveryLat.toFixed(6)}, Lng: {posDeliveryLng.toFixed(6)}
                                                </div>
                                                <div className="text-[11px] font-black text-emerald-900">
                                                    {language === 'th' ? 'ระยะทางจากร้าน:' : 'Distance from store:'} {
                                                        (() => {
                                                            const storeGps = storeSettings.storeLocationGps || "13.9239103,100.5220632";
                                                            const storeCoords = parseAnyMapLink(storeGps) || { lat: 13.9239103, lng: 100.5220632 };
                                                            return calculateDistanceKm(storeCoords.lat, storeCoords.lng, posDeliveryLat, posDeliveryLng).toFixed(2);
                                                        })()
                                                    } กม. (km)
                                                </div>
                                            </div>
                                        )}
                                        {!posResolvingGps && !posDeliveryLat && posDeliveryAddress && (
                                            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-lg text-xs font-bold flex items-start gap-1.5 mt-1">
                                                <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                                                <div className="leading-tight">
                                                    {language === 'th' 
                                                        ? 'ยังไม่พบพิกัด (กรุณาพิมพ์พิกัด เช่น 13.88, 100.52 หรือวางลิงก์ Google Maps)' 
                                                        : 'No coordinates found (please type coords like 13.88, 100.52 or paste a Google Maps link)'}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {orderSource !== 'store' && (
                                    <div className="w-full">
                                        <input 
                                            type="text" 
                                            placeholder={language === 'th' ? `หมายเลขออเดอร์ ${orderSource.toUpperCase()}` : `${orderSource.toUpperCase()} Order No.`} 
                                            className="border-2 border-brand-200 rounded-xl px-4 py-3 text-base font-bold focus:border-brand-500 outline-none w-full bg-brand-50" 
                                            value={deliveryPlatformRef} 
                                            onChange={e => setDeliveryPlatformRef(e.target.value)}
                                        />
                                    </div>
                                )}
                                <div className="space-y-1.5 pt-1.5 border-t border-gray-100">
                                    <div className="flex justify-between items-center text-xs font-bold text-gray-500 pb-1 border-b border-gray-50">
                                        <span>{language === 'th' ? 'ส่วนลด / โปรโมชั่น:' : 'Discount / Promo:'}</span>
                                        <select
                                            value={posPromoId}
                                            onChange={e => {
                                                setPosPromoId(e.target.value);
                                                if (e.target.value) setPosDiscount(0); // Clear manual discount if promo selected
                                            }}
                                            className="border border-brand-200 rounded-lg px-2 py-1 outline-none text-xs w-1/2 bg-white"
                                        >
                                            <option value="">{language === 'th' ? 'ไม่มีส่วนลด' : 'No Discount'}</option>
                                            {promoCodes?.filter(p => p.isActive).map(p => (
                                                <option key={p.id} value={p.id}>{p.code}</option>
                                            ))}
                                            <option value="manual">{language === 'th' ? 'ระบุส่วนลดเอง' : 'Manual Discount'}</option>
                                        </select>
                                    </div>
                                    <div className="pb-1 border-b border-gray-50">
                                        {posMemberCoupon ? (
                                            <div className="flex justify-between items-center bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-2 gap-2">
                                                <div className="text-xs font-black text-emerald-800 leading-tight">
                                                    🎟️ {posMemberCoupon.code} · {language === 'th' ? (posMemberCoupon.titleTh || posMemberCoupon.title) : posMemberCoupon.title}
                                                    <span className="block text-[10px] font-bold text-emerald-600">{memberProfile?.name || ''} ({memberProfile?.phone || posCustomerPhone}) · {language === 'th' ? 'ส่วนลด' : 'Discount'} -฿{posMemberCouponDiscount}</span>
                                                    {posMemberCouponDiscount <= 0 && <span className="block text-[10px] font-bold text-red-500">{language === 'th' ? '⚠️ เงื่อนไขยังไม่ผ่าน (ยอดขั้นต่ำ/ประเภทออเดอร์/วันหมดอายุ)' : '⚠️ Conditions not met'}</span>}
                                                </div>
                                                <button onClick={() => setPosMemberCoupon(null)} className="text-[10px] font-black text-red-500 border border-red-200 rounded px-1.5 py-1 bg-white shrink-0">{language === 'th' ? 'ยกเลิก' : 'Remove'}</button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => { setMemberLookupPhone(posCustomerPhone || ''); setMemberProfile(null); setShowMemberCouponModal(true); }}
                                                className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-white font-black text-sm py-2 rounded-xl shadow hover:opacity-90 active:scale-95 transition-all"
                                            >
                                                🎟️ {language === 'th' ? 'ใช้คูปองสมาชิก (ค้นด้วยเบอร์โทร)' : 'Member Coupon (phone lookup)'}
                                            </button>
                                        )}
                                        {showMemberCouponModal && (
                                            <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4" onClick={() => setShowMemberCouponModal(false)}>
                                                <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-5 space-y-3" onClick={e => e.stopPropagation()}>
                                                    <h3 className="font-black text-lg text-gray-800">🎟️ {language === 'th' ? 'ใช้คูปองสมาชิก' : 'Member Coupons'}</h3>
                                                    <div className="flex gap-2">
                                                        <input type="tel" autoFocus value={memberLookupPhone} onChange={e => setMemberLookupPhone(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') handleMemberLookup(); }} placeholder={language === 'th' ? 'เบอร์โทรสมาชิก' : 'Member phone'} className="flex-1 border-2 border-amber-300 rounded-xl px-3 py-2.5 font-bold outline-none focus:border-amber-500" />
                                                        <button onClick={handleMemberLookup} disabled={memberLookupLoading} className="bg-amber-500 text-white font-black px-4 rounded-xl disabled:opacity-50">{memberLookupLoading ? '...' : (language === 'th' ? 'ค้นหา' : 'Find')}</button>
                                                    </div>
                                                    {memberProfile && (
                                                        <div className="space-y-2">
                                                            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm font-bold text-blue-900">
                                                                👤 {memberProfile.name || '-'} · {memberProfile.phone}
                                                                <span className="block text-xs text-blue-600">⭐ {language === 'th' ? 'แต้มสะสม' : 'Points'}: {memberProfile.points}</span>
                                                            </div>
                                                            {(memberProfile.coupons || []).filter((c: any) => c && !c.isUsed).length === 0 && (
                                                                <div className="text-center text-sm font-bold text-gray-400 py-4">{language === 'th' ? 'ไม่มีคูปองที่ใช้ได้' : 'No available coupons'}</div>
                                                            )}
                                                            {(memberProfile.coupons || []).filter((c: any) => c && !c.isUsed).map((c: any, idx: number) => {
                                                                const expired = c.expiryDate ? (new Date() > new Date(`${c.expiryDate}T23:59:59`)) : false;
                                                                return (
                                                                    <button key={String(c.id) + '_' + idx} disabled={expired}
                                                                        onClick={() => { setPosMemberCoupon(c); setPosCustomerPhone(memberProfile.phone); setShowMemberCouponModal(false); }}
                                                                        className={`w-full text-left border-2 rounded-xl p-3 transition ${expired ? 'border-gray-200 bg-gray-50 opacity-50' : 'border-amber-200 bg-amber-50 hover:border-amber-400 active:scale-[0.99]'}`}>
                                                                        <div className="flex justify-between items-center">
                                                                            <span className="font-black text-sm text-gray-800">{c.code}{(language === 'th' ? c.badgeTh : c.badge) ? ` · ${language === 'th' ? c.badgeTh : c.badge}` : ''}</span>
                                                                            {expired && <span className="text-[10px] font-black text-red-500">{language === 'th' ? 'หมดอายุ' : 'Expired'}</span>}
                                                                        </div>
                                                                        <div className="text-xs font-bold text-gray-600 mt-0.5">{language === 'th' ? (c.titleTh || c.title) : c.title}</div>
                                                                        {(c.minOrderAmount || 0) > 0 && <div className={`text-[10px] font-bold mt-0.5 ${cartTotal >= c.minOrderAmount ? 'text-green-600' : 'text-red-500'}`}>{language === 'th' ? `ขั้นต่ำ ฿${c.minOrderAmount} (ตะกร้าตอนนี้ ฿${cartTotal})` : `Min ฿${c.minOrderAmount} (cart ฿${cartTotal})`}</div>}
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                    <button onClick={() => setShowMemberCouponModal(false)} className="w-full border-2 border-gray-200 rounded-xl py-2 font-bold text-gray-500">{language === 'th' ? 'ปิด' : 'Close'}</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    {posPromoId === 'manual' && (
                                        <div className="flex justify-between items-center text-xs font-bold text-gray-500 pb-1 border-b border-gray-50">
                                            <span>{language === 'th' ? 'ลดราคา (บาท):' : 'Discount (THB):'}</span>
                                            <input 
                                                type="number" 
                                                min="0"
                                                value={posDiscount || ''} 
                                                onChange={e => setPosDiscount(Number(e.target.value))}
                                                className="border border-brand-200 rounded-lg px-2 py-1 outline-none text-xs w-24 text-right bg-white"
                                                placeholder="0"
                                            />
                                        </div>
                                    )}

                                    <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                                        <span>{language === 'th' ? 'ภาษี 7% (VAT Toggle):' : '7% VAT (VAT Toggle):'}</span>
                                        <button 
                                            onClick={() => setVatEnabled(!vatEnabled)} 
                                            className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${vatEnabled ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}
                                        >
                                            {vatEnabled ? (language === 'th' ? 'เปิดใช้งาน / ON' : 'ON') : (language === 'th' ? 'ปิดการใช้งาน / OFF' : 'OFF')}
                                        </button>
                                    </div>
                                    {vatEnabled && cartTotal > 0 && (
                                        <>
                                            <div className="flex justify-between items-center text-xs text-gray-500 font-medium">
                                                <span>{language === 'th' ? 'ก่อนภาษี (Ex. VAT)' : 'Before VAT (Ex. VAT)'}</span>
                                                <span>฿{(Math.max(0, cartTotal - posCalculatedDiscount - posMemberCouponDiscount) - (Math.max(0, cartTotal - posCalculatedDiscount - posMemberCouponDiscount) * 7 / 107)).toFixed(2)}</span>
                                            </div>
                                            <div className="flex justify-between items-center text-xs text-gray-400 font-medium">
                                                <span>{language === 'th' ? 'ภาษีมูลค่าเพิ่ม (VAT 7%)' : 'Value Added Tax (VAT 7%)'}</span>
                                                <span>฿{(Math.max(0, cartTotal - posCalculatedDiscount - posMemberCouponDiscount) * 7 / 107).toFixed(2)}</span>
                                            </div>
                                        </>
                                    )}
                                    {posCalculatedDiscount > 0 && (
                                        <div className="flex justify-between items-center text-sm font-bold text-red-500">
                                            <span>{language === 'th' ? 'ส่วนลดที่ได้รับ' : 'Discount Applied'}</span>
                                            <span>-฿{posCalculatedDiscount}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between items-center text-2xl font-black text-gray-950 pt-1">
                                        <span>{language === 'th' ? 'รวมยอดทั้งหมด' : 'Total'}</span>
                                        <span>฿{Math.max(0, cartTotal - posCalculatedDiscount - posMemberCouponDiscount)}</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        onClick={handleSendToKitchen} 
                                        disabled={cart.length === 0} 
                                        className="py-4 rounded-xl font-bold text-lg bg-yellow-400 text-yellow-900 hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed transition shadow cursor-pointer text-center"
                                    >
                                        {language === 'th' ? 'ส่งเข้าครัว' : 'Kitchen'}
                                    </button>
                                    <button 
                                        onClick={handleCheckBill} 
                                        disabled={cart.length === 0} 
                                        className="py-4 rounded-xl font-bold text-lg bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow cursor-pointer text-center"
                                    >
                                        {language === 'th' ? 'เช็คบิลสด' : 'Pay Now'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {activeTab === 'tables' && (
                    <div className="flex-1 bg-gray-100 p-6 overflow-y-auto pb-24 lg:pb-6">
                        <div className="max-w-7xl mx-auto">
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><Layers className="text-brand-600"/> Active Orders & Tables</h2>
                            {activeTables.length === 0 ? <div className="flex flex-col items-center justify-center h-64 text-gray-400"><Layers size={64} className="mb-4 opacity-20"/><p className="text-xl font-bold">No active orders</p><button onClick={() => setActiveTab('order')} className="mt-4 text-brand-600 hover:underline font-bold">Start New Order</button></div> : 
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">{activeTables.map(order => {
                                    try {
                                        if (!order || !order.id) {
                                            throw new Error("Invalid or missing order data");
                                        }
                                        return (
                                            <div key={order.id} className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden flex flex-col relative group hover:border-brand-300 transition">
                                                <div className="p-4 bg-gray-50 border-b flex justify-between items-center">
                                                    <div>
                                                        <div className="text-xs text-gray-500 font-bold uppercase mb-1">Order #{String(order.id).slice(-4)}</div>
                                                        <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                                            {order.tableNumber ? (
                                                                <span className="bg-gray-800 text-white px-3 py-1 rounded-lg text-lg">Table {order.tableNumber}</span>
                                                            ) : (
                                                                <span className="bg-brand-600 text-white px-3 py-1 rounded-lg text-lg uppercase flex items-center gap-1">
                                                                    {order.type === 'delivery' ? <Bike size={16}/> : <ShoppingBag size={16}/>}
                                                                    {order.type}
                                                                </span>
                                                            )}
                                                        </h3>
                                                        {/* Date & Time of Order Creation */}
                                                        <div className="text-xs font-bold text-brand-600 mt-2 flex items-center gap-1 bg-brand-50/50 px-2 py-1 rounded-lg border border-brand-100 w-fit">
                                                            <Clock size={12}/>
                                                            <span>{formatOrderDateTime(order.createdAt, 'short')}</span>
                                                        </div>
                                                        {/* PRE-ORDER badge — scheduled orders must NOT be cooked immediately */}
                                                        {order.pickupTime && order.pickupTime !== 'ASAP' && (
                                                            <div className="text-xs font-black text-white mt-1.5 flex items-center gap-1.5 bg-purple-600 px-2.5 py-1.5 rounded-lg shadow-sm w-fit animate-pulse">
                                                                ⏰ {language === 'th'
                                                                    ? `สั่งล่วงหน้า — ${order.type === 'delivery' ? 'ส่งถึงเวลา' : 'นัดรับ'}: ${String(order.pickupTime).replace('Pre-order: ', '')}`
                                                                    : `PRE-ORDER — ${String(order.pickupTime).replace('Pre-order: ', '')}`}
                                                            </div>
                                                        )}
                                                        {/* Customer Name for Non-Table Orders */}
                                                        {!order.tableNumber && (
                                                            <div className="text-sm font-bold text-gray-600 mt-1.5 flex items-center gap-1">
                                                                <User size={14}/> {order.customerName}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-2xl font-bold text-brand-600">฿{order.totalAmount}</div>
                                                        <div className="text-xs text-red-500 font-bold bg-red-50 px-2 py-1 rounded mt-1 inline-block border border-red-100">UNPAID</div>
                                                    </div>
                                                </div>
                                                <div className="p-4 flex-1">
                                                    <div className="text-sm text-gray-600 space-y-2 max-h-48 overflow-y-auto">
                                                        {(order.items || []).filter(Boolean).map((item, i) => (
                                                            <div key={i} className="flex justify-between border-b border-gray-100 pb-1">
                                                                <span className="font-bold">{item.quantity}x {item.name}</span>
                                                                <span className="font-bold text-gray-800">฿{item.totalPrice}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {order.note && <div className="mt-2 text-xs italic text-gray-500 bg-yellow-50 p-2 rounded border border-yellow-100">Note: {order.note}</div>}
                                                    {order.type === 'delivery' && (
                                                        <div className="mt-3 space-y-2 bg-blue-50 p-3 rounded-xl border border-blue-100 shadow-sm animate-fade-in">
                                                            <div className="flex justify-between items-center pb-2 border-b border-blue-100/40">
                                                                <span className="text-sm font-bold text-blue-800">Delivery Fee: {order.deliveryFee === 'pending' ? 'TBD' : `฿${order.deliveryFee}`}</span>
                                                                <button onClick={() => handleUpdateDeliveryFee(order)} className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 font-bold shadow-sm">Update Fee</button>
                                                            </div>
                                                            
                                                            {/* Decoded delivery address annotations */}
                                                            <div className="text-xs space-y-2 pt-2 pb-1">
                                                                <div className="flex justify-between items-start">
                                                                    <span className="font-bold text-gray-700">ที่อยู่จัดส่ง:</span>
                                                                    <button 
                                                                        onClick={() => {
                                                                            const cleanAddress = (order.deliveryAddress || '')
                                                                                .replace(/\[Phone: .*?\]/g, '')
                                                                                .replace(/\[GPS Pin: .*?\]/g, '')
                                                                                .replace(/\[Google Maps Link: .*?\]/g, '')
                                                                                .trim();
                                                                            navigator.clipboard.writeText(cleanAddress);
                                                                            alert('คัดลอกที่อยู่แล้ว!');
                                                                        }}
                                                                        className="text-brand-600 hover:text-brand-800 underline active:text-brand-500 whitespace-nowrap ml-2"
                                                                    >
                                                                        คัดลอก
                                                                    </button>
                                                                </div>
                                                                <p className="text-gray-600 leading-relaxed bg-white p-2 rounded border border-blue-100/50">
                                                                    {(order.deliveryAddress || '')
                                                                        .replace(/\[Phone: .*?\]/g, '')
                                                                        .replace(/\[GPS Pin: .*?\]/g, '')
                                                                        .replace(/\[Google Maps Link: .*?\]/g, '')
                                                                        .trim()
                                                                    }
                                                                </p>
                                                                
                                                                {parseDeliveryPhone(order.deliveryAddress) && (
                                                                    <div className="flex items-center justify-between font-sans font-bold text-gray-700 border-t border-dashed border-blue-100 pt-2">
                                                                        <div className="flex items-center gap-1.5">
                                                                            <Phone size={13} className="text-blue-600 shrink-0"/>
                                                                            <span>เบอร์โทร:</span>
                                                                        </div>
                                                                        <a href={`tel:${parseDeliveryPhone(order.deliveryAddress)}`} className="text-blue-600 underline">
                                                                            {parseDeliveryPhone(order.deliveryAddress)}
                                                                        </a>
                                                                    </div>
                                                                )}
                                                                {parseGPSCoordinates(order.deliveryAddress) && (
                                                                    <div className="flex items-center justify-between gap-1.5 font-bold pt-2 border-t border-dashed border-blue-100">
                                                                        <div className="flex items-center gap-1.5 text-gray-750">
                                                                            <MapPin size={13} className="text-red-500 animate-pulse shrink-0"/>
                                                                            <span>ระยะทาง: {
                                                                                (() => {
                                                                                    const coords = parseGPSCoordinates(order.deliveryAddress);
                                                                                    if (!coords) return '?';
                                                                                    const storeGps = storeSettings.storeLocationGps || "13.9239103,100.5220632";
                                                                                    const storeCoords = parseAnyMapLink(storeGps) || { lat: 13.9239103, lng: 100.5220632 };
                                                                                    const sLat = storeCoords.lat;
                                                                                    const sLng = storeCoords.lng;
                                                                                    return calculateDistanceKm(sLat, sLng, coords.lat, coords.lng).toFixed(2);
                                                                                })()
                                                                            } กม.</span>
                                                                        </div>
                                                                        <a 
                                                                            href={parseGPSCoordinates(order.deliveryAddress)?.url} 
                                                                            target="_blank" 
                                                                            rel="noopener noreferrer" 
                                                                            className="text-[10px] bg-red-600 hover:bg-red-700 text-white px-2 py-1.5 rounded-lg font-extrabold flex items-center gap-1.5 shadow-sm transition active:scale-95"
                                                                        >
                                                                            <Globe size={11}/> เปิด Google Maps
                                                                        </a>
                                                                    </div>
                                                                )}
                                                                {/* Lalamove Dispatch Panel */}
                                                                <LalamoveDispatchPanel 
                                                                    order={order}
                                                                    updateOrderFields={updateOrderFields}
                                                                    language={language}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                    {order.source !== 'store' && (
                                                        <div className="mt-2 flex justify-between items-center bg-orange-50 p-2 rounded border border-orange-100">
                                                            <span className="text-sm font-bold text-orange-800">GP Deduction</span>
                                                            <button onClick={() => handleUpdateGPDeduction(order)} className="text-xs bg-orange-600 text-white px-3 py-1 rounded hover:bg-orange-700 font-bold shadow-sm">Edit GP</button>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-4 border-t bg-gray-50 space-y-2.5">
                                                    {/* ── ORDER FLOW: payment badge + mini stepper ── */}
                                                    {(() => {
                                                        const flowIdx = (order.status === 'pending' || order.status === 'confirmed') ? 0
                                                            : order.status === 'cooking' ? 1
                                                            : order.status === 'ready' ? 2
                                                            : 3;
                                                        const flowSteps = [
                                                            language === 'th' ? '1.รอยืนยัน' : '1.New',
                                                            language === 'th' ? '2.กำลังทำ' : '2.Cooking',
                                                            language === 'th' ? (order.type === 'delivery' ? '3.พร้อมส่ง' : '3.พร้อมเสิร์ฟ') : '3.Ready',
                                                            language === 'th' ? '4.จบบิล' : '4.Done'
                                                        ];
                                                        return (
                                                            <div className="space-y-1.5">
                                                                {order.status !== 'cancelled' && (
                                                                    order.paymentMethod === 'qr_transfer' ? (
                                                                        flowIdx === 0 ? (
                                                                            <div className="text-[11px] font-black text-amber-800 bg-amber-100 border border-amber-300 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                                                                                <AlertCircle size={13} className="shrink-0"/>
                                                                                {language === 'th' ? '💳 QR/โอน — ยังไม่ยืนยันเงินเข้า: เช็คสลิป/ยอดเงินก่อนกดเริ่มทำ' : '💳 QR/Transfer — verify the slip before cooking'}
                                                                            </div>
                                                                        ) : (
                                                                            <div className="text-[11px] font-black text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5">
                                                                                <CheckCircle2 size={13} className="shrink-0"/>
                                                                                {language === 'th' ? '💳 QR/โอน — ร้านยืนยันรับเงินแล้ว' : '💳 QR/Transfer — payment confirmed'}
                                                                            </div>
                                                                        )
                                                                    ) : (
                                                                        <div className="text-[11px] font-black text-gray-600 bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1.5">
                                                                            💵 {language === 'th' ? `เงินสด${order.type === 'delivery' ? ' (เก็บปลายทาง)' : ''}` : 'Cash'}
                                                                        </div>
                                                                    )
                                                                )}
                                                                <div className="flex items-center gap-1">
                                                                    {flowSteps.map((s, i) => (
                                                                        <React.Fragment key={i}>
                                                                            <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${i === flowIdx ? 'bg-brand-600 text-white shadow-sm' : i < flowIdx ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400'}`}>{s}</span>
                                                                            {i < flowSteps.length - 1 && <span className="text-gray-300 text-[10px]">›</span>}
                                                                        </React.Fragment>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {(order.status === 'pending' || order.status === 'confirmed') && (
                                                        <button onClick={() => handleConfirmPaymentAndCook(order.id)} className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition text-base">
                                                            <CheckCircle size={18}/> {language === 'th' ? (order.paymentMethod === 'qr_transfer' ? '✔ เช็คเงินเข้าแล้ว — เริ่มทำเลย' : 'รับออเดอร์ — เริ่มทำเลย') : 'Confirm Payment & Cook'}
                                                        </button>
                                                    )}
                                                    {order.status === 'cooking' && (
                                                        <button onClick={async () => { playSuccessFeedback(); await updateOrderStatus(order.id, 'ready'); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition text-base">
                                                            🍕 {language === 'th' ? 'อาหารพร้อมแล้ว (แจ้งลูกค้าอัตโนมัติ)' : 'Food Ready (notify customer)'}
                                                        </button>
                                                    )}
                                                    {order.status === 'ready' && order.type === 'delivery' && !order.lalamove_order_id && (
                                                        <div className="text-xs font-black text-orange-800 bg-orange-100 border border-orange-300 rounded-xl px-3 py-2.5 text-center">
                                                            🛵 {language === 'th' ? 'อาหารพร้อมแล้ว — เรียกไรเดอร์ที่กล่อง Lalamove ด้านบน ↑' : 'Ready — book the rider in the Lalamove panel above ↑'}
                                                        </div>
                                                    )}
                                                    {order.status === 'ready' && (order.type !== 'delivery' || order.lalamove_order_id) && (
                                                        <button onClick={() => handleCloseTable(order.id)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition text-base">
                                                            <CheckCircle2 size={18}/> {language === 'th' ? (order.type === 'delivery' ? 'ส่งสำเร็จ — ปิดบิล' : 'ลูกค้ารับ/เสิร์ฟแล้ว — ปิดบิล') : 'Complete & Close Bill'}
                                                        </button>
                                                    )}
                                                    <button onClick={() => handleCheckTableBill(order)} className="w-full bg-brand-600 hover:bg-brand-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-sm transition text-base"><Receipt size={18}/> Check Bill & Print</button>
                                                    
                                                    <button 
                                                        onClick={() => {
                                                            playClickSound();
                                                            startEditingOrderItems(order);
                                                        }} 
                                                        className="w-full bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 py-3 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-sm transition-all duration-200 active:scale-95"
                                                    >
                                                        <Edit2 size={15}/> {language === 'th' ? '📝 แก้ไขรายการอาหาร (1234)' : '📝 Edit Items (1234)'}
                                                    </button>

                                                    <div className="grid grid-cols-3 gap-2">
                                                        <button onClick={() => handleReprintOrder(order)} className="bg-amber-100 hover:bg-amber-200 text-amber-800 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95" title="Print Receipt">
                                                            <Printer size={12}/> Print
                                                        </button>
                                                        <button onClick={() => handleCloseTable(order.id)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95" title="Force Complete">
                                                            <Check size={12}/> Clear
                                                        </button>
                                                        <button onClick={() => handleCancelTable(order.id)} className="bg-red-100 hover:bg-red-200 text-red-700 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all active:scale-95" title="Cancel Order">
                                                            <X size={12}/> Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    } catch (e: any) {
                                        console.error("Error rendering order card:", order, e);
                                        return (
                                            <div key={order?.id || Math.random().toString()} className="bg-red-50 p-5 rounded-2xl border-2 border-dashed border-red-200 shadow-sm flex flex-col justify-between text-left h-full min-h-[300px]">
                                                <div className="space-y-2">
                                                    <div className="text-xs uppercase font-extrabold text-red-500">❌ Error Loading Order</div>
                                                    <h4 className="font-extrabold text-[#7c2d12] text-sm truncate">ID: {order?.id || 'Unknown'}</h4>
                                                    <p className="text-xs text-red-900 font-mono leading-relaxed bg-white p-3 rounded-xl border border-red-100 overflow-y-auto max-h-36">
                                                        {e?.message || String(e)}
                                                    </p>
                                                </div>
                                                <button 
                                                    onClick={async () => {
                                                        if (order?.id && window.confirm(language === 'th' ? `ลบออเดอร์ที่เสียหายรหัส #${order.id} หรือไม่?` : `Remove corrupted order record #${order.id}?`)) {
                                                            await deleteOrder(order.id);
                                                        }
                                                    }}
                                                    className="mt-4 w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs shadow transition active:scale-95 cursor-pointer text-center"
                                                >
                                                    {language === 'th' ? '🗑️ ลบข้อมูลเสียหายนี้' : '🗑️ Remove Corrupted Record'}
                                                </button>
                                            </div>
                                        );
                                    }
                                })}</div>
                            }
                        </div>
                    </div>
                )}

                {activeTab === 'sales' && (() => {
                    if (!isSalesUnlocked) {
                        const handlePasswordSubmit = (e?: React.FormEvent) => {
                            if (e) e.preventDefault();
                            if (salesPasswordInput === '123456*' || salesPasswordInput === 'Wachirus299*') {
                                setIsSalesUnlocked(true);
                                setSalesPasswordError(false);
                                setSalesPasswordInput('');
                                if (typeof playSuccessFeedback === 'function') playSuccessFeedback();
                            } else {
                                setSalesPasswordError(true);
                                setSalesPasswordInput('');
                                if (typeof playClickSound === 'function') playClickSound();
                            }
                        };

                        const handleKeyPress = (num: string) => {
                            setSalesPasswordError(false);
                            setSalesPasswordInput(prev => prev + num);
                        };

                        const handleBackspace = () => {
                            setSalesPasswordInput(prev => prev.slice(0, -1));
                        };

                        const handleClear = () => {
                            setSalesPasswordInput('');
                            setSalesPasswordError(false);
                        };

                        return (
                            <div className="flex-1 bg-gray-50 flex items-center justify-center p-6 pb-24 lg:pb-6">
                                <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-gray-200 p-8 text-center space-y-6">
                                    <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
                                        <Lock size={32} className="animate-pulse" />
                                    </div>

                                    <div className="space-y-2">
                                        <h3 className="text-xl font-black text-gray-900">
                                            {language === 'th' ? '🔐 ล็อกความปลอดภัยผู้จัดการ' : '🔐 Manager Security Lock'}
                                        </h3>
                                        <p className="text-xs text-gray-500 font-bold leading-relaxed px-4">
                                            {language === 'th' 
                                                ? 'กรุณากรอกรหัสผ่านผู้จัดการเพื่อดูรายงานยอดขาย วิเคราะห์ต้นทุน และรายชื่อลูกค้า' 
                                                : 'Please enter the manager passcode to access reports, cost analysis, and customer profiles.'}
                                        </p>
                                        <div className="bg-amber-50 text-amber-800 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-amber-200 inline-block">
                                            🔑 {language === 'th' ? 'รหัสผ่านตั้งต้นของร้านคือ: 123456*' : 'Your default passcode is: 123456*'}
                                        </div>
                                    </div>

                                    <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                        <div className="relative">
                                            <input 
                                                type="password"
                                                value={salesPasswordInput}
                                                onChange={(e) => {
                                                    setSalesPasswordError(false);
                                                    setSalesPasswordInput(e.target.value);
                                                }}
                                                placeholder="••••••"
                                                className={`w-full px-4 py-3.5 text-center text-2xl tracking-widest font-black bg-gray-50 border-2 rounded-2xl outline-none transition-all duration-200 ${salesPasswordError ? 'border-red-500 bg-red-50 text-red-700 placeholder-red-300' : 'border-gray-200 focus:border-brand-500 focus:bg-white text-gray-950'}`}
                                                autoFocus
                                            />
                                            {salesPasswordError && (
                                                <p className="text-xs text-red-600 font-extrabold mt-2 animate-bounce">
                                                    ❌ {language === 'th' ? 'รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่' : 'Incorrect passcode. Please try again.'}
                                                </p>
                                            )}
                                        </div>

                                        {/* PIN Pad layout for touchscreens/iPads */}
                                        <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto pt-2">
                                            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
                                                <button
                                                    key={num}
                                                    type="button"
                                                    onClick={() => handleKeyPress(num)}
                                                    className="h-14 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-2xl font-black text-lg text-gray-800 transition active:scale-95 flex items-center justify-center cursor-pointer"
                                                >
                                                    {num}
                                                </button>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={() => handleKeyPress('*')}
                                                className="h-14 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-2xl font-black text-xl text-amber-700 transition active:scale-95 flex items-center justify-center cursor-pointer"
                                            >
                                                *
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleKeyPress('0')}
                                                className="h-14 bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-2xl font-black text-lg text-gray-800 transition active:scale-95 flex items-center justify-center cursor-pointer"
                                            >
                                                0
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleBackspace}
                                                className="h-14 bg-red-50 hover:bg-red-100 border border-red-100 rounded-2xl font-bold text-sm text-red-600 transition active:scale-95 flex items-center justify-center cursor-pointer"
                                                title="Backspace"
                                            >
                                                ⌫
                                            </button>
                                        </div>

                                        <div className="flex gap-3 pt-2">
                                            <button
                                                type="button"
                                                onClick={handleClear}
                                                className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl font-extrabold text-sm transition active:scale-95 cursor-pointer"
                                            >
                                                {language === 'th' ? 'ล้าง' : 'Clear'}
                                            </button>
                                            <button
                                                type="submit"
                                                className="flex-1 py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-black text-sm shadow-md shadow-brand-100 hover:shadow-brand-200 transition active:scale-95 cursor-pointer"
                                            >
                                                {language === 'th' ? 'ยืนยันรหัสผ่าน' : 'Confirm'}
                                            </button>
                                        </div>
                                    </form>

                                    <div className="pt-2">
                                        <button 
                                            type="button"
                                            onClick={() => setActiveTab('order')} 
                                            className="text-xs text-gray-400 hover:text-gray-600 font-bold transition flex items-center justify-center gap-1 mx-auto cursor-pointer"
                                        >
                                            ← {language === 'th' ? 'กลับไปหน้าขายสินค้า' : 'Back to POS Cashier'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    }

                    const formatSelectedDateString = (date: Date) => {
                        const dStr = date.toDateString();
                        const today = new Date();
                        const yesterday = new Date();
                        yesterday.setDate(today.getDate() - 1);
                        const dayBeforeYesterday = new Date();
                        dayBeforeYesterday.setDate(today.getDate() - 2);

                        if (dStr === today.toDateString()) {
                            return language === 'th' ? 'วันนี้' : 'Today';
                        }
                        if (dStr === yesterday.toDateString()) {
                            return language === 'th' ? 'เมื่อวาน' : 'Yesterday';
                        }
                        if (dStr === dayBeforeYesterday.toDateString()) {
                            return language === 'th' ? 'เมื่อวานซืน' : '2 Days Ago';
                        }

                        if (language === 'th') {
                            return date.toLocaleDateString('th-TH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                        } else {
                            return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
                        }
                    };

                    const filteredOrders = (orders || []).filter(o => o && filterByDate(o.createdAt, salesFilter));
                    const filteredExpenses = (expenses || []).filter(e => e && filterByDate(e.date, salesFilter));
                    const totalSales = filteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                    const netSales = filteredOrders.reduce((sum, o) => sum + (o.netAmount || o.totalAmount || 0), 0);
                    const totalExpensesValue = filteredExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

                    // Download CSV with richer columns
                    const handleDetailedCSVExport = () => {
                        const csvRows = filteredOrders.map(o => {
                            const itemsDescription = (o.items || []).map(i => `${i.name} (x${i.quantity})`).join(' | ');
                            return {
                                "Order ID": o.id,
                                "Date & Time": o.createdAt,
                                "Customer Name": o.customerName || 'Walk-in / Guest',
                                "Table": o.tableNumber || '-',
                                "Source": o.source,
                                "Status": o.status,
                                "Items Summary": itemsDescription,
                                "Gross Amount (฿)": o.totalAmount,
                                "Net Amount After GP (฿)": o.netAmount || o.totalAmount
                            };
                        });
                        downloadCSV(csvRows, `sales_report_${salesFilter}_${Date.now()}.csv`);
                    };

                    return (
                        <div className="flex-1 bg-gray-50 p-6 overflow-y-auto pb-24 lg:pb-6 text-left">
                            <div className="max-w-7xl mx-auto space-y-6">
                                
                                {/* Header Title with professional design */}
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                                            <PieChart size={28} className="text-brand-600"/> 
                                            {language === 'th' ? 'รายงานวิเคราะห์ยอดขายอัจฉริยะ' : 'Sales Analytics Dashboard'}
                                        </h2>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {language === 'th' ? 'ดูข้อมูลเชิงลึก ยอดขายรายวัน รายการยอดนิยม และกลุ่มลูกค้าหลัก' : 'Monitor daily progress, top sellers, and customer insights.'}
                                        </p>
                                    </div>
                                    
                                    {/* Action Buttons: Filter & Export */}
                                    <div className="flex flex-wrap items-center gap-2">
                                        <div className="flex bg-gray-200 p-1 rounded-xl">
                                            {(['day', 'month', 'year', 'all'] as const).map(f => (
                                                <button 
                                                    key={f} 
                                                    onClick={() => setSalesFilter(f)} 
                                                    className={`px-4 py-1.5 rounded-lg text-xs font-black transition capitalize ${salesFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:bg-gray-300'}`}
                                                >
                                                    {f === 'day' ? (language === 'th' ? 'รายวัน' : 'Daily') : 
                                                     f === 'month' ? (language === 'th' ? 'เดือนนี้' : 'Month') : 
                                                     f === 'year' ? (language === 'th' ? 'ปีนี้' : 'Year') : (language === 'th' ? 'ทั้งหมด' : 'All')}
                                                </button>
                                            ))}
                                        </div>
                                        <button 
                                            onClick={handleDetailedCSVExport} 
                                            className="px-4 py-2.5 bg-green-600 text-white text-xs font-black rounded-xl hover:bg-green-700 shadow-sm flex items-center gap-2 transition"
                                        >
                                            <Download size={15}/> {language === 'th' ? 'ส่งออกไฟล์ CSV' : 'Export CSV'}
                                        </button>
                                    </div>
                                </div>

                                {salesFilter === 'day' && (
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-gray-200 rounded-2xl p-4 shadow-sm w-full animate-fade-in font-sans">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-black text-gray-700 flex items-center gap-1.5">
                                                📅 {language === 'th' ? 'เลือกวันที่ดูยอดขาย:' : 'Choose Date:'}
                                            </span>
                                            <span className="text-sm font-black text-brand-600 bg-brand-50 px-3 py-1 rounded-lg">
                                                {formatSelectedDateString(selectedSalesDate)}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {/* Quick select presets */}
                                            <button 
                                                onClick={() => { playClickSound(); setSelectedSalesDate(new Date()); }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${selectedSalesDate.toDateString() === new Date().toDateString() ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/20' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200/50'}`}
                                            >
                                                {language === 'th' ? 'วันนี้' : 'Today'}
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    playClickSound();
                                                    const d = new Date();
                                                    d.setDate(d.getDate() - 1);
                                                    setSelectedSalesDate(d);
                                                }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${(() => {
                                                    const yesterday = new Date();
                                                    yesterday.setDate(yesterday.getDate() - 1);
                                                    return selectedSalesDate.toDateString() === yesterday.toDateString();
                                                })() ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/20' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200/50'}`}
                                            >
                                                {language === 'th' ? 'เมื่อวาน' : 'Yesterday'}
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    playClickSound();
                                                    const d = new Date();
                                                    d.setDate(d.getDate() - 2);
                                                    setSelectedSalesDate(d);
                                                }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${(() => {
                                                    const dayBefore = new Date();
                                                    dayBefore.setDate(dayBefore.getDate() - 2);
                                                    return selectedSalesDate.toDateString() === dayBefore.toDateString();
                                                })() ? 'bg-brand-600 text-white shadow-sm shadow-brand-500/20' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200/50'}`}
                                            >
                                                {language === 'th' ? 'เมื่อวานซืน' : '2 Days Ago'}
                                            </button>

                                            <div className="h-6 w-[1px] bg-gray-200 mx-1 hidden sm:block"></div>

                                            {/* Day-by-day navigation */}
                                            <div className="flex items-center gap-1 bg-gray-100 border border-gray-200/50 rounded-xl p-0.5 shadow-inner">
                                                <button 
                                                    onClick={() => {
                                                        playClickSound();
                                                        const d = new Date(selectedSalesDate);
                                                        d.setDate(d.getDate() - 1);
                                                        setSelectedSalesDate(d);
                                                    }}
                                                    className="p-1.5 text-gray-600 hover:text-brand-600 hover:bg-white rounded-lg transition"
                                                    title={language === 'th' ? 'วันก่อนหน้า' : 'Previous Day'}
                                                >
                                                    <ChevronLeft size={16} />
                                                </button>
                                                
                                                <span className="text-[11px] font-extrabold px-2 text-gray-800 min-w-[70px] text-center select-none">
                                                    {language === 'th' ? 'เลื่อนวัน' : 'Navigate'}
                                                </span>

                                                <button 
                                                    onClick={() => {
                                                        playClickSound();
                                                        const d = new Date(selectedSalesDate);
                                                        d.setDate(d.getDate() + 1);
                                                        setSelectedSalesDate(d);
                                                    }}
                                                    className="p-1.5 text-gray-600 hover:text-brand-600 hover:bg-white rounded-lg transition"
                                                    title={language === 'th' ? 'วันถัดไป' : 'Next Day'}
                                                >
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>

                                            <div className="h-6 w-[1px] bg-gray-200 mx-1 hidden sm:block"></div>

                                            {/* Date Picker Input */}
                                            <div className="relative flex items-center gap-1 bg-gray-100 hover:bg-gray-200 border border-gray-200/50 rounded-xl px-3 py-1.5 shadow-inner cursor-pointer">
                                                <input 
                                                    type="date"
                                                    value={selectedSalesDate.toISOString().split('T')[0]}
                                                    onChange={(e) => {
                                                        if (e.target.value) {
                                                            playClickSound();
                                                            setSelectedSalesDate(new Date(e.target.value));
                                                        }
                                                    }}
                                                    className="text-xs font-black text-gray-700 outline-none bg-transparent cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* KPIs Grid */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between relative overflow-hidden">
                                        <div className="absolute right-0 top-0 w-24 h-24 bg-brand-50 rounded-full translate-x-8 -translate-y-8 opacity-40"></div>
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{language === 'th' ? 'ยอดขายรวม' : 'Gross Sales'}</span>
                                        <p className="text-3xl font-black text-gray-900 mt-2">฿{totalSales.toLocaleString()}</p>
                                        <span className="text-[11px] text-gray-400 mt-1">*{language === 'th' ? 'ราคาก่อนหักต้นทุน/GP' : 'Before GP or cost deductions'}</span>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between relative overflow-hidden">
                                        <div className="absolute right-0 top-0 w-24 h-24 bg-blue-50 rounded-full translate-x-8 -translate-y-8 opacity-40"></div>
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{language === 'th' ? 'จำนวนออเดอร์ทั้งหมด' : 'Total Orders'}</span>
                                        <p className="text-3xl font-black text-blue-600 mt-2">{filteredOrders.length}</p>
                                        <span className="text-[11px] text-gray-400 mt-1">*{language === 'th' ? 'คำสั่งซื้อที่เสร็จสมบูรณ์' : 'All completed orders'}</span>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between relative overflow-hidden">
                                        <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-50 rounded-full translate-x-8 -translate-y-8 opacity-40"></div>
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{language === 'th' ? 'รายรับสุทธิ (หลังหัก GP)' : 'Net Revenue (After GP)'}</span>
                                        <p className="text-3xl font-black text-emerald-600 mt-2">฿{netSales.toLocaleString()}</p>
                                        <span className="text-[11px] text-emerald-500 font-bold mt-1">฿{(totalSales - netSales).toLocaleString()} {language === 'th' ? 'ส่วนแบ่ง GP' : 'GP Deducted'}</span>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col justify-between relative overflow-hidden">
                                        <div className="absolute right-0 top-0 w-24 h-24 bg-amber-50 rounded-full translate-x-8 -translate-y-8 opacity-40"></div>
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{language === 'th' ? 'ค่าใช้จ่ายทั้งหมด' : 'Total Expenses'}</span>
                                        <p className="text-3xl font-black text-amber-600 mt-2">฿{totalExpensesValue.toLocaleString()}</p>
                                        <span className="text-[11px] font-bold text-gray-500 mt-1">Net Margin: ฿{(netSales - totalExpensesValue).toLocaleString()}</span>
                                    </div>
                                </div>

                                {/* Main Layout Content: Left Area for list/tab, Right Area for Top Sellers of the month */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    
                                    {/* Left Column: History & Daily Breakdown */}
                                    <div className="lg:col-span-2 space-y-4">
                                        
                                        {/* Sub Tabs Switcher */}
                                        <div className="flex border-b border-gray-200">
                                            <button 
                                                onClick={() => setSalesSubTab('orders')}
                                                className={`px-5 py-3 font-black text-sm border-b-2 transition ${salesSubTab === 'orders' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                            >
                                                📄 {language === 'th' ? 'ประวัติรายการสั่งซื้อ' : 'Order History'}
                                            </button>
                                            <button 
                                                onClick={() => setSalesSubTab('daily')}
                                                className={`px-5 py-3 font-black text-sm border-b-2 transition ${salesSubTab === 'daily' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                            >
                                                📈 {language === 'th' ? 'สรุปยอดขายรายวัน' : 'Daily Sales Breakdown'}
                                            </button>
                                            <button 
                                                onClick={() => setSalesSubTab('expenses')}
                                                className={`px-5 py-3 font-black text-sm border-b-2 transition ${salesSubTab === 'expenses' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                            >
                                                💸 {language === 'th' ? 'บันทึกบิล & รายจ่าย' : 'Bills & Expense Tracker'}
                                            </button>
                                            <button 
                                                onClick={() => setSalesSubTab('cost_analysis')}
                                                className={`px-5 py-3 font-black text-sm border-b-2 transition ${salesSubTab === 'cost_analysis' ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
                                            >
                                                🥗 {language === 'th' ? 'วิเคราะห์อัตรากำไร' : 'Margin & COGS Analysis'}
                                            </button>
                                        </div>

                                        {salesSubTab === 'orders' && (
                                            /* Order History */
                                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                                    <h3 className="font-extrabold text-gray-800 text-base">{language === 'th' ? 'รายการออเดอร์ทั้งหมด' : 'Transaction Records'}</h3>
                                                    <span className="text-xs font-bold text-gray-500">{filteredOrders.length} {language === 'th' ? 'รายการ' : 'Orders'}</span>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                                        <thead className="bg-gray-50 text-gray-400 font-bold uppercase text-xs border-b border-gray-100">
                                                            <tr>
                                                                <th className="p-4">{language === 'th' ? 'วันเวลา' : 'Date & Time'}</th>
                                                                <th className="p-4">{language === 'th' ? 'ลูกค้า / ออเดอร์' : 'Customer & Order'}</th>
                                                                <th className="p-4">{language === 'th' ? 'ที่มา' : 'Source'}</th>
                                                                <th className="p-4">{language === 'th' ? 'สถานะ' : 'Status'}</th>
                                                                <th className="p-4">{language === 'th' ? 'ยอดเต็ม' : 'Amount'}</th>
                                                                <th className="p-4 text-emerald-600">{language === 'th' ? 'หลังหัก GP' : 'Net'}</th>
                                                                <th className="p-4 text-right">{language === 'th' ? 'จัดการ' : 'Actions'}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {[...filteredOrders].reverse().map(order => (
                                                                <tr key={order.id} className="hover:bg-gray-50 transition">
                                                                    <td className="p-4 text-gray-500 text-xs font-bold">
                                                                        {formatOrderDateTime(order.createdAt, 'medium')}
                                                                    </td>
                                                                    <td className="p-4">
                                                                        <div className="flex flex-col">
                                                                            <span className="font-black text-gray-900 text-sm">
                                                                                #{String(order.id).slice(-4)} 
                                                                                {order.tableNumber && ` (TB: ${order.tableNumber})`}
                                                                            </span>
                                                                            <span className="text-xs text-gray-500 font-bold flex items-center gap-1 mt-0.5">
                                                                                👤 {order.customerName || (language === 'th' ? 'ลูกค้าทั่วไป (Walk-in)' : 'Walk-in Guest')}
                                                                            </span>
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-4">
                                                                        <span className="uppercase text-[10px] font-black bg-gray-100 px-2 py-1 rounded-lg text-gray-600 border border-gray-200">
                                                                            {order.source}
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-4">
                                                                        <span className={`uppercase text-[10px] font-black px-2 py-1 rounded-full ${order.status === 'completed' ? 'bg-green-100 text-green-700' : order.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                                            {order.status}
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-4 font-extrabold text-gray-700">฿{order.totalAmount}</td>
                                                                    <td className="p-4 font-black text-emerald-600">฿{order.netAmount || order.totalAmount}</td>
                                                                    <td className="p-4 text-right flex justify-end gap-1.5 flex-wrap">
                                                                        <button onClick={() => handleStartEditOrder(order)} className="text-blue-700 hover:underline font-bold text-xs bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition">แก้ไข (Edit)</button>
                                                                        <button onClick={() => handleDeleteOrderPrompt(order)} className="text-red-700 hover:underline font-bold text-xs bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg transition">ลบ (Delete)</button>
                                                                        {order.source !== 'store' && (
                                                                            <button onClick={() => handleUpdateGPDeduction(order)} className="text-orange-600 hover:underline font-bold text-xs bg-orange-50 hover:bg-orange-100 px-2.5 py-1.5 rounded-lg transition">{language === 'th' ? 'แก้ไข GP' : 'Edit GP'}</button>
                                                                        )}
                                                                        <button onClick={() => handleReprintOrder(order)} className="text-amber-700 hover:underline font-bold text-xs bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition"><Printer size={12}/> {language === 'th' ? 'พิมพ์' : 'Print'}</button>
                                                                        <button onClick={() => { setSelectedOrder(order); setShowPaymentModal(true); }} className="text-brand-600 hover:underline font-bold text-xs bg-brand-50 hover:bg-brand-100 px-2.5 py-1.5 rounded-lg transition">{language === 'th' ? 'ใบเสร็จ' : 'Receipt'}</button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            {filteredOrders.length === 0 && (
                                                                <tr>
                                                                    <td colSpan={7} className="p-8 text-center text-gray-400 font-bold">
                                                                        {language === 'th' ? 'ไม่พบข้อมูลออเดอร์ในช่วงเวลานี้' : 'No orders found for this period.'}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {salesSubTab === 'daily' && (
                                            /* Daily Sales breakdown */
                                            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                                <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                                    <h3 className="font-extrabold text-gray-800 text-base">{language === 'th' ? 'ประวัติยอดขายรายวัน' : 'Daily Sales Summary'}</h3>
                                                    <span className="text-xs font-bold text-gray-500">{dailySales.length} {language === 'th' ? 'วัน' : 'Days'}</span>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                                        <thead className="bg-gray-50 text-gray-400 font-bold uppercase text-xs border-b border-gray-100">
                                                            <tr>
                                                                <th className="p-4">{language === 'th' ? 'วันที่' : 'Date'}</th>
                                                                <th className="p-4">{language === 'th' ? 'จำนวนคำสั่งซื้อ' : 'Orders Count'}</th>
                                                                <th className="p-4 text-right">{language === 'th' ? 'ยอดขายรวม' : 'Gross Sales'}</th>
                                                                <th className="p-4 text-emerald-600 text-right">{language === 'th' ? 'รายรับสุทธิ (หลังหัก GP)' : 'Net Sales'}</th>
                                                                <th className="p-4 text-right">{language === 'th' ? 'ค่าเฉลี่ยต่อบิล' : 'Avg. Ticket Size'}</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-gray-100">
                                                            {dailySales.map(day => (
                                                                <tr key={day.date} className="hover:bg-gray-50 transition">
                                                                    <td className="p-4 font-black text-gray-900">{day.date}</td>
                                                                    <td className="p-4 font-bold text-gray-600">{day.ordersCount} ออเดอร์</td>
                                                                    <td className="p-4 text-right font-extrabold text-gray-700">฿{day.totalSales.toLocaleString()}</td>
                                                                    <td className="p-4 text-right font-black text-emerald-600">฿{day.netAmount.toLocaleString()}</td>
                                                                    <td className="p-4 text-right font-bold text-gray-500">฿{Math.round(day.totalSales / day.ordersCount).toLocaleString()}</td>
                                                                </tr>
                                                            ))}
                                                            {dailySales.length === 0 && (
                                                                <tr>
                                                                    <td colSpan={5} className="p-8 text-center text-gray-400 font-bold">
                                                                        {language === 'th' ? 'ไม่พบข้อมูลยอดขายรายวันในช่วงเวลานี้' : 'No daily sales records found.'}
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {salesSubTab === 'expenses' && (
                                            <div className="space-y-6">
                                                {/* Quick Templates Panel */}
                                                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                                                    <h4 className="font-extrabold text-gray-800 text-sm mb-3">⚡ {language === 'th' ? 'ต้นแบบรายจ่ายด่วน (แตะเพื่อกรอกข้อมูล)' : 'Quick Expense Templates (Tap to autofill)'}</h4>
                                                    <div className="flex flex-wrap gap-2">
                                                        {expenseTemplates.map(tpl => (
                                                            <button 
                                                                key={tpl.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    playClickSound();
                                                                    setExpenseForm({
                                                                        description: tpl.description,
                                                                        category: tpl.category || 'COGS',
                                                                        quantity: tpl.quantity || 1,
                                                                        unit: tpl.unit || 'แพ็ค',
                                                                        unitPrice: tpl.unitPrice || 0,
                                                                        amount: String(tpl.amount || ''),
                                                                        vendor: tpl.vendor || '',
                                                                        billNumber: '',
                                                                        note: tpl.note || '',
                                                                        saveAsTemplate: false
                                                                    });
                                                                }}
                                                                className="px-3.5 py-2 bg-gray-50 border border-gray-200 hover:border-brand-500 hover:bg-brand-50/50 rounded-xl text-xs font-bold text-gray-700 transition flex items-center gap-1.5 cursor-pointer"
                                                            >
                                                                <span>📦</span>
                                                                <span>{tpl.description}</span>
                                                                <span className="text-[10px] text-gray-400 font-mono">฿{tpl.amount}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {/* Add Expense Form */}
                                                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm text-left">
                                                    <h3 className="font-extrabold text-gray-800 text-base mb-4 flex items-center gap-2">
                                                        <span>💸</span> {language === 'th' ? 'บันทึกรายจ่าย / บิลซื้อของ' : 'Log New Expense / Bill'}
                                                    </h3>
                                                    <form onSubmit={handleAddExpense} className="space-y-4">
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-500 mb-1">{language === 'th' ? 'คำอธิบายรายจ่าย *' : 'Description *'}</label>
                                                                <input 
                                                                    type="text" 
                                                                    required
                                                                    value={expenseForm.description}
                                                                    onChange={e => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-bold text-sm bg-gray-50"
                                                                    placeholder="e.g. แป้งสาลีตราพัด, ค่าน้ำประปา"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-500 mb-1">{language === 'th' ? 'หมวดหมู่รายจ่าย' : 'Category'}</label>
                                                                <select 
                                                                    value={expenseForm.category}
                                                                    onChange={e => setExpenseForm(prev => ({ ...prev, category: e.target.value as any }))}
                                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-bold text-sm bg-gray-50"
                                                                >
                                                                    <option value="COGS">{language === 'th' ? 'ต้นทุนวัตถุดิบอาหาร (COGS)' : 'Cost of Ingredients (COGS)'}</option>
                                                                    <option value="Rent">{language === 'th' ? 'ค่าเช่าสถานที่' : 'Rent / Location'}</option>
                                                                    <option value="Utility">{language === 'th' ? 'ค่าสาธารณูปโภค (น้ำ/ไฟ/เน็ต)' : 'Utilities (Water/Electric/Net)'}</option>
                                                                    <option value="Staff">{language === 'th' ? 'เงินเดือน/ค่าจ้างพนักงาน' : 'Staff Salary & Wages'}</option>
                                                                    <option value="Marketing">{language === 'th' ? 'การตลาดและโฆษณา' : 'Marketing & Ads'}</option>
                                                                    <option value="Other">{language === 'th' ? 'ค่าใช้จ่ายอื่นๆ' : 'Other Expenses'}</option>
                                                                </select>
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-500 mb-1">{language === 'th' ? 'จำนวน' : 'Quantity'}</label>
                                                                <input 
                                                                    type="number" 
                                                                    min={1}
                                                                    value={expenseForm.quantity || 1}
                                                                    onChange={e => setExpenseForm(prev => ({ ...prev, quantity: Math.max(1, parseInt(e.target.value) || 1) }))}
                                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-bold text-sm bg-gray-50"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-500 mb-1">{language === 'th' ? 'หน่วยนับ' : 'Unit'}</label>
                                                                <input 
                                                                    type="text" 
                                                                    value={expenseForm.unit || 'แพ็ค'}
                                                                    onChange={e => setExpenseForm(prev => ({ ...prev, unit: e.target.value }))}
                                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-bold text-sm bg-gray-50"
                                                                    placeholder="e.g. กิโลกรัม, ลัง, ชิ้น"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-500 mb-1">{language === 'th' ? 'ราคาต่อหน่วย (บาท)' : 'Unit Price (THB)'}</label>
                                                                <input 
                                                                    type="number" 
                                                                    step="any"
                                                                    value={expenseForm.unitPrice || 0}
                                                                    onChange={e => {
                                                                        const up = parseFloat(e.target.value) || 0;
                                                                        setExpenseForm(prev => ({ ...prev, unitPrice: up, amount: String(up * (prev.quantity || 1)) }));
                                                                    }}
                                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-bold text-sm bg-gray-50"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-500 mb-1">{language === 'th' ? 'ราคารวมทั้งหมด (บาท) *' : 'Total Amount (THB) *'}</label>
                                                                <input 
                                                                    type="number" 
                                                                    step="any"
                                                                    required
                                                                    value={expenseForm.amount}
                                                                    onChange={e => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-bold text-sm bg-brand-50/50 text-brand-700 border-brand-200"
                                                                    placeholder="e.g. 1500"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-500 mb-1">{language === 'th' ? 'ร้านค้า/ซัพพลายเออร์' : 'Supplier / Vendor'}</label>
                                                                <input 
                                                                    type="text" 
                                                                    value={expenseForm.vendor || ''}
                                                                    onChange={e => setExpenseForm(prev => ({ ...prev, vendor: e.target.value }))}
                                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-bold text-sm bg-gray-50"
                                                                    placeholder="e.g. แม็คโคร"
                                                                />
                                                            </div>
                                                            <div>
                                                                <label className="block text-xs font-bold text-gray-500 mb-1">{language === 'th' ? 'เลขที่บิล/ใบเสร็จ' : 'Bill / Receipt No.'}</label>
                                                                <input 
                                                                    type="text" 
                                                                    value={expenseForm.billNumber || ''}
                                                                    onChange={e => setExpenseForm(prev => ({ ...prev, billNumber: e.target.value }))}
                                                                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-bold text-sm bg-gray-50"
                                                                    placeholder="e.g. RE-10943"
                                                                />
                                                            </div>
                                                            <div className="flex items-end pb-3">
                                                                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-gray-600 select-none">
                                                                    <input 
                                                                        type="checkbox"
                                                                        checked={expenseForm.saveAsTemplate || false}
                                                                        onChange={e => setExpenseForm(prev => ({ ...prev, saveAsTemplate: e.target.checked }))}
                                                                        className="w-4 h-4 text-brand-600 rounded border-gray-300 focus:ring-brand-500"
                                                                    />
                                                                    <span>{language === 'th' ? 'บันทึกเป็นต้นแบบด่วนเพื่อใช้ซ้ำ' : 'Save as quick template'}</span>
                                                                </label>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-bold text-gray-500 mb-1">{language === 'th' ? 'หมายเหตุเพิ่มเติม' : 'Note / Remarks'}</label>
                                                            <textarea 
                                                                value={expenseForm.note || ''}
                                                                onChange={e => setExpenseForm(prev => ({ ...prev, note: e.target.value }))}
                                                                className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-brand-500 focus:border-brand-500 font-bold text-sm bg-gray-50 h-16"
                                                                placeholder="..."
                                                            />
                                                        </div>
                                                        <div className="flex justify-end pt-2">
                                                            <button 
                                                                type="submit"
                                                                className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-black shadow-md shadow-brand-50 hover:shadow-brand-100 transition active:scale-95 cursor-pointer"
                                                            >
                                                                ➕ {language === 'th' ? 'บันทึกรายการจ่ายเงิน' : 'Add Expense Entry'}
                                                            </button>
                                                        </div>
                                                    </form>
                                                </div>

                                                {/* Expenses History List */}
                                                <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden text-left">
                                                    <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                                        <h3 className="font-extrabold text-gray-800 text-base">{language === 'th' ? 'รายการรายจ่ายตามตัวกรอง' : 'Expense Log Details'}</h3>
                                                        <span className="text-xs font-black text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">฿{totalExpensesValue.toLocaleString()}</span>
                                                    </div>
                                                    <div className="overflow-x-auto">
                                                        <table className="w-full text-left text-sm whitespace-nowrap">
                                                            <thead className="bg-gray-50 text-gray-400 font-bold uppercase text-[10px] border-b border-gray-100">
                                                                <tr>
                                                                    <th className="p-4">{language === 'th' ? 'วันที่' : 'Date'}</th>
                                                                    <th className="p-4">{language === 'th' ? 'รายการ' : 'Expense Detail'}</th>
                                                                    <th className="p-4">{language === 'th' ? 'หมวดหมู่' : 'Category'}</th>
                                                                    <th className="p-4">{language === 'th' ? 'จำนวน' : 'Qty'}</th>
                                                                    <th className="p-4 text-right">{language === 'th' ? 'ราคาต่อหน่วย' : 'Unit Price'}</th>
                                                                    <th className="p-4 text-right">{language === 'th' ? 'ราคารวม' : 'Total'}</th>
                                                                    <th className="p-4">{language === 'th' ? 'ร้านค้า' : 'Vendor'}</th>
                                                                    <th className="p-4 text-center">{language === 'th' ? 'จัดการ' : 'Action'}</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {filteredExpenses.map(exp => (
                                                                    <tr key={exp.id} className="hover:bg-gray-50 transition text-xs font-bold text-gray-600">
                                                                        <td className="p-4 font-mono text-gray-400">{new Date(exp.date).toLocaleDateString()}</td>
                                                                        <td className="p-4">
                                                                            <span className="text-gray-900 block font-black">{exp.description}</span>
                                                                            {exp.note && <span className="text-[10px] text-gray-400 font-normal">{exp.note}</span>}
                                                                        </td>
                                                                        <td className="p-4">
                                                                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600 font-extrabold uppercase">
                                                                                {exp.category}
                                                                            </span>
                                                                        </td>
                                                                        <td className="p-4">{exp.quantity} {exp.unit}</td>
                                                                        <td className="p-4 text-right font-mono">฿{Number(exp.unitPrice || 0).toLocaleString()}</td>
                                                                        <td className="p-4 text-right font-black text-gray-900 font-mono">฿{Number(exp.amount || 0).toLocaleString()}</td>
                                                                        <td className="p-4">
                                                                            <span className="text-gray-800 font-extrabold block">{exp.vendor || '-'}</span>
                                                                            {exp.billNumber && <span className="text-[9px] text-gray-400 font-mono">Bill: {exp.billNumber}</span>}
                                                                        </td>
                                                                        <td className="p-4 text-center">
                                                                            <button 
                                                                                onClick={() => {
                                                                                    if (confirm(language === 'th' ? "คุณแน่ใจหรือไม่ที่จะลบรายจ่ายรายการนี้?" : "Are you sure you want to delete this expense?")) {
                                                                                        deleteExpense(exp.id);
                                                                                    }
                                                                                }}
                                                                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition cursor-pointer"
                                                                            >
                                                                                🗑️
                                                                            </button>
                                                                        </td>
                                                                    </tr>
                                                                ))}
                                                                {filteredExpenses.length === 0 && (
                                                                    <tr>
                                                                        <td colSpan={8} className="p-8 text-center text-gray-400 font-bold">
                                                                            {language === 'th' ? 'ไม่พบประวัติการใช้จ่ายในช่วงเวลานี้' : 'No expenses logged during this period.'}
                                                                        </td>
                                                                    </tr>
                                                                )}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {salesSubTab === 'cost_analysis' && (() => {
                                            // Compute aggregated statistics per menu item
                                            const itemStats: Record<string, { qty: number; revenue: number; cogs: number; profit: number }> = {};
                                            
                                            // Pre-populate stats for each menu item to have complete product table
                                            menu.forEach(pizza => {
                                                itemStats[pizza.id] = { qty: 0, revenue: 0, cogs: 0, profit: 0 };
                                            });

                                            // Sum up stats from confirmed/completed orders in the selected filter window
                                            filteredOrders.forEach(order => {
                                                if (order.status === 'cancelled') return;
                                                (order.items || []).forEach(oItem => {
                                                    const pid = oItem.pizzaId;
                                                    const qty = oItem.quantity || 1;
                                                    const rev = oItem.totalPrice;
                                                    
                                                    // Get the ingredient cost (COGS)
                                                    const matchedPizza = menu.find(m => m.id === pid);
                                                    let singleCogs = matchedPizza?.rawCost || 0;
                                                    if (singleCogs === 0 && pid) {
                                                        const ingredients = ingredientCostsMap[pid] || [];
                                                        singleCogs = ingredients.reduce((s, ing) => s + ing.cost, 0);
                                                    }
                                                    const totalCogs = singleCogs * qty;

                                                    if (pid && itemStats[pid]) {
                                                        itemStats[pid].qty += qty;
                                                        itemStats[pid].revenue += rev;
                                                        itemStats[pid].cogs += totalCogs;
                                                        itemStats[pid].profit += (rev - totalCogs);
                                                    } else if (pid) {
                                                        itemStats[pid] = {
                                                            qty,
                                                            revenue: rev,
                                                            cogs: totalCogs,
                                                            profit: rev - totalCogs
                                                        };
                                                    }
                                                });
                                            });

                                            // Accumulate overall store stats
                                            let overallRev = 0;
                                            let overallCogs = 0;
                                            let overallProfit = 0;
                                            let overallQty = 0;

                                            Object.keys(itemStats).forEach(key => {
                                                const stat = itemStats[key];
                                                overallRev += stat.revenue;
                                                overallCogs += stat.cogs;
                                                overallProfit += stat.profit;
                                                overallQty += stat.qty;
                                            });

                                            const overallMarginPercent = overallRev > 0 ? (overallProfit / overallRev) * 100 : 0;

                                            return (
                                                <div className="space-y-6 text-left">
                                                    {/* Cost Analysis KPI Header cards */}
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase">{language === 'th' ? 'ต้นทุนรวมตามยอดขาย (COGS)' : 'Total Cost of Sales (COGS)'}</span>
                                                            <p className="text-2xl font-black text-gray-900 mt-1 font-mono">฿{overallCogs.toLocaleString()}</p>
                                                            <span className="text-[10px] text-gray-400 block mt-1">{language === 'th' ? 'ต้นทุนวัตถุดิบอาหารรวม' : 'Theoretical aggregate cost'}</span>
                                                        </div>
                                                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase">{language === 'th' ? 'กำไรขั้นต้นทางทฤษฎี' : 'Theoretical Gross Margin'}</span>
                                                            <p className="text-2xl font-black text-emerald-600 mt-1 font-mono">฿{overallProfit.toLocaleString()}</p>
                                                            <span className="text-[10px] text-gray-400 block mt-1">{language === 'th' ? 'ยอดหลังหักต้นทุนอาหาร' : 'Sales minus food cost'}</span>
                                                        </div>
                                                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase">{language === 'th' ? 'อัตรากำไรขั้นต้นเฉลี่ย' : 'Average Margin %'}</span>
                                                            <p className="text-2xl font-black text-brand-600 mt-1 font-mono">{overallMarginPercent.toFixed(1)}%</p>
                                                            <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                                                <div className="bg-brand-600 h-full rounded-full" style={{ width: `${overallMarginPercent}%` }}></div>
                                                            </div>
                                                        </div>
                                                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase">{language === 'th' ? 'จำนวนชิ้นอาหารที่ขายได้' : 'Total Items Sold'}</span>
                                                            <p className="text-2xl font-black text-blue-600 mt-1 font-mono">{overallQty} {language === 'th' ? 'จาน' : 'units'}</p>
                                                            <span className="text-[10px] text-gray-400 block mt-1">{language === 'th' ? 'นับตามปริมาณออเดอร์ย่อย' : 'Counted items from order list'}</span>
                                                        </div>
                                                    </div>

                                                    {/* Products Margin Breakdown Table */}
                                                    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
                                                        <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                                                            <h3 className="font-extrabold text-gray-800 text-base">{language === 'th' ? 'วิเคราะห์ต้นทุนและกำไรจำแนกตามรายสินค้า' : 'Theoretical Item Profit & COGS Ledger'}</h3>
                                                            <span className="text-xs text-gray-500 font-bold">{menu.length} {language === 'th' ? 'รายการเมนู' : 'Menu Items'}</span>
                                                        </div>
                                                        <div className="overflow-x-auto">
                                                            <table className="w-full text-left text-sm whitespace-nowrap">
                                                                <thead className="bg-gray-50 text-gray-400 font-bold uppercase text-[10px] border-b border-gray-100">
                                                                    <tr>
                                                                        <th className="p-4">{language === 'th' ? 'ชื่อเมนู' : 'Menu Item'}</th>
                                                                        <th className="p-4">{language === 'th' ? 'หมวดหมู่' : 'Category'}</th>
                                                                        <th className="p-4 text-right">{language === 'th' ? 'ราคาขาย' : 'Retail Price'}</th>
                                                                        <th className="p-4 text-right">{language === 'th' ? 'ต้นทุนวัตถุดิบ' : 'Ingredient Cost'}</th>
                                                                        <th className="p-4 text-right">{language === 'th' ? 'กำไรทางทฤษฎี/ชิ้น' : 'Margin / Unit'}</th>
                                                                        <th className="p-4 text-right">{language === 'th' ? 'อัตรากำไร (%)' : 'Margin %'}</th>
                                                                        <th className="p-4 text-right">{language === 'th' ? 'จำนวนที่ขาย' : 'Qty Sold'}</th>
                                                                        <th className="p-4 text-right text-brand-600">{language === 'th' ? 'รายรับสะสม' : 'Gross Rev'}</th>
                                                                        <th className="p-4 text-right text-emerald-600">{language === 'th' ? 'กำไรสะสม' : 'Total Profit'}</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody className="divide-y divide-gray-100">
                                                                    {menu.map(pizza => {
                                                                        const stats = itemStats[pizza.id] || { qty: 0, revenue: 0, cogs: 0, profit: 0 };
                                                                        
                                                                        // Determine COGS for unit
                                                                        let unitCogs = pizza.rawCost || 0;
                                                                        if (unitCogs === 0) {
                                                                            const ingredients = ingredientCostsMap[pizza.id] || [];
                                                                            unitCogs = ingredients.reduce((s, ing) => s + ing.cost, 0);
                                                                        }

                                                                        const unitMargin = Math.max(0, pizza.basePrice - unitCogs);
                                                                        const unitMarginPercent = pizza.basePrice > 0 ? (unitMargin / pizza.basePrice) * 100 : 0;

                                                                        // Determine Margin Color Label
                                                                        let marginColorClass = 'text-red-600 bg-red-50';
                                                                        if (unitMarginPercent >= 60) {
                                                                            marginColorClass = 'text-green-700 bg-green-50';
                                                                        } else if (unitMarginPercent >= 45) {
                                                                            marginColorClass = 'text-amber-700 bg-amber-50';
                                                                        }

                                                                        return (
                                                                            <tr key={pizza.id} className="hover:bg-gray-50 transition text-xs font-bold text-gray-700">
                                                                                <td className="p-4">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <img 
                                                                                            src={pizza.image || 'https://via.placeholder.com/150'} 
                                                                                            className="w-8 h-8 rounded-lg object-cover border border-gray-100 shrink-0" 
                                                                                            referrerPolicy="no-referrer"
                                                                                        />
                                                                                        <div className="flex flex-col text-left">
                                                                                            <span className="text-gray-900 block font-black">{language === 'th' ? pizza.nameTh || pizza.name : pizza.name}</span>
                                                                                            <span className="text-[10px] text-gray-400 font-mono">ID: {pizza.id}</span>
                                                                                        </div>
                                                                                    </div>
                                                                                </td>
                                                                                <td className="p-4 font-normal text-gray-400 uppercase text-[10px]">{pizza.category}</td>
                                                                                <td className="p-4 text-right font-mono text-gray-900">฿{pizza.basePrice.toLocaleString()}</td>
                                                                                <td className="p-4 text-right font-mono text-gray-500">
                                                                                    {unitCogs > 0 ? `฿${unitCogs}` : '-'}
                                                                                </td>
                                                                                <td className="p-4 text-right font-mono text-emerald-600">
                                                                                    {unitCogs > 0 ? `฿${unitMargin}` : '-'}
                                                                                </td>
                                                                                <td className="p-4 text-right font-mono">
                                                                                    {unitCogs > 0 ? (
                                                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-black ${marginColorClass}`}>
                                                                                            {unitMarginPercent.toFixed(0)}%
                                                                                        </span>
                                                                                    ) : (
                                                                                        <span className="text-gray-400 text-[10px] font-normal italic">{language === 'th' ? 'ไม่มีข้อมูลต้นทุนวัตถุดิบ' : 'No ingredients set'}</span>
                                                                                    )}
                                                                                </td>
                                                                                <td className="p-4 text-right font-mono text-gray-600">{stats.qty} ชิ้น</td>
                                                                                <td className="p-4 text-right font-mono text-brand-600">฿{stats.revenue.toLocaleString()}</td>
                                                                                <td className="p-4 text-right font-mono text-emerald-600 font-extrabold">฿{stats.profit.toLocaleString()}</td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Right Column: Dynamic Intelligence Panel (Monthly Best Sellers & Customer Insight) */}
                                    <div className="space-y-6">
                                        
                                        {/* Best Selling Items of the Month */}
                                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm text-left">
                                            <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2 mb-4">
                                                <span>🔥</span> {language === 'th' ? '5 อันดับสินค้าขายดีในเดือนนี้' : 'Top 5 Best Sellers (This Month)'}
                                            </h3>
                                            
                                            <div className="space-y-4">
                                                {bestSellersOfMonth.map((item, idx) => {
                                                    const maxCount = bestSellersOfMonth[0]?.count || 1;
                                                    const percentage = Math.round((item.count / maxCount) * 100);
                                                    
                                                    // Let's find customers who ordered this item in this month
                                                    const buyers = (orders || [])
                                                        .filter(o => o && o.status !== 'cancelled' && o.customerName)
                                                        .filter(o => {
                                                            const d = new Date(o.createdAt);
                                                            const now = new Date();
                                                            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
                                                        })
                                                        .filter(o => (o.items || []).some(itm => (itm.pizzaId === item.pizzaId || itm.name === item.name)))
                                                        .map(o => o.customerName)
                                                        .filter((value, index, self) => self.indexOf(value) === index) // Unique buyers
                                                        .slice(0, 3); // top 3 buyers

                                                    return (
                                                        <div key={idx} className="flex gap-3 items-start border-b border-gray-50 pb-3 last:border-0 last:pb-0">
                                                            <img 
                                                                src={item.img || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=120&q=80'} 
                                                                className="w-12 h-12 rounded-xl object-cover border border-gray-100 flex-shrink-0"
                                                                referrerPolicy="no-referrer"
                                                            />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex justify-between items-start gap-2">
                                                                    <p className="font-black text-gray-900 text-xs truncate">
                                                                        {idx + 1}. {language === 'th' ? item.nameTh || item.name : item.name}
                                                                    </p>
                                                                    <span className="text-xs font-black text-brand-600 bg-brand-50 px-2 py-0.5 rounded-lg whitespace-nowrap">
                                                                        {item.count} {language === 'th' ? 'ที่' : 'sold'}
                                                                    </span>
                                                                </div>
                                                                
                                                                {/* Progress Bar */}
                                                                <div className="w-full bg-gray-100 h-1.5 rounded-full mt-1 overflow-hidden">
                                                                    <div className="bg-brand-600 h-full rounded-full" style={{ width: `${percentage}%` }}></div>
                                                                </div>

                                                                {/* Revenue & Customer Names tag */}
                                                                <div className="flex justify-between items-center mt-1.5 text-[10px]">
                                                                    <span className="text-gray-400 font-bold">Rev: ฿{item.totalRev.toLocaleString()}</span>
                                                                    {buyers.length > 0 && (
                                                                        <span className="text-brand-600 font-extrabold max-w-[120px] truncate" title={buyers.join(', ')}>
                                                                            👥 {buyers.join(', ')}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {bestSellersOfMonth.length === 0 && (
                                                    <p className="text-sm text-gray-400 font-bold py-4 text-center">
                                                        {language === 'th' ? 'ยังไม่มีข้อมูลยอดขายในเดือนนี้' : 'No sales registered yet this month.'}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Customer Engagement Spotlight */}
                                        <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm text-left">
                                            <h3 className="font-extrabold text-gray-900 text-base flex items-center gap-2 mb-3">
                                                <span>👥</span> {language === 'th' ? 'กลุ่มลูกค้าที่ใช้บริการช่วงนี้' : 'Recent Customers Profile'}
                                            </h3>
                                            <p className="text-xs text-gray-500 mb-4">
                                                {language === 'th' ? 'รายชื่อลูกค้าที่มียอดสั่งซื้อสูงสุดและออเดอร์ล่าสุด' : 'Identify and connect with active buyers.'}
                                            </p>
                                            
                                            <div className="space-y-3 text-left">
                                                {(() => {
                                                    const recentWithNames = filteredOrders
                                                        .filter(o => o && o.customerName)
                                                        .slice(-5)
                                                        .reverse();

                                                    return recentWithNames.map((order, idx) => (
                                                        <div key={idx} className="flex justify-between items-center bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center font-black text-xs text-brand-700 uppercase">
                                                                    {String(order.customerName).slice(0, 2)}
                                                                </div>
                                                                <div className="flex flex-col text-left">
                                                                    <span className="font-extrabold text-gray-800 text-xs truncate max-w-[130px]">{order.customerName}</span>
                                                                    <span className="text-[10px] text-gray-400 font-medium font-mono">Order #{String(order.id).slice(-4)}</span>
                                                                </div>
                                                            </div>
                                                            <span className="text-xs font-black text-gray-700 font-mono">฿{order.totalAmount.toLocaleString()}</span>
                                                        </div>
                                                    ));
                                                })()}
                                                {filteredOrders.filter(o => o.customerName).length === 0 && (
                                                    <p className="text-xs text-gray-400 font-bold text-center py-4">
                                                        {language === 'th' ? 'ไม่มีรายชื่อลูกค้าส่วนบุคคลในออเดอร์ช่วงนี้' : 'No personal customer names registered.'}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                    </div>
                                </div>

                            </div>
                        </div>
                    );
                })()}

                {activeTab === 'qr_gen' && (
                    <div className="flex-1 bg-gray-100 p-6 overflow-y-auto pb-24 lg:pb-6">
                        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2"><QrCode className="text-brand-600"/> QR Generator</h2>
                            <div className="flex flex-col lg:flex-row gap-8">
                                <div className="flex-1 space-y-4">
                                    <div>
                                        <label className="text-sm font-bold text-gray-500 uppercase">Base URL</label>
                                        <input type="text" className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-brand-500 outline-none mt-1" value={qrBaseUrl} onChange={e => setQrBaseUrl(e.target.value)} />
                                    </div>
                                    <div>
                                         <label className="text-sm font-bold text-gray-500 uppercase">Table Number</label>
                                         <input type="text" className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-brand-500 outline-none mt-1" value={qrTableNum} onChange={e => setQrTableNum(e.target.value)} placeholder="e.g. 5" />
                                    </div>
                                    <div className="text-xs text-gray-500 mt-2 p-3 bg-gray-50 rounded-xl leading-relaxed">
                                         This tool generates a QR code pre-filled with the table number. Customers scanning this QR will automatically be assigned this table number during order placement.
                                    </div>
                                </div>
                                <div className="flex flex-col items-center justify-center p-6 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-300 min-w-[250px]">
                                     {qrBaseUrl && qrTableNum ? (
                                         <>
                                             <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(getCleanQrUrl() + '?table=' + qrTableNum)}`} alt="QR Code" className="w-48 h-48 mix-blend-multiply border border-gray-200 p-2 bg-white rounded-xl shadow-sm" />
                                             <div className="mt-4 font-bold text-lg text-brand-600 text-center uppercase">Table {qrTableNum}</div>
                                             <button className="mt-6 bg-brand-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-brand-700 w-full shadow flex items-center justify-center gap-2" onClick={handlePrintQrCard}><Printer size={18}/> Print QR Card</button>
                                         </>
                                     ) : (
                                         <div className="text-gray-400 font-bold text-center">Enter Base URL & Table Number</div>
                                     )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'partners' && (
                    <div className="flex-1 bg-gray-100 p-6 overflow-y-auto pb-24 lg:pb-6 font-sans">
                        <div className="max-w-5xl mx-auto space-y-6">
                            
                            {/* Header Summary */}
                            <div className="bg-gradient-to-r from-brand-600 to-indigo-600 p-6 rounded-2xl text-white shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-left">
                                <div>
                                    <h2 className="text-2xl font-bold flex items-center gap-2"><Store/> {language === 'th' ? 'ระบบพันธมิตรร้านใกล้เคียง' : 'Partner Referral Ecosystem'}</h2>
                                    <p className="text-white/85 text-sm mt-1">
                                        {language === 'th' 
                                            ? 'สร้างคิวอาร์โค้ดให้ร้านค้าผู้แนะนำรอบๆ ร้าน และแบ่งเปอร์เซ็นต์ส่วนแบ่งตามยอดขายจริง' 
                                            : 'Generate referral QR codes for nearby partner stores and distribute dynamic commission splits of actual order volumes.'}
                                    </p>
                                </div>
                                <div className="bg-white/10 px-4 py-2.5 rounded-xl border border-white/20 text-left">
                                    <div className="text-xs text-white/70 font-semibold">{language === 'th' ? 'จำนวนพันธมิตรทั้งหมด' : 'Total Active Partners'}</div>
                                    <div className="text-2xl font-black">{partners?.length || 0} {language === 'th' ? 'ร้านค้า' : 'Stores'}</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                
                                {/* Form: Add Partner */}
                                <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm h-fit text-left">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-3 border-gray-100 text-left">
                                        <Plus className="text-emerald-500" size={20}/> 
                                        {language === 'th' ? 'เพิ่มพันธมิตรใหม่' : 'Register New Partner'}
                                    </h3>
                                    <div className="space-y-4">
                                        <div className="text-left">
                                            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">
                                                {language === 'th' ? 'ชื่อร้านค้า / พันธมิตร' : 'Partner Store Name'}
                                            </label>
                                            <input 
                                                type="text" 
                                                className="w-full border border-gray-250 rounded-xl px-4 py-3 font-bold text-gray-700 focus:border-brand-500 outline-none text-sm bg-white"
                                                placeholder="e.g. Welltech Printer, Coffee Shop"
                                                value={newPartnerName}
                                                onChange={e => setNewPartnerName(e.target.value)}
                                            />
                                        </div>
                                        <div className="text-left">
                                            <label className="text-xs font-bold text-gray-400 uppercase block mb-1">
                                                {language === 'th' ? 'อัตราส่วนแบ่ง (%) จากยอดขาย' : 'Commission Share Rate (%)'}
                                            </label>
                                            <div className="relative">
                                                <input 
                                                    type="number" 
                                                    min="0"
                                                    max="100"
                                                    className="w-full border border-gray-250 rounded-xl pl-4 pr-10 py-3 font-bold text-gray-700 focus:border-brand-500 outline-none text-sm bg-white"
                                                    value={newPartnerComm}
                                                    onChange={e => setNewPartnerComm(parseFloat(e.target.value) || 0)}
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-gray-400">%</span>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => {
                                                if (!newPartnerName.trim()) {
                                                    alert(language === 'th' ? 'กรุณากรอกชื่อร้านค้าพันธมิตร' : 'Please input a partner name!');
                                                    return;
                                                }
                                                addPartner({
                                                    id: 'partner_' + Date.now(),
                                                    name: newPartnerName,
                                                    commissionPercent: newPartnerComm
                                                });
                                                setNewPartnerName('');
                                                setNewPartnerComm(10);
                                                playSuccessFeedback();
                                            }}
                                            className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 px-4 rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 text-sm cursor-pointer"
                                        >
                                            <Save size={16}/> {language === 'th' ? 'บันทึกพันธมิตร' : 'Create Partner Account'}
                                        </button>
                                    </div>
                                </div>

                                {/* List of Active Partners */}
                                <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm text-left">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2 border-b pb-3 border-gray-100 text-left">
                                        <List className="text-brand-500" size={20}/>
                                        {language === 'th' ? 'รายชื่อและข้อมูลยอดส่วนแบ่ง' : 'Partners Sales & Splits Ledger'}
                                    </h3>

                                    {!partners || partners.length === 0 ? (
                                        <div className="py-12 text-center text-gray-400 flex flex-col items-center justify-center">
                                            <Store size={48} className="opacity-30 mb-2" />
                                            <p className="font-bold">{language === 'th' ? 'ยังไม่มีพันธมิตรถูกลงทะเบียน' : 'No partner accounts created yet'}</p>
                                            <p className="text-xs text-gray-400 mt-1">{language === 'th' ? 'คุณสามารถเพิ่มร้านใกล้เคียงได้ที่แบบฟอร์มด้านซ้าย' : 'Add partner details using the form on the left.'}</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {partners.map(partner => {
                                                const partnerOrders = (orders || []).filter(o => o && o.partnerId === partner.id && o.status !== 'cancelled');
                                                const totalReferredSales = partnerOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
                                                const commissionAmountPaid = partnerOrders.reduce((sum, o) => sum + (o.partnerCommissionAmount || 0), 0);
                                                const affiliateLink = window.location.origin + '?partner=' + partner.id;

                                                return (
                                                    <div key={partner.id} className="p-4 rounded-2xl border border-gray-150 bg-gray-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-brand-200 transition-all text-left">
                                                        <div className="space-y-1.5 flex-1 w-full text-left">
                                                            <div className="flex items-center gap-2 justify-between md:justify-start">
                                                                <span className="font-bold text-gray-800 text-lg">{partner.name}</span>
                                                                <span className="bg-brand-50 text-brand-655 font-black text-xs py-1 px-2.5 rounded-lg border border-brand-100">
                                                                    Split: {partner.commissionPercent}%
                                                                </span>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-2 max-w-sm">
                                                                <div className="bg-white p-2.5 rounded-xl border border-gray-200 text-left">
                                                                    <div className="text-[10px] uppercase font-bold text-gray-400">{language === 'th' ? 'ยอดขายแนะนำสำเร็จ' : 'Total Orders Value'}</div>
                                                                    <div className="text-base font-black text-gray-800">฿{totalReferredSales.toLocaleString()} ({partnerOrders.length} ออเดอร์)</div>
                                                                </div>
                                                                <div className="bg-white p-2.5 rounded-xl border border-gray-200 text-left">
                                                                    <div className="text-[10px] uppercase font-bold text-amber-500">{language === 'th' ? 'ส่วนแบ่งคอมมิชชั่นสะสม' : 'Earned Commission'}</div>
                                                                    <div className="text-base font-black text-amber-600">฿{commissionAmountPaid.toLocaleString()}</div>
                                                                </div>
                                                            </div>
                                                            <div className="mt-2 flex items-center gap-1 bg-white p-2 rounded-xl border border-gray-250 w-full overflow-hidden">
                                                                <code className="text-[11px] font-mono text-gray-500 flex-1 truncate select-all">{affiliateLink}</code>
                                                                <button 
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(affiliateLink);
                                                                        alert(language === 'th' ? 'คัดลอกลิงก์ผู้แนะนำแล้ว!' : 'Referral URL copied to clipboard!');
                                                                    }}
                                                                    className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 cursor-pointer shrink-0"
                                                                >
                                                                    Copy
                                                                </button>
                                                            </div>
                                                        </div>

                                                        {/* QR Code and Actions */}
                                                        <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-gray-200 w-full md:w-auto shrink-0 md:min-w-[140px] text-center">
                                                            <img 
                                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(affiliateLink)}`} 
                                                                alt="Partner QR" 
                                                                className="w-24 h-24 p-1 mix-blend-multiply border border-gray-150 rounded" 
                                                            />
                                                            <button 
                                                                onClick={() => {
                                                                    const pWindow = window.open('', '_blank');
                                                                    if (pWindow) {
                                                                        pWindow.document.write(`
                                                                            <html>
                                                                                <head>
                                                                                    <title>Print QR for ${partner.name}</title>
                                                                                    <style>
                                                                                        body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #fff; }
                                                                                        .card { border: 4px solid #db2777; border-radius: 24px; padding: 40px; text-align: center; max-width: 400px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
                                                                                        h1 { font-size: 24px; color: #111827; margin-bottom: 8px; }
                                                                                        p { font-size: 14px; color: #4b5563; margin-bottom: 24px; }
                                                                                        img { width: 250px; height: 250px; margin-bottom: 24px; }
                                                                                        .footer { font-size: 12px; color: #9ca3af; font-weight: bold; text-transform: uppercase; }
                                                                                    </style>
                                                                                </head>
                                                                                <body>
                                                                                    <div class="card">
                                                                                        <h1>Scan & Order Here!</h1>
                                                                                        <p>Welcome! Our menu is sponsored by ${partner.name}. Select food and complete payment instantly.</p>
                                                                                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(affiliateLink)}" />
                                                                                        <div class="footer">Referral Code: ${partner.name}</div>
                                                                                    </div>
                                                                                    <script>window.onload=function(){setTimeout(function(){window.print();},500);}</script>
                                                                                </body>
                                                                            </html>
                                                                        `);
                                                                        pWindow.document.close();
                                                                    }
                                                                }}
                                                                className="mt-2 text-[10px] font-bold text-brand-600 hover:underline flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <Printer size={12}/> {language === 'th' ? 'พิมพ์ป้ายคิวอาร์' : 'Print QR Sign'}
                                                            </button>
                                                            <button 
                                                                onClick={() => {
                                                                    if (confirm(language === 'th' ? `ลบพันธมิตร "${partner.name}" หรือไม่?` : `Remove partner "${partner.name}"?`)) {
                                                                        deletePartner(partner.id);
                                                                    }
                                                                }}
                                                                className="mt-2 text-[10px] font-bold text-red-500 hover:underline cursor-pointer"
                                                            >
                                                                {language === 'th' ? 'ลบบัญชีพันธมิตร' : 'Delete Partner'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'promos' && (
                    <div className="flex-1 bg-gray-100 p-6 overflow-y-auto pb-24 lg:pb-6 font-sans">
                        <div className="max-w-6xl mx-auto space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-200 pb-4 mb-4 gap-4">
                                <div>
                                    <h2 className="text-2xl font-black text-gray-800 flex items-center gap-2">
                                        <Ticket className="text-brand-600 animate-pulse" size={28}/>
                                        {language === 'th' ? 'จัดการคูปอง & รหัสส่วนลด' : 'Promo & Coupon Management'}
                                    </h2>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {language === 'th' ? 'สร้างและกำหนดเงื่อนไขส่วนลดสำหรับลูกค้า สั่งออนไลน์' : 'Create and configure custom discount codes for online customer orders.'}
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                {/* Create New Promo Code Form */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 h-fit lg:col-span-1">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2">
                                        <Plus size={20} className="text-green-500"/>
                                        {language === 'th' ? 'เพิ่มรหัสส่วนลดใหม่' : 'Create New Promo'}
                                    </h3>
                                    <form onSubmit={handleAddPromoCodeSubmit} className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                                {language === 'th' ? 'รหัสส่วนลด (พิมพ์ใหญ่เท่านั้น)' : 'Promo Code (Uppercase)'}
                                            </label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. BOI3, BOI50"
                                                value={newPromoCode}
                                                onChange={(e) => setNewPromoCode(e.target.value.toUpperCase())}
                                                className="w-full text-sm font-mono font-bold border border-gray-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-brand-500 uppercase"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                                {language === 'th' ? 'ประเภทส่วนลด' : 'Discount Type'}
                                            </label>
                                            <select
                                                value={newPromoType}
                                                onChange={(e: any) => setNewPromoType(e.target.value)}
                                                className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-brand-500"
                                            >
                                                <option value="percentage">{language === 'th' ? 'ลดเป็นเปอร์เซ็นต์ (%)' : 'Percentage (%)'}</option>
                                                <option value="fixed_order">{language === 'th' ? 'ลดราคาอาหารตรงๆ (บาท)' : 'Fixed Order discount (THB)'}</option>
                                                <option value="fixed_delivery">{language === 'th' ? 'ส่วนลดค่าจัดส่ง (บาท)' : 'Fixed Delivery discount (THB)'}</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                                {language === 'th' ? 'มูลค่าส่วนลด' : 'Discount Value'}
                                            </label>
                                            <input
                                                type="number"
                                                required
                                                min="1"
                                                placeholder={newPromoType === 'percentage' ? 'e.g., 3' : 'e.g., 50'}
                                                value={newPromoValue || ''}
                                                onChange={(e) => setNewPromoValue(Number(e.target.value))}
                                                className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-brand-500"
                                            />
                                            <p className="text-[10px] text-gray-400 mt-1">
                                                {newPromoType === 'percentage' 
                                                    ? (language === 'th' ? 'เช่น ใส่ 3 เพื่อลด 3%' : 'E.g., enter 3 for 3% discount')
                                                    : (language === 'th' ? 'เช่น ใส่ 50 เพื่อลด 50 บาท' : 'E.g., enter 50 for 50 THB discount')
                                                }
                                            </p>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                                {language === 'th' ? 'ยอดสั่งซื้อขั้นต่ำ (บาท)' : 'Min Order Amount (THB)'}
                                            </label>
                                            <input
                                                type="number"
                                                required
                                                min="0"
                                                placeholder="e.g., 500"
                                                value={newPromoMinOrder === 0 ? '' : newPromoMinOrder}
                                                onChange={(e) => setNewPromoMinOrder(Number(e.target.value))}
                                                className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-brand-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                                {language === 'th' ? 'จำกัดสิทธิ์ต่อวัน (0 = ไม่จำกัด)' : 'Max Uses Per Day (0 = Unlimited)'}
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                placeholder="e.g., 10"
                                                value={newPromoMaxUses === 0 ? '' : newPromoMaxUses}
                                                onChange={(e) => setNewPromoMaxUses(Number(e.target.value))}
                                                className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-brand-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                                {language === 'th' ? 'คำอธิบาย (ภาษาไทย - ไม่บังคับ)' : 'Description (Thai - Optional)'}
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g., ส่วนลด 3% เมื่อยอดสั่งเกิน 500 บาท"
                                                value={newPromoDescTh}
                                                onChange={(e) => setNewPromoDescTh(e.target.value)}
                                                className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-brand-500"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                                {language === 'th' ? 'คำอธิบาย (English - ไม่บังคับ)' : 'Description (English - Optional)'}
                                            </label>
                                            <input
                                                type="text"
                                                placeholder="e.g., 3% discount on orders above 500 THB"
                                                value={newPromoDescEn}
                                                onChange={(e) => setNewPromoDescEn(e.target.value)}
                                                className="w-full text-sm border border-gray-200 rounded-xl px-3.5 py-2.5 outline-none focus:border-brand-500"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-500/10 transition active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                                        >
                                            <Plus size={18}/>
                                            {language === 'th' ? 'เพิ่มคูปองส่วนลด' : 'Add Promo Code'}
                                        </button>
                                    </form>
                                </div>

                                {/* List of Existing Promo Codes */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 lg:col-span-2">
                                    <h3 className="text-lg font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">
                                        {language === 'th' ? 'รหัสส่วนลดปัจจุบัน' : 'Active Promo Codes'}
                                    </h3>
                                    {(!promoCodes || promoCodes.length === 0) ? (
                                        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                                            <Ticket size={48} className="mb-2 opacity-30 animate-bounce"/>
                                            <p>{language === 'th' ? 'ยังไม่มีคูปองส่วนลด' : 'No promo codes configured yet.'}</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {promoCodes.map((promo) => {
                                                const discountFormatted = promo.discountType === 'percentage' 
                                                    ? `${promo.discountValue}%` 
                                                    : `${promo.discountValue} THB`;
                                                    
                                                const typeFormatted = promo.discountType === 'percentage'
                                                    ? (language === 'th' ? 'ลดเป็นเปอร์เซ็นต์ (%)' : 'Percentage (%)')
                                                    : promo.discountType === 'fixed_order'
                                                    ? (language === 'th' ? 'ลดราคาอาหาร (บาท)' : 'Fixed Order (THB)')
                                                    : (language === 'th' ? 'ลดค่าส่ง (บาท)' : 'Delivery (THB)');
                                                    
                                                return (
                                                    <div key={promo.id} className={`p-4 rounded-xl border transition ${promo.isActive ? 'bg-white border-gray-200 hover:shadow-md' : 'bg-gray-50 border-gray-200 opacity-60'}`}>
                                                        <div className="flex justify-between items-start mb-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-base font-mono font-black tracking-wider bg-gray-900 text-white px-2.5 py-1 rounded-lg">
                                                                    {promo.code}
                                                                </span>
                                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${promo.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                                    {promo.isActive ? (language === 'th' ? 'เปิดใช้งาน' : 'Active') : (language === 'th' ? 'ปิดอยู่' : 'Inactive')}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={async () => {
                                                                        const updated = { ...promo, isActive: !promo.isActive };
                                                                        await updatePromoCode(updated);
                                                                    }}
                                                                    className={`p-1.5 rounded-lg border transition ${promo.isActive ? 'bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100' : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'}`}
                                                                    title={promo.isActive ? (language === 'th' ? 'ปิดการใช้งาน' : 'Deactivate') : (language === 'th' ? 'เปิดการใช้งาน' : 'Activate')}
                                                                >
                                                                    {promo.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        if (confirm(language === 'th' ? `ลบรหัสส่วนลด "${promo.code}" หรือไม่?` : `Delete promo code "${promo.code}"?`)) {
                                                                            deletePromoCode(promo.id);
                                                                        }
                                                                    }}
                                                                    className="p-1.5 text-red-500 border border-red-100 bg-red-50 rounded-lg hover:bg-red-100 transition cursor-pointer"
                                                                >
                                                                    <Trash2 size={16}/>
                                                                </button>
                                                            </div>
                                                        </div>

                                                        <div className="space-y-1 mt-3">
                                                            <p className="text-xs font-bold text-gray-800">
                                                                {language === 'th' ? promo.descriptionTh : promo.description}
                                                            </p>
                                                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-50 text-[10px] text-gray-500">
                                                                <div>
                                                                    <span className="block text-[8px] uppercase font-bold text-gray-400">{language === 'th' ? 'ประเภท' : 'Type'}</span>
                                                                    <span className="font-bold">{typeFormatted}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="block text-[8px] uppercase font-bold text-gray-400">{language === 'th' ? 'ส่วนลด' : 'Discount'}</span>
                                                                    <span className="font-bold text-brand-600">{discountFormatted}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="block text-[8px] uppercase font-bold text-gray-400">{language === 'th' ? 'ขั้นต่ำ' : 'Min Order'}</span>
                                                                    <span className="font-bold">฿{promo.minOrderAmount}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="block text-[8px] uppercase font-bold text-gray-400">{language === 'th' ? 'จำกัด/วัน' : 'Daily Limit'}</span>
                                                                    <span className="font-bold text-blue-600">
                                                                        {(promo.maxUsesPerDay && promo.maxUsesPerDay > 0) ? `${promo.lastUseDate === new Date().toISOString().split('T')[0] ? promo.currentUses || 0 : 0}/${promo.maxUsesPerDay}` : (language === 'th' ? 'ไม่จำกัด' : 'Unlimited')}
                                                                    </span>
                                                                </div>
                                                                <div className="col-span-2">
                                                                    <span className="block text-[8px] uppercase font-bold text-gray-400">{language === 'th' ? 'สร้างเมื่อ' : 'Created At'}</span>
                                                                    <span className="font-semibold font-mono">{new Date(promo.createdAt).toLocaleDateString()}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'manage' && (
                    <div className="flex-1 bg-gray-100 p-6 overflow-y-auto pb-24 lg:pb-6">
                        <div className="max-w-4xl mx-auto space-y-6 text-left">
                            <h2 className="text-2xl font-bold flex items-center gap-2 text-gray-800"><Settings className="text-brand-600"/> Store Settings & Management</h2>
                            
                            {/* Manager Quick Navigation Hub for Mobile */}
                            <div className="lg:hidden bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
                                <h3 className="font-extrabold text-sm text-gray-700 flex items-center gap-2 border-b border-gray-100 pb-2">
                                    <span>🛠️</span> {language === 'th' ? 'แผงควบคุมเมนูลัดผู้จัดการ' : 'Manager Quick Controls'}
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    <button 
                                        onClick={() => { playClickSound(); setActiveTab('sales'); }}
                                        className="py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-100 text-amber-800 transition text-center cursor-pointer font-bold animate-pulse"
                                    >
                                        <PieChart size={18} className="text-amber-600" />
                                        <span className="text-[11px] font-black">{language === 'th' ? 'รายงานขาย & บันทึกรายจ่าย' : 'Reports & Expenses'}</span>
                                    </button>
                                    <button 
                                        onClick={() => { playClickSound(); setActiveTab('promos'); }}
                                        className="py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-800 transition text-center cursor-pointer font-bold"
                                    >
                                        <Tag size={18} className="text-indigo-600" />
                                        <span className="text-[11px] font-black">{language === 'th' ? 'โปรโมชั่น & ส่วนลด' : 'Promotions'}</span>
                                    </button>
                                    <button 
                                        onClick={() => { playClickSound(); setActiveTab('qr_gen'); }}
                                        className="py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-800 transition text-center cursor-pointer font-bold"
                                    >
                                        <QrCode size={18} className="text-emerald-600" />
                                        <span className="text-[11px] font-black">{language === 'th' ? 'สร้างคิวอาร์ (QR)' : 'QR Generator'}</span>
                                    </button>
                                    <button 
                                        onClick={() => { playClickSound(); setActiveTab('partners'); }}
                                        className="py-3 px-2 rounded-xl flex flex-col items-center justify-center gap-1 bg-blue-50 hover:bg-blue-100 border border-blue-100 text-blue-800 transition text-center cursor-pointer font-bold"
                                    >
                                        <Store size={18} className="text-blue-600" />
                                        <span className="text-[11px] font-black">{language === 'th' ? 'ระบบพาร์ทเนอร์ร้านค้า' : 'Partners Ecosystem'}</span>
                                    </button>
                                </div>
                            </div>
                            
                            {/* Registered Customers List (รายชื่อสมาชิกที่ลงทะเบียน) */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-4 mb-4 gap-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                                            <User size={20} className="text-brand-500" />
                                            {language === 'th' ? 'รายชื่อลูกค้าที่สมัครสมาชิก' : 'Registered Customers'}
                                            <span className="bg-brand-100 text-brand-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full">
                                                {registeredCustomers.length}
                                            </span>
                                        </h3>
                                        <p className="text-xs text-gray-400 mt-1">
                                            {language === 'th' ? 'แสดงข้อมูลลูกค้าทั้งหมดที่ลงทะเบียนสมัครใช้งานบนเว็บไซต์' : 'Displays all customer accounts registered on the website'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <button 
                                            onClick={async () => {
                                                setLoadingCustomers(true);
                                                try {
                                                    const data = await getAllCustomers();
                                                    setRegisteredCustomers(data || []);
                                                } catch(e) {
                                                    console.error(e);
                                                } finally {
                                                    setLoadingCustomers(false);
                                                }
                                            }}
                                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 p-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                                            title={language === 'th' ? 'รีเฟรชข้อมูล' : 'Refresh List'}
                                        >
                                            <RefreshCw size={14} className={loadingCustomers ? "animate-spin" : ""} />
                                        </button>
                                        <button
                                            onClick={handleExportCustomers}
                                            className="bg-brand-50 hover:bg-brand-100 text-brand-600 px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                                        >
                                            <FileSpreadsheet size={14} />
                                            {language === 'th' ? 'ส่งออกข้อมูล (Export)' : 'Export CSV'}
                                        </button>
                                    </div>
                                </div>

                                {/* Customer Search Filter */}
                                <div className="mb-4 relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                        <Search size={16} />
                                    </div>
                                    <input 
                                        type="text"
                                        placeholder={language === 'th' ? 'ค้นหาจาก ชื่อ หรือ เบอร์โทรศัพท์...' : 'Search by Name or Phone number...'}
                                        className="w-full pl-10 pr-4 py-2 border-2 border-gray-100 rounded-xl font-bold text-gray-800 outline-none focus:border-brand-500 transition text-sm"
                                        value={customerSearchTerm}
                                        onChange={(e) => setCustomerSearchTerm(e.target.value)}
                                    />
                                </div>

                                {/* Customer List Container */}
                                {loadingCustomers ? (
                                    <div className="flex flex-col items-center justify-center p-8 text-gray-400 font-sans">
                                        <RefreshCw size={32} className="animate-spin text-brand-500 mb-2" />
                                        <p className="text-sm font-bold">{language === 'th' ? 'กำลังโหลดข้อมูล...' : 'Loading customers...'}</p>
                                    </div>
                                ) : (
                                    (() => {
                                        const trimmedTerm = customerSearchTerm.trim().toLowerCase();
                                        const filtered = registeredCustomers.filter(c => 
                                            !trimmedTerm ||
                                            (c.name && c.name.toLowerCase().includes(trimmedTerm)) ||
                                            (c.phone && c.phone.toLowerCase().includes(trimmedTerm)) ||
                                            (c.address && c.address.toLowerCase().includes(trimmedTerm))
                                        );

                                        if (filtered.length === 0) {
                                            return (
                                                <div className="flex flex-col items-center justify-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                                    <User size={40} className="text-gray-300 mb-2" />
                                                    <p className="text-sm font-bold text-gray-500">
                                                        {customerSearchTerm ? (language === 'th' ? 'ไม่พบข้อมูลที่ค้นหา' : 'No customers match search') : (language === 'th' ? 'ยังไม่มีข้อมูลลูกค้าลงทะเบียน' : 'No registered customers found')}
                                                    </p>
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="overflow-x-auto rounded-xl border border-gray-105">
                                                <table className="w-full text-left border-collapse font-sans text-xs">
                                                    <thead>
                                                        <tr className="bg-gray-50 text-gray-500 border-b border-gray-150 font-bold uppercase">
                                                            <th className="p-3">{language === 'th' ? 'ชื่อลูกค้า / ระดับ' : 'Customer Name / Tier'}</th>
                                                            <th className="p-3">{language === 'th' ? 'เบอร์โทรศัพท์' : 'Phone Number'}</th>
                                                            <th className="p-3">{language === 'th' ? 'แต้มสะสม' : 'Loyalty Points'}</th>
                                                            <th className="p-3">{language === 'th' ? 'คูปอง' : 'Coupons'}</th>
                                                            <th className="p-3">{language === 'th' ? 'ที่อยู่จัดส่งเริ่มต้น' : 'Default Address'}</th>
                                                            <th className="p-3">{language === 'th' ? 'วันเกิด' : 'Birthday'}</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-gray-100 text-gray-700">
                                                        {filtered.map((cust, idx) => (
                                                            <tr key={cust.phone || idx} onClick={() => setProfileCustomer(cust)} className="hover:bg-brand-50/40 transition cursor-pointer">
                                                                <td className="p-3 whitespace-nowrap">
                                                                    <div className="flex items-center gap-2">
                                                                        <div className="w-8 h-8 rounded-full bg-brand-50 text-brand-700 flex items-center justify-center font-bold">
                                                                            {cust.name ? cust.name.charAt(0).toUpperCase() : 'C'}
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-extrabold text-sm text-gray-900 block">{cust.name || 'Anonymous'}</span>
                                                                            {cust.tier && (
                                                                                <span className={`inline-flex items-center gap-0.5 text-[9px] font-extrabold px-1.5 py-0.25 rounded ${
                                                                                    cust.tier === 'Gold' ? 'bg-amber-100 text-amber-800' :
                                                                                    cust.tier === 'Silver' ? 'bg-slate-100 text-slate-800' :
                                                                                    'bg-orange-50 text-orange-700'
                                                                                }`}>
                                                                                    <Star size={8} fill="currentColor" /> {cust.tier}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="p-3 font-extrabold text-gray-800 whitespace-nowrap">
                                                                    <div className="flex items-center gap-1">
                                                                        <Phone size={11} className="text-gray-400 shrink-0" />
                                                                        <span>{cust.phone}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="p-3 font-extrabold text-brand-600 whitespace-nowrap text-left text-sm">
                                                                    {cust.loyaltyPoints || 0} {language === 'th' ? 'แต้ม' : 'pts'}
                                                                </td>
                                                                <td className="p-3 whitespace-nowrap">
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); setSelectedCouponCustomer(cust); }}
                                                                        className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold px-2 py-1 rounded border border-amber-200 transition cursor-pointer"
                                                                    >
                                                                        <Gift size={12}/>
                                                                        <span>{cust.coupons ? cust.coupons.filter((c: any) => !c.isUsed).length : 0} {language === 'th' ? 'ใบ' : 'active'}</span>
                                                                    </button>
                                                                </td>
                                                                <td className="p-3 max-w-[220px]">
                                                                    <p className="line-clamp-2 text-[11px] font-medium text-gray-500 leading-tight" title={cust.address}>
                                                                        {cust.address || '-'}
                                                                    </p>
                                                                </td>
                                                                <td className="p-3 whitespace-nowrap text-gray-500 font-medium">
                                                                    {cust.birthday ? (
                                                                        <div className="flex items-center gap-1">
                                                                            <Calendar size={11} className="text-gray-400 shrink-0" />
                                                                            <span>{cust.birthday}</span>
                                                                        </div>
                                                                    ) : '-'}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        );
                                    })()
                                )}
                            </div>

                            {/* Catering Gallery & Banner Settings */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                <h3 className="font-bold text-lg text-gray-800 mb-2 border-b border-gray-100 pb-2 flex items-center gap-2">
                                    <ImageIcon size={20} className="text-brand-500"/>
                                    {language === 'th' ? 'แกลเลอรี่ภาพงานกิจกรรม & แบนเนอร์ (Catering & Promo Media)' : 'Catering Events Gallery & Banner'}
                                </h3>
                                <p className="text-xs text-gray-400 mb-6">
                                    {language === 'th' 
                                        ? 'ตั้งค่ารูปภาพกิจกรรมจัดเลี้ยง (Catering & Private Events) และรูปป้ายโปรโมชั่นต้อนรับของร้าน ภาพทั้งหมดจะถูกบีบอัดรักษาพื้นที่หน่วยความจำอัตโนมัติ' 
                                        : 'Manage pictures shown in the Catering & Private Events section and the shop welcoming banner.'}
                                </p>

                                <div className="space-y-6 animate-fade-in">
                                    {/* Promotional Banner */}
                                    <div className="bg-gray-55 p-4 rounded-xl border border-gray-100">
                                        <h4 className="font-bold text-sm text-gray-700 mb-3 block">
                                            📢 {language === 'th' ? 'รูปแบนเนอร์โปรโมชั่นร้าน (Promo Banner)' : 'Store Welcome Banner'}
                                        </h4>
                                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                                            {mediaForm.promoBannerUrl ? (
                                                <img src={mediaForm.promoBannerUrl} className="w-full md:w-48 h-24 object-cover rounded-lg border border-gray-200 shadow-sm shrink-0" referrerPolicy="no-referrer" />
                                            ) : (
                                                <div className="w-full md:w-48 h-24 bg-gray-205 rounded-lg flex items-center justify-center font-bold text-xs text-gray-405 shrink-0">
                                                    {language === 'th' ? 'ไม่มีแบนเนอร์' : 'No Banner'}
                                                </div>
                                            )}
                                            <div className="flex-1 space-y-2">
                                                <p className="text-xs text-gray-500 font-medium">
                                                    {language === 'th' 
                                                        ? 'แบนเนอร์ขนาดใหญ่สำหรับแสดงเป็นป้ายต้อนรับด้านบนสุดของหน้าฝั่งลูกค้า' 
                                                        : 'Displayed highlighting your shop on customer mobile browsers.'}
                                                </p>
                                                <label className="inline-flex items-center gap-1.5 bg-white border border-gray-300 hover:border-brand-500 text-gray-700 hover:text-brand-600 px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition cursor-pointer">
                                                    <Upload size={14} />
                                                    {language === 'th' ? 'เปลี่ยนภาพแบนเนอร์' : 'Change Banner'}
                                                    <input type="file" accept="image/*" onChange={handleBannerUpload} className="hidden" />
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Event Gallery */}
                                    <div>
                                        <h4 className="font-bold text-sm text-gray-700 mb-3 block">
                                            📸 {language === 'th' ? 'รูปกิจกรรมต่าง ๆ & งานจัดเลี้ยง (Catering & Events Gallery)' : 'Catering & Event Photos'}
                                        </h4>
                                        <p className="text-xs text-gray-400 mb-4 leading-relaxed font-semibold">
                                            {language === 'th' 
                                                ? 'รูปภาพที่จะแสดงในส่วน "Catering & Private Events" ด้านล่างหน้าลูกค้าของคุณ แนะนำให้ลงรูปงานจัดเลี้ยง เทศกาล หรือบรรยากาศหน้าร้านสวยๆ' 
                                                : 'Images displayed under the "Catering & Private Events" section of your customer catalog page.'}
                                        </p>

                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                            {/* List current photos */}
                                            {(mediaForm.eventGalleryUrls || []).map((img, idx) => (
                                                <div key={idx} className="relative aspect-video rounded-xl overflow-hidden border border-gray-200 group bg-gray-100">
                                                    <img src={img} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            const filtered = (mediaForm.eventGalleryUrls || []).filter((_, i) => i !== idx);
                                                            setMediaForm(prev => ({ ...prev, eventGalleryUrls: filtered }));
                                                        }}
                                                        className="absolute top-1.5 right-1.5 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-lg shadow transition transform hover:scale-105"
                                                        title={language === 'th' ? 'ลบรูปภาพนี้' : 'Delete this photo'}
                                                    >
                                                        <Trash2 size={12} />
                                                    </button>
                                                </div>
                                            ))}

                                            {/* Dotted Upload trigger */}
                                            <label className="border-2 border-dashed border-gray-300 hover:border-brand-500 text-gray-400 hover:text-brand-600 hover:bg-brand-50/20 rounded-xl transition cursor-pointer flex flex-col items-center justify-center p-4 aspect-video group">
                                                <Upload size={20} className="mb-1 text-gray-400 group-hover:scale-110 transition" />
                                                <span className="text-[10px] font-extrabold">{language === 'th' ? 'อัปโหลดภาพกิจกรรม' : 'Add Event Photo'}</span>
                                                <input type="file" accept="image/*" onChange={handleEventImageUpload} className="hidden" />
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 pt-4 border-t border-gray-100 flex justify-end">
                                    <button 
                                        type="button"
                                        onClick={handleSaveMediaSettings} 
                                        className="w-full lg:w-auto bg-brand-600 hover:bg-brand-700 text-white font-extrabold py-2.5 px-6 rounded-xl shadow transition"
                                    >
                                        💾 {language === 'th' ? 'บันทึกแกลเลอรี่และแบนเนอร์' : 'Save Gallery & Banner'}
                                    </button>
                                </div>
                            </div>

                            {/* Contact Info Settings */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                <h3 className="font-bold text-lg text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2"><Phone size={20} className="text-brand-500"/> Connect & Links (Footer)</h3>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                     <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase">Contact Phone</label>
                                        <input type="text" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 mt-1 font-bold text-gray-700 focus:border-brand-500 outline-none" value={contactForm.contactPhone} onChange={e => setContactForm({...contactForm, contactPhone: e.target.value})} />
                                     </div>
                                     <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase">PromptPay Number</label>
                                        <input type="text" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 mt-1 font-bold text-gray-700 focus:border-brand-500 outline-none" value={contactForm.promptPayNumber} onChange={e => setContactForm({...contactForm, promptPayNumber: e.target.value})} />
                                     </div>
                                     <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase">Facebook URL</label>
                                        <input type="text" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 mt-1 font-bold text-gray-700 focus:border-brand-500 outline-none" value={contactForm.facebookUrl} onChange={e => setContactForm({...contactForm, facebookUrl: e.target.value})} />
                                     </div>
                                     <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase">Line URL</label>
                                        <input type="text" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 mt-1 font-bold text-gray-700 focus:border-brand-500 outline-none" value={contactForm.lineUrl} onChange={e => setContactForm({...contactForm, lineUrl: e.target.value})} />
                                     </div>
                                </div>
                                <button onClick={() => { updateStoreSettings(contactForm); alert("Contact Settings Saved!"); }} className="mt-4 bg-gray-800 text-white font-bold py-2 px-6 rounded-xl hover:bg-gray-900 shadow transition w-full lg:w-auto">Save Contact Settings</button>
                            </div>

                            {/* Delivery Settings */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                <h3 className="font-bold text-lg text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2"><MapPin size={20} className="text-brand-500"/> Delivery & Location Settings</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                     <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase">Store GPS Location (Lat,Lng)</label>
                                        <input type="text" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 mt-1 font-bold text-gray-700 focus:border-brand-500 outline-none" value={deliveryForm.storeLocationGps} onChange={e => setDeliveryForm({...deliveryForm, storeLocationGps: e.target.value})} placeholder="e.g. 13.9239103,100.5220632" />
                                     </div>
                                     <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase">Free Delivery Radius (KM)</label>
                                        <input type="number" step="0.1" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 mt-1 font-bold text-gray-700 focus:border-brand-500 outline-none" value={deliveryForm.freeDeliveryRadiusKm} onChange={e => setDeliveryForm({...deliveryForm, freeDeliveryRadiusKm: Number(e.target.value)})} />
                                     </div>
                                     <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase">Delivery Fee Per KM (฿)</label>
                                        <input type="number" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 mt-1 font-bold text-gray-700 focus:border-brand-500 outline-none" value={deliveryForm.deliveryFeePerKm} onChange={e => setDeliveryForm({...deliveryForm, deliveryFeePerKm: Number(e.target.value)})} />
                                     </div>
                                     <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase">Base Delivery Fee (฿)</label>
                                        <input type="number" className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 mt-1 font-bold text-gray-700 focus:border-brand-500 outline-none" value={deliveryForm.baseDeliveryFee} onChange={e => setDeliveryForm({...deliveryForm, baseDeliveryFee: Number(e.target.value)})} />
                                     </div>
                                </div>
                                <button onClick={async () => { 
                                    let resolvedGps = deliveryForm.storeLocationGps;
                                    if (resolvedGps.includes('maps.app.goo.gl') || resolvedGps.includes('goo.gl/maps')) {
                                        try {
                                            const res = await fetch('/api/resolve-link', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ url: resolvedGps })
                                            });
                                            const data = await res.json();
                                            if (data && data.targetUrl) {
                                                resolvedGps = data.targetUrl;
                                            }
                                        } catch (e) {
                                            console.error(e);
                                        }
                                    }
                                    // Parse to exact lat/lng string if it's a URL
                                    const coords = parseAnyMapLink(resolvedGps);
                                    if (coords) {
                                        resolvedGps = `${coords.lat},${coords.lng}`;
                                        setDeliveryForm({...deliveryForm, storeLocationGps: resolvedGps});
                                    }
                                    
                                    await updateStoreSettings({...deliveryForm, storeLocationGps: resolvedGps}); 
                                    alert("Delivery Settings Saved!"); 
                                }} className="mt-4 bg-gray-800 text-white font-bold py-2 px-6 rounded-xl hover:bg-gray-900 shadow transition w-full lg:w-auto">Save Delivery Settings</button>
                            </div>

                            {/* Lalamove Connection Settings */}
                            <LalamoveSettingsCard />

                            {/* Store Operating Status & Holiday Settings */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6">
                                <h3 className="font-bold text-lg text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2">
                                    <Clock size={20} className="text-brand-500"/>
                                    {language === 'th' ? 'ตั้งค่าการเปิด-ปิดร้าน & วันหยุด (Store Operating & Holiday Settings)' : 'Store Operating & Holiday Settings'}
                                </h3>
                                <div className="space-y-4">
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div>
                                              <label className="text-xs font-bold text-gray-500 uppercase">{language === 'th' ? 'สถานะเปิด-ปิดร้านปกติ (Store Status)' : 'Store Status'}</label>
                                              <select 
                                                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 mt-1 font-bold text-gray-700 focus:border-brand-500 outline-none" 
                                                  value={storeStatusForm.isOpen ? "open" : "closed"} 
                                                  onChange={e => setStoreStatusForm({...storeStatusForm, isOpen: e.target.value === "open"})}
                                              >
                                                  <option value="open">🟢 {language === 'th' ? 'เปิดให้บริการปกติ' : 'Open (Accept orders)'}</option>
                                                  <option value="closed">🔴 {language === 'th' ? 'ปิดให้บริการชั่วคราว / นอกเวลา' : 'Closed (Disable ASAP orders)'}</option>
                                              </select>
                                          </div>
                                          <div>
                                              <label className="text-xs font-bold text-gray-500 uppercase">{language === 'th' ? 'ข้อความเมื่อปิดร้าน (Custom Closed Message)' : 'Custom Closed Message'}</label>
                                              <input 
                                                  type="text" 
                                                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 mt-1 font-bold text-gray-700 focus:border-brand-500 outline-none" 
                                                  value={storeStatusForm.closedMessage} 
                                                  onChange={e => setStoreStatusForm({...storeStatusForm, closedMessage: e.target.value})} 
                                                  placeholder={language === 'th' ? 'เช่น ปิดเตาชั่วคราวเพื่อเติมวัตถุดิบ จะเปิดให้บริการอีกครั้งพรุ่งนี้ค่ะ' : 'e.g. Temporarily closed for kitchen restocking. Reopening tomorrow!'} 
                                              />
                                          </div>
                                     </div>

                                     <div className="border-t border-dashed border-gray-100 pt-4">
                                          <h4 className="font-extrabold text-sm text-gray-700 mb-3">{language === 'th' ? '🏖️ กำหนดช่วงวันหยุดร้าน (Store Holiday dates)' : '🏖️ Set Store Holiday dates'}</h4>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                               <div>
                                                   <label className="text-xs font-bold text-gray-500 uppercase">{language === 'th' ? 'วันเริ่มต้นหยุด (Holiday Start Date)' : 'Holiday Start Date'}</label>
                                                   <input 
                                                       type="date" 
                                                       className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 mt-1 font-bold text-gray-700 focus:border-brand-500 outline-none" 
                                                       value={storeStatusForm.holidayStart} 
                                                       onChange={e => setStoreStatusForm({...storeStatusForm, holidayStart: e.target.value})} 
                                                   />
                                               </div>
                                               <div>
                                                   <label className="text-xs font-bold text-gray-500 uppercase">{language === 'th' ? 'วันสิ้นสุดหยุด (Holiday End Date)' : 'Holiday End Date'}</label>
                                                   <input 
                                                       type="date" 
                                                       className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 mt-1 font-bold text-gray-700 focus:border-brand-500 outline-none" 
                                                       value={storeStatusForm.holidayEnd} 
                                                       onChange={e => setStoreStatusForm({...storeStatusForm, holidayEnd: e.target.value})} 
                                                   />
                                               </div>
                                          </div>
                                          <p className="text-[10px] text-gray-400 mt-2 font-semibold">
                                               * {language === 'th' ? 'หากกำหนดช่วงวันหยุดร้าน ระบบจะปิดรับออเดอร์ด่วน (ASAP) และขึ้นแจ้งแบนเนอร์วันหยุดให้กับลูกค้าโดยอัตโนมัติในช่วงวันที่ดังกล่าว' : 'During these dates, the store will automatically display a Holiday banner to customers and disable immediate (ASAP) orders.'}
                                          </p>
                                     </div>
                                </div>
                                <button 
                                    onClick={async () => { 
                                        await updateStoreSettings(storeStatusForm); 
                                        alert(language === 'th' ? "บันทึกการตั้งค่าร้านสำเร็จ!" : "Store Status Settings Saved!"); 
                                    }} 
                                    className="mt-4 bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-6 rounded-xl shadow transition w-full lg:w-auto"
                                >
                                    {language === 'th' ? 'บันทึกการเปิด-ปิดร้าน & วันหยุด' : 'Save Status & Holidays'}
                                </button>
                            </div>

                            {/* Manage Toppings Card (จัดการส่วนผสมและท็อปปิ้ง) */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-gray-100 pb-4 mb-4 gap-4">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2 font-sans">
                                            <Sparkles size={20} className="text-brand-500" />
                                            {language === 'th' ? 'จัดการท็อปปิ้งและส่วนผสมเพิ่มเติม' : 'Manage Toppings & Ingredients'}
                                            <span className="bg-brand-100 text-brand-800 text-xs font-extrabold px-2.5 py-0.5 rounded-full font-mono">
                                                {toppings.length}
                                            </span>
                                        </h3>
                                        <p className="text-xs text-gray-400 mt-1 font-sans">
                                            {language === 'th' ? 'เพิ่ม แก้ไข ลบ หรือตั้งค่าการเปิด/ปิดท็อปปิ้งในระบบ' : 'Add, edit, remove or toggle topping availability'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => handleOpenToppingModal()}
                                        className="bg-green-500 hover:bg-green-600 text-white px-4 py-2.5 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-bold shadow-sm font-sans"
                                    >
                                        <Plus size={14} />
                                        {language === 'th' ? 'เพิ่มท็อปปิ้งใหม่' : 'Add New Topping'}
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin">
                                    {toppings.map(t => {
                                        const localizedName = language === 'th' && t.nameTh ? t.nameTh : t.name;
                                        return (
                                            <div key={t.id} className={`p-3 rounded-xl border flex items-center justify-between gap-3 bg-gray-50/50 hover:bg-gray-100 transition font-sans ${!t.available ? 'opacity-60 border-red-200 bg-red-50/10' : 'border-gray-200'}`}>
                                                <div className="flex items-center gap-3 min-w-0">
                                                    {t.image ? (
                                                        <img src={convertGoogleDriveUrl(t.image)} alt={t.name} className="w-10 h-10 rounded-lg object-cover bg-gray-200 border border-gray-150" referrerPolicy="no-referrer" />
                                                    ) : (
                                                        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-bold font-mono">🍕</div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="font-extrabold text-xs text-gray-801 leading-tight truncate">{localizedName}</p>
                                                        <div className="flex items-center gap-1.5 mt-1 font-mono text-[10px] text-gray-500 font-bold">
                                                            <span>฿{t.price}</span>
                                                            <span className="text-gray-300">•</span>
                                                            <span className="uppercase text-[9px] bg-gray-200 px-1 rounded text-gray-650 shrink-0">{t.category || 'other'}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    {/* Toggle Stock */}
                                                    <button 
                                                        onClick={() => updateTopping({ ...t, available: !t.available })}
                                                        className={`p-1.5 rounded-lg shadow-sm border transition cursor-pointer ${t.available ? 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200' : 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'}`}
                                                        title={t.available ? (language === 'th' ? 'มีของอยู่ (คลิกเพื่อปิด)' : 'In Stock') : (language === 'th' ? 'หมด (คลิกเพื่อเปิด)' : 'Out of Stock')}
                                                    >
                                                        <Power size={11} />
                                                    </button>
                                                    {/* Edit */}
                                                    <button 
                                                        onClick={() => handleOpenToppingModal(t)}
                                                        className="bg-blue-50 hover:bg-blue-100 text-blue-700 p-1.5 rounded-lg border border-blue-200 transition cursor-pointer"
                                                        title="Edit"
                                                    >
                                                        <Edit2 size={11} />
                                                    </button>
                                                    {/* Delete */}
                                                    <button 
                                                        onClick={async () => {
                                                            if (confirm(language === 'th' ? `คุณแน่ใจหรือไม่ที่จะลบท็อปปิ้ง "${localizedName}" จากระบบ?` : `Are you sure you want to delete topping "${localizedName}"?`)) {
                                                                await deleteTopping(t.id);
                                                            }
                                                        }}
                                                        className="bg-red-50 hover:bg-red-100 text-red-750 p-1.5 rounded-lg border border-red-200 transition text-red-700 cursor-pointer"
                                                        title="Delete"
                                                    >
                                                        <Trash2 size={11} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Printer Settings */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                <h3 className="font-bold text-lg text-gray-800 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2"><Printer size={20} className="text-brand-500"/> {language === 'th' ? 'ตั้งค่าความกว้างกระดาษเครื่องพิมพ์' : 'Printer & Paper Width Settings'}</h3>
                                <div className="space-y-4">
                                    <p className="text-sm text-gray-500">
                                        {language === 'th' ? 'เลือกความกว้างกระดาษเครื่องพิมพ์ความร้อนที่คุณใช้อยู่ เพื่อจัดสัดส่วนใบเสร็จให้สวยงาม ไม่ตกขอบกระดาษ' : 'Choose your physical thermal printer paper width so that receipt formats align perfectly without margins clipping.'}
                                    </p>

                                    {/* One-tap preset for the shop's Welltech G5 Bluetooth printer */}
                                    <div className="bg-emerald-50 border-2 border-emerald-300 rounded-xl p-4 space-y-2.5">
                                        <p className="font-bold text-sm text-emerald-900 flex items-center gap-1.5">
                                            ⚡ {language === 'th' ? 'ตั้งค่าด่วน: Welltech G5 (Bluetooth)' : 'Quick Setup: Welltech G5 (Bluetooth)'}
                                        </p>
                                        <p className="text-xs text-emerald-800 leading-relaxed">
                                            {language === 'th'
                                                ? 'กดปุ่มเดียว ระบบตั้งค่าให้ครบ: โหมด Bluetooth + ภาษาไทยแบบรูปภาพกราฟิก (ไทยถูกต้อง 100% ทุกเครื่อง ไม่มีตัวต่างดาว) + เปิดพิมพ์ใบเสร็จอัตโนมัติ — เลือกปุ่มตามหน้ากว้างกระดาษของเครื่อง เสร็จแล้วกด "ค้นหา & เชื่อมต่อเครื่องพิมพ์" ด้านล่างอีก 1 ครั้ง'
                                                : 'One tap applies every Welltech G5 setting: Bluetooth mode + Thai GRAPHIC mode (Thai renders perfectly on every printer) + auto-print. Pick your paper width, then tap "Search & Connect" below once.'}
                                        </p>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    setPrinterType('bluetooth');
                                                    setThaiCodePage('graphic-58');
                                                    setPaperSize('58mm');
                                                    setAutoPrintNewOrders(true);
                                                    alert(language === 'th' ? '✅ ตั้งค่า Welltech G5 (กระดาษ 58mm, ภาษาไทยโหมดรูปภาพ) เรียบร้อย!\n\nขั้นตอนสุดท้าย: เลื่อนลงไปกดปุ่ม "ค้นหา & เชื่อมต่อเครื่องพิมพ์" เลือก Printer001 หนึ่งครั้ง แล้วลองพิมพ์ใบทดสอบ — ภาษาไทยจะคมชัดไม่มีเพี้ยน' : '✅ Welltech G5 (58mm, Thai graphic mode) configured! Now tap "Search & Connect" below, pick Printer001, then print a test slip.');
                                                }}
                                                className="flex-1 bg-emerald-600 text-white font-bold py-2.5 px-3 rounded-lg text-sm hover:bg-emerald-700 active:scale-95 transition-all"
                                            >
                                                🖨️ G5 {language === 'th' ? 'กระดาษ 58mm' : 'paper 58mm'}
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setPrinterType('bluetooth');
                                                    setThaiCodePage('graphic-80');
                                                    setPaperSize('80mm');
                                                    setAutoPrintNewOrders(true);
                                                    alert(language === 'th' ? '✅ ตั้งค่า Welltech G5 (กระดาษ 80mm, ภาษาไทยโหมดรูปภาพ) เรียบร้อย!\n\nขั้นตอนสุดท้าย: เลื่อนลงไปกดปุ่ม "ค้นหา & เชื่อมต่อเครื่องพิมพ์" เลือก Printer001 หนึ่งครั้ง แล้วลองพิมพ์ใบทดสอบ — ภาษาไทยจะคมชัดไม่มีเพี้ยน' : '✅ Welltech G5 (80mm, Thai graphic mode) configured! Now tap "Search & Connect" below, pick Printer001, then print a test slip.');
                                                }}
                                                className="flex-1 bg-emerald-500 text-white font-bold py-2.5 px-3 rounded-lg text-sm hover:bg-emerald-600 active:scale-95 transition-all"
                                            >
                                                🖨️ G5 {language === 'th' ? 'กระดาษ 80mm' : 'paper 80mm'}
                                            </button>
                                        </div>
                                        <p className="text-[11px] text-emerald-700 leading-relaxed">
                                            {language === 'th'
                                                ? '* ไม่แน่ใจขนาดกระดาษ: G5 รุ่นพกพาส่วนใหญ่ใช้ 58mm — ถ้าพิมพ์แล้วใบเสร็จผิดสัดส่วน กดอีกปุ่มแทนได้เลย (โหมดรูปภาพพิมพ์ช้ากว่าโหมดข้อความเล็กน้อย แต่ภาษาไทยถูกต้องแน่นอน)'
                                                : '* Not sure about paper width? Most portable G5s use 58mm — if the layout looks wrong just tap the other button. (Graphic mode prints slightly slower than text mode but Thai is always correct.)'}
                                        </p>
                                    </div>

                                    {/* Multi-Tablet Setup & Alien Characters Troubleshooting Guide */}
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2 leading-relaxed font-sans text-left">
                                        <p className="font-bold text-sm flex items-center gap-1.5 text-amber-950">
                                            💡 {language === 'th' ? 'คู่มือแก้พิมพ์ต่างต่างดาว / ตั้งค่าแท็บเล็ตเครื่องอื่น' : 'Thai Character and Multi-Tablet Setup Guide'}
                                        </p>
                                        <p className="font-medium text-amber-800">
                                            {language === 'th' 
                                                ? 'เนื่องจากบลูทูธและเบราว์เซอร์จะเชื่อมโยงแยกกันเฉพาะเครื่อง หากเปลี่ยนไปเปิดบนแท็บเล็ตเครื่องใหม่ หรือ iPad แล้วเจอปัญหากดไม่ติด หรือปริ้นออกมาเป็นภาษาต่างดาว ให้ทำตามขั้นตอนดังนี้บนเครื่องนั้นๆ:' 
                                                : 'Because browser Bluetooth authorization is bound locally, physical tablets/iPads require separate configuration on first login. If they print alien symbols or do not connect, follow these fast checks on that tablet:'}
                                        </p>
                                        <ol className="list-decimal pl-4.5 space-y-1.5 text-amber-800/90 font-medium">
                                            <li>
                                                {language === 'th' 
                                                    ? 'เปลี่ยนหัวข้อ "วิธีการสั่งพิมพ์ (Printing Mode)" ด้านล่างนี้ ให้ตรงตามที่ใช้ (เช่น Bluetooth หรือ Wi-Fi)' 
                                                    : 'Amend the "Printing Mode" configuration below to match either "Bluetooth" or "Wi-Fi".'}
                                            </li>
                                            <li>
                                                {language === 'th' 
                                                    ? 'หากใช้ Bluetooth: ต้องกดปุ่มสีน้ำเงิน "ค้นหา & เชื่อมต่อเครื่องพิมพ์" บนหน้าจอนี้ผ่านแท็บเล็ตเครื่องใหม่นั้นๆ 1 ครั้งซ้ำ เพื่อลงทะเบียนจับคู่กับเครื่องปริ้นเตอร์' 
                                                    : 'If on Bluetooth: Click "Connect Printer" once directly from this new tablet to verify permissions and pair with your physical hardware.'}
                                            </li>
                                            <li>
                                                {language === 'th' 
                                                    ? 'หากพิมพ์ภาษาไทยเพี้ยน/สระซ้อน: เลือกหัวข้อ "การตั้งค่ารหัสภาษาไทย" เป็น "Code Page 26" (สำหรับ Welltech G5 / Xprinter) หรือ แนะนำเลือก "โหมดรูปภาพกราฟิก (Graphic-58 หรือ Graphic-80)" ซึ่งจะส่งข้อมูลเป็นรูปภาพ คมชัด ปริ้นภาษาไทยได้ 100% บนทุกเครื่องพิมพ์' 
                                                    : 'If characters are scrambled: Select "Code Page 26" (Welltech G5 / Xprinter) or switch to "Graphic-58 or Graphic-80 (Graphic Mode)" which converts print texts into pixel graphics, delivering 100% perfect Thai layout compatibility anywhere.'}
                                            </li>
                                        </ol>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 font-sans">
                                        <button 
                                            key="btn-58"
                                            onClick={() => setPaperSize('58mm')} 
                                            className={`py-4 px-4 rounded-xl font-bold flex flex-col items-center justify-center border-2 transition cursor-pointer ${paperSize === '58mm' ? 'border-brand-600 bg-brand-50 text-brand-600 shadow' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'}`}
                                        >
                                            <span className="text-lg">58 mm</span>
                                            <span className="text-xs font-normal opacity-75 mt-1">{language === 'th' ? 'เครื่องขนาดเล็ก / พกพา' : 'Small / Portable Thermal'}</span>
                                        </button>
                                        <button 
                                            key="btn-80"
                                            onClick={() => setPaperSize('80mm')} 
                                            className={`py-4 px-4 rounded-xl font-bold flex flex-col items-center justify-center border-2 transition cursor-pointer ${paperSize === '80mm' ? 'border-brand-600 bg-brand-50 text-brand-600 shadow' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'}`}
                                        >
                                            <span className="text-lg">80 mm</span>
                                            <span className="text-xs font-normal opacity-75 mt-1">{language === 'th' ? 'เครื่องตั้งโต๊ะมาตรฐาน' : 'Standard Desktop Thermal'}</span>
                                        </button>
                                    </div>

                                    {/* Advanced Customizations for Receipt Layout */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-gray-150">
                                        <div>
                                            <label className="text-xs font-bold text-gray-600 block mb-1.5 flex items-center gap-1">
                                                <span>🔎 {language === 'th' ? 'ขนาดอักษรใบเสร็จ (Font Size):' : 'Receipt Font Size:'}</span>
                                                <span className="font-extrabold text-brand-600">{receiptFontSize}px</span>
                                            </label>
                                            <div className="grid grid-cols-5 gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
                                                {[10, 11, 12, 14, 16].map((sz) => (
                                                    <button
                                                        type="button"
                                                        key={`fs-${sz}`}
                                                        onClick={() => setReceiptFontSize(sz)}
                                                        className={`py-1 text-xs font-bold rounded-lg transition cursor-pointer ${receiptFontSize === sz ? 'bg-white text-brand-600 shadow border border-gray-200' : 'text-gray-500 hover:text-gray-800'}`}
                                                    >
                                                        {sz}px
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-600 block mb-1.5 flex items-center gap-1">
                                                <span>📐 {language === 'th' ? 'ระยะขอบข้างใบเสร็จ (Margin):' : 'Receipt Margins:'}</span>
                                                <span className="font-extrabold text-brand-600">{receiptPadding}mm</span>
                                            </label>
                                            <div className="grid grid-cols-5 gap-1 bg-gray-50 p-1 rounded-xl border border-gray-200">
                                                {[0, 1, 2, 4, 6].map((pd) => (
                                                    <button
                                                        type="button"
                                                        key={`pad-${pd}`}
                                                        onClick={() => setReceiptPadding(pd)}
                                                        className={`py-1 text-xs font-bold rounded-lg transition cursor-pointer ${receiptPadding === pd ? 'bg-white text-brand-600 shadow border border-gray-200' : 'text-gray-500 hover:text-gray-800'}`}
                                                    >
                                                        {pd}mm
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center text-sm gap-4">
                                        <div className="flex flex-col gap-3 w-full">
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={() => setAutoPrintNewOrders(!autoPrintNewOrders)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer leading-tight transition shrink-0 ${autoPrintNewOrders ? 'bg-amber-100/80 text-amber-800 border border-amber-300' : 'bg-gray-100 text-gray-500 border border-gray-300 hover:bg-gray-200'}`}
                                                >
                                                    {autoPrintNewOrders ? 'AUTOPRINT: ON' : 'AUTOPRINT: OFF'}
                                                </button>
                                                <span className="text-xs text-gray-400 font-bold block max-w-xl">{language === 'th' ? 'สั่งพิมพ์บิลใบเสร็จและใบจัดส่งทันทีเมื่อได้รับออเดอร์หรือชำระเงิน' : 'Prints bills, delivery receipts, and tickets instantly.'}</span>
                                            </div>
                                            <div className="flex items-center gap-3 border-t border-gray-50 pt-2">
                                                <button 
                                                    onClick={() => setVatEnabled(!vatEnabled)}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-black cursor-pointer leading-tight transition shrink-0 ${vatEnabled ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 ring-2 ring-emerald-50' : 'bg-gray-100 text-gray-500 border border-gray-300 hover:bg-gray-200'}`}
                                                >
                                                    {vatEnabled ? (language === 'th' ? 'ภาษีมูลค่าเพิ่ม (VAT 7%): ON' : 'VAT 7% DISPLAY: ON') : (language === 'th' ? 'ภาษีมูลค่าเพิ่ม (VAT 7%): OFF' : 'VAT 7% DISPLAY: OFF')}
                                                </button>
                                                <span className="text-xs text-gray-400 font-bold block max-w-xl">
                                                    {language === 'th' 
                                                        ? 'เปิด/ปิดการคำนวณและแสดงแจกแจงภาษีมูลค่าเพิ่ม 7% (รวมในราคาสินค้าแล้ว ไม่บวกเพิ่มจากราคาหน้า POS) บนใบเสร็จ' 
                                                        : 'Toggle display of 7% Value Added Tax calculated from existing prices (VAT inclusive, no extra charges added on top) on printed bills.'}
                                                </span>
                                            </div>
                                        </div>
                                        <button onClick={() => { window.print(); }} className="text-brand-600 font-bold hover:underline py-1.5 px-4 bg-brand-50 hover:bg-brand-100 rounded-xl transition self-end md:self-center shrink-0">{language === 'th' ? '🖨️ ทดสอบสั่งพิมพ์' : '🖨️ Try Printing Test'}</button>
                                    </div>
                                    
                                    <div className="mt-6 pt-6 border-t border-gray-150 space-y-4">
                                        <h4 className="font-extrabold text-sm text-gray-800 flex items-center gap-1.5 uppercase">
                                            📶 {language === 'th' ? 'ตั้งค่าการเชื่อมต่อเครื่องพิมพ์ Wi-Fi / IP Printer' : 'Wi-Fi / IP Printer Connection Setup'}
                                        </h4>
                                        <p className="text-xs text-gray-400">
                                            {language === 'th' 
                                                ? 'กำหนดหมายเลขไอพีเครื่องพิมพ์ที่แชร์บนวงเครือข่าย Wi-Fi ท้องถิ่นของคุณ เพื่อความสะดวกและยืดหยุ่นในการสับเปลี่ยนเครือข่ายในอนาคต' 
                                                : 'Define the physical printer IP address on your local network/Wi-Fi to ensure rapid access and seamless future printer swaps.'}
                                        </p>
                                        
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">
                                                    {language === 'th' ? 'หมายเลข IP เครื่องพิมพ์ (Printer IP Address)' : 'Printer IP Address'}
                                                </label>
                                                <div className="relative">
                                                    <input 
                                                        type="text" 
                                                        value={printerIpAddress} 
                                                        onChange={(e) => setPrinterIpAddress(e.target.value)}
                                                        placeholder="เช่น 192.168.1.255"
                                                        className="w-full pl-9 pr-3 py-2 border-2 border-gray-200 rounded-xl font-mono font-bold text-gray-800 focus:border-brand-500 outline-none transition"
                                                    />
                                                    <span className="absolute left-3 top-2.5 text-gray-400 text-xs font-black">IP:</span>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">
                                                    {language === 'th' ? 'พอร์ตเชื่อมต่อ (Connection Port)' : 'Connection Port'}
                                                </label>
                                                <input 
                                                    type="number" 
                                                    value={printerPort} 
                                                    onChange={(e) => setPrinterPort(Number(e.target.value))}
                                                    placeholder="9100"
                                                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl font-mono font-bold text-gray-800 focus:border-brand-500 outline-none transition"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-gray-500 block mb-1">
                                                    {language === 'th' ? 'วิธีการสั่งพิมพ์ (Printing Mode)' : 'Printing Mode'}
                                                </label>
                                                <select
                                                    value={printerType}
                                                    onChange={(e) => setPrinterType(e.target.value as any)}
                                                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl font-bold text-gray-800 bg-white focus:border-brand-500 outline-none transition"
                                                >
                                                    <option value="system">🖥️ {language === 'th' ? 'System Print (แนะนำเสถียรที่สุด)' : 'System Print (Recommended)'}</option>
                                                    <option value="bluetooth">🔵 {language === 'th' ? 'Bluetooth Direct Printer001 (สำหรับเครื่อง Welltech G5)' : 'Bluetooth Direct Printer001 (Welltech G5)'}</option>
                                                    <option value="rawbt">📱 {language === 'th' ? 'RawBT App / Android WiFi' : 'RawBT Companion App (Android)'}</option>
                                                    <option value="local_proxy">🔌 {language === 'th' ? 'Direct Local Network Proxy' : 'Local Network Proxy/Bridge'}</option>
                                                </select>
                                            </div>

                                            <div className="flex items-end">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        alert(language === 'th' 
                                                            ? `💾 บันทึกค่าการเชื่อมต่อเครื่องพิมพ์ ${printerIpAddress}:${printerPort} (โหมด: ${printerType}) เรียบร้อยแล้ว!` 
                                                            : `💾 Wi-Fi Printer configuration saved! Target: ${printerIpAddress}:${printerPort}`);
                                                    }}
                                                    className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-2 px-4 rounded-xl shadow transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 text-xs h-10"
                                                >
                                                    💾 {language === 'th' ? 'บันทึกการตั้งค่าเครื่องปริ้นเตอร์' : 'Save Printer Preferences'}
                                                </button>
                                            </div>
                                        </div>

                                        {printerType === 'bluetooth' && (
                                            <div className="p-4 rounded-2xl bg-brand-50/50 border border-brand-200 space-y-3 animate-fade-in text-left">
                                                <div className="flex justify-between items-center">
                                                    <div className="flex items-center gap-1.5 font-bold text-brand-900 text-sm">
                                                        <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
                                                        <span>{language === 'th' ? 'สเตตัสการเชื่อมต่อบลูทูธ (Bluetooth Printer001)' : 'Bluetooth Thermal Printer Status'}</span>
                                                    </div>
                                                    <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase ${
                                                        btStatus === 'connected' ? 'bg-emerald-100 text-emerald-800' :
                                                        btStatus === 'connecting' ? 'bg-amber-100 text-amber-800 animate-pulse' :
                                                        'bg-gray-200 text-gray-700'
                                                    }`}>
                                                        {btStatus}
                                                    </span>
                                                </div>

                                                <div className="text-xs text-gray-500 font-sans leading-relaxed">
                                                    {language === 'th' 
                                                        ? 'กดเชื่อมต่อบลูทูธด้านล่างเพื่อจับคู่โปรแกรมหน้าเว็บ POS กับเครื่องพิมพ์ Welltech G5 (Printer001) ของคุณโดยตรง' 
                                                        : 'Pair your browser environment directly with your Welltech G5 (Printer001) thermal printer below.'}
                                                </div>

                                                {btDevice && (
                                                    <div className="text-xs font-mono bg-white p-3 rounded-xl border border-brand-100 space-y-1 animate-fade-in">
                                                        <div>🔧 <strong>Device Name:</strong> {btDevice.name || 'Printer001'}</div>
                                                        <div>📶 <strong>ID:</strong> {btDevice.id || 'N/A'}</div>
                                                        <div>🔋 <strong>GATT Server:</strong> Connected</div>
                                                    </div>
                                                )}

                                                {/* Dynamic Thai Encoding / Code Page Sector Selection */}
                                                <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm space-y-2 text-left mb-3">
                                                    <label className="text-xs font-bold text-gray-700 block flex items-center gap-1">
                                                        🔤 {language === 'th' ? 'การตั้งค่ารหัสภาษาไทย (Thai Print Mode)' : 'Thai Print Mode'}
                                                    </label>
                                                    <select
                                                        value={thaiCodePage.startsWith('custom-') ? 'custom' : thaiCodePage}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            if (val === 'custom') {
                                                                setThaiCodePage(`custom-${customCP}`);
                                                            } else {
                                                                setThaiCodePage(val);
                                                            }
                                                        }}
                                                        className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 bg-white focus:border-brand-500 outline-none transition cursor-pointer"
                                                    >
                                                        <optgroup label="🌟 โหมดข้อความธรรมดา (แนะนำมากสุด 👍 พิมพ์เร็ว ประหยัดกระดาษ)">
                                                            <option value="tis620-26">Code Page 26 (แนะนำพิเศษสำหรับ Welltech G5 / Xprinter ✅)</option>
                                                            <option value="tis620-18">Code Page 18 (สำหรับเครื่องพิมพ์ CP874 / Epson 💾)</option>
                                                            <option value="utf8-epson">UTF-8 Mode (สำหรับเครื่องพิมพ์ภาษาสากล 💾)</option>
                                                        </optgroup>
                                                        <optgroup label="🖼️ โหมดรูปภาพกราฟิก (กรณีภาษาไทยมีสระลอย / สลับที่)">
                                                            <option value="graphic-58">🖼️ รูปภาพขนาด 58 มม. (พิมพ์แบบส่งข้อมูลรูป)</option>
                                                            <option value="graphic-80">🖼️ รูปภาพขนาด 80 มม. (พิมพ์แบบส่งข้อมูลรูป)</option>
                                                        </optgroup>
                                                        <optgroup label="⚙️ ตัวเลือกขั้นสูง">
                                                            <option value="custom">{language === 'th' ? 'ระบุรหัสด้วยตัวเอง...' : 'Specify Custom Code Page...'}</option>
                                                        </optgroup>
                                                    </select>

                                                    {/* Custom Code Page Input */}
                                                    {(thaiCodePage.startsWith('custom-') || thaiCodePage === 'custom') && (
                                                        <div className="flex gap-1.5 items-center bg-gray-50 p-2 rounded-lg border border-gray-200 mt-1 animate-fade-in">
                                                            <span className="text-[10px] font-bold text-gray-500">ESC t [Number]:</span>
                                                            <input
                                                                type="number"
                                                                value={customCP}
                                                                min="0"
                                                                max="255"
                                                                onChange={(e) => {
                                                                    setCustomCP(e.target.value);
                                                                    setThaiCodePage(`custom-${e.target.value}`);
                                                                }}
                                                                className="w-16 px-1.5 py-0.5 border border-gray-300 rounded text-xs font-bold text-gray-800 focus:border-brand-500 outline-none"
                                                            />
                                                            <p className="text-[10px] text-gray-400">ระบุเลข 0-255 เพื่อทดสอบ</p>
                                                        </div>
                                                    )}

                                                    <p className="text-[10px] text-gray-400 leading-tight">
                                                        {language === 'th' 
                                                            ? '* เนื่องจากเครื่องพิมพ์ Welltech/Xprinter มีรุ่นย่อยเยอะมาก รหัสเริ่มต้นมักจะเป็น 26 หรือ 18 หรือเปลี่ยนมาใช้ "UTF-8" ด้านบนสุด หากภาษาไทยพิลึกแสดงว่ารหัสเครื่องไม่ตรง กรุณากดทดสอบแต่ละแบบด้านล่าง' 
                                                            : '* Welltech/Xprinter printers have many model variations. If Thai displays garbled, toggle between UTF-8 modes or TIS-620 code pages, then click Test Print.'}
                                                    </p>
                                                </div>

                                                <div className="flex flex-col gap-2 w-full">
                                                    {btStatus !== 'connected' ? (
                                                        <div className="flex gap-2 w-full">
                                                            <button 
                                                                type="button"
                                                                onClick={connectBluetoothPrinter}
                                                                className="flex-1 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-extrabold py-2.5 rounded-xl text-xs shadow-sm transition-all"
                                                            >
                                                                🔗 {btStatus === 'connecting' ? (language === 'th' ? 'กำลังเชื่อมต่อ...' : 'Connecting...') : (language === 'th' ? 'ค้นหา & เชื่อมต่อเครื่องพิมพ์' : 'Search & Connect')}
                                                            </button>
                                                            {btStatus === 'connecting' && (
                                                                <button 
                                                                    type="button"
                                                                    onClick={disconnectBluetoothPrinter}
                                                                    className="px-3 bg-red-100 hover:bg-red-200 text-red-700 font-extrabold py-2.5 rounded-xl text-xs transition-all"
                                                                >
                                                                    ❌ {language === 'th' ? 'ยกเลิก' : 'Cancel'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="grid grid-cols-3 gap-2 w-full">
                                                            <button 
                                                                type="button"
                                                                onClick={async () => {
                                                                    const testPayload = {
                                                                        storeName: "Pizza Damac Nonthaburi",
                                                                        address: `ทดสอบภาษาไทย: กขค ะาิีึืุู ่้๊๋็์ 🍕`,
                                                                        phone: "099-497-9199",
                                                                        queueNo: `TEST: ${thaiCodePage}`,
                                                                        date: new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }),
                                                                        items: [
                                                                            { name: "ทดสอบพิมพ์ไทย - มาร์เกริต้า", quantity: 1, totalPrice: 0 },
                                                                            { name: "ทดสอบพิมพ์สระจมลอย - หนึ่งสองสาม", quantity: 1, totalPrice: 0 }
                                                                        ],
                                                                        total: 0,
                                                                        paymentMethod: "BLUETOOTH FEED"
                                                                    };
                                                                    try {
                                                                        setReceiptData(testPayload);
                                                                        await triggerReceiptPrint(testPayload);
                                                                        if (printerType === 'bluetooth' && btCharacteristic) {
                                                                            alert("🎉 ส่งใบทดสอบสำเร็จกรุณาดูที่เครื่องพิมพ์!");
                                                                        }
                                                                    } catch (err: any) {
                                                                        alert("❌ ไม่สามารถพิมพ์ได้: " + err.message);
                                                                    }
                                                                }}
                                                                className="bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-extrabold py-2.5 rounded-xl text-[11px] hover:shadow transition-all text-center"
                                                            >
                                                                📝 {language === 'th' ? 'ทดสอบพิมพ์' : 'Test Print'}
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={async () => {
                                                                    playClickSound();
                                                                    await resetBluetoothConnection();
                                                                }}
                                                                className="bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-extrabold py-2.5 rounded-xl text-[11px] hover:shadow transition-all text-center"
                                                                title={language === 'th' ? 'เชื่อมต่อใหม่และล้างบัฟเฟอร์ค้าง' : 'Reset connection & reconnect'}
                                                            >
                                                                🔄 {language === 'th' ? 'รีเฟรชเชื่อมต่อ' : 'Refresh BT'}
                                                            </button>
                                                            <button 
                                                                type="button"
                                                                onClick={disconnectBluetoothPrinter}
                                                                className="bg-red-600 hover:bg-red-700 active:scale-95 text-white font-extrabold py-2.5 rounded-xl text-[11px] hover:shadow transition-all text-center"
                                                            >
                                                                ❌ {language === 'th' ? 'ตัดเชื่อมต่อ' : 'Disconnect'}
                                                            </button>
                                                        </div>
                                                    )}

                                                    {/* Quick Reset troubleshooting helper box */}
                                                    <div className="flex justify-between items-center text-[10.5px] text-gray-500 bg-gray-50 p-2 rounded-xl border border-dashed border-gray-200 mt-1">
                                                        <span>{language === 'th' ? 'หากเครื่องพิมพ์ค้างไม่ตอบสนองเลย:' : 'If printer is frozen/lagging:'}</span>
                                                        <button 
                                                            type="button" 
                                                            onClick={async () => {
                                                                playClickSound();
                                                                await resetBluetoothConnection();
                                                            }}
                                                            className="text-brand-600 hover:text-brand-800 font-bold underline transition"
                                                        >
                                                            {language === 'th' ? '🔄 รีเซ็ตการเชื่อมต่อทันที' : '🔄 Force Reset Connection'}
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Dynamic System Instructions Guide Box */}
                                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-xs text-amber-900 space-y-3.5">
                                            <h5 className="font-black text-amber-950 text-sm flex items-center gap-1.5">
                                                🖨️ {language === 'th' ? 'คู่มือตั้งค่าและเชื่อมต่อเครื่องพิมพ์ Welltech รุ่น Wi-Fi' : 'How to Setup Welltech Wi-Fi Printer'}
                                            </h5>
                                            
                                            {language === 'th' ? (
                                                <div className="space-y-3 text-[11.5px] leading-relaxed">
                                                    <p className="font-medium text-amber-900">
                                                        เครื่องพิมพ์ความร้อนแบรนด์ <strong className="font-extrabold text-[#d97706]">Welltech</strong> ใช้การเชื่อมต่อแบบมาตรฐาน ESC/POS ผ่านพอร์ต <strong className="font-extrabold text-blue-700">9100</strong> หากท่านยังเชื่อมต่อไม่ได้ กรุณาทำตาม 4 ขั้นตอนสำคัญนี้ครับ:
                                                    </p>
                                                    
                                                    <div className="space-y-2.5">
                                                        <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                                                            <strong className="text-amber-950 font-black block mb-1">ขั้นตอนที่ 1: ตรวจหาไอพีจริงของ Welltech (พิมพ์ใบทดสอบ Self-Test)</strong>
                                                            <p className="text-gray-650 text-[11px]">
                                                                หมายเลข <span className="font-bold underline text-red-600">192.168.1.255</span> เป็นเพียงไอพีบรอดแคสต์ (Broadcast Address) เครื่องจริงของท่านจะมีไอพีเฉพาะของมันเอง ให้หาวิธีพิมพ์ใบข้อมูลดังนี้:
                                                            </p>
                                                            <ol className="list-decimal list-inside mt-1.5 space-y-0.5 text-gray-700">
                                                                <li><span className="font-bold">ปิดสวิตช์เครื่องปริ้นเตอร์</span>ด้านหลังหรือด้านข้าง</li>
                                                                <li>ใช้มือกดปุ่ม <span className="font-bold bg-gray-100 px-1 rounded border">FEED</span> ค้างไว้ (ห้ามปล่อยมือ)</li>
                                                                <li><span className="font-bold">เปิดสวิตช์เปิดเครื่อง</span> ในขณะที่ยังกดปุ่ม FEED ค้างอยู่</li>
                                                                <li>ค้างไว้ 3 วินาทีจนเครื่องดังสั้นๆ หรือเริ่มดึงกระดาษ แล้วจึง<span className="font-bold text-brand-600">ปล่อยปุ่ม FEED</span></li>
                                                                <li>เครื่องพิมพ์จะพิมพ์กระดาษรายงานออกมาเป็นภาษาอังกฤษ ให้มองหาคำว่า <strong className="text-blue-700 font-mono">"IP Address: 192.168.1.xxx"</strong> (ตัวเลข 3 ตัวหลังจะไม่ใช่ 255 เช่น 192.168.1.100 หรือ 192.168.1.199)</li>
                                                            </ol>
                                                        </div>

                                                        <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                                                            <strong className="text-amber-950 font-black block mb-1">ขั้นตอนที่ 2: ตั้งค่าเชื่อมต่อ Wi-Fi ในอุปกรณ์</strong>
                                                            <p className="text-gray-650 text-[11px]">
                                                                อุปกรณ์ที่เปิดโปรแกรมนี้ (เช่น คอมพิวเตอร์ โทรศัพท์มือถือ แท็บเล็ต หรือ iPad ที่ใช้กดสั่งออเดอร์) <strong className="text-[#9a3412]">จะต้องเชื่อมต่อสัญญาณ Wi-Fi ตัวเดียวกันกับที่ต่อกับเครื่องพิมพ์ Welltech</strong> หากต่อคนละตัวกัน จะไม่สามารถพิมพ์สลิปและค้นหากันเจอได้ครับ
                                                            </p>
                                                        </div>

                                                        <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                                                            <strong className="text-amber-950 font-black block mb-1">ขั้นตอนที่ 3: กรอกไอพีและบันทึกค่าลงระบบ</strong>
                                                            <p className="text-gray-650 text-[11px]">
                                                                นำหมายเลข IP จริงที่ได้จากขั้นตอนที่ 1 (เช่น 192.168.1.199) มากอกลงในช่อง <strong className="text-brand-600">"หมายเลข IP เครื่องพิมพ์"</strong> ด้านข้างบนนี้ แล้วกด <span className="font-bold text-gray-800">"บันทึกการตั้งค่าเครื่องปริ้นเตอร์"</span>
                                                            </p>
                                                        </div>

                                                        <div className="bg-white p-3 rounded-xl border border-amber-100 shadow-sm">
                                                            <strong className="text-amber-950 font-black block mb-1">ขั้นตอนที่ 4: สั่งพิมพ์ออเดอร์ผ่านแอปคู่ใจตามระบบปฏิบัติการ</strong>
                                                            <ul className="list-disc list-inside mt-1 space-y-1 text-gray-750">
                                                                <li>
                                                                    <strong className="text-blue-700">ระบบแอนดรอยด์ (Android Phone/Tablet):</strong> แนะนำให้ใช้ <strong className="text-brand-600">RawBT Print Service</strong> บน Google Play Store ตั้งค่าในแอป RawBT ให้เชื่อมต่อแบบ "Network/WiFi" ใส่ IP ของเครื่อง Welltech แล้วลองสั่งพิมพ์ตามเมนูด้านบน จะดึงเข้าเครื่องปริ้นสดๆ ทันที
                                                                </li>
                                                                <li>
                                                                    <strong className="text-blue-700">ระบบวินโดวส์ (Windows PC):</strong> ไปที่ Devices and Printers → Add Printer → Add using TCP/IP address → กรอกไอพีของ Welltech แล้วเลือกไดรเวอร์ผู้ผลิต Welltech หรือเลือก "Generic / Text Only" จากนั้นกดสั่งพิมพ์ใบเสร็จในระบบได้ทันที
                                                                </li>
                                                                <li>
                                                                    <strong className="text-blue-700">ระบบ iOS (iPhone / iPad):</strong> แนะนำให้เชื่อมต่อผ่าน Wi-Fi เครือข่ายเดียวกัน และเลือกสั่งพิมพ์ผ่านแอปพลิเคชันที่รองรับมาตรฐาน ESC/POS ของ Welltech
                                                                </li>
                                                            </ul>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="space-y-3 text-[11.5px] leading-relaxed">
                                                    <p>
                                                        Welltech thermal printer uses ESC/POS connection on port 9100. Please ensure the printer and this device are on the same Wi-Fi subnet.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {selectedPizza && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:hidden">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-gray-800 animate-fade-in text-left">
                        <div className="bg-brand-600 px-6 py-4 flex items-center justify-between text-white sticky top-0 z-10">
                            <h3 className="font-extrabold text-lg flex items-center gap-2">
                                🍕 {editingCartItem ? (language === 'th' ? 'แก้ไขรายการอาหาร' : 'Edit Item') : (language === 'th' ? 'เลือกตัวเลือกเพิ่มเติม' : 'Customize Item')}
                            </h3>
                            <button onClick={() => { playClickSound(); setSelectedPizza(null); setSelectedToppings([]); setEditingCartItem(null); setSpecialInstructions(''); setQuantity(1); }} className="text-white/80 hover:text-white font-bold text-2xl leading-none">&times;</button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* Pizza Info Banner */}
                            <div className="flex gap-4 items-center bg-gray-50 p-4 rounded-xl border border-gray-150">
                                {selectedPizza.image && (
                                    <img src={selectedPizza.image} alt={selectedPizza.name} className="w-16 h-16 rounded-lg object-cover border border-gray-200" referrerPolicy="no-referrer" />
                                )}
                                <div>
                                    <h4 className="font-bold text-gray-900 text-sm">{language === 'th' ? selectedPizza.nameTh || selectedPizza.name : selectedPizza.name}</h4>
                                    <p className="text-xs text-brand-600 font-extrabold">฿{selectedPizza.basePrice} {language === 'th' ? '(ราคาเริ่มต้น)' : '(Base Price)'}</p>
                                </div>
                            </div>

                            {/* Promo Combo Builder (POS) */}
                            {selectedPizza.category === 'promotion' && (selectedPizza.comboCount || 0) > 0 && (
                                <div className="mb-6 bg-brand-50/50 p-5 rounded-2xl border border-brand-100 text-left">
                                    <h3 className="font-extrabold text-brand-900 mb-3 flex items-center gap-2">
                                        🎁 {language === 'th' ? 'เลือกรายการในเซ็ตโปรโมชั่น' : 'Select Combo Items'}
                                    </h3>
                                    
                                    {activeComboSlot === null ? (
                                        <div className="space-y-3">
                                            <p className="text-xs text-gray-500 font-bold mb-2">
                                                {language === 'th' ? `เลือกพิซซ่าทั้งหมด ${selectedPizza.comboCount} ถาดสำหรับชุดประหยัดนี้` : `Choose ${selectedPizza.comboCount} pizzas for this bundle`}
                                            </p>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                {Array.from({ length: selectedPizza.comboCount }).map((_, idx) => {
                                                    const sel = comboSelections[idx];
                                                    return (
                                                        <button
                                                            key={idx}
                                                            type="button"
                                                            onClick={() => handleComboSlotClick(idx)}
                                                            className={`w-full p-4 rounded-xl border-2 border-dashed flex items-center justify-between text-left transition duration-155 ${sel ? 'border-brand-500 bg-brand-50/80 hover:bg-brand-50' : 'border-gray-300 hover:border-brand-400 bg-white hover:bg-gray-55'}`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white bg-brand-600`}>
                                                                    {idx + 1}
                                                                </div>
                                                                <div>
                                                                    <span className={`font-extrabold text-sm block ${sel ? 'text-gray-901' : 'text-gray-400'}`}>
                                                                        {sel ? (language === 'th' ? sel.nameTh || sel.name : sel.name) : (language === 'th' ? 'คลิกเลือกพิซซ่า...' : 'Click to select...')}
                                                                    </span>
                                                                    {sel && (() => {
                                                                        const p = menu.find(m => m.id === sel.pizzaId);
                                                                        if (p && p.basePrice > 380) {
                                                                            return <span className="inline-block mt-0.5 text-[10px] bg-red-100 text-red-800 font-black px-1.5 py-0.25 rounded">+{p.basePrice - 380} ฿</span>;
                                                                        }
                                                                        return null;
                                                                    })()}
                                                                </div>
                                                            </div>
                                                            <ChevronRight size={18} className="text-gray-450" />
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <div className="flex justify-between items-center mb-4">
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveComboSlot(null)}
                                                    className="text-xs font-extrabold text-gray-500 hover:text-gray-900 flex items-center gap-1 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm"
                                                >
                                                    <ArrowLeft size={14} /> Back
                                                </button>
                                                <h4 className="font-extrabold text-sm text-gray-700 font-mono">
                                                    {language === 'th' ? `เลือกพิซซ่าถาดที่ #${activeComboSlot + 1}` : `Select Pizza for Slot #${activeComboSlot + 1}`}
                                                </h4>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-72 overflow-y-auto pr-2">
                                                {menu.filter(p => {
                                                    if (p.category !== 'pizza') return false;
                                                    if (p.id === 'custom_base' || p.id === 'p_half_half' || p.id === 'p_boat') return false;
                                                    if (!p.available) return false;
                                                    if ((p.comboCount || 0) > 0) return false;
                                                    if (p.allowedPromotions && p.allowedPromotions.length > 0) {
                                                        return p.allowedPromotions.includes(selectedPizza.id);
                                                    }
                                                    return true;
                                                }).map(pItem => (
                                                    <button
                                                        key={pItem.id}
                                                        type="button"
                                                        onClick={() => handleComboPizzaSelect(pItem)}
                                                        className="p-3 bg-white hover:bg-brand-50 border hover:border-brand-550 rounded-xl flex flex-col items-center text-center transition duration-150 relative overflow-hidden text-xs"
                                                    >
                                                        <img src={pItem.image || 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=400&q=80'} className="w-14 h-14 rounded-lg object-cover mb-2 border border-gray-100" referrerPolicy="no-referrer" />
                                                        <span className="font-extrabold text-[11px] text-gray-800 block line-clamp-1">{language === 'th' ? pItem.nameTh || pItem.name : pItem.name}</span>
                                                        <span className="text-[10px] text-gray-450 mt-1">฿{pItem.basePrice}</span>
                                                        {pItem.basePrice > 380 && (
                                                            <span className="absolute top-1 right-1 bg-orange-100 text-orange-850 text-[8px] font-black px-1.5 rounded">
                                                                +{pItem.basePrice - 380} ฿
                                                            </span>
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Half-Half Selector (POS) */}
                            {selectedPizza.id === 'p_half_half' && (
                                <div className="mb-6 bg-amber-50 p-4 rounded-xl border border-amber-200 text-left">
                                    <h3 className="font-bold text-amber-900 mb-3 flex items-center gap-2">🌓 {language === 'th' ? 'เลือกสองหน้าลูกครึ่ง (Half-Half)' : 'Select Two Halves'}</h3>
                                    <div className="space-y-4 font-bold text-gray-800 text-xs text-left">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 block mb-1 text-left">{language === 'th' ? 'ซีกแรก (Side A)' : 'Side A (First Half)'}</label>
                                            <select 
                                                className="w-full border border-gray-300 rounded-lg p-2.5 bg-white text-sm font-bold text-gray-800 outline-none"
                                                value={halfA?.id || ''}
                                                onChange={(e) => setHalfA(menu.find(p => p.id === e.target.value) || null)}
                                            >
                                                <option value="">{language === 'th' ? '-- เลือกซีกแรก A --' : '-- Choose Side A --'}</option>
                                                {menu.filter(p => p.category === 'pizza' && p.id !== 'custom_base' && p.id !== 'p_half_half' && p.available).map(pItem => (
                                                    <option key={pItem.id} value={pItem.id}>
                                                        {language === 'th' ? pItem.nameTh || pItem.name : pItem.name} (฿{pItem.basePrice})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 block mb-1 text-left">{language === 'th' ? 'ซีกสอง (Side B)' : 'Side B (Second Half)'}</label>
                                            <select 
                                                className="w-full border border-gray-300 rounded-lg p-2.5 bg-white text-sm font-bold text-gray-800 outline-none"
                                                value={halfB?.id || ''}
                                                onChange={(e) => setHalfB(menu.find(p => p.id === e.target.value) || null)}
                                            >
                                                <option value="">{language === 'th' ? '-- เลือกซีกสอง B --' : '-- Choose Side B --'}</option>
                                                {menu.filter(p => p.category === 'pizza' && p.id !== 'custom_base' && p.id !== 'p_half_half' && p.available).map(pItem => (
                                                    <option key={pItem.id} value={pItem.id}>
                                                        {language === 'th' ? pItem.nameTh || pItem.name : pItem.name} (฿{pItem.basePrice})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Pizza Boat Selector (POS) */}
                            {selectedPizza.id === 'p_boat' && (
                                <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-200 text-left">
                                    <h3 className="font-bold text-blue-900 mb-3 flex items-center gap-2">⛵ {language === 'th' ? 'แต่งหน้าพิซซ่าทรงเรือ 2 ชิ้น' : 'Customize Pizza Boat (2 Pieces)'}</h3>
                                    <div className="space-y-4 font-bold text-gray-850 text-xs text-left">
                                        
                                        <div className="bg-white p-3 rounded-lg border border-blue-100">
                                            <label className="text-xs font-bold text-gray-500 block mb-1 text-left">{language === 'th' ? 'ชิ้นที่ 1 (Side A)' : 'Side A (Piece 1)'}</label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <select 
                                                    className="w-full border border-gray-300 rounded-lg p-2 bg-white text-sm font-bold text-gray-850 outline-none"
                                                    value={boatA?.id || ''}
                                                    onChange={(e) => {
                                                        const found = menu.find(p => p.id === e.target.value);
                                                        setBoatA(found || null);
                                                        setBoatPriceA(found ? Math.round(found.basePrice / 2) : 0);
                                                    }}
                                                >
                                                    <option value="">{language === 'th' ? '-- เลือกรสชาติชิ้นที่ 1 --' : '-- Choose Side A --'}</option>
                                                    {menu.filter(p => p.category === 'pizza' && p.id !== 'custom_base' && p.id !== 'p_half_half' && p.id !== 'p_boat' && p.available).map(pItem => (
                                                        <option key={pItem.id} value={pItem.id}>
                                                            {language === 'th' ? pItem.nameTh || pItem.name : pItem.name} (฿{pItem.basePrice})
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="flex items-center border border-gray-300 bg-white rounded-lg overflow-hidden">
                                                    <span className="bg-gray-100 px-2.5 py-2 text-xs font-bold text-gray-500 border-r border-gray-300">฿</span>
                                                    <input 
                                                        type="number" 
                                                        placeholder={language === 'th' ? 'ราคาชิ้นแรก' : 'Price A'}
                                                        value={boatPriceA || ''} 
                                                        onChange={(e) => setBoatPriceA(Number(e.target.value))}
                                                        className="w-full px-2 py-2 text-sm font-extrabold outline-none bg-transparent"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white p-3 rounded-lg border border-blue-100">
                                            <label className="text-xs font-bold text-gray-500 block mb-1 text-left">{language === 'th' ? 'ชิ้นที่ 2 (Side B)' : 'Side B (Piece 2)'}</label>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <select 
                                                    className="w-full border border-gray-300 rounded-lg p-2 bg-white text-sm font-bold text-gray-850 outline-none"
                                                    value={boatB?.id || ''}
                                                    onChange={(e) => {
                                                        const found = menu.find(p => p.id === e.target.value);
                                                        setBoatB(found || null);
                                                        setBoatPriceB(found ? Math.round(found.basePrice / 2) : 0);
                                                    }}
                                                >
                                                    <option value="">{language === 'th' ? '-- เลือกรสชาติชิ้นที่ 2 --' : '-- Choose Side B --'}</option>
                                                    {menu.filter(p => p.category === 'pizza' && p.id !== 'custom_base' && p.id !== 'p_half_half' && p.id !== 'p_boat' && p.available).map(pItem => (
                                                        <option key={pItem.id} value={pItem.id}>
                                                            {language === 'th' ? pItem.nameTh || pItem.name : pItem.name} (฿{pItem.basePrice})
                                                        </option>
                                                    ))}
                                                </select>
                                                <div className="flex items-center border border-gray-300 bg-white rounded-lg overflow-hidden">
                                                    <span className="bg-gray-100 px-2.5 py-2 text-xs font-bold text-gray-500 border-r border-gray-300">฿</span>
                                                    <input 
                                                        type="number" 
                                                        placeholder={language === 'th' ? 'ราคาชิ้นที่สอง' : 'Price B'}
                                                        value={boatPriceB || ''} 
                                                        onChange={(e) => setBoatPriceB(Number(e.target.value))}
                                                        className="w-full px-2 py-2 text-sm font-extrabold outline-none bg-transparent"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            )}

                            {/* Toppings (Only for non-combo items) */}
                            {!(selectedPizza.category === 'promotion' && (selectedPizza.comboCount || 0) > 0) && (
                                <div className="mb-6 text-left">
                                    <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                                        <Layers size={18}/> 
                                        {language === 'th' ? 'เลือกส่วนประกอบเพิ่มเติม' : 'Extra Options'}
                                    </h3>
                                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                        {toppings.filter(t => t.available).map(t => {
                                            const isSelected = selectedToppings.some(st => st.id === t.id);
                                            return (
                                                <button key={t.id} onClick={() => toggleTopping(t)} className={`w-full flex items-center justify-between p-3 border rounded-xl transition ${isSelected ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-gray-350'}`}>
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${isSelected ? 'bg-brand-500 border-brand-500 text-white' : 'border-gray-300'}`}>
                                                            {isSelected && <Check size={14}/>}
                                                        </div>
                                                        <span className="font-bold text-sm text-gray-700">{language === 'en' ? t.name : (t.nameTh || t.name)}</span>
                                                    </div>
                                                    <span className="text-sm font-bold text-gray-500">+฿{t.price}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                            
                            {/* Note */}
                            <div className="mb-6 text-left">
                                <h3 className="font-bold text-gray-800 mb-2">{language === 'th' ? 'หมายเหตุพิเศษ' : 'Special Instructions'}</h3>
                                <input 
                                    type="text" 
                                    placeholder={language === 'th' ? 'เช่น ไม่ใส่หอมใหญ่, เผ็ดพิเศษ' : 'e.g., No onions, extra spicy'} 
                                    className="w-full border bg-white border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-brand-500 outline-none" 
                                    value={specialInstructions} 
                                    onChange={(e) => setSpecialInstructions(e.target.value)} 
                                />
                            </div>
                        </div>
                        
                        <div className="p-4 bg-gray-50 border-t flex items-center gap-4 shrink-0">
                            <div className="flex items-center bg-white rounded-xl border border-gray-200 p-1 shrink-0">
                                <button onClick={() => quantity > 1 && setQuantity(q => q - 1)} className="w-10 h-10 flex items-center justify-center text-gray-650 hover:bg-gray-100 rounded-lg transition"><Minus size={18}/></button>
                                <span className="w-12 text-center font-bold text-lg text-gray-800">{quantity}</span>
                                <button onClick={() => setQuantity(q => q + 1)} className="w-10 h-10 flex items-center justify-center text-gray-655 hover:bg-gray-100 rounded-lg transition"><Plus size={18}/></button>
                            </div>
                            <button 
                                onClick={(selectedPizza.category === 'promotion' && (selectedPizza.comboCount || 0) > 0) ? confirmAddComboToCart : confirmAddToCart} 
                                disabled={(selectedPizza.category === 'promotion' && (selectedPizza.comboCount || 0) > 0) ? comboSelections.filter(Boolean).length < selectedPizza.comboCount : false}
                                className="flex-1 bg-brand-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-brand-700 shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed">
                                {editingCartItem 
                                    ? (language === 'th' ? 'อัปเดตรายการ' : 'Update Order') 
                                    : (language === 'th' ? 'เพิ่มลงออเดอร์' : 'Add to Order')} • ฿{
                                    (((selectedPizza.id === 'p_half_half' 
                                        ? (halfA && halfB ? Math.round((halfA.basePrice/2)+(halfB.basePrice/2)+20) : 20) 
                                        : selectedPizza.id === 'p_boat'
                                        ? (Number(boatPriceA || 0) + Number(boatPriceB || 0))
                                        : selectedPizza.basePrice) 
                                    + (selectedPizza.category === 'promotion' ? comboSelections.reduce((sum, item) => {
                                        if (!item) return sum;
                                        const p = menu.find(m => m.id === item.pizzaId);
                                        if (p && p.basePrice > 380) {
                                            return sum + (p.basePrice - 380);
                                        }
                                        return sum;
                                    }, 0) : 0)
                                    + selectedToppings.reduce((s, t) => s + t.price, 0)) * quantity).toLocaleString()
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- MENU ITEM EDIT/ADD MODAL (showItemModal) --- */}
            {showItemModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:hidden">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden text-gray-800 animate-fade-in text-left">
                        <div className="bg-brand-600 px-6 py-4 flex items-center justify-between text-white sticky top-0 z-10 font-sans">
                            <h3 className="font-extrabold text-lg flex items-center gap-2">
                                🍔 {itemForm.id ? (language === 'th' ? 'แก้ไขรายละเอียดสินค้า' : 'Edit Menu Item') : (language === 'th' ? 'เพิ่มเมนูอาหารใหม่' : 'Add New Menu Item')}
                            </h3>
                            <button 
                                onClick={() => setShowItemModal(false)} 
                                className="text-white/80 hover:text-white font-bold text-2xl leading-none cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-6 flex-1 font-sans">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                
                                {/* Left Side: Image and Status */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">{language === 'th' ? 'รูปภาพสินค้า' : 'Product Image'}</label>
                                        <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-100 transition relative group h-48 overflow-hidden">
                                            {itemForm.image ? (
                                                <>
                                                    <img 
                                                        src={convertGoogleDriveUrl(itemForm.image)} 
                                                        alt="preview" 
                                                        className="absolute inset-0 w-full h-full object-cover" 
                                                        referrerPolicy="no-referrer"
                                                    />
                                                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                                        <label className="bg-white text-gray-800 px-3 py-1.5 rounded-lg text-xs font-bold shadow cursor-pointer hover:bg-gray-100 flex items-center gap-1">
                                                            <Upload size={12}/> {language === 'th' ? 'เปลี่ยนรูป' : 'Change'}
                                                            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                                        </label>
                                                        <button 
                                                            type="button"
                                                            onClick={() => setItemForm({ ...itemForm, image: '' })}
                                                            className="bg-red-650 bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow hover:bg-red-700 flex items-center gap-1 cursor-pointer"
                                                        >
                                                            <Trash2 size={12}/> {language === 'th' ? 'ลบรูป' : 'Delete'}
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-center text-center">
                                                    <Plus className="text-gray-400 mb-2" size={40} />
                                                    <p className="text-xs font-bold text-gray-500 mb-1">{language === 'th' ? 'ลากไฟล์รูปภาพ หรือคลิกเพื่ออัปโหลด' : 'Drag or click to upload'}</p>
                                                    <p className="text-[10px] text-gray-400">{language === 'th' ? 'แนะนำสัดส่วน 1:1, ขนาดไม่เกิน 5MB' : 'Recommended 1:1 aspect ratio'}</p>
                                                    <label className="mt-3 bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 px-4 py-2 rounded-xl text-xs font-black shadow-sm cursor-pointer transition">
                                                        {language === 'th' ? 'เลือกไฟล์รูปภาพ' : 'Select Image File'}
                                                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                        {/* Image URL text input */}
                                        <div className="mt-2 text-left">
                                            <input 
                                                type="text" 
                                                placeholder={language === 'th' ? 'หรือ วางลิงก์รูปภาพตรงนี้ (เช่น Google Drive, Web Link)' : 'Or paste direct image URL (e.g. Google Drive, Web Link)'}
                                                value={itemForm.image || ''} 
                                                onChange={e => setItemForm({ ...itemForm, image: e.target.value })} 
                                                className="w-full text-xs font-bold border border-gray-250 rounded-lg px-2.5 py-1.5 focus:border-brand-500 outline-none bg-white text-gray-800 font-mono shadow-sm"
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-150 space-y-3 text-left">
                                        <h4 className="font-extrabold text-xs text-gray-500 uppercase tracking-wider">{language === 'th' ? 'การตั้งค่าแท็กและสถานะ' : 'Badge & Status Settings'}</h4>
                                        
                                        <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                                            <span className="text-xs font-bold text-gray-700">{language === 'th' ? 'พร้อมขาย (มีของ)' : 'Available in Stock'}</span>
                                            <button 
                                                type="button"
                                                onClick={() => setItemForm({ ...itemForm, available: !itemForm.available })}
                                                className="p-1 rounded-full transition cursor-pointer"
                                            >
                                                {itemForm.available ? <ToggleRight size={38} className="text-green-500" /> : <ToggleLeft size={38} className="text-gray-400" />}
                                            </button>
                                        </div>

                                        <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                                            <span className="text-xs font-bold text-gray-700">{language === 'th' ? 'เมนูแนะนำขายดี (Bestseller)' : 'Mark as Bestseller'}</span>
                                            <button 
                                                type="button"
                                                onClick={() => setItemForm({ ...itemForm, isBestSeller: !itemForm.isBestSeller })}
                                                className="p-1 rounded-full transition cursor-pointer"
                                            >
                                                {itemForm.isBestSeller ? <ToggleRight size={38} className="text-amber-500" /> : <ToggleLeft size={38} className="text-gray-400" />}
                                            </button>
                                        </div>

                                        {/* Promo Badges */}
                                        <div className="grid grid-cols-2 gap-3 mt-2">
                                            <div>
                                                <label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-1">{language === 'th' ? 'ป้ายกำกับ (EN)' : 'Badge Label (EN)'}</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="e.g. Hot, Promo"
                                                    value={itemForm.badge || ''} 
                                                    onChange={e => setItemForm({ ...itemForm, badge: e.target.value })} 
                                                    className="w-full text-xs font-bold border border-gray-205 rounded-lg px-2.5 py-1.5 focus:border-brand-500 outline-none bg-white text-gray-800"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-extrabold text-gray-500 uppercase block mb-1">{language === 'th' ? 'ป้ายกำกับ (TH)' : 'Badge Label (TH)'}</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="เช่น ยอดฮิต, ใหม่"
                                                    value={itemForm.badgeTh || ''} 
                                                    onChange={e => setItemForm({ ...itemForm, badgeTh: e.target.value })} 
                                                    className="w-full text-xs font-bold border border-gray-205 rounded-lg px-2.5 py-1.5 focus:border-brand-500 outline-none bg-white text-gray-800"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Right Side: Text Fields */}
                                <div className="space-y-4 text-left font-sans">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="col-span-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">{language === 'th' ? 'ชื่อเมนูอาหาร (EN)' : 'Food Name (EN)'}</label>
                                            <input 
                                                type="text" 
                                                required
                                                value={itemForm.name || ''} 
                                                onChange={e => setItemForm({ ...itemForm, name: e.target.value })} 
                                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 font-bold text-gray-850 focus:border-brand-500 outline-none"
                                                placeholder="e.g. Carbonara Pasta"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">{language === 'th' ? 'ชื่อเมนูอาหาร (TH)' : 'Food Name (TH)'}</label>
                                            <input 
                                                type="text" 
                                                required
                                                value={itemForm.nameTh || ''} 
                                                onChange={e => setItemForm({ ...itemForm, nameTh: e.target.value })} 
                                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 font-bold text-gray-850 focus:border-brand-500 outline-none"
                                                placeholder="เช่น พาสต้าคาโบนาร่า"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">{language === 'th' ? 'หมวดหมู่สินค้า' : 'Category'}</label>
                                            <select 
                                                value={itemForm.category || 'pizza'} 
                                                onChange={e => setItemForm({ ...itemForm, category: e.target.value as ProductCategory })} 
                                                className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-800 focus:border-brand-500 outline-none bg-white font-sans"
                                            >
                                                {(CATEGORIES || []).map(cat => (
                                                    <option key={cat.id} value={cat.id}>{language === 'th' ? (cat.labelTh || cat.label) : cat.label}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-gray-500 uppercase block mb-1">{language === 'th' ? 'ราคาเริ่มต้น (บาท)' : 'Base Price (฿)'}</label>
                                            <input 
                                                type="number" 
                                                required
                                                min="0"
                                                value={itemForm.basePrice !== undefined ? itemForm.basePrice : ''} 
                                                onChange={e => setItemForm({ ...itemForm, basePrice: parseInt(e.target.value) || 0 })} 
                                                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 font-bold text-gray-850 focus:border-brand-500 outline-none font-mono"
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-b border-gray-100 py-4 my-2">
                                        <div>
                                            <label className="text-xs font-black text-amber-700 uppercase block mb-1">
                                                {language === 'th' ? '🍖 ต้นทุนวัตถุดิบ (บาท)' : '🍖 Raw Ingredient Cost (฿)'}
                                            </label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                min="0"
                                                value={itemForm.rawCost !== undefined ? itemForm.rawCost : ''} 
                                                onChange={e => setItemForm({ ...itemForm, rawCost: parseFloat(e.target.value) || 0 })} 
                                                className="w-full border-2 border-amber-100 bg-amber-50/20 rounded-xl px-4 py-2 font-black text-amber-900 focus:border-amber-500 focus:bg-white outline-none font-mono"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-green-700 uppercase block mb-1">
                                                {language === 'th' ? '🟢 ราคา Grab (บาท)' : '🟢 Grab Price (฿)'}
                                            </label>
                                            <input 
                                                type="number" 
                                                min="0"
                                                value={itemForm.grabPrice !== undefined ? itemForm.grabPrice : ''} 
                                                onChange={e => setItemForm({ ...itemForm, grabPrice: parseInt(e.target.value) || 0 })} 
                                                className="w-full border-2 border-green-100 bg-green-50/20 rounded-xl px-4 py-2 font-black text-green-900 focus:border-green-500 focus:bg-white outline-none font-mono"
                                                placeholder={itemForm.basePrice ? String(itemForm.basePrice) : "0"}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-blue-700 uppercase block mb-1">
                                                {language === 'th' ? '🔵 ราคา Lineman (บาท)' : '🔵 Lineman Price (฿)'}
                                            </label>
                                            <input 
                                                type="number" 
                                                min="0"
                                                value={itemForm.linemanPrice !== undefined ? itemForm.linemanPrice : ''} 
                                                onChange={e => setItemForm({ ...itemForm, linemanPrice: parseInt(e.target.value) || 0 })} 
                                                className="w-full border-2 border-blue-100 bg-blue-50/20 rounded-xl px-4 py-2 font-black text-blue-900 focus:border-blue-500 focus:bg-white outline-none font-mono"
                                                placeholder={itemForm.basePrice ? String(itemForm.basePrice) : "0"}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">{language === 'th' ? 'รายละเอียดสินค้า (EN)' : 'Description (EN)'}</label>
                                        <textarea 
                                            rows={2}
                                            value={itemForm.description || ''} 
                                            onChange={e => setItemForm({ ...itemForm, description: e.target.value })} 
                                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 font-medium text-gray-850 focus:border-brand-500 outline-none"
                                            placeholder="e.g. Rich cream, egg yolk, bacon and cheese with fresh pasta."
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-gray-500 uppercase block mb-1">{language === 'th' ? 'รายละเอียดสินค้า (TH)' : 'Description (TH)'}</label>
                                        <textarea 
                                            rows={2}
                                            value={itemForm.descriptionTh || ''} 
                                            onChange={e => setItemForm({ ...itemForm, descriptionTh: e.target.value })} 
                                            className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 font-medium text-gray-850 focus:border-brand-500 outline-none"
                                            placeholder="เช่น ครีมเข้มข้น ไข่แดง เบคอน และชีสขูด เสิร์ฟพร้อมพาสต้าเส้นสด"
                                        />
                                    </div>

                                    {/* INGREDIENT COST ASSIGNMENT & MARGIN SECTION */}
                                    <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-200 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h5 className="font-extrabold text-xs text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                                                <span>🍖 {language === 'th' ? 'ต้นทุนวัตถุดิบและกำไรขั้นต้นทางทฤษฎี' : 'Ingredient Cost & Theoretical Margin'}</span>
                                            </h5>
                                            <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-100 text-amber-800 rounded">
                                                {language === 'th' ? 'คำนวณอัตโนมัติ' : 'Auto-calculated'}
                                            </span>
                                        </div>

                                        {/* List of current ingredients */}
                                        <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                                            {modalIngredients.length === 0 ? (
                                                <p className="text-[11px] text-gray-500 italic py-1 text-center bg-white/50 rounded border border-dashed border-gray-200">
                                                    {language === 'th' ? 'ยังไม่ได้ระบุต้นทุนวัตถุดิบย่อย' : 'No ingredient costs assigned yet.'}
                                                </p>
                                            ) : (
                                                modalIngredients.map(ing => (
                                                    <div key={ing.id} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-gray-150 text-xs">
                                                        <span className="font-bold text-gray-700">{ing.name}</span>
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-extrabold text-amber-800 font-mono">฿{ing.cost.toLocaleString()}</span>
                                                            <button 
                                                                type="button"
                                                                onClick={() => handleRemoveIngredient(ing.id)}
                                                                className="text-red-500 hover:text-red-700 p-0.5 rounded transition hover:bg-red-50"
                                                                title={language === 'th' ? 'ลบออก' : 'Remove'}
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Add new ingredient form */}
                                        <div className="grid grid-cols-12 gap-1.5 pt-1">
                                            <div className="col-span-7">
                                                <input 
                                                    type="text"
                                                    placeholder={language === 'th' ? 'ชื่อวัตถุดิบ เช่น มอสซาเรลล่าชีส' : 'e.g. Mozzarella Cheese'}
                                                    value={newIngredientName}
                                                    onChange={e => setNewIngredientName(e.target.value)}
                                                    className="w-full text-[11px] font-bold border border-gray-200 rounded-lg px-2 py-1.5 focus:border-brand-500 outline-none bg-white text-gray-800"
                                                />
                                            </div>
                                            <div className="col-span-3">
                                                <input 
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    placeholder={language === 'th' ? 'ต้นทุน' : 'Cost'}
                                                    value={newIngredientCost || ''}
                                                    onChange={e => setNewIngredientCost(parseFloat(e.target.value) || 0)}
                                                    className="w-full text-[11px] font-bold border border-gray-200 rounded-lg px-2 py-1.5 focus:border-brand-500 outline-none bg-white text-gray-800 font-mono"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <button
                                                    type="button"
                                                    onClick={handleAddIngredient}
                                                    className="w-full h-full bg-amber-600 text-white font-extrabold text-[11px] rounded-lg hover:bg-amber-700 active:scale-95 transition flex items-center justify-center gap-0.5 cursor-pointer"
                                                >
                                                    <Plus size={12} />
                                                    <span>{language === 'th' ? 'เพิ่ม' : 'Add'}</span>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Theoretical Gross Margin Summary */}
                                        {(() => {
                                            const totalCost = modalIngredients.reduce((sum, ing) => sum + ing.cost, 0);
                                            const basePrice = itemForm.basePrice || 0;
                                            const grossProfit = basePrice - totalCost;
                                            const marginPct = basePrice > 0 ? (grossProfit / basePrice) * 100 : 0;

                                            let healthBg = 'bg-gray-100 text-gray-800';
                                            let healthText = 'No price';
                                            if (basePrice > 0) {
                                                if (marginPct >= 60) {
                                                    healthBg = 'bg-green-100 text-green-800 border border-green-200';
                                                    healthText = language === 'th' ? 'กำไรดีมาก (Excellent)' : 'Excellent Margin';
                                                } else if (marginPct >= 40) {
                                                    healthBg = 'bg-teal-100 text-teal-800 border border-teal-200';
                                                    healthText = language === 'th' ? 'กำไรปานกลาง (Healthy)' : 'Healthy Margin';
                                                } else if (marginPct >= 0) {
                                                    healthBg = 'bg-orange-100 text-orange-800 border border-orange-200';
                                                    healthText = language === 'th' ? 'กำไรบาง (Thin Margin)' : 'Thin Margin';
                                                } else {
                                                    healthBg = 'bg-red-100 text-red-800 border border-red-200 animate-pulse';
                                                    healthText = language === 'th' ? 'ขาดทุน (Negative Margin)' : 'Losing Money';
                                                }
                                            }

                                            return (
                                                <div className="bg-white p-3 rounded-xl border border-amber-200/60 grid grid-cols-2 gap-2 text-xs font-sans">
                                                    <div className="border-r border-gray-100 pr-2">
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">
                                                            {language === 'th' ? 'รวมต้นทุนวัตถุดิบ' : 'Total Ingredient Cost'}
                                                        </span>
                                                        <span className="text-sm font-black text-amber-900 font-mono">
                                                            ฿{totalCost.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                    <div className="pl-2">
                                                        <span className="text-[10px] font-bold text-gray-500 uppercase block mb-0.5">
                                                            {language === 'th' ? 'กำไรขั้นต้น / อัตรากำไร' : 'Gross Profit / Margin %'}
                                                        </span>
                                                        <div className="flex flex-col">
                                                            <span className={`text-sm font-black font-mono ${grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                                ฿{grossProfit.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
                                                                <span className="text-xs font-extrabold ml-1.5">
                                                                    ({marginPct.toFixed(1)}%)
                                                                </span>
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="col-span-2 pt-2 border-t border-gray-100 flex items-center justify-between text-[10px]">
                                                        <span className="text-gray-500 font-bold">
                                                            {language === 'th' ? 'สถานะอัตรากำไรขั้นต้น:' : 'Gross Margin Status:'}
                                                        </span>
                                                        <span className={`px-2 py-0.5 rounded-full font-black text-[9px] ${healthBg}`}>
                                                            {healthText}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                    </div>

                                    {/* Promotion Bundle Fields if category is promotion */}
                                    {itemForm.category === 'promotion' && (
                                        <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-200 mt-2">
                                            <h5 className="font-extrabold text-xs text-amber-900 mb-2 uppercase tracking-wide">📦 {language === 'th' ? 'ตั้งค่าการจัดสมนาคุณ (คอมโบ)' : 'Combo Choices Setup'}</h5>
                                            <div>
                                                <label className="text-[11px] font-bold text-gray-500 uppercase block mb-1">{language === 'th' ? 'จำนวนตัวเลือกพิซซ่า/เมนูในชุดนี้' : 'Pizzas/Dishes Choices Count Limit'}</label>
                                                <input 
                                                    type="number"
                                                    min="0"
                                                    value={itemForm.comboCount || 0}
                                                    onChange={e => setItemForm({ ...itemForm, comboCount: parseInt(e.target.value) || 0 })}
                                                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-1.5 font-bold font-mono text-gray-800 outline-none focus:border-brand-500"
                                                />
                                                <p className="text-[9px] text-amber-800 font-medium mt-1 leading-relaxed">
                                                    * {language === 'th' ? 'ระบุตัวเลข เช่น 2 หากต้องให้ลูกค้าเลือกรายการพิซซ่าได้ 2 ถาด (ใส่ 0 หากเป็นเซตปกติไม่มีเมนูให้เลือกย่อย)' : 'Specify choices user can select inside this promo, e.g. 2. (Set to 0 if simple static banner promo)'}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        
                        <div className="bg-gray-100 p-4 border-t border-gray-150 flex justify-end gap-3 sticky bottom-0 z-10 shrink-0 font-sans">
                            <button 
                                type="button"
                                onClick={() => setShowItemModal(false)}
                                className="px-5 py-2.5 rounded-xl font-bold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 active:scale-95 transition text-xs cursor-pointer"
                            >
                                {language === 'th' ? 'ยกเลิก' : 'Cancel'}
                            </button>
                            <button 
                                type="button"
                                onClick={handleSaveItem}
                                disabled={!itemForm.name || itemForm.basePrice === undefined}
                                className="px-6 py-2.5 rounded-xl font-black bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md active:scale-95 transition text-xs cursor-pointer"
                            >
                                {language === 'th' ? '💾 บันทึกสินค้า' : '💾 Save Item'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TOPPING EDIT/ADD MODAL (showToppingsModal) --- */}
            {showToppingsModal && (
                <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto print:hidden">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-gray-800 animate-fade-in text-left">
                        <div className="bg-brand-600 px-6 py-4 flex items-center justify-between text-white sticky top-0 z-10 font-sans">
                            <h3 className="font-extrabold text-lg flex items-center gap-2">
                                🍕 {toppingForm.id ? (language === 'th' ? 'แก้ไขวัตถุดิบท็อปปิ้ง' : 'Edit Topping / Ingredient') : (language === 'th' ? 'เพิ่มวัตถุดิบท็อปปิ้งใหม่' : 'Add New Topping')}
                            </h3>
                            <button 
                                onClick={() => setShowToppingsModal(false)} 
                                className="text-white/80 hover:text-white font-bold text-2xl leading-none cursor-pointer"
                            >
                                &times;
                            </button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-left font-sans">
                            {/* Topping Image Upload */}
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1.5">{language === 'th' ? 'รูปภาพท็อปปิ้ง (ย่อข้อมูลอัตโนมัติ)' : 'Topping Thumbnail Image'}</label>
                                <div className="border-2 border-dashed border-gray-300 rounded-xl p-3 flex flex-col items-center justify-center bg-gray-50/50 hover:bg-gray-100 transition relative group h-32 overflow-hidden">
                                    {toppingForm.image ? (
                                        <>
                                            <img 
                                                src={convertGoogleDriveUrl(toppingForm.image)} 
                                                alt="topping-preview" 
                                                className="absolute inset-0 w-full h-full object-cover" 
                                                referrerPolicy="no-referrer"
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
                                                <label className="bg-white text-gray-800 px-2.5 py-1 rounded-md text-xs font-bold shadow cursor-pointer hover:bg-gray-50 flex items-center gap-1">
                                                    <Upload size={10}/> {language === 'th' ? 'เปลี่ยนรูป' : 'Change'}
                                                    <input type="file" accept="image/*" className="hidden" onChange={handleToppingImageUpload} />
                                                </label>
                                                <button 
                                                    type="button"
                                                    onClick={() => setToppingForm({ ...toppingForm, image: '' })}
                                                    className="bg-red-600 text-white px-2.5 py-1 rounded-md text-xs font-bold shadow hover:bg-red-700 flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Trash2 size={10}/> {language === 'th' ? 'ลบรูป' : 'Delete'}
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center text-center">
                                            <Plus className="text-gray-400 mb-1" size={24} />
                                            <p className="text-[10px] font-bold text-gray-500">{language === 'th' ? 'คลิกอัปโหลดภาพท็อปปิ้งสัดส่วน 1:1' : 'Upload 1:1 topping thumbnail'}</p>
                                            <label className="mt-2 bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200 px-3 py-1 rounded-lg text-[10px] font-black shadow-sm cursor-pointer transition">
                                                {language === 'th' ? 'เลือกไฟล์' : 'Select'}
                                                <input type="file" accept="image/*" className="hidden" onChange={handleToppingImageUpload} />
                                            </label>
                                        </div>
                                    )}
                                </div>
                                {/* Topping image URL text field */}
                                <div className="mt-2 text-left">
                                    <input 
                                        type="text" 
                                        placeholder={language === 'th' ? 'หรือ วางลิงก์รูปภาพท็อปปิ้งตรงนี้ (เช่น Google Drive, Web Link)' : 'Or paste direct topping image URL (e.g. Google Drive, Web Link)'}
                                        value={toppingForm.image || ''} 
                                        onChange={e => setToppingForm({ ...toppingForm, image: e.target.value })} 
                                        className="w-full text-xs font-bold border border-gray-250 rounded-lg px-2.5 py-1.5 focus:border-brand-500 outline-none bg-white text-gray-800 font-mono shadow-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">{language === 'th' ? 'ชื่อท็อปปิ้ง (EN)' : 'Topping Name (EN)'}</label>
                                <input 
                                    type="text" 
                                    required
                                    value={toppingForm.name || ''} 
                                    onChange={e => setToppingForm({ ...toppingForm, name: e.target.value })} 
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 font-bold text-gray-850 focus:border-brand-500 outline-none"
                                    placeholder="e.g. Extra Mozzarella Cheese"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">{language === 'th' ? 'ชื่อท็อปปิ้ง (TH)' : 'Topping Name (TH)'}</label>
                                <input 
                                    type="text" 
                                    required
                                    value={toppingForm.nameTh || ''} 
                                    onChange={e => setToppingForm({ ...toppingForm, nameTh: e.target.value })} 
                                    className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 font-bold text-gray-850 focus:border-brand-500 outline-none"
                                    placeholder="เช่น เพิ่มมอสซาเรลล่าชีส"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">{language === 'th' ? 'ราคาบวกเพิ่ม (฿)' : 'Extra Price (฿)'}</label>
                                    <input 
                                        type="number" 
                                        required
                                        min="0"
                                        value={toppingForm.price !== undefined ? toppingForm.price : ''} 
                                        onChange={e => setToppingForm({ ...toppingForm, price: parseInt(e.target.value) || 0 })} 
                                        className="w-full border-2 border-gray-200 rounded-xl px-4 py-2 font-bold text-gray-850 focus:border-brand-500 outline-none font-mono"
                                        placeholder="0"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">{language === 'th' ? 'หมวดหมู่ท็อปปิ้ง' : 'Category'}</label>
                                    <select 
                                        value={toppingForm.category || 'other'} 
                                        onChange={e => setToppingForm({ ...toppingForm, category: e.target.value as any })} 
                                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-800 focus:border-brand-500 outline-none bg-white font-sans"
                                    >
                                        <option value="sauce">{language === 'th' ? 'ซอสราด (Sauce)' : 'Sauce'}</option>
                                        <option value="cheese">{language === 'th' ? 'ชีสแผ่น/ขูด (Cheese)' : 'Cheese'}</option>
                                        <option value="meat">{language === 'th' ? 'เนื้อสัตว์ / ไส้ (Meat)' : 'Meat'}</option>
                                        <option value="vegetable">{language === 'th' ? 'ผัก / ผลไม้ (Vegetable)' : 'Vegetable'}</option>
                                        <option value="seasoning">{language === 'th' ? 'เครื่องปรุง (Seasoning)' : 'Seasoning'}</option>
                                        <option value="other">{language === 'th' ? 'อื่นๆ (Other)' : 'Other'}</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-150 mt-2">
                                <span className="text-xs font-bold text-gray-700">{language === 'th' ? 'สถานะท็อปปิ้ง (มีวัตถุดิบ)' : 'In Stock & Available'}</span>
                                <button 
                                    type="button"
                                    onClick={() => setToppingForm({ ...toppingForm, available: !toppingForm.available })}
                                    className="p-1 rounded-full transition cursor-pointer"
                                >
                                    {toppingForm.available ? <ToggleRight size={36} className="text-green-500" /> : <ToggleLeft size={36} className="text-gray-400" />}
                                </button>
                            </div>
                        </div>
                        
                        <div className="bg-gray-100 p-4 border-t border-gray-150 flex justify-end gap-3 sticky bottom-0 z-10 shrink-0 font-sans">
                            <button 
                                type="button"
                                onClick={() => setShowToppingsModal(false)}
                                className="px-5 py-2 rounded-xl font-bold border border-gray-300 text-gray-750 bg-white hover:bg-gray-50 active:scale-95 transition text-xs cursor-pointer"
                            >
                                {language === 'th' ? 'ยกเลิก' : 'Cancel'}
                            </button>
                            <button 
                                type="button"
                                onClick={handleSaveTopping}
                                disabled={!toppingForm.name || toppingForm.price === undefined}
                                className="px-6 py-2 rounded-xl font-black bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-md active:scale-95 transition text-xs cursor-pointer"
                            >
                                {language === 'th' ? '💾 บันทึกท็อปปิ้ง' : '💾 Save Topping'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- PAYMENT MODAL (CHECKOUT & CASHIERING) --- */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:hidden text-left">
                    <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col lg:flex-row h-[90vh] lg:h-[80vh] text-gray-800 border border-gray-150 animate-fade-in overflow-hidden">
                        
                        {/* Left Side: Order Summary */}
                        <div className="w-full lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200 p-6 overflow-y-auto">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-black text-gray-800">{language === 'th' ? 'สรุปรายการอาหาร' : 'Order Summary'}</h2>
                                <span className="px-3 py-1 bg-amber-50 text-amber-850 rounded-full text-xs font-bold border border-amber-200">
                                    {selectedOrder ? `Order #${String(selectedOrder.id).slice(-4)}` : 'New Bill'}
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[40vh] lg:max-h-none border border-gray-150 rounded-xl p-3 bg-gray-50/50 text-left">
                                {(selectedOrder ? selectedOrder.items : cart).map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-start gap-4 py-2 border-b border-gray-100 last:border-0 text-xs text-left">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-extrabold text-gray-800">
                                                {item.quantity}x {language === 'th' ? (item.nameTh || item.name) : item.name}
                                            </div>
                                            <div className="text-[10px] text-gray-500 font-bold mt-0.5">
                                                {item.selectedToppings && item.selectedToppings.length > 0 && (
                                                    <div>+ {item.selectedToppings.map(t => language === 'th' ? (t.nameTh || t.name) : t.name).join(', ')}</div>
                                                )}
                                                {item.subItems && item.subItems.length > 0 && (
                                                    <div>+ {item.subItems.map(s => language === 'th' ? (s.nameTh || s.name) : s.name).join(', ')}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="font-bold text-gray-800">฿{item.totalPrice.toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-gray-250 pt-4 space-y-2 mt-4 text-xs font-bold text-gray-550 shrink-0">
                                <div className="flex justify-between">
                                    <span>{language === 'th' ? 'ค่าอาหารและเครื่องดื่ม' : 'Subtotal'}</span>
                                    <span>฿{(posCheckoutTotal).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-base font-black text-gray-800 pt-2 border-t border-gray-200">
                                    <span>{language === 'th' ? 'ยอดรวมทั้งสิ้น' : 'Total Amount'}</span>
                                    <span>฿{(posCheckoutTotal).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Payment Methods Form */}
                        <div className="w-full lg:w-1/2 flex flex-col p-6 overflow-y-auto text-left">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-black text-gray-800">{language === 'th' ? 'ช่องทางการชำระเงิน' : 'Payment Type'}</h2>
                                <button 
                                    onClick={() => { playClickSound(); setShowPaymentModal(false); }} 
                                    className="text-gray-400 hover:text-gray-655 font-extrabold text-lg p-1"
                                >
                                    <X size={18}/>
                                </button>
                            </div>

                            {/* Total Due */}
                            <div className="mb-4 bg-brand-50 p-4 rounded-xl border border-brand-100 flex justify-between items-center">
                                <span className="font-bold text-gray-655 text-xs">{language === 'th' ? 'ยอดที่ต้องชำระ:' : 'Total Due:'}</span>
                                <span className="text-2xl font-black text-[#b91c1c]">
                                    ฿{(posCheckoutTotal).toLocaleString()}
                                </span>
                            </div>

                            {/* Payment Method Selector Grid */}
                            <div className="mb-4">
                                <label className="text-[10.5px] font-black uppercase text-gray-400 block mb-2">{language === 'th' ? 'เลือกประเภทการจ่ายเงิน' : 'Select Method'}</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button 
                                        type="button"
                                        onClick={() => { playClickSound(); setPaymentMethod('cash'); setCashReceived(''); }}
                                        className={`py-3.5 px-1.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition duration-150 cursor-pointer ${paymentMethod === 'cash' ? 'bg-amber-500 border-amber-600 text-white font-black' : 'bg-gray-50 border-gray-200 text-gray-650 hover:bg-gray-100'}`}
                                    >
                                        <Banknote size={15}/>
                                        <span className="text-[10px] whitespace-nowrap">{language === 'th' ? 'เงินสด (Cash)' : 'Cash'}</span>
                                    </button>
                                    
                                    <button 
                                        type="button"
                                        onClick={() => { playClickSound(); setPaymentMethod('qr_transfer'); }}
                                        className={`py-3.5 px-1.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition duration-150 cursor-pointer ${paymentMethod === 'qr_transfer' ? 'bg-amber-500 border-amber-600 text-white font-black' : 'bg-gray-50 border-gray-200 text-gray-655 hover:bg-gray-100'}`}
                                    >
                                        <QrCode size={15}/>
                                        <span className="text-[10px] whitespace-nowrap">{language === 'th' ? 'เงินโอน (QR)' : 'QR Transfer'}</span>
                                    </button>

                                    <button 
                                        type="button"
                                        onClick={() => { playClickSound(); setPaymentMethod('thai_chuay_thai'); }}
                                        className={`py-3.5 px-1.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition duration-150 cursor-pointer ${paymentMethod === 'thai_chuay_thai' ? 'bg-amber-500 border-amber-600 text-white font-black' : 'bg-gray-50 border-gray-200 text-gray-655 hover:bg-gray-100'}`}
                                    >
                                        <Sparkles size={15}/>
                                        <span className="text-[10px] whitespace-nowrap">{language === 'th' ? 'ไทยช่วยไทย' : 'Thai scheme'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Method Content Panel */}
                            <div className="flex-1 min-h-[160px]">
                                {paymentMethod === 'cash' && (
                                    <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200 animate-fade-in text-left">
                                        <div>
                                            <label className="text-[10.5px] font-extrabold text-gray-500 uppercase block mb-1">{language === 'th' ? 'ระบุยอดรับเงินสด (฿)' : 'Received'}</label>
                                            <input 
                                                type="number" 
                                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-1.5 font-extrabold text-sm text-gray-855 outline-none focus:border-amber-500"
                                                placeholder="e.g. 1000"
                                                value={cashReceived}
                                                onChange={e => setCashReceived(e.target.value)}
                                            />
                                        </div>

                                        <div className="flex flex-wrap gap-1.5">
                                            <button 
                                                type="button"
                                                onClick={() => { playClickSound(); setCashReceived(String(posCheckoutTotal)); }}
                                                className="px-2.5 py-1 bg-white border border-gray-200 hover:border-amber-400 text-gray-700 rounded-md text-[10px] font-bold transition shadow-sm cursor-pointer"
                                            >
                                                Exact (พอดี)
                                            </button>
                                            {[55, 100, 500, 1000].map(bill => (
                                                <button 
                                                    type="button"
                                                    key={bill}
                                                    onClick={() => { playClickSound(); setCashReceived(String(bill)); }}
                                                    className="px-2.5 py-1 bg-white border border-gray-200 hover:border-amber-400 text-gray-700 rounded-md text-[10px] font-bold transition shadow-sm cursor-pointer"
                                                >
                                                    +{bill}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="pt-2 border-t border-gray-200 flex justify-between items-center text-xs font-bold">
                                            <span className="text-gray-500">{language === 'th' ? 'เงินทอน (Change):' : 'Change Due:'}</span>
                                            <span className={`text-base font-black font-mono ${change >= 0 ? 'text-green-600' : 'text-orange-500'}`}>
                                                ฿{change.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {paymentMethod === 'qr_transfer' && (
                                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 text-center animate-fade-in flex flex-col items-center">
                                        <p className="text-[10px] font-black text-gray-550 uppercase mb-2">{language === 'th' ? 'สแกนจ่ายเงินด้วย PromptPay QR' : 'Scan to Transfer'}</p>
                                        <div className="bg-white p-2 rounded-lg border border-gray-200 shadow-sm inline-block">
                                            <img 
                                                src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(
                                                    generatePromptPayPayload(
                                                        storeSettings.promptPayNumber || "0-9949-7919-9", 
                                                        posCheckoutTotal
                                                    )
                                                )}`}
                                                alt="PromptPay QR Code" 
                                                className="w-[120px] h-[120px] object-contain"
                                                referrerPolicy="no-referrer"
                                            />
                                        </div>
                                        <p className="text-[10.5px] font-black text-[#1e293b] mt-1.5">
                                            PromptPay: {storeSettings.promptPayNumber || "0-9949-7919-9"}
                                        </p>
                                    </div>
                                )}

                                {paymentMethod === 'thai_chuay_thai' && (
                                    <div className="bg-amber-50 p-3 rounded-xl border border-amber-200 animate-fade-in text-amber-955 text-xs text-left">
                                        <p className="font-extrabold text-[10.5px] text-amber-800 uppercase block mb-1">วิธีการชำระโครงการไทยช่วยไทย</p>
                                        <div className="space-y-1 text-[11px] font-bold leading-relaxed">
                                            <p>1. เปิดแอปเป๋าตังสำหรับโครงการไทยช่วยไทย</p>
                                            <p>2. ตรวจสอบยอดเงินร่วมกับสิทธิ์โครงการ</p>
                                            <p>3. สแกนชำระที่หน้าร้าน</p>
                                            <p>4. เมื่อยอดและสิทธิ์ชำระเรียบร้อยในแอปหน้าร้านแล้ว ให้กดปุ่ม <strong>CONFIRM</strong> หน้าจอนี้เพื่อปิดบิล</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Tax Invoice Toggle */}
                            <div className="mb-4 bg-gray-50 p-3 rounded-xl border border-gray-200 mt-4">
                                <label className="flex items-center gap-2 cursor-pointer mb-2">
                                    <input type="checkbox" className="w-5 h-5 rounded border-gray-300 text-brand-600 focus:ring-brand-500" checked={taxInvoice.isRequested} onChange={(e) => setTaxInvoice({...taxInvoice, isRequested: e.target.checked})} />
                                    <span className="font-bold text-gray-750 text-xs">ขอใบกำกับภาษีเต็มรูป (Tax Invoice)</span>
                                </label>
                                {taxInvoice.isRequested && (
                                    <div className="space-y-3 mt-3 border-t border-gray-200 pt-3 animate-fade-in">
                                         <div>
                                            <input type="text" placeholder="ชื่อบริษัท / Company Name" className="w-full px-3 py-1.5 border rounded-lg text-xs font-bold outline-none focus:border-amber-500" value={taxInvoice.companyName} onChange={e => setTaxInvoice({...taxInvoice, companyName: e.target.value})} />
                                         </div>
                                         <div>
                                            <input type="text" placeholder="เลขประจำตัวผู้เสียภาษี / Tax ID" className="w-full px-3 py-1.5 border rounded-lg text-xs font-bold outline-none focus:border-amber-500" value={taxInvoice.taxId} onChange={e => setTaxInvoice({...taxInvoice, taxId: e.target.value})} />
                                         </div>
                                         <div>
                                            <input type="text" placeholder="ที่อยู่ / Address" className="w-full px-3 py-1.5 border rounded-lg text-xs font-bold outline-none focus:border-amber-500" value={taxInvoice.address} onChange={e => setTaxInvoice({...taxInvoice, address: e.target.value})} />
                                         </div>
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="mt-auto flex gap-3">
                                <button type="button" onClick={handlePrintBill} className="px-6 py-4 rounded-xl font-bold bg-gray-200 text-gray-700 hover:bg-gray-300 transition flex flex-col items-center justify-center cursor-pointer">
                                    <Printer size={24}/>
                                </button>
                                <button type="button" onClick={handleFinalizePayment} disabled={selectedOrder?.deliveryFee === 'pending'} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center gap-2 cursor-pointer">
                                    {paymentMethod === 'cash' ? 'PAID' : 'CONFIRM'} <CheckCircle size={22}/>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- ORDER ITEMS EDITOR MODAL (EDIT EXISTING UNPAID ORDERS) --- */}
            {showOrderItemsEditor && editingOrderForItems && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:hidden text-left">
                    <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col lg:flex-row h-[90vh] lg:h-[80vh] text-gray-800 border border-gray-150 animate-fade-in overflow-hidden">
                        
                        {/* Left Side: Order Items List */}
                        <div className="w-full lg:w-1/2 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-200 p-6 overflow-y-auto">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-black text-gray-800">{language === 'th' ? 'แก้ไขรายการอาหารในออเดอร์' : 'Edit Order Items'}</h2>
                                <span className="px-3 py-1 bg-amber-50 text-amber-850 rounded-full text-xs font-bold border border-amber-200">
                                    {`Order #${String(editingOrderForItems.id).slice(-4)}`}
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[40vh] lg:max-h-none border border-gray-150 rounded-xl p-3 bg-gray-50/50 text-left">
                                {editedItemsList.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-start gap-4 py-2 border-b border-gray-100 last:border-0 text-xs text-left">
                                        <div className="flex-1 min-w-0">
                                            <div className="font-extrabold text-gray-800">
                                                {item.quantity}x {language === 'th' ? (item.nameTh || item.name) : item.name}
                                            </div>
                                            <div className="text-[10px] text-gray-500 font-bold mt-0.5">
                                                {item.selectedToppings && item.selectedToppings.length > 0 && (
                                                    <div>+ {item.selectedToppings.map(t => language === 'th' ? (t.nameTh || t.name) : t.name).join(', ')}</div>
                                                )}
                                                {item.subItems && item.subItems.length > 0 && (
                                                    <div>+ {item.subItems.map(s => language === 'th' ? (s.nameTh || s.name) : s.name).join(', ')}</div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="font-bold text-gray-800">฿{item.totalPrice.toLocaleString()}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="border-t border-gray-250 pt-4 space-y-2 mt-4 text-xs font-bold text-gray-550 shrink-0">
                                <div className="flex justify-between">
                                    <span>{language === 'th' ? 'ค่าอาหารและเครื่องดื่ม' : 'Subtotal'}</span>
                                    <span>฿{editedItemsList.reduce((sum, item) => sum + item.totalPrice, 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-base font-black text-gray-800 pt-2 border-t border-gray-200">
                                    <span>{language === 'th' ? 'ยอดรวมทั้งสิ้น' : 'Total Amount'}</span>
                                    <span>฿{editedItemsList.reduce((sum, item) => sum + item.totalPrice, 0).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Order Editor Form */}
                        <div className="w-full lg:w-1/2 flex flex-col p-6 overflow-y-auto text-left">
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-xl font-black text-gray-800">{language === 'th' ? 'รายละเอียดออเดอร์' : 'Order Details'}</h2>
                                <button 
                                    onClick={() => { playClickSound(); setShowOrderItemsEditor(false); setEditingOrderForItems(null); }} 
                                    className="text-gray-400 hover:text-gray-655 font-extrabold text-lg p-1 animate-fade-in"
                                >
                                    <X size={18}/>
                                </button>
                            </div>

                            <div className="grid grid-cols-1 gap-4 text-left">
                                {/* Edit Table Number */}
                                <div>
                                    <label className="text-[10.5px] font-black text-gray-500 uppercase block mb-1">
                                        👉 {language === 'th' ? 'เลขโต๊ะ / สถานที่ทาน' : 'Table Number / Room'}
                                    </label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-extrabold text-xs text-gray-850 outline-none focus:border-amber-400"
                                        placeholder="เช่น 1 หรือ Delivery"
                                        value={editedOrderTableNumber}
                                        onChange={e => setEditedOrderTableNumber(e.target.value)}
                                    />
                                </div>

                                {/* Edit Customer Name */}
                                <div>
                                    <label className="text-[10.5px] font-black text-gray-500 uppercase block mb-1">
                                        👉 {language === 'th' ? 'ชื่อลูกค้า / เบอร์' : 'Customer Name'}
                                    </label>
                                    <input 
                                        type="text" 
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-extrabold text-xs text-gray-855 outline-none focus:border-amber-400"
                                        placeholder="เช่น คุณกานต์"
                                        value={editedOrderCustomerName}
                                        onChange={e => setEditedOrderCustomerName(e.target.value)}
                                    />
                                </div>

                                {/* Order Source */}
                                <div>
                                    <label className="text-[10.5px] font-black text-gray-500 uppercase block mb-1">
                                        👉 {language === 'th' ? 'ช่องทางจำหน่าย' : 'Order Source'}
                                    </label>
                                    <select 
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 font-extrabold text-xs text-gray-855 outline-none focus:border-amber-400"
                                        value={editedOrderSource}
                                        onChange={e => setEditedOrderSource(e.target.value as OrderSource)}
                                    >
                                        <option value="store">Store (หน้าร้าน/โต๊ะ)</option>
                                        <option value="grab">Grab Food</option>
                                        <option value="lineman">LineMan</option>
                                        <option value="foodpanda">FoodPanda</option>
                                        <option value="robinhood">Robinhood</option>
                                        <option value="shopeefood">ShopeeFood</option>
                                    </select>
                                </div>

                                {/* Order Notes */}
                                <div>
                                    <label className="text-[10.5px] font-black text-gray-500 uppercase block mb-1">
                                        👉 {language === 'th' ? 'คำแนะนำเพิ่มเติม (Note)' : 'Special Notes / Instructions'}
                                    </label>
                                    <textarea 
                                        className="w-full bg-white border border-gray-200 rounded-xl px-3 py-1.5 font-extrabold text-xs text-gray-855 outline-none focus:border-amber-400 h-20 resize-none"
                                        placeholder="เช่น ไม่ใส่พริกไทย"
                                        value={editedOrderNote}
                                        onChange={e => setEditedOrderNote(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Total summary info and Save keys */}
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200 mt-auto">
                                <div className="flex flex-col items-start gap-1">
                                    <span className="text-[10px] font-extrabold text-gray-400 uppercase">
                                        {language === 'th' ? '💸 ยอดรวมที่แก้ไขแล้ว:' : '💸 Recalculated Total:'}
                                    </span>
                                    <span className="text-2xl font-black text-[#b91c1c]">
                                        ฿{editedItemsList.reduce((sum, item) => sum + item.totalPrice, 0).toLocaleString()}
                                    </span>
                                </div>

                                <div className="flex gap-2 w-full md:w-auto shrink-0">
                                    <button 
                                        type="button"
                                        onClick={() => { 
                                            playClickSound(); 
                                            setShowOrderItemsEditor(false); 
                                            setEditingOrderForItems(null); 
                                        }} 
                                        className="flex-1 md:flex-initial px-5 py-3 font-extrabold text-xs border border-gray-300 hover:bg-gray-150 text-gray-700 bg-white rounded-xl transition duration-150 cursor-pointer"
                                    >
                                        {language === 'th' ? '❌ ยกเลิก' : 'Cancel'}
                                    </button>
                                    
                                    <button 
                                        type="button"
                                        onClick={() => {
                                            playClickSound();
                                            handleSaveEditedOrderItems();
                                        }} 
                                        className="flex-1 md:flex-initial px-6 py-3 font-black text-xs bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-lg border border-amber-600 shadow-amber-500/10 hover:scale-[1.02] active:scale-95 transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <Save size={13}/>
                                        {language === 'th' ? '💾 บันทึกแก้ไข' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* --- EDIT ORDER MODAL --- */}
            {showEditOrderModal && editingOrder && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 print:hidden">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in text-gray-800">
                        <div className="bg-gray-905 px-6 py-4 flex items-center justify-between text-white border-b border-gray-805 bg-brand-650" style={{backgroundColor: '#b91c1c'}}>
                            <h3 className="font-extrabold text-lg flex items-center gap-2">
                                🍕 แก้ไขออเดอร์ #{String(editingOrder.id).slice(-4)}
                            </h3>
                            <button onClick={() => { setShowEditOrderModal(false); setEditingOrder(null); }} className="text-gray-200 hover:text-white font-bold text-2xl p-1 leading-none">&times;</button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-4 max-h-[70vh] text-left">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Customer Name (ชื่อลูกค้า)</label>
                                <input 
                                    type="text" 
                                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-800 outline-none focus:border-brand-500"
                                    value={editOrderForm.customerName}
                                    onChange={e => setEditOrderForm({...editOrderForm, customerName: e.target.value})}
                                />
                            </div>
                            
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Customer Phone (เบอร์โทร)</label>
                                <input 
                                    type="text" 
                                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-800 outline-none focus:border-brand-500"
                                    value={editOrderForm.customerPhone}
                                    onChange={e => setEditOrderForm({...editOrderForm, customerPhone: e.target.value})}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Table Number (เลขโต๊ะ)</label>
                                    <input 
                                        type="text" 
                                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-800 outline-none focus:border-brand-500"
                                        placeholder="เช่น 5"
                                        value={editOrderForm.tableNumber}
                                        onChange={e => setEditOrderForm({...editOrderForm, tableNumber: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Order Source (ช่องทาง)</label>
                                    <select 
                                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-800 outline-none focus:border-brand-500 bg-white"
                                        value={editOrderForm.source}
                                        onChange={e => setEditOrderForm({...editOrderForm, source: e.target.value as OrderSource})}
                                    >
                                        <option value="store">Store (หน้าร้าน)</option>
                                        <option value="grab">Grab</option>
                                        <option value="lineman">LineMan</option>
                                        <option value="foodpanda">FoodPanda</option>
                                        <option value="robinhood">Robinhood</option>
                                        <option value="shopeefood">ShopeeFood</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Total (ยอดขายรวม ฿)</label>
                                    <input 
                                        type="number" 
                                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-800 outline-none focus:border-brand-500"
                                        value={editOrderForm.totalAmount}
                                        onChange={e => setEditOrderForm({...editOrderForm, totalAmount: Number(e.target.value)})}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Net (รายรับหลังหัก GP ฿)</label>
                                    <input 
                                        type="number" 
                                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-800 outline-none focus:border-brand-500"
                                        value={editOrderForm.netAmount}
                                        onChange={e => setEditOrderForm({...editOrderForm, netAmount: Number(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Order Status (สถานะคิว)</label>
                                    <select 
                                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-800 outline-none focus:border-brand-500 bg-white"
                                        value={editOrderForm.status}
                                        onChange={e => setEditOrderForm({...editOrderForm, status: e.target.value as OrderStatus})}
                                    >
                                        <option value="pending">Pending (รอชำระ/รอทำ)</option>
                                        <option value="completed">Completed (เสร็จสิ้น)</option>
                                        <option value="cancelled">Cancelled (ยกเลิก)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Payment (วิธีจ่ายเงิน)</label>
                                    <select 
                                        className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-800 outline-none focus:border-brand-500 bg-white"
                                        value={editOrderForm.paymentMethod}
                                        onChange={e => setEditOrderForm({...editOrderForm, paymentMethod: e.target.value as PaymentMethod})}
                                    >
                                        <option value="cash">Cash (เงินสด)</option>
                                        <option value="promptpay">PromptPay (พร้อมเพย์)</option>
                                        <option value="thaihelpthai">โครงการไทยช่วยไทย</option>
                                        <option value="delivery_app">แอปคู่เดลิเวอรี่</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Order Time (วันเวลาไทยของออเดอร์)</label>
                                <input 
                                    type="datetime-local" 
                                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-800 outline-none focus:border-brand-500"
                                    value={isoToDatetimeLocal(editOrderForm.createdAt)}
                                    onChange={e => setEditOrderForm({...editOrderForm, createdAt: datetimeLocalToIso(e.target.value)})}
                                />
                                <span className="text-[10px] text-gray-400 block mt-1">เวลาในระบบจะถูกบันทึกเป็น UTC และแปลงตามเวลาไทย (GMT+7) เสมอ</span>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Notes (หมายเหตุออเดอร์)</label>
                                <textarea 
                                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-2 font-bold text-gray-800 outline-none focus:border-brand-500 h-16"
                                    value={editOrderForm.note}
                                    onChange={e => setEditOrderForm({...editOrderForm, note: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="bg-gray-50 px-6 py-4 flex gap-3 border-t border-gray-200">
                            <button 
                                onClick={() => { setShowEditOrderModal(false); setEditingOrder(null); }} 
                                className="flex-1 py-3 rounded-xl font-bold border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 transition"
                            >
                                Cancel (ยกเลิก)
                            </button>
                            <button 
                                onClick={handleSaveOrderEdit} 
                                className="flex-1 py-3 rounded-xl font-bold bg-green-600 hover:bg-green-700 text-white shadow transition"
                            >
                                Save (บันทึกแก้ไข)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* --- ACTIVE ORDER ITEMS EDITOR MODAL --- */}
            {showOrderItemsEditor && editingOrderForItems && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 print:hidden text-left">
                    <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col h-[90vh] text-gray-800 border border-gray-150 animate-fade-in overflow-hidden">
                        {/* Header */}
                        <div className="bg-amber-600 px-6 py-4 flex items-center justify-between text-white shrink-0">
                            <div>
                                <h3 className="font-extrabold text-lg flex items-center gap-2">
                                    📝 {language === 'th' ? `แก้ไขรายการออเดอร์ #${String(editingOrderForItems.id).slice(-4)}` : `Edit Items for Order #${String(editingOrderForItems.id).slice(-4)}`}
                                </h3>
                                <p className="text-[11px] text-amber-50">
                                    {language === 'th' ? 'เพิ่ม ลด ลบ รายการ หรือเพิ่มเมนูใหม่ในบิลนี้' : 'Modify items, adjust quantities, or add new dishes to this active bill'}
                                </p>
                            </div>
                            <button 
                                onClick={() => { setShowOrderItemsEditor(false); setEditingOrderForItems(null); }} 
                                className="text-white bg-amber-700/50 hover:bg-amber-700 w-8 h-8 flex items-center justify-center rounded-xl text-xl font-bold leading-none transition"
                            >
                                &times;
                            </button>
                        </div>

                        {/* Split layout in Modal Body */}
                        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 bg-gray-50">
                            
                            {/* LEFT SIDE: Current Items & Details */}
                            <div className="flex-1 flex flex-col border-r border-gray-200 p-4 lg:p-6 overflow-y-auto">
                                <h4 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
                                    🛒 {language === 'th' ? 'รายการอาหารในออเดอร์ปัจจุบัน' : 'Current Order Items'} 
                                    <span className="bg-brand-100 text-brand-800 text-[11px] px-2.5 py-0.5 rounded-full font-extrabold font-mono">
                                        {editedItemsList.reduce((acc, i) => acc + i.quantity, 0)} {language === 'th' ? 'ชิ้น' : 'pcs'}
                                    </span>
                                </h4>

                                {/* Order metadata fields */}
                                <div className="grid grid-cols-2 gap-3 mb-4 bg-white p-3 rounded-xl border border-gray-200">
                                    <div>
                                        <label className="text-[10px] uppercase font-extrabold text-gray-400 block mb-0.5">{language === 'th' ? 'ชื่อลูกค้า' : 'Cust Name'}</label>
                                        <input 
                                            type="text" 
                                            className="w-full text-xs font-bold bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500 text-gray-800"
                                            value={editedOrderCustomerName}
                                            onChange={e => setEditedOrderCustomerName(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-extrabold text-gray-400 block mb-0.5">{language === 'th' ? 'เลขโต๊ะ / เบอร์โทร' : 'Table / Tel'}</label>
                                        <input 
                                            type="text" 
                                            className="w-full text-xs font-bold bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500 text-gray-800"
                                            value={editedOrderTableNumber}
                                            onChange={e => setEditedOrderTableNumber(e.target.value)}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] uppercase font-extrabold text-gray-400 block mb-0.5">{language === 'th' ? 'หมายเหตุ / พิเศษ' : 'Remarks / Note'}</label>
                                        <input 
                                            type="text" 
                                            className="w-full text-xs font-bold bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500 text-gray-800"
                                            value={editedOrderNote}
                                            onChange={e => setEditedOrderNote(e.target.value)}
                                            placeholder={language === 'th' ? 'เช่น เผ็ดน้อย, แยกน้ำซอส' : 'e.g. less spicy, sauce on side'}
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] uppercase font-extrabold text-gray-400 block mb-0.5">{language === 'th' ? 'ช่องทางจำหน่าย' : 'Order Source'}</label>
                                        <select 
                                            className="w-full text-xs font-bold bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 outline-none focus:border-amber-500 text-gray-800"
                                            value={editedOrderSource}
                                            onChange={e => setEditedOrderSource(e.target.value as OrderSource)}
                                        >
                                            <option value="store">Store (ทานที่ร้าน / กลับบ้าน)</option>
                                            <option value="grab">Grab Food</option>
                                            <option value="lineman">LineMan</option>
                                            <option value="foodpanda">FoodPanda</option>
                                            <option value="robinhood">Robinhood</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Items list view */}
                                <div className="flex-1 space-y-2 mb-4 scrollbar-thin">
                                    {editedItemsList.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center py-12 text-center text-gray-400">
                                            <p className="text-3xl mb-2">🍽️</p>
                                            <p className="text-xs font-bold">{language === 'th' ? 'ไม่มีรายการอาหารในออเดอร์นี้' : 'No items left in this order.'}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">{language === 'th' ? 'โปรดคลิกเลือกรายการจากทางขวามือ เพื่อเพิ่มอาหาร' : 'Please select dishes from the right side library'}</p>
                                        </div>
                                    ) : (
                                        editedItemsList.map(item => (
                                            <div key={item.id} className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-sm hover:shadow transition flex justify-between items-center gap-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-extrabold text-[13.5px] text-gray-800 leading-tight truncate">
                                                        {language === 'th' ? (item.nameTh || item.name) : item.name}
                                                    </p>
                                                    <p className="text-xs font-black text-brand-605 mt-0.5 font-mono text-brand-600">
                                                        ฿{item.totalPrice.toLocaleString()} 
                                                        <span className="text-[10.5px] text-gray-400 font-normal"> (฿{Math.round(item.totalPrice / item.quantity).toLocaleString()} / ชิ้น)</span>
                                                    </p>
                                                    {item.selectedToppings && item.selectedToppings.length > 0 && (
                                                        <p className="text-[10px] text-gray-500 mt-1 max-w-sm truncate">
                                                            ➕ {item.selectedToppings.map(t => language === 'th' ? (t.nameTh || t.name) : t.name).join(', ')}
                                                        </p>
                                                    )}
                                                    {item.subItems && item.subItems.length > 0 && (
                                                        <p className="text-[10px] text-gray-500 mt-1 max-w-sm truncate italic">
                                                            🧩 {item.subItems.map(s => s.name).join(', ')}
                                                        </p>
                                                    )}
                                                </div>
                                                
                                                {/* Control Qty */}
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                    <button 
                                                        type="button"
                                                        onClick={() => decrementEditedItemQty(item.id)}
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-600 transition font-bold"
                                                    >
                                                        <Minus size={13}/>
                                                    </button>
                                                    <span className="w-8 text-center text-xs font-black font-mono text-gray-800">
                                                        {item.quantity}
                                                    </span>
                                                    <button 
                                                        type="button"
                                                        onClick={() => incrementEditedItemQty(item.id)}
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-600 transition font-bold"
                                                    >
                                                        <Plus size={13}/>
                                                    </button>
                                                    <button 
                                                        type="button"
                                                        onClick={() => deleteEditedItem(item.id)}
                                                        className="w-7 h-7 flex items-center justify-center rounded-lg bg-red-50 hover:bg-red-100 text-red-650 transition ml-1 text-red-650"
                                                    >
                                                        <Trash2 size={13}/>
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* Sum Section */}
                                <div className="bg-gray-150 p-3.5 rounded-xl border border-gray-200 flex justify-between items-center mt-auto">
                                    <span className="text-xs font-bold text-gray-500 uppercase">{language === 'th' ? 'ยอดขายรวมทั้งสิ้น:' : 'Total Adjusted Sum:'}</span>
                                    <span className="text-xl font-black font-mono text-brand-600">
                                        ฿{editedItemsList.reduce((sum, item) => sum + item.totalPrice, 0).toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* RIGHT SIDE: Add New Menu Items Library */}
                            <div className="w-full lg:w-[420px] bg-white p-4 lg:p-6 flex flex-col overflow-hidden">
                                <h4 className="font-extrabold text-gray-700 mb-3 flex items-center gap-1.5 shrink-0 text-sm">
                                    ✨ {language === 'th' ? 'เพิ่มเมนูอาหารในบิล' : 'Add New Dishes'}
                                </h4>

                                {/* Filter & Search bar */}
                                <div className="space-y-2 mb-4 shrink-0">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2 text-gray-400" size={15}/>
                                        <input 
                                            type="text" 
                                            placeholder={language === 'th' ? 'ค้นหาอาหาร...' : 'Search foods...'}
                                            className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg outline-none focus:border-amber-500 font-bold bg-white text-gray-850"
                                            value={addSearchQuery}
                                            onChange={e => setAddSearchQuery(e.target.value)}
                                        />
                                    </div>
                                    
                                    {/* Categories filter badging list */}
                                    <div className="flex gap-1 overflow-x-auto pb-1 select-none scrollbar-none">
                                        <button 
                                            onClick={() => setAddCategoryFilter('all')}
                                            className={`px-2.5 py-1 text-[10.5px] rounded-lg font-bold whitespace-nowrap transition-all shrink-0 ${addCategoryFilter === 'all' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                        >
                                            {language === 'th' ? 'ทั้งหมด' : 'All'}
                                        </button>
                                        {(CATEGORIES || []).map(cat => (
                                            <button 
                                                key={cat.id}
                                                onClick={() => setAddCategoryFilter(cat.id as ProductCategory)}
                                                className={`px-2.5 py-1 text-[10.5px] rounded-lg font-bold whitespace-nowrap transition-all shrink-0 ${addCategoryFilter === cat.id ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                            >
                                                {language === 'th' ? (cat.nameTh || cat.name) : cat.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Menu Items List scrollable wrapper */}
                                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[200px] scrollbar-thin">
                                    {filteredAddMenuMatches.length === 0 ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 py-12">
                                            <p className="text-xl">🔍</p>
                                            <p className="text-[11px] mt-1 font-bold">{language === 'th' ? 'ไม่พบเมนูที่ค้นหา' : 'No foods match your search'}</p>
                                        </div>
                                    ) : (
                                        filteredAddMenuMatches.map(pizza => (
                                            <div 
                                                key={pizza.id}
                                                onClick={() => {
                                                    playClickSound();
                                                    addMenuItemToEditedList(pizza);
                                                }}
                                                className="p-2.5 bg-gray-55 hover:bg-amber-50 border border-gray-150 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition active:scale-[0.98] select-none group"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    {pizza.image && (
                                                        <img 
                                                            src={convertGoogleDriveUrl(pizza.image)} 
                                                            alt={pizza.name}
                                                            className="w-10 h-10 rounded-lg object-cover bg-gray-200 shrink-0 border border-gray-200"
                                                            referrerPolicy="no-referrer"
                                                        />
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-extrabold text-gray-800 leading-tight group-hover:text-amber-805 transition truncate">
                                                            {language === 'th' ? (pizza.nameTh || pizza.name) : pizza.name}
                                                        </p>
                                                        <p className="text-[10.5px] font-bold text-gray-400 group-hover:text-amber-600 font-mono mt-0.5">
                                                            ฿{pizza.basePrice.toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button 
                                                    type="button"
                                                    className="w-6 h-6 flex items-center justify-center rounded-md bg-amber-100 text-amber-700 hover:bg-amber-600 hover:text-white transition shadow-sm shrink-0"
                                                >
                                                    <Plus size={12}/>
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="bg-gray-100 p-4 border-t border-gray-200 flex justify-end gap-3 shrink-0">
                            <button 
                                onClick={() => { setShowOrderItemsEditor(false); setEditingOrderForItems(null); }} 
                                className="px-5 py-2.5 rounded-xl font-bold border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 hover:shadow-sm active:scale-95 transition text-xs"
                            >
                                {language === 'th' ? 'ยกเลิกแก้ไข' : 'Discard Changes'}
                            </button>
                            <button 
                                onClick={handleSaveEditedOrderItems} 
                                className="px-6 py-2.5 rounded-xl font-black bg-brand-600 hover:bg-brand-700 text-white shadow-md active:scale-95 transition text-xs"
                            >
                                {language === 'th' ? '💾 บันทึกและอัปเดตออเดอร์' : '💾 Save & Update Queue'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Customer Coupon Management Modal */}
            {profileCustomer && (() => {
                const cust = profileCustomer;
                const custOrders = (orders || []).filter((o: any) => o.customerPhone && cust.phone && String(o.customerPhone) === String(cust.phone));
                const doneOrders = custOrders.filter((o: any) => o.status === 'completed');
                const totalSpent = doneOrders.reduce((s: number, o: any) => s + (o.totalAmount || 0), 0);
                const recentOrders = [...custOrders].sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()).slice(0, 10);
                let isBirthdayMonth = false;
                if (cust.birthday) {
                    const s = String(cust.birthday).trim();
                    let mm = 0;
                    let m1 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
                    if (m1) mm = parseInt(m1[2], 10); else { m1 = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/); if (m1) mm = parseInt(m1[2], 10); }
                    isBirthdayMonth = mm > 0 && (new Date().getMonth() + 1) === mm;
                }
                const allCoupons = cust.coupons || [];
                const activeCoupons = allCoupons.filter((c: any) => c && !c.isUsed && !(c.expiryDate && new Date() > new Date(`${c.expiryDate}T23:59:59`)));
                return (
                    <div className="fixed inset-0 bg-black/60 z-[998] flex items-center justify-center p-4" onClick={() => setProfileCustomer(null)}>
                        <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[88vh] overflow-y-auto p-6 space-y-4 text-left" onClick={e => e.stopPropagation()}>
                            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-14 h-14 rounded-full bg-brand-500 text-white flex items-center justify-center font-black text-2xl shrink-0">{cust.name ? cust.name.charAt(0).toUpperCase() : 'C'}</div>
                                    <div>
                                        <div className="font-black text-xl text-gray-900 flex items-center gap-2 flex-wrap">
                                            <span>{cust.name || 'Anonymous'}</span>
                                            {cust.tier && (
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${cust.tier === 'Gold' ? 'bg-amber-100 text-amber-800' : cust.tier === 'Silver' ? 'bg-slate-100 text-slate-700' : 'bg-orange-50 text-orange-700'}`}>★ {cust.tier}</span>
                                            )}
                                            {isBirthdayMonth && <span className="bg-pink-100 text-pink-700 text-[10px] font-black px-2 py-0.5 rounded-full">🎂 {language === 'th' ? 'เดือนเกิด!' : 'Birthday month!'}</span>}
                                        </div>
                                        <div className="text-sm font-bold text-gray-500 mt-0.5">📞 {cust.phone}{cust.birthday ? ` · 🎂 ${cust.birthday}` : ''}</div>
                                    </div>
                                </div>
                                <button onClick={() => setProfileCustomer(null)} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={22}/></button>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center">
                                <div className="bg-brand-50 border border-brand-100 rounded-xl p-3">
                                    <div className="text-xl font-black text-brand-600">{cust.loyaltyPoints || 0}</div>
                                    <div className="text-[10px] font-black text-gray-500 uppercase">{language === 'th' ? 'แต้มสะสม' : 'Points'}</div>
                                </div>
                                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                                    <div className="text-xl font-black text-emerald-600">{activeCoupons.length}</div>
                                    <div className="text-[10px] font-black text-gray-500 uppercase">{language === 'th' ? 'คูปองใช้ได้' : 'Active coupons'}</div>
                                </div>
                                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                                    <div className="text-xl font-black text-blue-600">{custOrders.length}</div>
                                    <div className="text-[10px] font-black text-gray-500 uppercase">{language === 'th' ? 'ออเดอร์' : 'Orders'}</div>
                                </div>
                                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                                    <div className="text-xl font-black text-amber-600">฿{totalSpent.toLocaleString()}</div>
                                    <div className="text-[10px] font-black text-gray-500 uppercase">{language === 'th' ? 'ยอดสะสม' : 'Total spent'}</div>
                                </div>
                            </div>
                            {cust.address && (
                                <div className="text-xs font-bold text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">🏠 {cust.address}</div>
                            )}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-black text-sm text-gray-700">🎟️ {language === 'th' ? 'คูปองทั้งหมด' : 'Coupons'} ({allCoupons.length})</h4>
                                    <button onClick={() => setSelectedCouponCustomer(cust)} className="text-xs font-black text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 hover:bg-amber-100">➕ {language === 'th' ? 'เพิ่ม/จัดการคูปอง' : 'Add / Manage'}</button>
                                </div>
                                {allCoupons.length === 0 ? (
                                    <div className="text-xs text-gray-400 font-bold py-2">{language === 'th' ? 'ยังไม่มีคูปอง' : 'No coupons'}</div>
                                ) : (
                                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                                        {allCoupons.map((c: any, i: number) => {
                                            const expired = c.expiryDate ? (new Date() > new Date(`${c.expiryDate}T23:59:59`)) : false;
                                            const statusTxt = c.isUsed ? (language === 'th' ? 'ใช้แล้ว' : 'Used') : expired ? (language === 'th' ? 'หมดอายุ' : 'Expired') : (language === 'th' ? 'ใช้ได้' : 'Active');
                                            const chip = c.isUsed ? 'bg-gray-100 text-gray-500' : expired ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700';
                                            return (
                                                <div key={String(c.id) + '_' + i} className="flex justify-between items-center border border-gray-100 rounded-lg px-2.5 py-1.5">
                                                    <div className="text-xs font-bold text-gray-700 leading-tight">
                                                        <span className="font-black">{c.code}</span> · {language === 'th' ? (c.titleTh || c.title) : c.title}
                                                        {c.expiryDate && <span className="block text-[10px] text-gray-400 font-medium">Exp: {c.expiryDate}</span>}
                                                    </div>
                                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 ml-2 ${chip}`}>{statusTxt}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                            <div>
                                <h4 className="font-black text-sm text-gray-700 mb-2">🧾 {language === 'th' ? `ประวัติออเดอร์ (ล่าสุด ${recentOrders.length} รายการ)` : `Order history (last ${recentOrders.length})`}</h4>
                                {recentOrders.length === 0 ? (
                                    <div className="text-xs text-gray-400 font-bold py-2">{language === 'th' ? 'ยังไม่พบออเดอร์ของเบอร์นี้ในระบบ' : 'No orders found for this phone'}</div>
                                ) : (
                                    <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                        {recentOrders.map((o: any) => (
                                            <div key={o.id} className="flex justify-between items-center border border-gray-100 rounded-lg px-2.5 py-1.5 text-xs">
                                                <div className="font-bold text-gray-700 leading-tight">
                                                    #{String(o.id).slice(-4)} · {o.createdAt ? new Date(o.createdAt).toLocaleString(language === 'th' ? 'th-TH' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}
                                                    <span className="block text-[10px] text-gray-400 font-medium">{(o.items || []).slice(0, 3).map((it: any) => `${it.quantity}x ${(language === 'th' && it.nameTh) ? it.nameTh : it.name}`).join(', ')}{(o.items || []).length > 3 ? ' …' : ''}</span>
                                                </div>
                                                <div className="text-right shrink-0 ml-2">
                                                    <span className="font-black text-gray-900 block">฿{(o.totalAmount || 0).toLocaleString()}</span>
                                                    <span className={`text-[9px] font-black uppercase ${o.status === 'completed' ? 'text-green-600' : o.status === 'cancelled' ? 'text-red-500' : 'text-amber-600'}`}>{o.status}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })()}
            {selectedCouponCustomer && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedCouponCustomer(null)}>
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col font-sans" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                            <div>
                                <h2 className="font-extrabold text-lg text-gray-800 flex items-center gap-2">
                                    <Gift className="text-amber-500" size={22}/>
                                    <span>{language === 'th' ? `จัดการคูปองของ: ${selectedCouponCustomer.name || 'ลูกค้า'}` : `Manage Coupons for: ${selectedCouponCustomer.name || 'Customer'}`}</span>
                                </h2>
                                <p className="text-xs text-gray-400 mt-0.5">{language === 'th' ? `เบอร์โทรศัพท์: ${selectedCouponCustomer.phone}` : `Phone: ${selectedCouponCustomer.phone}`}</p>
                            </div>
                            <button onClick={() => setSelectedCouponCustomer(null)} className="text-gray-400 hover:text-gray-600 p-1 bg-white border border-gray-200 rounded-full hover:shadow-sm transition"><X size={18}/></button>
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-6">
                            {/* Issue Coupon Form */}
                            <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-100 space-y-4 text-left">
                                <h3 className="font-extrabold text-sm text-amber-800 flex items-center gap-1.5 border-b border-amber-100/60 pb-1.5">
                                    <Sparkles size={16} className="text-amber-500 animate-pulse"/>
                                    <span>{language === 'th' ? 'ออกคูปองใหม่ให้สมาชิก' : 'Issue New Coupon'}</span>
                                </h3>

                                {/* Quick Templates */}
                                <div>
                                    <label className="block text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">
                                        ⚡ {language === 'th' ? 'เลือกจากเทมเพลตด่วน' : 'Quick Templates'}
                                    </label>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                        <button 
                                            type="button"
                                            onClick={() => handleSelectCouponTemplate('new_member')}
                                            className="px-2.5 py-1.5 bg-white hover:bg-amber-100 text-[11px] font-bold text-gray-750 border border-gray-200 rounded-lg shadow-xs hover:border-amber-400 transition cursor-pointer text-left"
                                        >
                                            🆕 {language === 'th' ? 'สมาชิกใหม่ (10%)' : 'New Member (10%)'}
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => handleSelectCouponTemplate('monthly_promo')}
                                            className="px-2.5 py-1.5 bg-white hover:bg-amber-100 text-[11px] font-bold text-gray-750 border border-gray-200 rounded-lg shadow-xs hover:border-amber-400 transition cursor-pointer text-left"
                                        >
                                            📅 {language === 'th' ? 'ส่วนลดเดือนนี้ (15%)' : 'Monthly Promo (15%)'}
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => handleSelectCouponTemplate('free_delivery')}
                                            className="px-2.5 py-1.5 bg-white hover:bg-amber-100 text-[11px] font-bold text-gray-750 border border-gray-200 rounded-lg shadow-xs hover:border-amber-400 transition cursor-pointer text-left"
                                        >
                                            🚚 {language === 'th' ? 'ส่งฟรี (สูงสุด ฿100)' : 'Free Shipping (฿100)'}
                                        </button>
                                        <button 
                                            type="button"
                                            onClick={() => handleSelectCouponTemplate('member_discount')}
                                            className="px-2.5 py-1.5 bg-white hover:bg-amber-100 text-[11px] font-bold text-gray-750 border border-gray-200 rounded-lg shadow-xs hover:border-amber-400 transition cursor-pointer text-left"
                                        >
                                            🎟️ {language === 'th' ? 'ส่วนลดเงินสด (฿50)' : 'Cash Discount (฿50)'}
                                        </button>
                                    </div>
                                </div>

                                {/* Form Fields */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-600 mb-1">{language === 'th' ? 'รหัสคูปอง' : 'Coupon Code'}</label>
                                        <input 
                                            type="text" 
                                            value={newCouponCode}
                                            onChange={(e) => setNewCouponCode(e.target.value)}
                                            placeholder="e.g. SPECIAL10"
                                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg font-mono text-xs uppercase font-extrabold outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-200 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-600 mb-1">{language === 'th' ? 'ป้ายแท็ก (TH)' : 'Badge/Tag (TH)'}</label>
                                        <input 
                                            type="text" 
                                            value={newCouponBadgeTh}
                                            onChange={(e) => setNewCouponBadgeTh(e.target.value)}
                                            placeholder="เช่น สมาชิกใหม่"
                                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-amber-400 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-600 mb-1">{language === 'th' ? 'ป้ายแท็ก (EN)' : 'Badge/Tag (EN)'}</label>
                                        <input 
                                            type="text" 
                                            value={newCouponBadgeEn}
                                            onChange={(e) => setNewCouponBadgeEn(e.target.value)}
                                            placeholder="e.g. New Member"
                                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-amber-400 bg-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-600 mb-1">{language === 'th' ? 'หัวข้อคูปอง (TH)' : 'Coupon Title (TH)'}</label>
                                        <input 
                                            type="text" 
                                            value={newCouponTitleTh}
                                            onChange={(e) => setNewCouponTitleTh(e.target.value)}
                                            placeholder="เช่น ส่วนลดพิเศษสมาชิกใหม่"
                                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-amber-400 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-600 mb-1">{language === 'th' ? 'หัวข้อคูปอง (EN)' : 'Coupon Title (EN)'}</label>
                                        <input 
                                            type="text" 
                                            value={newCouponTitleEn}
                                            onChange={(e) => setNewCouponTitleEn(e.target.value)}
                                            placeholder="e.g. Special New Member Discount"
                                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-amber-400 bg-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-600 mb-1">{language === 'th' ? 'คำอธิบาย (TH)' : 'Description (TH)'}</label>
                                        <input 
                                            type="text" 
                                            value={newCouponDescTh}
                                            onChange={(e) => setNewCouponDescTh(e.target.value)}
                                            placeholder="เช่น ลด 10% สำหรับพิซซ่าหน้าใดก็ได้ 1 ถาดที่ราคาแพงที่สุด"
                                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium outline-none focus:border-amber-400 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-600 mb-1">{language === 'th' ? 'คำอธิบาย (EN)' : 'Description (EN)'}</label>
                                        <input 
                                            type="text" 
                                            value={newCouponDescEn}
                                            onChange={(e) => setNewCouponDescEn(e.target.value)}
                                            placeholder="e.g. 10% off the most expensive single pizza item"
                                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium outline-none focus:border-amber-400 bg-white"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-600 mb-1">{language === 'th' ? 'ประเภทส่วนลด' : 'Discount Type'}</label>
                                        <select 
                                            value={newCouponType}
                                            onChange={(e) => setNewCouponType(e.target.value)}
                                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-amber-400 bg-white h-8"
                                        >
                                            <option value="percentage_most_expensive">{language === 'th' ? 'เปอร์เซ็นต์ (%): พิซซ่าที่แพงที่สุด' : 'Percentage (%): Most Expensive Pizza'}</option>
                                            <option value="percentage_total">{language === 'th' ? 'เปอร์เซ็นต์ (%): ยอดรวมออเดอร์' : 'Percentage (%): Total Order'}</option>
                                            <option value="fixed_discount">{language === 'th' ? 'ลดคงที่ (บาท): ยอดรวมออเดอร์' : 'Fixed Cash Discount (THB)'}</option>
                                            <option value="free_delivery">{language === 'th' ? 'ส่งฟรี (บาท): ค่าส่งตามระยะทาง' : 'Free Shipping (THB Limit)'}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-600 mb-1">{language === 'th' ? 'มูลค่าส่วนลด' : 'Discount Value'}</label>
                                        <input 
                                            type="number" 
                                            value={newCouponValue}
                                            onChange={(e) => setNewCouponValue(Number(e.target.value || 0))}
                                            placeholder="เช่น 10 หรือ 50"
                                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-amber-400 bg-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-bold text-gray-600 mb-1">{language === 'th' ? 'ขั้นต่ำการสั่งซื้อ (บาท)' : 'Min. Order Amount (THB)'}</label>
                                        <input 
                                            type="number" 
                                            value={newCouponMinOrder}
                                            onChange={(e) => setNewCouponMinOrder(Number(e.target.value || 0))}
                                            placeholder="เช่น 0 หรือ 300"
                                            className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-bold outline-none focus:border-amber-400 bg-white"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end pt-2">
                                    <button 
                                        type="button"
                                        onClick={handleAddCouponToCustomer}
                                        className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold px-6 py-2 rounded-xl text-xs transition shadow-md hover:shadow flex items-center gap-1.5 active:scale-95 cursor-pointer"
                                    >
                                        <Plus size={14}/>
                                        <span>{language === 'th' ? 'มอบคูปองให้ลูกค้า' : 'Issue Coupon to Customer'}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Current Coupons List */}
                            <div className="space-y-3 text-left">
                                <h3 className="font-extrabold text-sm text-gray-700 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                                    <Ticket size={16} className="text-gray-400"/>
                                    <span>{language === 'th' ? 'รายการคูปองปัจจุบันของลูกค้า' : 'Customer Active & Used Coupons'}</span>
                                    <span className="bg-gray-100 px-2 py-0.5 rounded-full text-xs font-bold text-gray-500 ml-auto">
                                        {(selectedCouponCustomer.coupons || []).length}
                                    </span>
                                </h3>

                                {(selectedCouponCustomer.coupons || []).length === 0 ? (
                                    <div className="p-8 text-center text-gray-400 font-medium text-xs border border-dashed border-gray-200 rounded-xl bg-gray-50">
                                        🎟️ {language === 'th' ? 'ยังไม่มีคูปอง' : 'No coupons issued yet'}
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                                        {(selectedCouponCustomer.coupons || []).map((c: any) => (
                                            <div 
                                                key={c.id}
                                                className={`p-3 rounded-xl border flex items-start gap-3 transition relative ${
                                                    c.isUsed 
                                                        ? 'bg-gray-50/80 border-gray-200 opacity-60' 
                                                        : 'bg-white border-amber-200 ring-1 ring-amber-100/50'
                                                }`}
                                            >
                                                <div className={`p-2 rounded-xl text-white shrink-0 mt-0.5 ${c.isUsed ? 'bg-gray-400' : 'bg-amber-500 animate-pulse'}`}>
                                                    <Gift size={16} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="text-xs font-black text-gray-900 font-mono bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                                            {c.code}
                                                        </span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 font-bold rounded ${c.isUsed ? 'bg-gray-200 text-gray-650' : 'bg-amber-100 text-amber-800'}`}>
                                                            {language === 'th' ? c.badgeTh || c.badge : c.badge}
                                                        </span>
                                                        {c.isUsed && (
                                                            <span className="text-[10px] px-1.5 py-0.5 font-extrabold rounded bg-red-100 text-red-700">
                                                                {language === 'th' ? 'ใช้แล้ว' : 'USED'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <h4 className="text-xs font-extrabold text-gray-800 mt-2">
                                                        {language === 'th' ? c.titleTh || c.title : c.title}
                                                    </h4>
                                                    <p className="text-[10.5px] text-gray-500 mt-0.5 leading-snug">
                                                        {language === 'th' ? c.descriptionTh || c.description : c.description}
                                                    </p>
                                                    <div className="text-[10px] font-semibold text-gray-400 mt-1 font-mono">
                                                        {language === 'th' 
                                                            ? `ประเภท: ${c.discountType === 'percentage_most_expensive' ? 'ลดหน้าแพงสุด %' : c.discountType === 'percentage_total' ? 'ลดท้ายบิล %' : c.discountType === 'fixed_discount' ? 'ลดคงที่' : 'ส่งฟรี'}, มูลค่า: ฿${c.discountValue}, ขั้นต่ำ: ฿${c.minOrderAmount}`
                                                            : `Type: ${c.discountType}, Value: ${c.discountValue}, Min: ฿${c.minOrderAmount}`}
                                                    </div>
                                                    
                                                    {/* Actions inside individual coupon */}
                                                    <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-gray-100">
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleToggleCouponUsedStatus(c.id)}
                                                            className={`px-2 py-0.5 text-[9.5px] font-bold rounded transition cursor-pointer flex items-center gap-0.5 ${
                                                                c.isUsed 
                                                                    ? 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200' 
                                                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-250'
                                                            }`}
                                                        >
                                                            <CheckCircle2 size={10}/>
                                                            <span>{c.isUsed ? (language === 'th' ? 'เปลี่ยนเป็นยังไม่ใช้' : 'Mark Unused') : (language === 'th' ? 'เปลี่ยนเป็นใช้แล้ว' : 'Mark Used')}</span>
                                                        </button>
                                                        <button 
                                                            type="button"
                                                            onClick={() => handleRemoveCouponFromCustomer(c.id)}
                                                            className="px-2 py-0.5 text-[9.5px] font-bold rounded bg-red-50 hover:bg-red-100 text-red-650 border border-red-200 transition cursor-pointer flex items-center gap-0.5 ml-auto text-red-650"
                                                        >
                                                            <Trash2 size={10}/>
                                                            <span>{language === 'th' ? 'ลบออก' : 'Delete'}</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="bg-gray-50 p-4 border-t border-gray-150 flex justify-end shrink-0">
                            <button 
                                type="button"
                                onClick={() => setSelectedCouponCustomer(null)} 
                                className="px-5 py-2 rounded-xl font-bold border border-gray-300 text-gray-700 bg-white hover:bg-gray-100 transition text-xs cursor-pointer"
                            >
                                {language === 'th' ? 'ปิดหน้าต่าง' : 'Close Management'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
