import React, { useState, useEffect } from 'react';
import { Truck, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { checkLalamoveStatus, LalamoveStatusResponse } from '../../services/lalamoveService';
import { useStore } from '../../context/StoreContext';

export const LalamoveSettingsCard = () => {
  const { language } = useStore();
  const [status, setStatus] = useState<'loading' | 'online' | 'offline'>('loading');
  const [message, setMessage] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStatus = async () => {
    setIsRefreshing(true);
    try {
      const res = await checkLalamoveStatus();
      setStatus(res.status);
      setMessage(res.message);
    } catch (err: any) {
      setStatus('offline');
      setMessage(err.message);
    }
    setIsRefreshing(false);
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mt-6">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
        <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
          <Truck size={20} className="text-orange-500" />
          {language === 'th' ? 'การเชื่อมต่อ Lalamove API' : 'Lalamove API Connection'}
        </h3>
        <button 
          onClick={fetchStatus}
          disabled={isRefreshing}
          className="text-gray-400 hover:text-gray-600 transition"
          title={language === 'th' ? 'รีเฟรช' : 'Refresh'}
        >
          <RefreshCw size={18} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-3 bg-gray-50 p-4 rounded-xl border border-gray-100">
          {status === 'loading' ? (
            <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />
          ) : status === 'online' ? (
            <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={24} />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
              <AlertCircle size={24} />
            </div>
          )}
          
          <div className="flex-1">
            <h4 className="font-bold text-gray-800 text-sm">
              {status === 'loading' 
                ? (language === 'th' ? 'กำลังตรวจสอบสถานะ...' : 'Checking connection...') 
                : status === 'online' 
                  ? (language === 'th' ? 'เชื่อมต่อ Lalamove สำเร็จ (Production)' : 'Connected to Lalamove Production') 
                  : (language === 'th' ? 'จำลองระบบ (ไม่พบ API Key)' : 'Simulator Mode (API Keys missing)')}
            </h4>
            <p className={`text-xs mt-0.5 ${status === 'online' ? 'text-emerald-600' : 'text-gray-500'}`}>
              {message}
            </p>
          </div>
        </div>

        {status === 'offline' && (
          <div className="bg-orange-50 text-orange-800 p-4 rounded-xl text-sm border border-orange-100">
            <p className="font-bold mb-1">
              {language === 'th' ? 'วิธีตั้งค่า API Key' : 'How to configure API Keys'}
            </p>
            <p className="text-xs">
              {language === 'th' ? 
                'หากคุณต้องการเรียก Lalamove จริง ให้เพิ่ม LALAMOVE_API_KEY, LALAMOVE_API_SECRET และ LALAMOVE_MARKET (ตั้งค่าเป็น TH) ลงใน Environment Variables (ตั้งค่าผ่าน AI Studio Settings)' 
                : 'To enable real Lalamove dispatching, add LALAMOVE_API_KEY, LALAMOVE_API_SECRET, and LALAMOVE_MARKET (set to TH) in your Environment Variables (via AI Studio Settings).'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
