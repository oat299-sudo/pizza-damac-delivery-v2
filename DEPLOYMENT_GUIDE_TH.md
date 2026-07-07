# คู่มือการย้ายระบบและ Deploy ขึ้น Google Cloud Run (ฉบับละเอียดที่สุด)

คู่มือนี้จัดทำขึ้นสำหรับคุณโอ๊ต เพื่ออธิบายสถาปัตยกรรมใหม่ ขั้นตอนการนำโค้ดจาก **AI Studio** ไปใส่ใน **GitHub** เพื่อ Deploy ขึ้น **Google Cloud Run** และการผูกโดเมนทั้งสองตัวอย่างละเอียดทีละขั้นตอนครับ

---

## 🗺️ ภาพรวมสถาปัตยกรรมใหม่ (อัปเดต: ไม่ใช้ Wix)

เราจะใช้ **Codebase ชุดเดียวกัน (Single Codebase)** ที่พัฒนาบน AI Studio นี้ในการรันทั้งสองเว็บ โดยมีแผนผังการทำงานดังนี้ครับ:

| โดเมน | หน้าที่หลัก | โฮสติ้งที่ใช้ | แหล่งโค้ด (Source) |
|---|---|---|---|
| **pizzariadamac.com** (GoDaddy) | หน้าเว็บร้านหลัก (โฮมเพจ, เมนู, ข้อมูลติดต่อ) | **Netlify** (เหมือนเดิม) | GitHub (Branch: `main` หรือโปรเจกต์เดิม) |
| **pizzadamac.com** (Google Domains) | ระบบสั่งอาหาร + Delivery + POS + ห้องครัว | **Google Cloud Run** | GitHub (Repository ที่ส่งออกจาก AI Studio) |

---

## 🛠️ ขั้นตอนที่ 1: การนำโค้ดจาก AI Studio ไปยัง GitHub ของคุณ

เนื่องจากบน AI Studio เป็นพื้นที่ทดลองและพัฒนาสด หากต้องการ Deploy ขึ้น Google Cloud Run แบบมืออาชีพและอัปเดตอัตโนมัติเมื่อมีการแก้โค้ด เราต้องเชื่อมกับ **GitHub** ครับ

### 1.1 วิธีการดาวน์โหลดโค้ดจาก AI Studio
1. มองไปที่**เมนูแถบซ้ายมือ** หรือ**ไอคอนรูปเฟือง (Settings)** ด้านล่างซ้าย/บนขวา ของ AI Studio (ขึ้นอยู่กับเวอร์ชันหน้าจอแสดงผล)
2. หาปุ่ม **"Export to GitHub"** หรือ **"Download ZIP"**
   - **แนะนำให้กด "Export to GitHub":** ระบบจะสร้าง Repository ใหม่บนบัญชี GitHub ของคุณโดยอัตโนมัติ
   - **หรือเลือก "Download ZIP":** เพื่อดาวน์โหลดโค้ดทั้งหมดลงเครื่องคอมพิวเตอร์ของคุณ จากนั้นนำไปสร้างและอัปโหลดเข้า GitHub ของคุณเอง

---

## 🚀 ขั้นตอนที่ 2: การสร้างบริการบน Google Cloud Run และเชื่อมกับ GitHub

Google Cloud Run มีฟีเจอร์ **Continuous Deployment** ที่ฉลาดมาก เมื่อคุณอัปเดตโค้ดบน GitHub มันจะ Deploy ใหม่ให้ทันที

