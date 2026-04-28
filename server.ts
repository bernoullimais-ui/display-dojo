import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = (supabaseUrl && supabaseServiceKey) ? createClient(supabaseUrl, supabaseServiceKey) : null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- PAGAR.ME API ROUTES ---

  // Endpoint to test connection
  app.get("/api/payments/test", async (req, res) => {
    const apiKey = process.env.PAGARME_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ status: "error", message: "Pagar.me API key not configured." });
    }

    try {
      const authHeader = `Basic ${Buffer.from(apiKey + ':').toString('base64')}`;
      const response = await axios.get("https://api.pagar.me/core/v5/orders", {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        },
        params: { page: 1, size: 1 }
      });
      
      res.json({ status: "success", message: "Conectado ao Pagar.me com sucesso!", data: response.data });
    } catch (error: any) {
      console.error("Pagar.me Test Error:", error.response?.data || error.message);
      res.status(500).json({ 
        status: "error", 
        message: "Erro ao conectar com Pagar.me", 
        details: error.response?.data || error.message 
      });
    }
  });

  // Endpoint to create a transaction (subscription or masterclass)
  app.post("/api/payments/create", async (req, res) => {
    const { type, resourceId, teacherId, amount, card, customer, address } = req.body;
    const apiKey = process.env.PAGARME_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Pagar.me API key not configured on server." });
    }

    try {
      const authHeader = `Basic ${Buffer.from(apiKey + ':').toString('base64')}`;
      
      // Parse expiry date (handles "MM/YY", "MM/YYYY", "MMYY", "MMYYYY")
      const expiryStr = card.expiry.replace(/\D/g, '');
      let expMonth: number;
      let expYear: number;

      if (expiryStr.length === 4) {
        expMonth = parseInt(expiryStr.substring(0, 2));
        expYear = parseInt('20' + expiryStr.substring(2, 4));
      } else if (expiryStr.length === 6) {
        expMonth = parseInt(expiryStr.substring(0, 2));
        expYear = parseInt(expiryStr.substring(2, 6));
      } else {
        // Fallback to split if slash was provided but regex failed to be clean
        const parts = card.expiry.split('/');
        expMonth = parseInt(parts[0]);
        expYear = parts[1]?.length === 2 ? parseInt('20' + parts[1]) : parseInt(parts[1]);
      }

      const phoneDigits = customer.phone.replace(/\D/g, '');
      const areaCode = phoneDigits.substring(0, 2);
      const number = phoneDigits.substring(2);

      const customerData = {
        name: customer.name,
        email: customer.email,
        document: customer.document,
        type: "individual",
        phones: {
          mobile_phone: {
            country_code: "55",
            area_code: areaCode,
            number: number
          }
        },
        address: {
          line_1: `${address.number}, ${address.street}, ${address.neighborhood}`,
          zip_code: address.zipCode,
          city: address.city,
          state: address.state,
          country: "BR"
        }
      };

      const cardData = {
        number: card.number.replace(/\s/g, ''),
        holder_name: card.name,
        exp_month: expMonth,
        exp_year: expYear,
        cvv: card.cvv,
        billing_address: customerData.address
      };

      if (type === 'subscription') {
        const subscriptionData = {
          payment_method: "credit_card",
          currency: "BRL",
          interval: "month",
          interval_count: 1,
          billing_type: "prepaid",
          card: cardData,
          customer: customerData,
          statement_descriptor: "DOJO DIGITAL",
          items: [
            {
              description: `Assinatura Plano ${resourceId}`,
              quantity: 1,
              pricing_scheme: {
                scheme_type: "unit",
                price: amount
              }
            }
          ],
          metadata: {
            teacherId,
            planId: resourceId
          }
        };

        console.log("Creating Pagar.me Subscription:", JSON.stringify(subscriptionData, null, 2));
        
        const response = await axios.post("https://api.pagar.me/core/v5/subscriptions", subscriptionData, {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          }
        });

        return res.json(response.data);
      } else {
        // Order / Masterclass (one-time)
        const orderData = {
          items: [
            {
              amount: amount,
              description: `MasterClass: ${resourceId}`,
              quantity: 1,
              code: resourceId
            }
          ],
          customer: customerData,
          metadata: {
            teacherId,
            planId: resourceId
          },
          payments: [
            {
              payment_method: "credit_card",
              credit_card: {
                card: cardData,
                installments: 1,
                statement_descriptor: "DOJO DIGITAL"
              }
            }
          ]
        };

        console.log("Creating Pagar.me Order:", JSON.stringify(orderData, null, 2));

        const response = await axios.post("https://api.pagar.me/core/v5/orders", orderData, {
          headers: {
            'Authorization': authHeader,
            'Content-Type': 'application/json'
          }
        });

        return res.json(response.data);
      }
    } catch (error: any) {
      console.error("Pagar.me API Error:", error.response?.data || error.message);
      res.status(500).json({ 
        error: error.response?.data?.message || "Erro ao processar pagamento", 
        details: error.response?.data?.errors 
      });
    }
  });

  // Webhook for Pagar.me to notify payment status changes
  app.post("/api/webhook/pagarme", async (req, res) => {
    const event = req.body;
    console.log(`Received Pagar.me Webhook: ${event.type}`, JSON.stringify(event, null, 2));

    try {
      let teacherId = event.data?.metadata?.teacherId;
      let planId = event.data?.metadata?.planId;
      let status = event.data?.status;

      // Handle Subscription specific events
      if (event.type.startsWith('subscription.')) {
        teacherId = event.data?.metadata?.teacherId;
        planId = event.data?.metadata?.planId;
        status = event.data?.status;
      } 
      // Handle Invoice events (recurring subscription payments)
      else if (event.type.startsWith('invoice.')) {
        teacherId = event.data?.subscription?.metadata?.teacherId;
        planId = event.data?.subscription?.metadata?.planId;
        status = event.data?.status; // paid, overdue, etc
      }
      // Handle Orders (One-time payments)
      else if (event.type === 'order.paid' || event.type === 'order.payment_failed') {
        teacherId = event.data?.metadata?.teacherId;
        planId = event.data?.metadata?.planId;
        status = event.type === 'order.paid' ? 'paid' : 'failed';
      }

      console.log(`Parsed Data -> Teacher: ${teacherId}, Plan: ${planId}, Status: ${status}`);

      if (teacherId && planId && supabaseAdmin) {
        const isSuccess = status === 'active' || status === 'paid';
        console.log(`Updating teacher ${teacherId} database status to: ${isSuccess ? 'active' : 'inactive'}`);
        
        const { error } = await supabaseAdmin
          .from('teachers')
          .update({ 
            plan: planId,
            plan_status: isSuccess ? 'active' : 'expired',
            updated_at: new Date().toISOString()
          })
          .eq('id', teacherId);

        if (error) {
          console.error("Database Update Error:", error);
          return res.status(500).send("DB Error");
        }
        console.log("Database updated successfully!");
      } else {
        console.warn("Webhook received but missing teacherId, planId or supabaseAdmin configuration.");
      }

      res.status(200).send("OK");
    } catch (err) {
      console.error("Webhook processing error:", err);
      res.status(500).send("Internal Server Error");
    }
  });

  // --- VITE MIDDLEWARE ---

  if (process.env.NODE_ENV !== "production") {
    console.log("Starting in DEVELOPMENT mode with Vite middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Explicitly handle index.html for the root and any other non-API routes
    app.get("*", async (req, res, next) => {
      const url = req.originalUrl;
      // Skip API routes
      if (url.startsWith('/api')) {
        return next();
      }
      
      try {
        const fs = await import("fs");
        let template = fs.readFileSync(path.resolve(__dirname, "index.html"), "utf-8");
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    console.log("Starting in PRODUCTION mode");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
