require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Pool } = require("pg");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// Security Middleware
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGINS || "*" }));
app.use(bodyParser.json({ limit: "10kb" }));
app.use(morgan("combined"));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later"
});
app.use("/api/", limiter);

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

// Session store for OTPs (in production, use Redis)
const otpStore = new Map();

// Utility function for API responses
const respond = (res, status, success, message, data = {}) => {
  return res.status(status).json({ success, message, ...data });
};

// Generate and Send OTP
app.post("/api/send-otp", async (req, res) => {
  const { phone } = req.body;
  
  if (!phone || phone.length !== 10) {
    return respond(res, 400, false, "Valid 10-digit phone number is required");
  }

  try {
    // Check if user exists or create new
    const userCheck = await pool.query(
      "SELECT id FROM users WHERE phone = $1", 
      [phone]
    );

    if (userCheck.rows.length === 0) {
      await pool.query(
        "INSERT INTO users (phone) VALUES ($1)",
        [phone]
      );
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry
    
    // Store OTP with expiry
    otpStore.set(phone, { otp, expiresAt });
    
    // In production, send via SMS service
    console.log(`OTP for ${phone}: ${otp}`);
    
    return respond(res, 200, true, "OTP sent successfully", { otp });
    
  } catch (error) {
    console.error("Error sending OTP:", error);
    return respond(res, 500, false, "Failed to send OTP");
  }
});

// Verify OTP
app.post("/api/verify-otp", async (req, res) => {
  const { phone, otp } = req.body;
  
  if (!phone || !otp) {
    return respond(res, 400, false, "Phone number and OTP are required");
  }

  try {
    const storedOtp = otpStore.get(phone);
    
    // Check if OTP exists and is not expired
    if (!storedOtp || storedOtp.expiresAt < new Date()) {
      otpStore.delete(phone);
      return respond(res, 400, false, "OTP expired or invalid");
    }
    
    if (storedOtp.otp !== otp) {
      return respond(res, 400, false, "Invalid OTP");
    }
    
    // OTP is valid - generate session token
    otpStore.delete(phone);
    
    // In production, generate JWT token
    const sessionToken = "temp-session-" + Math.random().toString(36).substring(2);
    
    // Update user last login
    await pool.query(
      "UPDATE users SET last_login = NOW() WHERE phone = $1",
      [phone]
    );
    
    return respond(res, 200, true, "OTP verified successfully", { 
      sessionToken,
      phone 
    });
    
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return respond(res, 500, false, "Failed to verify OTP");
  }
});

// QR Code Scanning Endpoint
app.post("/api/scan-qr", async (req, res) => {
  const { serialNumber, phone } = req.body;
  
  if (!serialNumber || !phone) {
    return respond(res, 400, false, "Serial number and phone number are required");
  }

  try {
    // Start transaction
    const client = await pool.connect();
    
    try {
      await client.query("BEGIN");
      
      // Check QR code
      const qrCheck = await client.query(
        `SELECT id, phone_number, scanned, scan_timestamp 
         FROM qr_codes 
         WHERE serial_number = $1 FOR UPDATE`,
        [serialNumber]
      );

      if (qrCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return respond(res, 404, false, "QR Code not found");
      }

      const qrData = qrCheck.rows[0];

      // Case 1: Already scanned by this user
      if (qrData.phone_number === phone) {
        await client.query("ROLLBACK");
        return respond(res, 400, false, "You've already scanned this QR code", {
          duplicate: true,
          scanTimestamp: qrData.scan_timestamp
        });
      }

      // Case 2: Scanned by another user
      if (qrData.scanned && qrData.phone_number !== phone) {
        await client.query("ROLLBACK");
        return respond(res, 400, false, "QR code already used by another user", {
          alreadyUsed: true
        });
      }

      // Case 3: Valid scan
      await client.query(
        `UPDATE qr_codes 
         SET scanned = TRUE, phone_number = $1, scan_timestamp = NOW() 
         WHERE serial_number = $2`,
        [phone, serialNumber]
      );

      // Log the scan
      await client.query(
        `INSERT INTO scan_logs (user_phone, qr_serial, scan_time)
         VALUES ($1, $2, NOW())`,
        [phone, serialNumber]
      );

      await client.query("COMMIT");
      
      return respond(res, 200, true, "QR Code scanned successfully");
      
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error("QR scan error:", error);
    return respond(res, 500, false, "Failed to process QR scan");
  }
});

// Get user scan history
app.post("/api/user-scans", async (req, res) => {
  const { phone } = req.body;
  
  if (!phone) {
    return respond(res, 400, false, "Phone number is required");
  }

  try {
    const result = await pool.query(
      `SELECT qr.serial_number, sl.scan_time as scanned_at
       FROM scan_logs sl
       JOIN qr_codes qr ON sl.qr_serial = qr.serial_number
       WHERE sl.user_phone = $1
       ORDER BY sl.scan_time DESC`,
      [phone]
    );

    return respond(res, 200, true, "Scan history retrieved", {
      scans: result.rows,
      count: result.rows.length
    });
    
  } catch (error) {
    console.error("Error fetching scan history:", error);
    return respond(res, 500, false, "Failed to fetch scan history");
  }
});

// Admin endpoints
const adminAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || authHeader !== `Bearer ${process.env.ADMIN_TOKEN}`) {
    return respond(res, 401, false, "Unauthorized");
  }
  
  next();
};

// Add new QR codes
app.post("/api/admin/qr-codes", adminAuth, async (req, res) => {
  const { serialNumbers } = req.body;
  
  if (!serialNumbers || !Array.isArray(serialNumbers)) {
    return respond(res, 400, false, "Array of serial numbers is required");
  }

  try {
    const results = [];
    
    for (const serial of serialNumbers) {
      try {
        await pool.query(
          "INSERT INTO qr_codes (serial_number) VALUES ($1)",
          [serial]
        );
        results.push({ serial, success: true });
      } catch (error) {
        if (error.code === '23505') { // Unique violation
          results.push({ serial, success: false, message: "Already exists" });
        } else {
          throw error;
        }
      }
    }
    
    return respond(res, 200, true, "QR codes processed", { results });
    
  } catch (error) {
    console.error("Error adding QR codes:", error);
    return respond(res, 500, false, "Failed to add QR codes");
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  respond(res, 500, false, "Internal server error");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
