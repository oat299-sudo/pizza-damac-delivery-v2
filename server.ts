import express from "express";
import path from "path";
import crypto from "crypto";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // JSON middleware
  app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));

  // API to unshorten Google Map links
  app.post("/api/resolve-link", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "Missing url" });
      }

      // SSRF guard: this endpoint exists only to unshorten Google Maps links,
      // so refuse to fetch anything that is not a Google/goo.gl maps domain.
      let linkHost = '';
      try { linkHost = new URL(url).hostname.toLowerCase(); } catch (e) {
        return res.status(400).json({ error: "Invalid url" });
      }
      const isAllowedMapsHost = /(^|\.)goo\.gl$|(^|\.)google\.com$|(^|\.)google\.co\.th$|^g\.co$/.test(linkHost);
      if (!isAllowedMapsHost) {
        return res.status(400).json({ error: "Only Google Maps links are supported" });
      }

      let finalUrl = url;
      try {
        // Follow redirects to get the ultimate destination URL which contains coordinates
        const response = await fetch(url, { 
          method: 'GET',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        finalUrl = response.url;
      } catch (err) {
        // Fallback to manual redirect if follow fails
        const response = await fetch(url, { method: 'GET', redirect: 'manual' });
        finalUrl = response.headers.get('location') || url;
      }

      return res.json({ targetUrl: finalUrl });
    } catch (e: any) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/config", (req, res) => {
    res.json({
      GOOGLE_MAPS_PLATFORM_KEY: process.env.GOOGLE_MAPS_PLATFORM_KEY || process.env.VITE_GOOGLE_MAPS_PLATFORM_KEY || '',
      VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || '',
      VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || ''
    });
  });

  // ---------------- LINE Official Account integration ----------------
  const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN || '';
  const LINE_SECRET = process.env.LINE_CHANNEL_SECRET || '';
  const SHOP_URL = 'https://pizzadamac.com';

  const lineApi = async (path: string, body: any) => {
    if (!LINE_TOKEN) return null;
    try {
      return await fetch(`https://api.line.me/v2/bot/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LINE_TOKEN}` },
        body: JSON.stringify(body)
      });
    } catch (e) { console.warn('LINE api error', e); return null; }
  };
  const linePush = (to: string, text: string) => lineApi('message/push', { to, messages: [{ type: 'text', text }] });
  const lineReply = (replyToken: string, text: string) => lineApi('message/reply', { replyToken, messages: [{ type: 'text', text }] });

  const supaRpc = async (fn: string, params: any) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseKey) return null;
    try {
      const r = await fetch(`${supabaseUrl}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!r.ok) return null;
      return await r.json();
    } catch (e) { console.warn('supaRpc error', fn, e); return null; }
  };

  // Push a LINE message to the member owning this phone (if they linked LINE)
  const lineNotifyByPhone = async (phone: string, text: string) => {
    if (!LINE_TOKEN || !phone) return false;
    const rows = await supaRpc('loyalty_lookup', { p_phone: phone });
    const cust = Array.isArray(rows) ? rows[0] : null;
    if (!cust || !cust.line_user_id) return false;
    await linePush(cust.line_user_id, text);
    return true;
  };

  // LINE webhook: welcome message, account linking (customer types their phone
  // number in the chat), and simple keyword replies for the rich menu.
  app.post('/api/line/webhook', async (req: any, res) => {
    try {
      if (LINE_SECRET) {
        const sig = crypto.createHmac('sha256', LINE_SECRET).update(req.rawBody || Buffer.from('')).digest('base64');
        if (sig !== req.headers['x-line-signature']) {
          console.warn('LINE webhook signature mismatch');
          return res.status(401).send('Invalid signature');
        }
      }
      const events = (req.body && req.body.events) || [];
      for (const ev of events) {
        const replyToken = ev.replyToken;
        const userId = ev.source && ev.source.userId;
        if (ev.type === 'follow' && replyToken) {
          await lineReply(replyToken,
            `ยินดีต้อนรับสู่ Pizza Damac ครับ! 🍕\n\n` +
            `🛒 สั่งอาหาร: ${SHOP_URL}\n\n` +
            `🔔 อยากรับแจ้งเตือนสถานะออเดอร์ทาง LINE?\n` +
            `พิมพ์ "เบอร์โทร" ที่ใช้สมัครสมาชิก/สั่งอาหาร ส่งมาในแชทนี้ได้เลยครับ (เช่น 0812345678)`);
        } else if (ev.type === 'message' && ev.message && ev.message.type === 'text' && replyToken) {
          const text = String(ev.message.text || '').trim();
          const cleaned = text.replace(/[-\s]/g, '');
          if (/^0\d{8,9}$/.test(cleaned) && userId) {
            const rows = await supaRpc('loyalty_lookup', { p_phone: cleaned });
            const cust = Array.isArray(rows) ? rows[0] : null;
            if (cust && cust.phone) {
              await supaRpc('loyalty_update', { p_phone: cleaned, p: { line_user_id: userId } });
              await lineReply(replyToken,
                `เชื่อมบัญชีสำเร็จครับ! ✅\n\nคุณ ${cust.name || ''} (${cleaned})\n` +
                `ต่อไปนี้จะได้รับแจ้งเตือนสถานะออเดอร์ทาง LINE นี้อัตโนมัติ 🔔🍕`);
            } else {
              await lineReply(replyToken,
                `ยังไม่พบสมาชิกเบอร์ ${cleaned} ครับ 🙏\n\n` +
                `สมัครสมาชิกฟรี (รับ 4 คูปองทันที) ได้ที่ ${SHOP_URL} เมนู "Join Us"\n` +
                `เสร็จแล้วพิมพ์เบอร์มาอีกครั้งครับ`);
            }
          } else if (/เมนู|สั่ง|order|menu/i.test(text)) {
            await lineReply(replyToken, `สั่งอาหารได้เลยครับ 🍕\n${SHOP_URL}\n\nสมาชิกใหม่รับฟรี 4 คูปองส่วนลด และเดือนเกิดลด 15% ทั้งบิลครับ!`);
          } else if (/โทร|เบอร์ร้าน|call/i.test(text)) {
            await lineReply(replyToken, `โทรหาร้านได้ที่ 099-497-9199 ครับ 📞`);
          } else if (/เชื่อม|แจ้งเตือน|notify/i.test(text)) {
            await lineReply(replyToken, `รับแจ้งเตือนสถานะออเดอร์ทาง LINE 🔔\n\nพิมพ์ "เบอร์โทร" ที่ใช้สมัครสมาชิก/สั่งอาหาร ส่งมาในแชทนี้ได้เลยครับ (เช่น 0812345678)`);
          } else if (/เวลา|เปิด|ปิด|hours/i.test(text)) {
            await lineReply(replyToken, `Pizza Damac เปิดทุกวัน 11:00 - 20:30 น. ครับ 🍕\nสั่งล่วงหน้า (Pre-order) ได้ที่ ${SHOP_URL}`);
          } else {
            await lineReply(replyToken, `สวัสดีครับ Pizza Damac ยินดีให้บริการ 🍕\n\n🛒 สั่งอาหาร: ${SHOP_URL}\n📞 โทร: 099-497-9199\n🔔 รับแจ้งเตือนออเดอร์: พิมพ์เบอร์โทรของคุณส่งมาได้เลย`);
          }
        }
      }
      return res.status(200).send('OK');
    } catch (e: any) {
      console.error('LINE webhook error', e);
      return res.status(200).send('OK'); // always ACK so LINE doesn't disable the webhook
    }
  });

  // Called by the POS/Kitchen after a status change to notify the customer.
  app.post('/api/line/notify', async (req, res) => {
    try {
      if (!LINE_TOKEN) return res.json({ sent: false, reason: 'LINE not configured' });
      const { orderId, event } = req.body || {};
      if (!orderId) return res.status(400).json({ error: 'orderId required' });
      const rows = await supaRpc('track_orders', { p_ids: [String(orderId)], p_phone: null });
      const order = Array.isArray(rows) ? rows[0] : null;
      if (!order || !order.customer_phone) return res.json({ sent: false, reason: 'no phone' });
      const shortId = String(orderId).slice(-4);
      let text = '';
      if (event === 'ready') {
        text = order.type === 'pickup'
          ? `✅ ออเดอร์ #${shortId} พร้อมแล้วครับ! มารับได้เลยที่ร้าน Pizza Damac 🍕`
          : `✅ ออเดอร์ #${shortId} ของคุณพร้อมแล้วครับ 🍕`;
      } else if (event === 'cooking') {
        // Explicitly confirm BOTH the order and the payment (Oat's request):
        // QR/transfer orders = shop verified the money; cash = pay on receive.
        text = order.payment_method === 'qr_transfer'
          ? `✅ ร้านได้รับออเดอร์ #${shortId} และยืนยันการชำระเงินของคุณเรียบร้อยแล้วครับ\n👨‍🍳 กำลังเตรียมอาหารให้เลยครับ`
          : `✅ ร้านได้รับออเดอร์ #${shortId} ของคุณเรียบร้อยแล้วครับ\n👨‍🍳 กำลังเตรียมอาหารให้เลยครับ (ชำระเงินสดตอนรับอาหาร)`;
      } else if (event === 'completed') {
        text = `🙏 ขอบคุณที่อุดหนุน Pizza Damac ครับ! สะสมแต้มจากออเดอร์ #${shortId} ให้เรียบร้อยแล้ว 🍕`;
      } else {
        text = `📣 ออเดอร์ #${shortId} อัปเดตสถานะ: ${event}`;
      }
      const sent = await lineNotifyByPhone(order.customer_phone, text);
      return res.json({ sent });
    } catch (e: any) {
      console.error('LINE notify error', e);
      return res.status(500).json({ error: e.message });
    }
  });

  // (The old /api/verify-pin endpoint was removed - staff login now uses
  //  Supabase Auth email+password, so no PIN system exists anymore.)

  // --- LALAMOVE BACKEND INTEGRATION ---
  // Status check to see if Lalamove real connection is active (configured & reachable)
  app.get("/api/lalamove/status", async (req, res) => {
    try {
      const apiKey = process.env.LALAMOVE_API_KEY;
      const apiSecret = process.env.LALAMOVE_API_SECRET;
      
      if (!apiKey || !apiSecret) {
        return res.json({
          configured: false,
          status: 'offline',
          message: 'Lalamove API Keys are missing. Please add LALAMOVE_API_KEY and LALAMOVE_API_SECRET to the environment.'
        });
      }

      // Perform a real query to GET /v3/cities to verify connection
      const time = new Date().getTime().toString();
      const method = 'GET';
      const requestPath = '/v3/cities';
      const body = '';
      const rawSignature = `${time}\r\n${method}\r\n${requestPath}\r\n\r\n${body}`;
      const signature = crypto.createHmac('sha256', apiSecret).update(rawSignature).digest('hex');
      const requestId = `REQ-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      const response = await fetch('https://rest.lalamove.com/v3/cities', {
        method: 'GET',
        headers: {
          'Authorization': `hmac ${apiKey}:${time}:${signature}`,
          'Market': 'TH',
          'Request-ID': requestId
        }
      });

      if (response.ok) {
        return res.json({
          configured: true,
          status: 'online',
          message: 'Connected to Lalamove Production API successfully!'
        });
      } else {
        const errData = await response.json().catch(() => ({}));
        return res.json({
          configured: true,
          status: 'offline',
          message: 'Lalamove API returned error status ' + response.status,
          error: errData
        });
      }
    } catch (e: any) {
      console.error("Lalamove status check failed", e);
      return res.json({
        configured: true,
        status: 'offline',
        message: `Connection error: ${e.message}`
      });
    }
  });

  // We MUST keep the API Key and Secret on the server to prevent them from being stolen.
  app.post("/api/lalamove/quote", async (req, res) => {
    try {
      const apiKey = process.env.LALAMOVE_API_KEY;
      const apiSecret = process.env.LALAMOVE_API_SECRET;
      
      if (!apiKey || !apiSecret) {
        return res.status(500).json({ error: "Lalamove API Keys are missing in Secrets." });
      }

      const time = new Date().getTime().toString();
      const method = 'POST';
      const requestPath = '/v3/quotations';
      const body = JSON.stringify(req.body);
      const rawSignature = `${time}\r\n${method}\r\n${requestPath}\r\n\r\n${body}`;
      const signature = crypto.createHmac('sha256', apiSecret).update(rawSignature).digest('hex');
      const requestId = `REQ-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      const response = await fetch('https://rest.lalamove.com/v3/quotations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `hmac ${apiKey}:${time}:${signature}`,
          'Market': 'TH',
          'Request-ID': requestId
        },
        body: body
      });

      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json({ error: data });
      }

      return res.json(data);
    } catch (e: any) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/lalamove/order", async (req, res) => {
    try {
      const apiKey = process.env.LALAMOVE_API_KEY;
      const apiSecret = process.env.LALAMOVE_API_SECRET;
      
      if (!apiKey || !apiSecret) {
        return res.status(500).json({ error: "Lalamove API Keys are missing in Secrets." });
      }

      const time = new Date().getTime().toString();
      const method = 'POST';
      const requestPath = '/v3/orders';
      const body = JSON.stringify(req.body);
      const rawSignature = `${time}\r\n${method}\r\n${requestPath}\r\n\r\n${body}`;
      const signature = crypto.createHmac('sha256', apiSecret).update(rawSignature).digest('hex');
      const requestId = `REQ-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      const response = await fetch('https://rest.lalamove.com/v3/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `hmac ${apiKey}:${time}:${signature}`,
          'Market': 'TH',
          'Request-ID': requestId
        },
        body: body
      });

      const data = await response.json();
      
      if (!response.ok) {
        return res.status(response.status).json({ error: data });
      }

      return res.json(data);
    } catch (e: any) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/lalamove/order/:id", async (req, res) => {
    try {
      const apiKey = process.env.LALAMOVE_API_KEY;
      const apiSecret = process.env.LALAMOVE_API_SECRET;
      
      if (!apiKey || !apiSecret) return res.status(500).json({ error: "Missing keys" });

      const time = new Date().getTime().toString();
      const method = 'GET';
      const requestPath = `/v3/orders/${req.params.id}`;
      const rawSignature = `${time}\r\n${method}\r\n${requestPath}\r\n\r\n`;
      const signature = crypto.createHmac('sha256', apiSecret).update(rawSignature).digest('hex');
      const requestId = `REQ-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      const response = await fetch(`https://rest.lalamove.com${requestPath}`, {
        method,
        headers: {
          'Authorization': `hmac ${apiKey}:${time}:${signature}`,
          'Market': 'TH',
          'Request-ID': requestId
        }
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data });
      return res.json(data);
    } catch (e: any) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  });

  app.delete("/api/lalamove/order/:id", async (req, res) => {
    try {
      const apiKey = process.env.LALAMOVE_API_KEY;
      const apiSecret = process.env.LALAMOVE_API_SECRET;
      
      if (!apiKey || !apiSecret) return res.status(500).json({ error: "Missing keys" });

      const time = new Date().getTime().toString();
      const method = 'DELETE';
      const requestPath = `/v3/orders/${req.params.id}`;
      const rawSignature = `${time}\r\n${method}\r\n${requestPath}\r\n\r\n`;
      const signature = crypto.createHmac('sha256', apiSecret).update(rawSignature).digest('hex');
      const requestId = `REQ-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

      const response = await fetch(`https://rest.lalamove.com${requestPath}`, {
        method,
        headers: {
          'Authorization': `hmac ${apiKey}:${time}:${signature}`,
          'Market': 'TH',
          'Request-ID': requestId
        }
      });
      const data = await response.json();
      if (!response.ok) return res.status(response.status).json({ error: data });
      return res.json(data);
    } catch (e: any) {
      console.error(e);
      return res.status(500).json({ error: e.message });
    }
  });

  // Supabase for webhook (need standard createClient since it's backend)
  app.post("/api/webhook/lalamove", async (req, res) => {
    try {
      console.log('Lalamove Webhook Event:', req.body);
      const eventType = req.body.eventType;
      const orderId = req.body.data?.order?.orderId;
      const status = req.body.data?.order?.status; // e.g., ASSIGNING_DRIVER, ON_GOING, PICKED_UP, COMPLETED, CANCELED, REJECTED
      const driver = req.body.data?.order?.driverId; 
      
      // --- Webhook authenticity checks (Lalamove v3) ---
      const body = req.body || {};
      // Lalamove's initial connection test can be an empty body - just ACK it.
      if (!body.eventType && !body.data) {
        return res.status(200).send('OK');
      }

      // 1) Hard check: the apiKey pushed with the event must be OUR api key.
      const ourApiKey = process.env.LALAMOVE_API_KEY || '';
      if (!ourApiKey || body.apiKey !== ourApiKey) {
        console.warn('Lalamove webhook REJECTED: apiKey mismatch');
        return res.status(401).send('Invalid');
      }

      // 2) HMAC signature check per Lalamove v3 webhook docs:
      //    raw = `${timestamp}\r\nPOST\r\n${path}\r\n\r\n${JSON.stringify(data)}`
      //    Enforced only when LALAMOVE_WEBHOOK_STRICT=true so that a format surprise
      //    cannot break live delivery updates (Lalamove disables the URL after 10
      //    failed pushes). Watch Cloud Run logs: once real events log "signature OK",
      //    set LALAMOVE_WEBHOOK_STRICT=true to enforce.
      try {
        const lalaSecret = process.env.LALAMOVE_API_SECRET || '';
        const rawSignature = `${body.timestamp}\r\nPOST\r\n/api/webhook/lalamove\r\n\r\n${JSON.stringify(body.data)}`;
        const expectedSig = crypto.createHmac('sha256', lalaSecret).update(rawSignature).digest('hex');
        const sigOk = !!body.signature && expectedSig === String(body.signature);
        if (sigOk) {
          console.log('Lalamove webhook signature OK:', body.eventType);
        } else {
          console.warn('Lalamove webhook signature MISMATCH:', body.eventType, '| strict =', process.env.LALAMOVE_WEBHOOK_STRICT === 'true');
          if (process.env.LALAMOVE_WEBHOOK_STRICT === 'true') {
            return res.status(401).send('Invalid signature');
          }
        }
      } catch (sigErr) {
        console.warn('Lalamove webhook signature check failed to run:', sigErr);
        if (process.env.LALAMOVE_WEBHOOK_STRICT === 'true') {
          return res.status(401).send('Invalid signature');
        }
      }

      if (orderId && status) {
        // Find matching Supabase order and update it
        // We will do this via a raw fetch to Supabase REST API for simplicity on the server
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
        
        if (supabaseUrl && supabaseKey) {
            let mappedStatus = status.toLowerCase();
            if (status === 'ON_GOING') mappedStatus = 'ongoing';
            
            // orders table is staff-only now; the webhook goes through a narrow
            // SECURITY DEFINER RPC that can only touch delivery_status.
            // It returns the affected order so we can LINE-notify the customer.
            let updatedRows: any[] = [];
            try {
                const wr = await fetch(`${supabaseUrl}/rest/v1/rpc/webhook_update_delivery_status`, {
                    method: 'POST',
                    headers: {
                        'apikey': supabaseKey,
                        'Authorization': `Bearer ${supabaseKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        p_lalamove_order_id: orderId,
                        p_status: mappedStatus
                    })
                });
                if (wr.ok) updatedRows = await wr.json();
            } catch (e) { console.warn('webhook rpc error', e); }

            try {
                if (Array.isArray(updatedRows) && updatedRows.length > 0) {
                    const row = updatedRows[0];
                    const sid = String(row.order_id || '').slice(-4);
                    // Include Lalamove's live-tracking share link so the customer
                    // can watch the rider on the map in real time.
                    const trackLine = row.lalamove_share_link ? `\n📍 ดูตำแหน่งไรเดอร์แบบสด: ${row.lalamove_share_link}` : '';
                    if (status === 'PICKED_UP' || status === 'ON_GOING') {
                        await lineNotifyByPhone(row.customer_phone, `🛵 ไรเดอร์รับออเดอร์ #${sid} แล้ว กำลังนำไปส่งครับ!${trackLine}`);
                    } else if (status === 'COMPLETED') {
                        await lineNotifyByPhone(row.customer_phone, `📦 ออเดอร์ #${sid} ส่งถึงเรียบร้อยครับ ขอบคุณที่อุดหนุน Pizza Damac 🍕`);
                    }
                }
            } catch (e) { console.warn('LINE delivery notify error', e); }
        }
      }
      
      return res.status(200).send('OK');
    } catch (e: any) {
      console.error('Webhook error', e);
      return res.status(500).send('Error');
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
