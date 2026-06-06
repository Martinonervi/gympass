require("dotenv").config();
const express = require("express");
const { MercadoPagoConfig, Preference } = require("mercadopago");
const { initializeApp, cert } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");

const app = express();
app.use(express.json());

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const adminAuth = getAuth();

const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

const PRECIOS = { classic: 5000, platinum: 10000, black: 20000 };
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
      },
    });

    res.json({ initPoint: result.init_point });
  } catch (error) {
    console.error("crear-preferencia error:", error);
    res.status(500).json({ error: "Error al crear preferencia" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor corriendo en puerto ${PORT}`));
