export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { reference, firstName, lastName, email, phone, webhookUrl } = req.body || {};

    if (!reference || !firstName || !email || !phone) {
        return res.status(400).json({ error: "Missing required fields" });
    }

    const secret = process.env.ASPFIY_SECRET_KEY;
    if (!secret) {
        return res.status(500).json({ error: "Payment provider not configured" });
    }

    try {
        const response = await fetch("https://api-v1.aspfiy.com/reserve-paga/", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${secret}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                reference,
                firstName,
                lastName:   lastName || firstName,
                email,
                phone,
                webhookUrl: webhookUrl || `${process.env.VERCEL_URL ? "https://" + process.env.VERCEL_URL : ""}/api/aspfiy-webhook`
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Aspfiy reserve error:", data);
            return res.status(502).json({ error: data?.message || "Failed to create payment account" });
        }

        return res.status(200).json(data);
    } catch (err) {
        console.error("Aspfiy reserve fetch error:", err);
        return res.status(500).json({ error: "Payment provider unavailable" });
    }
}
