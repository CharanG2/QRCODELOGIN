require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const path = require("path");

const app = express();

// Middleware
app.use(cors({ origin: "*" }));
app.use(bodyParser.json());

// Serve static files from the root directory
app.use(express.static(path.join(__dirname)));

// PostgreSQL Database Connection
const pool = new Pool({
    connectionString: "postgresql://neondb_owner:npg_93ADyYGaolsL@ep-falling-brook-a563oirs-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
    ssl: { rejectUnauthorized: false }
});

// Test database connection
pool.connect()
    .then(() => console.log("Connected to PostgreSQL Database"))
    .catch((err) => {
        console.error("Database connection failed: ", err);
        process.exit(1);
    });

let otpStore = {};

// API Routes

// Generate and Send OTP
app.post("/send-otp", (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: "Phone number is required!" });

    const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
    otpStore[phone] = otp;
    console.log(`Generated OTP for ${phone}: ${otp}`);

    res.json({ success: true, otp });
});

// Verify OTP
app.post("/verify-otp", (req, res) => {
    const { phone, otp } = req.body;
    if (otpStore[phone] && otpStore[phone].toString() === otp.toString()) {
        delete otpStore[phone];
        res.json({ success: true, message: "OTP Verified!" });
    } else {
        res.json({ success: false, message: "Invalid OTP! Please try again." });
    }
});

// Scan QR Code and store with phone number
app.post("/scan-qr", async (req, res) => {
    const { serialNumber, phone } = req.body;
    if (!serialNumber || !phone) {
        return res.status(400).json({ 
            success: false, 
            message: "Serial number and phone number are required!",
            status: "error"
        });
    }

    try {
        // Check if QR code exists and get scan status
        const qrCheck = await pool.query(
            `SELECT id, phone_number, scanned, scan_timestamp 
             FROM qr_codes 
             WHERE serial_number = $1`, 
            [serialNumber]
        );

        if (qrCheck.rows.length === 0) {
            return res.json({ 
                success: false, 
                message: "Invalid QR Code!",
                status: "error",
                errorType: "invalid_code"
            });
        }

        const qrData = qrCheck.rows[0];

        // Case 1: QR already scanned by this user
        if (qrData.phone_number === phone) {
            return res.json({ 
                success: false,
                message: `You have already scanned this QR code on ${new Date(qrData.scan_timestamp).toLocaleString()}`,
                status: "warning",
                errorType: "duplicate",
                scanTimestamp: qrData.scan_timestamp
            });
        }

        // Case 2: QR already scanned by another user
        if (qrData.scanned && qrData.phone_number !== phone) {
            return res.json({ 
                success: false,
                message: "This QR code has already been used by another user!",
                status: "error",
                errorType: "already_used",
                scanTimestamp: qrData.scan_timestamp
            });
        }

        // Case 3: QR is available for scanning
        await pool.query(
            `UPDATE qr_codes 
             SET scanned = TRUE, phone_number = $1, scan_timestamp = NOW() 
             WHERE serial_number = $2`,
            [phone, serialNumber]
        );

        return res.json({ 
            success: true,
            message: "QR Code scanned successfully!",
            status: "success",
            scanTimestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error("Database error:", error);
        return res.status(500).json({ 
            success: false,
            message: "Database error",
            status: "error"
        });
    }
});

// Get all scanned QR codes for a user
app.post("/get-user-scans", async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: "Phone number is required!" });

    try {
        const result = await pool.query(
            `SELECT serial_number, scan_timestamp as scanned_at 
             FROM qr_codes 
             WHERE phone_number = $1 
             ORDER BY scan_timestamp DESC`,
            [phone]
        );

        return res.json({
            success: true,
            scans: result.rows,
            count: result.rows.length
        });

    } catch (error) {
        console.error("Database error:", error);
        return res.status(500).json({ success: false, message: "Database error" });
    }
});

// Serve index.html for all other GET requests
app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Serving files from: ${__dirname}`);
});
