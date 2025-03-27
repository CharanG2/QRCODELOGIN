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
        rejectUnauthorized: false
    }
});

// Test database connection
pool.connect()
    .then(() => console.log("Connected to PostgreSQL Database"))
    .catch((err) => {
        console.error("Database connection failed: ", err);
        process.exit(1);
    });

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
    const { serialNumber, phone } = req.body;
    console.log("Received serial Number:", serialNumber, "for phone:", phone);

    if (!serialNumber || !phone) {
        return res.status(400).json({ message: "Serial number and phone number are required!" });
    }

    try {
        // Check if QR code exists
        const qrCheck = await pool.query(
            "SELECT * FROM qr_codes WHERE serial_number = $1", 
            [serialNumber]
        );

        if (qrCheck.rows.length === 0) {
            return res.json({ message: "QR Code not found!" });
        }

        // Check if this user already scanned this QR code
        const userScanCheck = await pool.query(
            `SELECT * FROM user_qr_scans 
             WHERE phone_number = $1 AND serial_number = $2`,
            [phone, serialNumber]
        );

        if (userScanCheck.rows.length > 0) {
            return res.json({ 
                message: "You have already scanned this QR code!",
                duplicate: true
            });
        }

        // Record the scan
        await pool.query(
            `INSERT INTO user_qr_scans (phone_number, serial_number, scanned_at)
             VALUES ($1, $2, NOW())`,
            [phone, serialNumber]
        );

        // Update the QR code status
        await pool.query(
            "UPDATE qr_codes SET scanned = TRUE WHERE serial_number = $1",
            [serialNumber]
        );

        return res.json({ 
            message: "QR Code scanned successfully!",
            success: true
        });

    } catch (error) {
        console.error("Database error:", error);
        return res.status(500).json({ message: "Database error", error });
    }
});

// Get all scanned QR codes for a user
app.post("/get-user-scans", async (req, res) => {
    const { phone } = req.body;

    if (!phone) {
        return res.status(400).json({ message: "Phone number is required!" });
    }

    try {
        const result = await pool.query(
            `SELECT serial_number, scanned_at 
             FROM user_qr_scans 
             WHERE phone_number = $1 
             ORDER BY scanned_at DESC`,
            [phone]
        );

        return res.json({
            success: true,
            scans: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error("Database error:", error);
        return res.status(500).json({ message: "Database error", error });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
