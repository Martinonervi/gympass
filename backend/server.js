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

const PRECIOS = { classic: 5000, platinum: 10000, black: 20000 };
const NOMBRES = { classic: "Plan Classic", platinum: "Plan Platinum", black: "Plan Black" };
// Etiquetas con mayúscula inicial, igual a como se guarda planTipo en empleadores
const PLAN_LABEL = { classic: "Classic", platinum: "Platinum", black: "Black" };

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

// Pago corporativo: el empleador paga el total (precio del plan × cantidad de empleados)
app.post("/crear-preferencia-empresa", async (req, res) => {
  try {
    const idToken = req.headers.authorization?.replace("Bearer ", "");
    if (!idToken) return res.status(401).json({ error: "No autorizado" });

    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    const { planId, cantidad, periodo } = req.body;

    if (!["classic", "platinum", "black"].includes(planId)) {
      return res.status(400).json({ error: "Plan inválido" });
    }

    const cant = Number(cantidad);
    if (!Number.isInteger(cant) || cant <= 0) {
      return res.status(400).json({ error: "Cantidad inválida" });
    }

    const per = periodo === "anual" ? "anual" : "mensual";
    // Anual = 10 meses (2 meses de descuento); mensual = 1 mes.
    const meses = per === "anual" ? 10 : 1;
    const total = PRECIOS[planId] * cant * meses;

    const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
    const preference = new Preference(client);

    const result = await preference.create({
      body: {
        items: [{
          title: `${NOMBRES[planId]} corporativo ${per} (${cant} empleados)`,
          quantity: 1,
          unit_price: total,
          currency_id: "ARS",
        }],
        external_reference: `${uid}|empresa|${planId}|${cant}|${per}`,
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
    console.error("crear-preferencia-empresa error:", error);
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

    const partes = (payment.external_reference || "").split("|");
    const uid = partes[0];
    if (!uid) return res.sendStatus(200);

    // Pago corporativo: `${uid}|empresa|${planId}|${cantidad}|${periodo}`
    if (partes[1] === "empresa") {
      const planId = partes[2];
      const cantidad = Number(partes[3]);
      const periodo = partes[4] === "anual" ? "anual" : "mensual";
      if (!planId || !Number.isInteger(cantidad)) return res.sendStatus(200);

      // Vencimiento: 1 mes (mensual) o 12 meses (anual) desde el pago.
      const ahora = new Date();
      const vence = new Date(ahora);
      vence.setMonth(vence.getMonth() + (periodo === "anual" ? 12 : 1));

      await db.collection("empleadores").doc(uid).set(
        {
          planTipo: PLAN_LABEL[planId] || planId,
          cuposTotales: cantidad,
          planPagado: true,
          planPeriodo: periodo,
          planPagadoEn: ahora,
          planVence: vence,
        },
        { merge: true }
      );
      return res.sendStatus(200);
    }

    // Pago individual: `${uid}|${planId}`
    const planId = partes[1];
    if (!planId) return res.sendStatus(200);

    // Plan de usuario es mensual: vence un mes después del pago.
    const ahoraInd = new Date();
    const venceInd = new Date(ahoraInd);
    venceInd.setMonth(venceInd.getMonth() + 1);

    await db.collection("usuarios").doc(uid).set(
      { plan: planId, planActivadoEn: ahoraInd, planVence: venceInd },
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
