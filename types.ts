// ---------------------------------------------------------------------------
// SAVE QR/IMAGE ที่ใช้ได้จริงทุกเครื่อง — แก้บั๊ก "กดบันทึก QR แล้วรูปไม่ลงเครื่อง"
// สาเหตุเดิม: <a download href="data:..."> ใช้ไม่ได้บน iOS Safari และ in-app
// browser (LINE/Facebook/IG) — กดแล้วเงียบหาย ลูกค้าคิดว่าบันทึกแล้ว
// วิธีใหม่ 3 ชั้น:
//   1) Web Share API พร้อมไฟล์รูป → เด้งชีทแชร์ของเครื่อง ลูกค้ากด "บันทึกรูปภาพ"
//      (ทางเดียวที่ลงรูปใน Photos ได้จริงจาก LINE browser / iPhone)
//   2) ดาวน์โหลดผ่าน blob URL (คอม + Android Chrome ปกติ)
//   3) ป๊อปอัปรูปใหญ่ + คำแนะนำ "กดค้างที่รูปแล้วเลือกบันทึกรูปภาพ" (ใช้ได้ทุกที่)
// ---------------------------------------------------------------------------

export type SaveImageResult = 'shared' | 'downloaded' | 'manual' | 'cancelled';

const isInAppBrowser = (): boolean =>
  /Line\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|TikTok/i.test(navigator.userAgent || '');

const isIOS = (): boolean =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent || '') ||
  (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1); // iPadOS

// ป๊อปอัปชั้นสุดท้าย: โชว์รูปใหญ่ให้กดค้างบันทึกเอง (ทำงานได้แม้ browser บล็อกทุกอย่าง)
const showLongPressOverlay = (blob: Blob, lang: 'th' | 'en') => {
  const url = URL.createObjectURL(blob);
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.88);z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;gap:14px;';
  const img = document.createElement('img');
  img.src = url;
  img.alt = 'QR';
  img.style.cssText = 'max-width:82vw;max-height:58vh;border-radius:16px;background:#fff;box-shadow:0 10px 40px rgba(0,0,0,.5);';
  const tip = document.createElement('div');
  tip.textContent = lang === 'th' ? '👆 กดค้างที่รูป แล้วเลือก "บันทึกรูปภาพ" หรือแคปหน้าจอได้เลย' : '👆 Long-press the image, then tap "Save Image" (or take a screenshot)';
  tip.style.cssText = 'color:#fff;font-weight:800;font-size:15px;text-align:center;line-height:1.5;max-width:320px;';
  const close = document.createElement('button');
  close.textContent = lang === 'th' ? 'ปิดหน้าต่างนี้' : 'Close';
  close.style.cssText = 'margin-top:4px;background:#fff;color:#111;font-weight:800;font-size:14px;padding:10px 26px;border-radius:12px;border:0;cursor:pointer;';
  close.onclick = () => { try { document.body.removeChild(overlay); } catch (e) {} URL.revokeObjectURL(url); };
  overlay.appendChild(img);
  overlay.appendChild(tip);
  overlay.appendChild(close);
  document.body.appendChild(overlay);
};

export const saveCanvasImage = async (
  canvas: HTMLCanvasElement,
  filename: string,
  lang: 'th' | 'en' = 'th',
  mime: string = 'image/jpeg'
): Promise<SaveImageResult> => {
  const blob: Blob | null = await new Promise(res => {
    try { canvas.toBlob(b => res(b), mime, 1.0); } catch (e) { res(null); }
  });
  if (!blob) {
    alert(lang === 'th' ? 'สร้างรูปไม่สำเร็จ กรุณาแคปหน้าจอแทน' : 'Could not build the image — please screenshot instead.');
    return 'manual';
  }

  // (1) ชีทแชร์เนทีฟพร้อมไฟล์ — ปลายทางที่ลงรูปในเครื่องได้จริงบนมือถือ
  try {
    const nav: any = navigator;
    const file = new File([blob], filename, { type: mime });
    if (nav.share && nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title: 'Pizza Damac PromptPay QR' });
      return 'shared';
    }
  } catch (e: any) {
    if (e && (e.name === 'AbortError' || /abort/i.test(String(e.message || '')))) return 'cancelled'; // ผู้ใช้ปิดชีทเอง = จบ ไม่ต้องเด้งต่อ
    // แชร์พัง → ไหลลงชั้นถัดไป
  }

  // (2) มือถือ iOS / in-app browser: download attribute ใช้ไม่ได้ → ไปป๊อปอัปกดค้างเลย
  if (isInAppBrowser() || isIOS()) {
    showLongPressOverlay(blob, lang);
    return 'manual';
  }

  // (3) คอม + Android browser ปกติ: ดาวน์โหลดจริงผ่าน blob URL
  try {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return 'downloaded';
  } catch (e) {
    showLongPressOverlay(blob, lang);
    return 'manual';
  }
};

// ประกอบ QR ความละเอียดสูง 800x800 พื้นขาว + ขอบ (สแกนจากแอปธนาคารชัวร์)
// แล้วบันทึกด้วยระบบ 3 ชั้นด้านบน — ใช้ได้กับ QR canvas ทุกขนาด
export const saveQrHiRes = async (
  sourceCanvas: HTMLCanvasElement,
  filename: string,
  lang: 'th' | 'en' = 'th'
): Promise<SaveImageResult> => {
  const off = document.createElement('canvas');
  off.width = 800;
  off.height = 800;
  const ctx = off.getContext('2d');
  if (!ctx) return saveCanvasImage(sourceCanvas, filename, lang);
  ctx.imageSmoothingEnabled = false; // คง pixel คมของ QR ตอนขยาย
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 800, 800);
  ctx.strokeStyle = '#f1f5f9';
  ctx.lineWidth = 12;
  ctx.strokeRect(20, 20, 760, 760);
  ctx.drawImage(sourceCanvas, 80, 80, 640, 640);
  return saveCanvasImage(off, filename, lang, 'image/jpeg');
};
