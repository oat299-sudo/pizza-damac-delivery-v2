# Changelog — Pizza Damac Web System (pizzadamac.com)

บันทึกการเปลี่ยนแปลงทุกเวอร์ชันของระบบ Pizza Damac (หน้าลูกค้า + POS + Kitchen + Delivery)
รูปแบบตาม [Keep a Changelog](https://keepachangelog.com/) และเลขเวอร์ชันตาม [Semantic Versioning](https://semver.org/) — วิธีออกเวอร์ชันใหม่อ่านที่ [VERSIONING.md](./VERSIONING.md)

เวอร์ชันที่กำลังรันอยู่ดูได้ที่ `https://pizzadamac.com/api/version`

หมวดที่ใช้: **Added** (เพิ่มฟีเจอร์) · **Changed** (เปลี่ยนพฤติกรรม) · **Fixed** (แก้บั๊ก) · **Security** (ความปลอดภัย) · **Removed** (ถอดออก)

---

## [Unreleased]

_ยังไม่มี — รายการที่แก้แล้วแต่ยังไม่ออกเวอร์ชัน ให้จดไว้ตรงนี้ก่อน_

---

## [1.4.1] — 2026-09-13

### Fixed
- **HOTFIX: หน้าเว็บขาว (ReferenceError: getGpRate is not defined)** หลัง deploy v1.4.0 ประมาณ 5 นาที — ฟังก์ชัน `getGpRate` ถูกวางผิดตำแหน่งใน `context/StoreContext.tsx` (หลุดเข้าไปในตัวเริ่มค่าของ `useState`) ทำให้ทั้งแอปโหลดไม่ขึ้น; ย้ายออกมาที่ระดับ Provider แล้ว

---

## [1.4.0] — 2026-09-13

### Added
- **โหมดแพลตฟอร์ม (Platform Quick Mode) ในหน้าสั่งอาหาร POS** — บันทึกออเดอร์ Grab / LINE MAN / Robinhood / Foodpanda / ShopeeFood ได้ในไม่กี่แตะ
  - **ปุ่มช่องทางแบบชิปใหญ่** แทน dropdown เดิม (🏠 ร้าน · 🟢 Grab · 🟩 LINE MAN · …) กดครั้งเดียว ชิปโชว์ % GP ของช่องทางนั้น
  - เลือกแพลตฟอร์มแล้วระบบ **ตั้งประเภทเป็น "ทานในร้าน/รับกลับ" อัตโนมัติ** (ไรเดอร์ของแพลตฟอร์มมารับ — ไม่ต้องกรอกที่อยู่ ไม่เรียก Lalamove) และปิดโปรโมชั่นร้าน
  - แถบอธิบายโหมด + ช่อง "🧾 เลขออเดอร์จากแอป" ชัดเจน
  - **ป้ายราคาบนการ์ดเมนู**: บอกว่าเมนูนี้ใช้ราคา Grab/LINE MAN หรือยังเป็นราคาร้าน
  - **สรุปในตะกร้า**: ยอดขาย → หัก GP xx% → **ร้านได้รับสุทธิ** เห็นก่อนกดเช็คบิล
  - เช็คบิลออเดอร์แพลตฟอร์มบันทึกวิธีจ่ายเป็น **PLATFORM** (แพลตฟอร์มโอนให้ทีหลัง) แยกจากเงินสด/QR ในรายงาน
- **ตั้งค่า % GP เองได้** — การ์ด "ค่า GP แพลตฟอร์มเดลิเวอรี่" ในแท็บตั้งค่า (`src/components/PlatformGpSettingsCard.tsx`) บันทึกลง `store_settings.gp_rates`; ปุ่มค่าเริ่มต้น (Grab 32 / LINE MAN 32 / Robinhood 25 / Foodpanda 35 / ShopeeFood 30); ออเดอร์ที่บันทึกไปแล้วไม่เปลี่ยน
- **รายงานขาย: แท็บใหม่ "📅 แนวโน้มรายเดือน"** — กราฟแท่ง 12 เดือน (ยอดขายรวม vs รายรับสุทธิ) + ตารางต่อเดือน: ออเดอร์ · วันที่มีขาย · ยอดขายรวม · เทียบเดือนก่อน (▲▼%) · ยอดผ่านแพลตฟอร์ม · รายรับสุทธิ · รายจ่าย · กำไรขั้นต้น · เฉลี่ยต่อวันขาย · เฉลี่ยต่อบิล (ดูทุกเดือนที่มีข้อมูล ไม่ขึ้นกับตัวกรองวันที่)
- `StoreContext.getGpRate(source)` — จุดเดียวที่ทุกการคำนวณรายรับสุทธิใช้ (แทนค่าคงที่ `GP_RATES` 5 จุดเดิม)
- `types.ts`: `PaymentMethod` เพิ่ม `'platform'`, `StoreSettings.gpRates`
- ฐานข้อมูล: `store_settings.gp_rates jsonb` — migration `store_settings_gp_rates`

### Changed
- ฟังก์ชันเดิม (เลือกช่องทาง → ราคาสลับ → หัก GP) ยังทำงานเหมือนเดิม แต่เข้าถึงง่ายและมองเห็นผลลัพธ์ทันที — ที่ผ่านมาออเดอร์สำเร็จทั้ง 210 ใบถูกบันทึกเป็น "ร้าน" ทั้งหมด

---

## [1.3.0] — 2026-09-13

### Added
- **หน้า CRM ใหม่ (แท็บ 👥 "ลูกค้า" ในเมนู POS)** — `src/components/CrmCenter.tsx` แทนตารางรายชื่อสมาชิกแบบเดิมที่ดูรายละเอียดได้น้อย
  - **ตัวเลขภาพรวม 6 ช่อง:** สมาชิก · ลูกค้าประจำ (3+ ออเดอร์) · มาใหม่ 30 วัน · เสี่ยงหาย (ไม่สั่งเกิน 45 วัน) · เกิดเดือนนี้ · ยังไม่สมัครสมาชิก
  - **กลุ่มลูกค้า (segment) กดกรองได้ทันที** + ค้นหา ชื่อ/เบอร์/ที่อยู่/แท็ก + เรียงตาม สั่งล่าสุด/ยอดสะสม/จำนวนออเดอร์/แต้ม/ชื่อ
  - **"ยังไม่สมัครสมาชิก"** = เบอร์โทรที่เคยสั่ง (จากออเดอร์) แต่ไม่มีบัญชีสมาชิก — เห็นชัดว่าควรชวนใครสมัคร
  - **แผงรายละเอียดลูกค้า (ขวา):** ออเดอร์สำเร็จ · ยอดสะสม · เฉลี่ยต่อบิล · สั่งล่าสุด/ครั้งแรก · แต้ม · เมนูที่สั่งบ่อย 5 อันดับ · ช่องทางที่สั่ง (ร้าน/Grab/LINE MAN…) · ส่งบ้าน vs รับเอง · ที่อยู่ทั้งหมด · คูปอง (ใช้ได้/ใช้แล้ว/หมดอายุ + ปุ่มออกคูปอง) · ประวัติออเดอร์ทุกใบ กดดูรายการอาหาร/ท็อปปิ้ง/โน้ต/ที่อยู่/คะแนนรีวิวได้
  - **โน้ตพนักงาน + แท็ก (ลูกค้าไม่เห็น)** เช่น #VIP #แพ้กุ้ง #ไม่ใส่หอม — บันทึกลงฐานข้อมูล ใช้ได้กับสมาชิกทุกคน
  - ป้าย LINE (ผูกบัญชีแล้ว), 🎂 เดือนเกิด, 🔴 หายไป X วัน โชว์ที่การ์ดลูกค้า; กดเบอร์เพื่อโทรได้
- ฐานข้อมูล: เพิ่มคอลัมน์ `customers.staff_note` (text) และ `customers.tags` (jsonb) — migration `crm_customer_staff_note_tags`
- `context/StoreContext.tsx`: `getAllCustomers` ส่ง `lineUserId`, `staffNote`, `tags` เพิ่ม

### Changed
- แถบเมนูมือถือของ POS: เพิ่มปุ่ม "ลูกค้า" (CRM); ตารางสมาชิกแบบเดิมในแท็บตั้งค่ายังอยู่เหมือนเดิม

---

## [1.2.1] — 2026-09-13

### Fixed
- ป้ายเวอร์ชันใน POS ย้ายจากใต้ปุ่มออกจากระบบ (หลุดจอบนจอเตี้ย) ไปอยู่ใต้โลโก้ร้านมุมบนซ้าย — มองเห็นเสมอ; เพิ่มช่องว่างข้อความ `v1.2.1 · 00070-xxx`

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

[Unreleased]: https://github.com/oat299-sudo/pizza-damac-delivery-v2/compare/v1.4.1...HEAD
[1.4.1]: https://github.com/oat299-sudo/pizza-damac-delivery-v2/releases/tag/v1.4.1
[1.4.0]: https://github.com/oat299-sudo/pizza-damac-delivery-v2/releases/tag/v1.4.0
[1.3.0]: https://github.com/oat299-sudo/pizza-damac-delivery-v2/releases/tag/v1.3.0
[1.2.1]: https://github.com/oat299-sudo/pizza-damac-delivery-v2/releases/tag/v1.2.1
[1.2.0]: https://github.com/oat299-sudo/pizza-damac-delivery-v2/releases/tag/v1.2.0
[1.1.0]: https://github.com/oat299-sudo/pizza-damac-delivery-v2/releases/tag/v1.1.0
[1.0.0]: https://github.com/oat299-sudo/pizza-damac-delivery-v2/releases/tag/v1.0.0
