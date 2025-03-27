require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Pool } = require("pg");

const app = express();
app.use(cors({ origin: "https://qrcodelogin-1-em0m.onrender.com" }));
app.use(bodyParser.json());

// PostgreSQL Database Connection
const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_93ADyYGaolsL@ep-falling-brook-a563oirs-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
    ssl: {
        rejectUnauthorized: false // Allows SSL connections
    }
});

// Test database connection
pool.connect()
    .then(() => console.log("Connected to PostgreSQL Database"))
    .catch((err) => {
        console.error("Database connection failed: ", err);
        process.exit(1);
    });

// Store OTPs mapped to phone numbers
let otpStore = {};

// Base URL Route
app.get("/", (req, res) => {
    res.send("Server is running successfully!");
});

// Generate and Send OTP
app.post("/send-otp", (req, res) => {
    console.log("Received request body:", req.body);
    const { phone } = req.body;

    if (!phone) {
        return res.status(400).json({ message: "Phone number is required!" });
    }

    const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
    otpStore[phone] = otp;
    console.log(`Generated OTP for ${phone}: ${otp}`);

    res.json({ otp });
});

// Verify OTP
app.post("/verify-otp", (req, res) => {
    const { phone, otp } = req.body;
    console.log("Stored OTP:", otpStore[phone]);
    console.log("Received OTP:", otp);

    if (otpStore[phone] && otpStore[phone].toString() === otp.toString()) {
        delete otpStore[phone];
        res.json({ success: true, message: "OTP Verified!" });
    } else {
        res.json({ success: false, message: "Invalid OTP! Please try again." });
    }
});

// Scan QR Code and store in database
app.post("/scan-qr", async (req, res) => {
    const { serialNumber } = req.body;
    console.log("Received serial Number:", serialNumber);

    if (!serialNumber) {
        return res.status(400).json({ message: "Serial number is required!" });
    }

    try {
        const result = await pool.query("SELECT * FROM qr_codes WHERE serial_number = $1", [serialNumber]);

        if (result.rows.length === 0) {
            return res.json({ message: "QR Code not found!" });
        }

        if (result.rows[0].scanned) {
            return res.json({ message: "QR Code already scanned!" });
        }

        await pool.query(
            "UPDATE qr_codes SET scanned = TRUE, scanned_at = NOW() WHERE serial_number = $1",
            [serialNumber]
        );

        return res.json({ message: "QR Code scanned successfully!" });

    } catch (error) {
        console.error("Database error:", error);
        return res.status(500).json({ message: "Database error", error });
    }
});

// Start the server
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
