import express from "express";
import path from "path";
import crypto from "crypto";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // JSON middleware
  app.use(express.json());

  // API to unshorten Google Map links
  app.post("/api/resolve-link", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "Missing url" });
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

  // --- ADMIN AUTH ---
  app.post("/api/verify-pin", (req, res) => {
    const { pin, username } = req.body;
    const serverPin = process.env.POS_PIN || '123456';
    if (pin === serverPin) {
      return res.json({ success: true });
    }
    return res.status(401).json({ success: false, error: 'Invalid PIN' });
  });

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
      
      // We would ideally verify the webhook signature here
      
      if (orderId && status) {
        // Find matching Supabase order and update it
        // We will do this via a raw fetch to Supabase REST API for simplicity on the server
        const supabaseUrl = process.env.VITE_SUPABASE_URL;
        const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
        
        if (supabaseUrl && supabaseKey) {
            let mappedStatus = status.toLowerCase();
            if (status === 'ON_GOING') mappedStatus = 'ongoing';
            
            await fetch(`${supabaseUrl}/rest/v1/orders?lalamove_order_id=eq.${orderId}`, {
                method: 'PATCH',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    delivery_status: mappedStatus
                })
            });
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
