import React, { useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Download } from 'lucide-react';
import { savePromptPayCard } from '../../utils/saveImage';

// ---------------------------------------------------------------------------
// THAI QR PAYMENT CARD — หน้าตา QR จ่ายเงินสไตล์ทางการเหมือนแอปธนาคาร
// แถบ THAI QR PAYMENT + โลโก้ PromptPay + QR พร้อมโลโก้ D กลาง + ยอดส้ม + วันหมดอายุ
// ใช้ที่: modal หลังสั่ง (CustomerView), การ์ดติดตามออเดอร์, TrackView
// ปุ่มบันทึกรูป → ได้การ์ดแบบเดียวกันนี้เป็นไฟล์รูป (วาดใหม่ความละเอียดสูง)
// ---------------------------------------------------------------------------

// โลโก้ D กลาง QR (ขอบขาว + กล่องส้ม) — ฝังใน QR ด้วย excavate + level H
export const DAMAC_QR_LOGO = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="132" height="132"><rect width="132" height="132" rx="34" fill="#ffffff"/><rect x="8" y="8" width="116" height="116" rx="28" fill="#EA580C"/><text x="66" y="94" font-family="Arial, Helvetica, sans-serif" font-size="80" font-weight="900" fill="#ffffff" text-anchor="middle">D</text></svg>`
);

// วันหมดอายุ = สิ้นวันนี้ (นโยบายร้าน: บิลจ่ายภายในวัน) รูปแบบ "12 ก.ค. 2569, 23:59"
export const qrExpiryText = (): string => {
  const d = new Date();
  const date = d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  return `QR นี้มีอายุถึง ${date}, 23:59`;
};

const fmtAmount = (amount: number): string =>
  `฿${Number(amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const ThaiQRCard: React.FC<{
  qrValue: string;
  amount: number;
  canvasId: string;
  refNo?: string;       // เลขออเดอร์ท้าย 4 ตัว
  size?: number;        // ขนาด QR บนจอ
  language?: string;
  showSave?: boolean;
}> = ({ qrValue, amount, canvasId, refNo, size = 190, language = 'th', showSave = true }) => {
  const th = language !== 'en';
  const [saving, setSaving] = useState(false);
  const logoSize = Math.round(size * 0.22);

  const handleSave = async () => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas || saving) return;
    setSaving(true);
    try {
      await savePromptPayCard(canvas, {
        amountText: fmtAmount(amount),
        expiryText: qrExpiryText(),
        refText: `${refNo ? `ออเดอร์ #${refNo} • ` : ''}pizzadamac.com`
      }, `PizzaDamac-QR-${refNo || 'Payment'}.jpg`, th ? 'th' : 'en');
    } catch (e) {
      console.error('Save QR card failed', e);
      alert(th ? 'บันทึกอัตโนมัติไม่ได้ — กรุณาแคปหน้าจอแทนได้เลย' : 'Auto-save failed — please screenshot instead.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full max-w-[300px] mx-auto bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* แถบหัว THAI QR PAYMENT */}
      <div className="bg-gray-100 py-2.5 flex items-center justify-center gap-2">
        <span className="relative inline-grid grid-cols-2 gap-[2px] bg-brand-600 rounded-md p-[5px]" style={{ width: 26, height: 26 }}>
          <span className="bg-white rounded-[2px]"></span>
          <span className="bg-white rounded-[2px]"></span>
          <span className="bg-white rounded-[2px]"></span>
          <span className="bg-brand-600 border border-white/70 rounded-[2px]"></span>
        </span>
        <span className="text-brand-600 font-black leading-none text-left" style={{ fontSize: 13 }}>
          THAI QR<br />PAYMENT
        </span>
      </div>

      <div className="p-4 flex flex-col items-center">
        {/* โลโก้ PromptPay */}
        <div className="border-2 border-brand-600 rounded-lg px-4 py-1.5 mb-3 relative">
          <span className="absolute -top-0.5 right-1.5 text-[8px] italic font-bold text-brand-600">พร้อมเพย์</span>
          <span className="font-extrabold text-lg leading-none">
            <span className="text-gray-700">Prompt</span><span className="text-brand-600">Pay</span>
          </span>
        </div>

        {/* QR + โลโก้ D กลาง */}
        <QRCodeCanvas
          id={canvasId}
          value={qrValue}
          size={size}
          level="H"
          includeMargin={true}
          imageSettings={{ src: DAMAC_QR_LOGO, width: logoSize, height: logoSize, excavate: true }}
        />

        {/* ยอดเงิน */}
        <div className="text-brand-600 font-black text-2xl mt-2">
          {th ? 'ทั้งหมด: ' : 'Total: '}{fmtAmount(amount)}
        </div>

        {/* หมดอายุ + เว็บ */}
        <div className="text-[11px] text-gray-400 font-semibold mt-1.5 text-center leading-relaxed">
          {qrExpiryText()}<br />
          <span className="text-brand-600 font-bold">{refNo ? `ออเดอร์ #${refNo} • ` : ''}pizzadamac.com</span>
        </div>

        {showSave && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-3 flex items-center justify-center gap-1.5 px-4 py-2 bg-brand-600 text-white hover:bg-brand-700 active:scale-95 text-xs font-bold rounded-lg transition shadow-md w-full disabled:opacity-60"
          >
            <Download size={13} />
            {saving ? '...' : (th ? 'บันทึกรูป QR ลงเครื่อง' : 'Save QR Image')}
          </button>
        )}
      </div>
    </div>
  );
};

export default ThaiQRCard;
