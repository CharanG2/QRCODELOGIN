require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// Security middlewares
app.use(helmet());
app.use(cors({ origin: "*" }));
app.use(bodyParser.json());
app.use(morgan("combined"));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// PostgreSQL Database Connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_93ADyYGaolsL@ep-falling-brook-a563oirs-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require",
  ssl: { rejectUnauthorized: false }
});

// Test database connection
pool.connect()
  .then(() => console.log("Connected to PostgreSQL Database"))
  .catch((err) => {
    console.error("Database connection failed: ", err);
    process.exit(1);
  });

// In-memory store for OTPs (replace with Redis in production)
let otpStore = {};

// Helper function to generate OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// Generate and Send OTP
app.post("/send-otp", (req, res) => {
  const { phone } = req.body;
  
  if (!phone || phone.length !== 10) {
    return res.status(400).json({ 
      success: false, 
      message: "Valid 10-digit phone number is required!" 
    });
  }

  const otp = generateOTP();
  otpStore[phone] = {
    otp,
    attempts: 0,
    expiresAt: Date.now() + 5 * 60 * 1000 // 5 minutes expiry
  };

  console.log(`Generated OTP for ${phone}: ${otp}`); // In production, send via SMS service

  res.json({ 
    success: true, 
    message: "OTP sent successfully",
    otp // Remove in production, only for development
  });
});

// Verify OTP
app.post("/verify-otp", (req, res) => {
  const { phone, otp } = req.body;
  
  if (!phone || !otp) {
    return res.status(400).json({ 
      success: false, 
      message: "Phone number and OTP are required!" 
    });
  }

  const storedOTP = otpStore[phone];
  
  // Check if OTP exists and isn't expired
  if (!storedOTP || storedOTP.expiresAt < Date.now()) {
    return res.json({ 
      success: false, 
      message: "OTP expired. Please request a new one." 
    });
  }

  // Increment attempt counter
  storedOTP.attempts++;
  
  if (storedOTP.attempts > 5) {
    delete otpStore[phone];
    return res.json({ 
      success: false, 
      message: "Too many attempts. Please request a new OTP." 
    });
  }

  if (storedOTP.otp === otp) {
    delete otpStore[phone];
    return res.json({ 
      success: true, 
      message: "OTP Verified!",
      token: "generated-jwt-token" // In production, return a JWT
    });
  } else {
    return res.json({ 
      success: false, 
      message: "Invalid OTP! Please try again.",
      attemptsLeft: 5 - storedOTP.attempts
    });
  }
});

// Scan QR Code and store with phone number
app.post("/scan-qr", async (req, res) => {
  const { serialNumber, phone } = req.body;
  
  if (!serialNumber || !phone) {
    return res.status(400).json({ 
      success: false, 
      message: "Serial number and phone number are required!" 
    });
  }

  try {
    // Check if QR code exists
    const qrCheck = await pool.query(
      "SELECT id, phone_number, scanned, scan_timestamp FROM qr_codes WHERE serial_number = $1", 
      [serialNumber]
    );

    if (qrCheck.rows.length === 0) {
      return res.json({ 
        success: false, 
        message: "QR Code not found!",
        status: "not_found"
      });
    }

    const qrData = qrCheck.rows[0];

    // Case 1: QR already scanned by this user
    if (qrData.phone_number === phone) {
      return res.json({ 
        success: false,
        message: "You have already scanned this QR code!",
        status: "duplicate",
        scanTimestamp: qrData.scan_timestamp
      });
    }

    // Case 2: QR already scanned by another user
    if (qrData.scanned && qrData.phone_number !== phone) {
      return res.json({ 
        success: false,
        message: "This QR code has already been used by another user!",
        status: "already_used"
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
      status: "success"
    });

  } catch (error) {
    console.error("Database error:", error);
    return res.status(500).json({ 
      success: false,
      message: "Internal server error" 
    });
  }
});

// Get all scanned QR codes for a user
app.get("/user-scans/:phone", async (req, res) => {
  const { phone } = req.params;
  
  if (!phone) {
    return res.status(400).json({ 
      success: false, 
      message: "Phone number is required!" 
    });
  }

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
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
});

// Admin endpoints
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return res.status(403).json({ 
      success: false, 
      message: "Unauthorized" 
    });
  }
  next();
};

// Add new QR codes (admin endpoint)
app.post("/admin/qr-codes", adminAuth, async (req, res) => {
  const { serialNumbers } = req.body;
  
  if (!serialNumbers || !Array.isArray(serialNumbers)) {
    return res.status(400).json({ 
      success: false, 
      message: "Array of serial numbers is required!" 
    });
  }

  try {
    const values = serialNumbers.map(sn => [sn]);
    const placeholders = serialNumbers.map((_, i) => `($${i + 1})`).join(",");
    
    await pool.query(
      `INSERT INTO qr_codes (serial_number) VALUES ${placeholders}`,
      serialNumbers
    );
    
    return res.json({ 
      success: true, 
      message: `${serialNumbers.length} QR Codes added successfully!` 
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ 
        success: false, 
        message: "One or more QR codes already exist!" 
      });
    }
    console.error("Database error:", error);
    return res.status(500).json({ 
      success: false, 
      message: "Internal server error" 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    success: false, 
    message: "Something went wrong!" 
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
