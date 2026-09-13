# Changelog — Pizza Damac Web System (pizzadamac.com)

บันทึกการเปลี่ยนแปลงทุกเวอร์ชันของระบบ Pizza Damac (หน้าลูกค้า + POS + Kitchen + Delivery)
รูปแบบตาม [Keep a Changelog](https://keepachangelog.com/) และเลขเวอร์ชันตาม [Semantic Versioning](https://semver.org/) — วิธีออกเวอร์ชันใหม่อ่านที่ [VERSIONING.md](./VERSIONING.md)

เวอร์ชันที่กำลังรันอยู่ดูได้ที่ `https://pizzadamac.com/api/version`

หมวดที่ใช้: **Added** (เพิ่มฟีเจอร์) · **Changed** (เปลี่ยนพฤติกรรม) · **Fixed** (แก้บั๊ก) · **Security** (ความปลอดภัย) · **Removed** (ถอดออก)

---

## [Unreleased]

_ยังไม่มี — รายการที่แก้แล้วแต่ยังไม่ออกเวอร์ชัน ให้จดไว้ตรงนี้ก่อน_

---

## [1.2.0] — 2026-09-13

### Added
- **ป้ายเวอร์ชันบนเว็บ** — เห็นได้ทันทีว่า pizzadamac.com รันเวอร์ชันไหน ไม่ต้องเดาว่าอัปโหลดแล้วหรือยัง
  - แสดง 3 จุด: ท้ายหน้าลูกค้า (ใต้ © Pizza Damac), หน้าล็อกอิน Staff Access, และแถบเมนูซ้ายของ POS (ใต้ปุ่มออกจากระบบ)
  - รูปแบบ `v1.2.0 · 00067-xxx` = เลขเวอร์ชันจาก package.json + Cloud Run revision ล่าสุด (วางเมาส์ดูชื่อ revision เต็ม)
  - คอมโพเนนต์ใหม่ `src/components/AppVersionBadge.tsx` อ่านค่าจาก `GET /api/version`
  - ไฟล์ที่แก้: `App.tsx`, `views/CustomerView.tsx`, `views/POSView.tsx`

### Changed
- ตกลงกติกา: ทุกครั้งที่แก้โค้ด Claude จะขึ้น GitHub ให้ครบชุด (CHANGELOG → เลขเวอร์ชัน → commit → Release → ตรวจ /api/version) โดยไม่ต้องสั่งซ้ำ

---

## [1.1.0] — 2026-09-13

### Fixed
- **เรียกไรเดอร์ Lalamove ซ้ำ (บั๊กสำคัญ)** — commits `5738e89`, `9538a8f`
  - **อาการ:** พนักงานกด "เรียกไรเดอร์" แล้วสถานะไม่ขึ้น กดซ้ำ → Lalamove สร้างงานจริงหลายใบ
  - **สาเหตุ:** ฟังก์ชันบันทึกออเดอร์ (`updateOrderFields` ใน `context/StoreContext.tsx`) ไม่เคยเขียนคอลัมน์ `lalamove_order_id`, `lalamove_share_link`, `delivery_status` ลงฐานข้อมูล → หน้าจอรีเฟรชแล้วเห็นว่า "ยังไม่มีไรเดอร์" → ปุ่มเรียกโผล่กลับมา
  - **ผลพวงที่หายไปด้วย:** สถานะจาก Lalamove (ไรเดอร์รับของ / ส่งสำเร็จ) ไม่เคยขึ้นหน้าจอ เพราะ webhook จับคู่ออเดอร์ด้วย `lalamove_order_id` ที่ไม่เคยถูกบันทึก
  - **แก้:** `StoreContext.tsx` เขียน 5 คอลัมน์ (`lalamove_order_id`, `lalamove_share_link`, `delivery_status`, `lalamove_quotation_id`, `delivery_vehicle`) ลง Supabase และคืนค่า `true/false` บอกว่าบันทึกสำเร็จหรือไม่
- **กันกดซ้ำ 3 ชั้นในหน้า Lalamove Dispatch** (`src/components/LalamoveDispatchPanel.tsx`)
  - ล็อกปุ่มทันทีที่ Lalamove ตอบเลข Order ID กลับมา (ไม่รอฐานข้อมูล)
  - กดซ้ำจะเด้งเตือนพร้อมเลข ID ที่เรียกไปแล้ว ไม่ยิงซ้ำไป Lalamove
  - ถ้าบันทึกลงระบบร้านล้มเหลว จะแสดงกรอบแดง "เรียกสำเร็จแล้ว ID: xxx — ห้ามกดซ้ำ" แทนปุ่มเรียก
  - ปุ่ม "ยกเลิกการเรียก" ใช้เลข ID ที่ล็อกไว้ได้แม้ฐานข้อมูลยังไม่ทันอัปเดต
  - ช่อง "ID ไรเดอร์" ในการ์ดแสดงเลข Lalamove Order ID จริง

### Added
- `GET /api/version` ส่งค่า `version` (เลขเวอร์ชันจาก `package.json`) เพิ่มจาก `revision` เดิม
- `CHANGELOG.md` และ `VERSIONING.md` — เริ่มระบบจดเวอร์ชันอย่างเป็นทางการ

---

## [1.0.0] — 2026-07-13

_เวอร์ชันฐาน: สรุปทุกอย่างที่สร้างและแก้ช่วง 7–13 ก.ค. 2026 (ก่อนเริ่มจดเวอร์ชัน) — บันทึกย้อนหลัง_

### Security
- **ล็อกฐานข้อมูลทั้งหมด (RLS)** — เดิม "Prototype Mode" ใครมี anon key ก็อ่าน/แก้ข้อมูลลูกค้าได้ทั้งหมด
  - Stage 1: หน้า POS/Kitchen ต้องล็อกอินด้วย Supabase Auth (Email + Password) — ถอด PIN `123456` และ backdoor `oatto` ที่ฝังในโค้ดหน้าเว็บออก
  - Stage 2: รหัสผ่านสมาชิกเข้ารหัส bcrypt ทั้งหมด (เดิมเก็บ plaintext) ผ่าน RPC `loyalty_login` / `loyalty_upsert`; ปิดช่องโหว่คูปองต้อนรับซ้ำ
  - Stage 3: ลบ `/api/verify-pin`, ตรวจ apiKey + HMAC ของ Lalamove webhook, กัน SSRF ที่ `/api/resolve-link`, ลบไฟล์ key/ขยะออกจาก repo, เพิ่ม `.gitignore`
  - ตาราง `orders` ล็อกเป็น staff-only; ลูกค้าติดตามออเดอร์ผ่าน RPC `track_orders` / `customer_update_order`; webhook อัปเดตสถานะผ่าน RPC `webhook_update_delivery_status`

### Changed
- **รวมระบบเหลือ 1 แอป** — pizzadamac.com ชี้ไป Cloud Run service `pizza-damac-delivery-v2` (ก่อนหน้านี้โดเมนชี้ไป v1 ตัวเก่า ทำให้ "แก้แล้วแต่ไม่เห็นผล"); pizzariadamac.com redirect 302 มาที่ pizzadamac.com
- **Delivery ใช้ราคา Lalamove จริง** — ค่าส่งที่ลูกค้าเห็นตอนสั่ง = ราคาจริงจาก Lalamove; ลูกค้าเลือกประเภทรถได้ (🛵 มอเตอร์ไซค์ / 🚗 รถยนต์ / 🛻 กระบะ) และ POS จองตามที่ลูกค้าเลือก
- ถอด "ไรเดอร์จำลอง" ออก — POS เรียกได้เฉพาะงาน Lalamove จริง สถานะมาจาก webhook เท่านั้น
- แก้ schema drift ของตาราง `orders` (เพิ่มคอลัมน์ delivery_status, lalamove_order_id, พิกัด ฯลฯ) และ `promo_codes` ที่ไม่เคยเซฟ
- รูปเมนู/แบนเนอร์ย้ายจาก base64 ในฐานข้อมูล (~12MB ต่อการเปิดเว็บ) ไป Supabase Storage bucket `menu-images`

### Added
- **ระบบสมาชิก/สะสมแต้มหน้าร้าน** (Phase 1–2): ค้นหาสมาชิกจากเบอร์โทร ใช้คูปองที่ POS, คูปองวันเกิด HBD15, คูปองต้อนรับ NEWMEMBER10
- **Promo Board** — ตั้งค่าโปรโมชัน (welcome / birthday / pickup รายเดือน) จากหน้า POS แทนการแก้โค้ด (ตาราง `promo_campaigns`)
- **Stock Manager** — ซัพพลายเออร์ / วัตถุดิบ / ความเคลื่อนไหวสต๊อก ตัดสต๊อกตามการขาย
- **Costing Center** — ต้นทุนสูตรและเมนูจากไฟล์ "Pizza Damac Cost.xlsx" + จุดคุ้มทุน
- **LINE Official Account** — ผูกบัญชีสมาชิกด้วยเบอร์โทรในแชท, แจ้งสถานะออเดอร์ (พร้อม / ไรเดอร์รับของ / ส่งถึง) พร้อมลิงก์ติดตามไรเดอร์
- **PWA** — ติดตั้งเป็นแอปบนมือถือ/แท็บเล็ตได้ (manifest + service worker + ไอคอน)
- **เสียงแจ้งออเดอร์** — เลือกริงโทน/เสียงพูด ไทย-อังกฤษ ได้ใน POS
- **แจ้งอัปเดตเวอร์ชัน** — แท็บ POS/Kitchen ที่เปิดค้างไว้จะเช็ก `/api/version` และเด้งให้รีเฟรชเมื่อมี deploy ใหม่ (แก้ปัญหา "แท็บเก่ารันโค้ดเก่าอยู่หลายวัน")
- SEO / Open Graph / รูป preview เมื่อแชร์ลิงก์, QR โต๊ะสำหรับสั่งที่ร้าน
- Cloud Build trigger: อัปโหลดขึ้น GitHub `main` → build + deploy Cloud Run อัตโนมัติ

### Fixed
- Lalamove ปฏิเสธออเดอร์เพราะรูปแบบเบอร์โทร → แปลงเป็น +66 อัตโนมัติ
- ยกเลิกไรเดอร์แล้วระบบล้างสถานะทั้งที่ Lalamove ไม่ยอมยกเลิก → ตอนนี้ล้างเฉพาะเมื่อ Lalamove ยืนยัน (มิฉะนั้นจะเกิดไรเดอร์ 2 คน)
- สมัครสมาชิก/ล็อกอินล่มหลังล็อก RLS (upsert ชน policy) → แก้ด้วย RPC
- ค่าส่ง ฿0 บนหน้าลูกค้า, ปุ่มบันทึก QR PromptPay บนมือถือ (กดค้าง), ปริ้นเตอร์ Bluetooth

---

[Unreleased]: https://github.com/oat299-sudo/pizza-damac-delivery-v2/compare/v1.2.0...HEAD
[1.2.0]: https://github.com/oat299-sudo/pizza-damac-delivery-v2/releases/tag/v1.2.0
[1.1.0]: https://github.com/oat299-sudo/pizza-damac-delivery-v2/releases/tag/v1.1.0
[1.0.0]: https://github.com/oat299-sudo/pizza-damac-delivery-v2/releases/tag/v1.0.0
