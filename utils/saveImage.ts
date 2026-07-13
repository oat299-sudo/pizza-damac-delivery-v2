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

// ---------------------------------------------------------------------------
// THAI QR PAYMENT CARD — วาดการ์ดสไตล์ทางการ (แถบ THAI QR PAYMENT + โลโก้
// PromptPay + QR พร้อมโลโก้ D กลาง + ยอดเงินสีส้ม + วันหมดอายุ) แล้วบันทึก
// ---------------------------------------------------------------------------
const ORANGE = '#EA580C';

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// โลโก้ D กลาง QR (ขอบขาวช่วยให้ QR อ่านง่าย) — วาดสดบน canvas ให้คมทุกขนาด
const drawDBadge = (ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) => {
  const half = size / 2;
  ctx.save();
  // ขอบขาวรอบนอก
  roundRect(ctx, cx - half - size * 0.08, cy - half - size * 0.08, size * 1.16, size * 1.16, size * 0.3);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  // กล่องส้ม
  roundRect(ctx, cx - half, cy - half, size, size, size * 0.24);
  ctx.fillStyle = ORANGE;
  ctx.fill();
  // ตัว D
  ctx.fillStyle = '#ffffff';
  ctx.font = `900 ${Math.round(size * 0.62)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('D', cx, cy + size * 0.03);
  ctx.restore();
};

export interface PromptPayCardOpts {
  amountText: string;   // เช่น "฿135.00"
  expiryText: string;   // เช่น "QR นี้มีอายุถึง 12 ก.ค. 2569, 23:59"
  refText?: string;     // เช่น "ออเดอร์ #1234 • pizzadamac.com"
}

export const composePromptPayCard = (sourceCanvas: HTMLCanvasElement, opts: PromptPayCardOpts): HTMLCanvasElement => {
  const W = 800, H = 1000;
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const ctx = off.getContext('2d');
  if (!ctx) return sourceCanvas;

  // พื้นขาว
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // ===== แถบหัว THAI QR PAYMENT =====
  ctx.fillStyle = '#F4F4F5';
  ctx.fillRect(0, 0, W, 104);
  // โลโก้ (กล่องส้มมุมมน + ช่อง QR ขาวสไตล์ Thai QR)
  const gx = 250, gy = 22, gs = 60;
  roundRect(ctx, gx, gy, gs, gs, 14);
  ctx.fillStyle = ORANGE;
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  const cell = gs / 5;
  [[1, 1], [3, 1], [1, 3]].forEach(([cxi, cyi]) => {
    ctx.fillRect(gx + cxi * cell - 2, gy + cyi * cell - 2, cell + 4, cell + 4);
  });
  ctx.fillStyle = ORANGE;
  ctx.fillRect(gx + 3 * cell + 2, gy + 3 * cell + 2, cell - 4, cell - 4);
  // ตัวหนังสือ THAI QR / PAYMENT
  ctx.fillStyle = ORANGE;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '900 34px Arial, sans-serif';
  ctx.fillText('THAI QR', gx + gs + 18, 50);
  ctx.font = '900 30px Arial, sans-serif';
  ctx.fillText('PAYMENT', gx + gs + 18, 84);

  // ===== กล่องโลโก้ PromptPay =====
  const pbW = 250, pbH = 66, pbX = (W - pbW) / 2, pbY = 138;
  roundRect(ctx, pbX, pbY, pbW, pbH, 10);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = ORANGE;
  ctx.stroke();
  ctx.textAlign = 'right';
  ctx.fillStyle = ORANGE;
  ctx.font = 'italic 700 16px Tahoma, sans-serif';
  ctx.fillText('พร้อมเพย์', pbX + pbW - 14, pbY + 24);
  ctx.textAlign = 'center';
  ctx.font = '800 34px Arial, sans-serif';
  ctx.fillStyle = '#3F3F46';
  const promptW = ctx.measureText('Prompt').width;
  const payW = (() => { ctx.font = '800 34px Arial, sans-serif'; return ctx.measureText('Pay').width; })();
  const totalW = promptW + payW;
  ctx.textAlign = 'left';
  ctx.fillText('Prompt', pbX + (pbW - totalW) / 2, pbY + 52);
  ctx.fillStyle = ORANGE;
  ctx.fillText('Pay', pbX + (pbW - totalW) / 2 + promptW, pbY + 52);

  // ===== QR + โลโก้ D =====
  const qs = 460, qx = (W - qs) / 2, qy = 236;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(sourceCanvas, qx, qy, qs, qs);
  ctx.imageSmoothingEnabled = true;
  drawDBadge(ctx, W / 2, qy + qs / 2, 96);

  // ===== ยอดเงิน =====
  ctx.textAlign = 'center';
  ctx.fillStyle = ORANGE;
  ctx.font = '900 52px Tahoma, Arial, sans-serif';
  ctx.fillText(`ทั้งหมด: ${opts.amountText}`, W / 2, qy + qs + 84);

  // ===== หมดอายุ + อ้างอิง =====
  ctx.fillStyle = '#9CA3AF';
  ctx.font = '600 26px Tahoma, sans-serif';
  ctx.fillText(opts.expiryText, W / 2, qy + qs + 138);
  if (opts.refText) {
    ctx.fillStyle = ORANGE;
    ctx.font = '800 26px Tahoma, sans-serif';
    ctx.fillText(opts.refText, W / 2, qy + qs + 178);
  }
  return off;
};

// บันทึกการ์ด Thai QR Payment (ใช้ระบบ save 3 ชั้นเดิม — แชร์ชีท/ดาวน์โหลด/กดค้าง)
export const savePromptPayCard = async (
  sourceCanvas: HTMLCanvasElement,
  opts: PromptPayCardOpts,
  filename: string,
  lang: 'th' | 'en' = 'th'
): Promise<SaveImageResult> => {
  const card = composePromptPayCard(sourceCanvas, opts);
  return saveCanvasImage(card, filename, lang, 'image/jpeg');
};
