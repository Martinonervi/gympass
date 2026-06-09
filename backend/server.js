require("dotenv").config();
const express = require("express");
const { MercadoPagoConfig, Preference, Payment } = require("mercadopago");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

const app = express();
app.use(express.json());

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const adminAuth = getAuth();
const db = getFirestore();

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

const PRECIOS = { classic: 40000, platinum: 65000, black: 90000 };
const NOMBRES = { classic: "Plan Classic", platinum: "Plan Platinum", black: "Plan Black" };

app.post("/crear-preferencia", async (req, res) => {
  try {
    const idToken = req.headers.authorization?.replace("Bearer ", "");
    if (!idToken) return res.status(401).json({ error: "No autorizado" });

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const { planId } = req.body;

    if (!["classic", "platinum", "black"].includes(planId)) {
      return res.status(400).json({ error: "Plan inválido" });
    }

    const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [{
          title: NOMBRES[planId],
          quantity: 1,
          unit_price: PRECIOS[planId],
          currency_id: "ARS",
        }],
        external_reference: `${uid}|${planId}`,
        notification_url: "https://gympass-production.up.railway.app/webhook",
        back_urls: {
          success: "gympass://payment?status=approved",
          failure: "gympass://payment?status=rejected",
          pending: "gympass://payment?status=pending",
        },
        auto_return: "approved",
      },
    });

    res.json({ initPoint: result.init_point });
  } catch (error) {
    console.error("crear-preferencia error:", error);
    res.status(500).json({ error: "Error al crear preferencia" });
  }
});

app.post("/webhook", async (req, res) => {
  try {
    const { type, data } = req.body;
    if (type !== "payment") return res.sendStatus(200);

    const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
    const payment = await new Payment(client).get({ id: data.id });

    if (payment.status !== "approved") return res.sendStatus(200);

    const [uid, planId] = payment.external_reference.split("|");
    if (!uid || !planId) return res.sendStatus(200);

    await db.collection("usuarios").doc(uid).set(
      { plan: planId, planActivadoEn: new Date() },
      { merge: true }
    );

    res.sendStatus(200);
  } catch (error) {
    console.error("webhook error:", error);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
