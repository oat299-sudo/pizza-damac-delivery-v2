import React, { useEffect, useState } from 'react';
import { useStore } from '../context/StoreContext';
import { Package, Truck, CheckCircle, ExternalLink, ArrowLeft, RefreshCw } from 'lucide-react';
import { getLalamoveQuote, fetchRealLalamoveQuote } from '../services/lalamoveService';

export const TrackView: React.FC = () => {
    const { trackingOrderId, orders, navigateTo, language, t } = useStore();
    const order = orders.find(o => o.id === trackingOrderId);
    
    if (!order) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
                <div className="text-center">
                    <p className="text-gray-500 mb-4">{language === 'th' ? 'ไม่พบออเดอร์นี้' : 'Order not found'}</p>
                    <button onClick={() => navigateTo('customer')} className="text-brand-600 font-bold hover:underline">
                        {language === 'th' ? 'กลับหน้าหลัก' : 'Back to Home'}
                    </button>
                </div>
            </div>
        );
    }
    
    const steps = [
        { key: 'pending', labelTh: 'รับออเดอร์', labelEn: 'Received', icon: Package },
        { key: 'cooking', labelTh: 'กำลังทำ', labelEn: 'Cooking', icon: RefreshCw },
        { key: 'ready', labelTh: 'พร้อมส่ง', labelEn: 'Ready', icon: CheckCircle },
        { key: 'shipping', labelTh: 'กำลังไปส่ง', labelEn: 'Shipping', icon: Truck },
        { key: 'completed', labelTh: 'ส่งสำเร็จ', labelEn: 'Completed', icon: CheckCircle }
    ];
    
    let currentStepIndex = 0;
    if (order.status === 'confirmed' || order.status === 'acknowledged') currentStepIndex = 1;
    if (order.status === 'cooking') currentStepIndex = 1;
    if (order.status === 'ready') currentStepIndex = 2;
    if (order.delivery_status === 'ongoing' || order.delivery_status === 'picked_up') currentStepIndex = 3;
    if (order.status === 'completed' || order.delivery_status === 'completed') currentStepIndex = 4;
    
    return (
        <div className="min-h-screen bg-gray-50 pb-20">
            <div className="bg-white sticky top-0 z-10 shadow-sm border-b">
                <div className="max-w-lg mx-auto px-4 h-16 flex items-center justify-between">
                    <button onClick={() => navigateTo('customer')} className="text-gray-500 hover:text-gray-900">
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-lg font-black text-gray-800">
                        {language === 'th' ? 'ติดตามสถานะ' : 'Track Order'}
                    </h1>
                    <div className="w-6"></div>
                </div>
            </div>
            
            <div className="max-w-lg mx-auto p-4 space-y-4 mt-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <div className="flex justify-between items-end mb-6 border-b pb-4">
                        <div>
                            <p className="text-xs font-bold text-gray-400 uppercase">Order ID</p>
                            <p className="font-black text-lg text-gray-800">#{order.id.slice(-6)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-xs font-bold text-gray-400 uppercase">{language === 'th' ? 'ยอดรวม' : 'Total'}</p>
                            <p className="font-black text-lg text-brand-600">฿{order.totalAmount}</p>
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                        {steps.map((step, idx) => {
                            const isActive = idx === currentStepIndex;
                            const isPast = idx < currentStepIndex;
                            const Icon = step.icon;
                            return (
                                <div key={step.key} className={`flex items-center gap-4 ${isPast ? 'opacity-50' : ''}`}>
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 transition ${isActive ? 'bg-brand-50 border-brand-500 text-brand-600 shadow-md' : isPast ? 'bg-gray-100 border-gray-200 text-gray-400' : 'bg-white border-gray-200 text-gray-300'}`}>
                                        <Icon size={isActive ? 20 : 16} />
                                    </div>
                                    <div>
                                        <p className={`font-bold ${isActive ? 'text-brand-600 text-lg' : isPast ? 'text-gray-500' : 'text-gray-400'}`}>
                                            {language === 'th' ? step.labelTh : step.labelEn}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
                
                {order.lalamove_share_link && order.delivery_status !== 'completed' && order.delivery_status !== 'canceled' && (
                    <a href={order.lalamove_share_link} target="_blank" rel="noopener noreferrer" className="block w-full bg-orange-500 hover:bg-orange-600 text-white rounded-2xl p-4 text-center font-bold shadow-md transition flex items-center justify-center gap-2">
                        <Truck size={20} />
                        {language === 'th' ? 'ดูตำแหน่งไรเดอร์ (Lalamove)' : 'Track Lalamove Rider'}
                        <ExternalLink size={16} />
                    </a>
                )}
            </div>
        </div>
    );
};