### 2.1 สมัคร/เข้าใช้ Google Cloud Console
1. ไปที่เว็บไซต์ [Google Cloud Console](https://console.cloud.google.com/)
2. เข้าสู่ระบบด้วยอีเมลเดียวกับที่ใช้จดโดเมนของ Google (`oat299@gmail.com`)
3. สร้างโปรเจกต์ใหม่ (Project) เช่น ตั้งชื่อว่า `pizza-damac-system`

### 2.2 ตั้งค่าหน้าสร้างบริการ Cloud Run (ตรงตามหน้าจอที่คุณเห็นเลยครับ)

ให้คุณตั้งค่าและคลิกตามลำดับดังนี้ได้เลยครับ:

1. **คลิกปุ่มสีน้ำเงินด้านบนสุด 🔵 "Set up with Cloud Build"**
   - เมื่อคลิกแล้ว ระบบจะพาคุณไปเชื่อมต่อกับบัญชี **GitHub** ของคุณ
   - เลือก **Repository** ของโปรเจกต์นี้ที่คุณนำเข้าจาก AI Studio
   - ในส่วนย่อย **Build Configuration** (หน้าจอตามรูปที่สองที่คุณส่งมาล่าสุด):
     - **Branch *:** ให้คงค่าเดิมไว้คือ `^main$`
     - **Build Type:** ให้คลิกเลือกวงกลมตัวที่สอง 🔘 **"Go, Node.js, Python, Java, .NET Core, Ruby or PHP via Google Cloud's buildpacks"** *(สำคัญมาก! เพราะเรายังไม่ได้สร้างไฟล์ Dockerfile ในโปรเจกต์ การใช้ Buildpacks จะทำให้ Google ตรวจจับและประกอบระบบจาก package.json ให้เราโดยอัตโนมัติ สะดวกและปลอดภัยที่สุดครับ)*
     - จากนั้นคลิกปุ่มสีน้ำเงิน 🔵 **"Save"** ที่อยู่มุมล่างซ้ายมือเพื่อบันทึกการตั้งค่าส่วนนี้ครับ

2. **ใส่ชื่อบริการในช่อง "Service name *"**
   - แนะนำให้พิมพ์ว่า: `pizza-damac` (เป็นตัวพิมพ์เล็กทั้งหมด ไม่มีเว้นวรรค)

3. **เลือกพื้นที่เครื่องเซิร์ฟเวอร์ในช่อง "Region *"**
   - **สำคัญมาก!** ตอนนี้มันแสดงเป็น `europe-west1 (Belgium)` ให้คุณคลิกแล้วเลือกหาตัวเลือก:
     - **`asia-southeast1 (Singapore)`** (เพื่อความรวดเร็วและลื่นไหลที่สุดในการโหลดหน้าเว็บสำหรับลูกค้าในประเทศไทย)

4. **ตั้งค่าสิทธิ์การเข้าใช้งานในส่วน "Authentication *"**
   - ให้คลิกเลือกวงกลมอันแรก:
     - **🔘 "Allow public access"** (หรือ "Allow unauthenticated invocations" ในเวอร์ชันเก่า) เพื่ออนุญาตให้ลูกค้าทั่วไปทุกคนเปิดเข้ามาสั่งอาหารได้ทันที โดยที่ไม่จำเป็นต้องมีบัญชี Google

---

### 2.3 การใส่ค่า Environment Variables (ตัวแปรความลับ)
ก่อนกดปุ่ม Create ให้เลื่อนลงมาด้านล่างสุด ขยายเมนู **"Container(s), Volumes, Connections, Security"** เพื่อใส่ค่าตัวแปรในแท็บ **"Variables"** ให้ครบถ้วนดังนี้:

| Name | Value |
|---|---|
| `NODE_ENV` | `production` |
| `POS_PIN` | *[รหัส PIN 6 หลัก เช่น 123456]* |
| `LALAMOVE_API_KEY` | *[คีย์ Lalamove ชุดจริง]* |
| `LALAMOVE_API_SECRET` | *[คีย์ Lalamove Secret ชุดจริง]* |
| `LALAMOVE_MARKET` | `TH` |
| `GOOGLE_MAPS_PLATFORM_KEY` | *[คีย์ Google Maps ของคุณ]* |
| `VITE_SUPABASE_URL` | *[URL ของ Supabase ของคุณ]* |
| `VITE_SUPABASE_ANON_KEY` | *[Anon Key ของ Supabase ของคุณ]* |

*(หมายเหตุ: คุณไม่จำเป็นต้องใส่ตัวแปร `PORT` อีกแล้ว เนื่องจากตอนนี้โค้ดเซิร์ฟเวอร์ได้รับการอัปเดตให้อ่านค่าจากระบบของ Cloud Run โดยอัตโนมัติแล้วครับ)*

9. เมื่อกรอกครบแล้ว ให้คลิกปุ่ม **"CREATE"**
10. รอระบบทำงานประมาณ 2-5 นาที จะได้ URL ที่ลงท้ายด้วย `.run.app` มาใช้งาน

---

## 🌐 ขั้นตอนที่ 3: การผูกโดเมนส่วนตัว (Custom Domain)

หลังจากที่ Cloud Run สร้างเสร็จเรียบร้อยแล้ว และได้ URL เช่น `https://pizza-damac-xxxx.run.app` ให้คุณทำการผูกโดเมนจริงดังนี้:

### 3.1 การเชื่อมโดเมน pizzadamac.com ( Google Domains / Squarespace )
1. ในหน้า Google Cloud Run ของคุณ ให้ไปที่เมนู **"Manage Custom Domains"** (จัดการโดเมนที่กำหนดเอง) ที่อยู่แถบด้านบน
2. คลิก **"ADD MAPPING"**
3. เลือก Service: `pizza-damac`
4. ป้อนชื่อโดเมนของคุณ: `pizzadamac.com` (และเพิ่มอีกตัวสำหรับ `www.pizzadamac.com` ได้)
5. กด **Continue** ระบบของ Google จะตรวจสอบการเป็นเจ้าของโดเมนโดยอัตโนมัติ (เนื่องจากคุณใช้บัญชี Google เดียวกับที่จดโดเมน)
6. ระบบจะแสดงตารางข้อมูล **DNS Records** ที่ต้องนำไปใส่ในผู้ให้บริการโดเมนของคุณ (เช่น Record Type: **A**, **AAAA** และค่า IP Address)

### 3.2 การนำค่า DNS ไปตั้งค่าในผู้ให้บริการโดเมน (Squarespace / Google Domains)
1. ลงชื่อเข้าใช้บัญชีผู้ดูแลโดเมนของคุณที่ **Squarespace Domains** (หรือ Google Domains เดิม)
2. ไปที่ส่วน **DNS Settings** (การตั้งค่า DNS) ของโดเมน `pizzadamac.com`
3. เพิ่ม Record ใหม่ตามที่ Google Cloud Run ให้มา:
   - **Type A:**
     - Host: `@`
     - IP Address: *[ใส่ค่า IP ที่ได้จากหน้า Cloud Run]*
   - **Type AAAA (ถ้ามี):**
     - Host: `@`
     - IP Address: *[ใส่ค่า IPv6 ที่ได้]*
   - **Type CNAME (สำหรับ www):**
     - Host: `www`
     - Point to: `ghs.googlehosted.com.`
4. กดบันทึก (Save)
5. **รออัปเดต:** ระบบ DNS จะใช้เวลาอัปเดตประมาณ 15 นาที - 2 ชั่วโมง จากนั้นคุณจะสามารถเข้าเว็บผ่าน `https://pizzadamac.com` ได้ทันทีพร้อม SSL (https://) ฟรีอัตโนมัติจาก Google!

---

## 🛵 ขั้นตอนที่ 4: การเชื่อมปุ่ม Delivery จากเว็บ Netlify ไปยังเว็บ Cloud Run

เพื่อให้สองระบบทำงานเชื่อมต่อกันอย่างไร้รอยต่อ:

1. เปิดโค้ดส่วนหน้าเว็บร้านของคุณบน **Netlify** (ซึ่งจดกับ GoDaddy: `pizzariadamac.com`)
2. ค้นหาปุ่มที่เขียนว่า **"สั่งอาหาร"** หรือ **"Delivery"**
3. แก้ไขลิงก์ของปุ่มนั้นให้วิ่งตรงไปที่โดเมนสั่งอาหารบน Cloud Run ของคุณ:
   ```html
   <!-- ตัวอย่างโค้ดปุ่มบนเว็บหลัก pizzariadamac.com -->
   <a href="https://pizzadamac.com" class="btn-delivery">
       🛵 สั่ง Delivery ออนไลน์ที่นี่
   </a>
   ```
4. กดบันทึกและ Deploy บน Netlify ตามปกติ

เพียงเท่านี้ ลูกค้าที่เข้ามาชมร้านที่ `pizzariadamac.com` (Netlify) เมื่อกดปุ่มสั่งอาหาร ตัวเว็บจะนำทางไปที่หน้าทำรายการและเลือกพิกัดที่ `pizzadamac.com` (Cloud Run) ทันทีอย่างสวยงามและเป็นธรรมชาติครับ!
