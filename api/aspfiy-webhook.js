import crypto from "node:crypto";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore }                  from "firebase-admin/firestore";

if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId:   process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey:  process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
        })
    });
}

const db = getFirestore();

function verifyAspfiySignature(signature, secret) {
    const expected = crypto.createHash("md5").update(secret).digest("hex");
    return signature === expected;
}

export default async function handler(req, res) {
    if (req.method === "OPTIONS") return res.status(200).end();
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const signature = req.headers["x-wiaxy-signature"] || "";
    const secret    = process.env.ASPFIY_SECRET_KEY || "";

    if (secret && !verifyAspfiySignature(signature, secret)) {
        return res.status(401).json({ error: "Invalid signature" });
    }

    const body = req.body || {};

    // Aspfiy sends payment notification for reserved account credit
    // reference field matches what we sent during reserve — format: NXT-{timestamp}-{rand}
    const reference = body.reference || body.data?.reference || "";
    const amount    = body.amount    || body.data?.amount    || 0;
    const status    = (body.status   || body.data?.status    || "").toLowerCase();

    if (status !== "success" && status !== "successful") {
        return res.status(200).json({ received: true });
    }

    if (!reference) {
        return res.status(200).json({ received: true });
    }

    try {
        // Find the pending user by reference
        const snap = await db.collection("nextelusers")
            .where("aspfiyReference", "==", reference)
            .limit(1)
            .get();

        if (!snap.empty) {
            await snap.docs[0].ref.update({
                activated:       true,
                activatedAt:     new Date().toISOString(),
                aspfiyReference: reference,
                paidAmount:      String(amount)
            });
        }
    } catch (err) {
        console.error("Firestore update failed:", err);
    }

    return res.status(200).json({ received: true });
}
