// Configuration
const API_BASE_URL = "https://qrcodelogin-9741.onrender.com/api";
const MAX_OTP_ATTEMPTS = 5;
const OTP_EXPIRY_MINUTES = 5;
const MAX_SCAN_ATTEMPTS = 5;
const SCAN_COOLDOWN_MS = 2000;

// State management
const state = {
  scanner: null,
  otpTimer: null,
  timeLeft: OTP_EXPIRY_MINUTES * 60,
  attemptCount: 0,
  lastScannedCode: null,
  isProcessingScan: false,
  scanAttempts: 0,
  sessionToken: null,
  currentPhone: null
};

// DOM Elements
const elements = {
  phoneInput: document.getElementById("phone"),
  sendOtpBtn: document.getElementById("sendOTP"),
  resendOtpBtn: document.getElementById("resendOTP"),
  verifyOtpBtn: document.getElementById("verifyOTP"),
  scanQrBtn: document.getElementById("scanQR"),
  otpInput: document.getElementById("otp"),
  otpDisplay: document.getElementById("otpDisplay"),
  otpTimer: document.getElementById("otpTimer"),
  otpSection: document.getElementById("otpSection"),
  qrSection: document.getElementById("qrSection"),
  scanStatus: document.getElementById("scanStatus"),
  phoneLabel: document.getElementById("phoneLabel")
};

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  // Phone number validation
  elements.phoneInput.addEventListener("input", function(e) {
    this.value = this.value.replace(/[^0-9]/g, '');
    if (this.value.length > 10) {
      this.value = this.value.slice(0, 10);
    }
  });

  // Event listeners
  elements.sendOtpBtn.addEventListener("click", sendOTP);
  elements.resendOtpBtn.addEventListener("click", resendOTP);
  elements.verifyOtpBtn.addEventListener("click", verifyOTP);
  elements.scanQrBtn.addEventListener("click", startScanner);

  // Check for existing session
  checkExistingSession();
});

// Check for existing valid session
function checkExistingSession() {
  const sessionToken = localStorage.getItem("sessionToken");
  const phone = localStorage.getItem("userPhone");
  
  if (sessionToken && phone) {
    state.sessionToken = sessionToken;
    state.currentPhone = phone;
    showQRSection(phone);
  }
}

// Send OTP to user's phone
async function sendOTP() {
  const phone = elements.phoneInput.value.trim();
  
  if (phone.length !== 10) {
    showAlert("Please enter a valid 10-digit phone number", "error");
    return;
  }

  try {
    disableOtpButtons();
    showLoading(true, "Sending OTP...");
    
    const response = await fetch(`${API_BASE_URL}/send-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone })
    });
    
    const data = await response.json();
    
    if (data.success) {
      state.attemptCount++;
      state.currentPhone = phone;
      
      showOtpSection(data.otp);
      startOtpTimer();
    } else {
      showAlert(data.message || "Failed to send OTP", "error");
    }
  } catch (error) {
    console.error("Error sending OTP:", error);
    showAlert("Failed to send OTP. Please try again.", "error");
  } finally {
    showLoading(false);
  }
}

// Resend OTP
function resendOTP() {
  if (state.attemptCount >= MAX_OTP_ATTEMPTS) {
    showAlert("Maximum attempts reached. Please try again later.", "error");
    return;
  }
  sendOTP();
}

// Verify entered OTP
async function verifyOTP() {
  const otp = elements.otpInput.value.trim();
  const phone = elements.phoneInput.value.trim();
  
  if (!otp) {
    showAlert("Please enter the OTP", "error");
    return;
  }

  try {
    showLoading(true, "Verifying OTP...");
    
    const response = await fetch(`${API_BASE_URL}/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, otp })
    });
    
    const data = await response.json();
    
    if (data.success) {
      clearOtpTimer();
      state.sessionToken = data.sessionToken;
      state.currentPhone = phone;
      
      // Store session
      localStorage.setItem("sessionToken", data.sessionToken);
      localStorage.setItem("userPhone", phone);
      
      showQRSection(phone);
    } else {
      showAlert(data.message || "Invalid OTP", "error");
      
      if (state.attemptCount >= MAX_OTP_ATTEMPTS) {
        disableOtpInput();
      }
    }
  } catch (error) {
    console.error("Error verifying OTP:", error);
    showAlert("OTP verification failed", "error");
  } finally {
    showLoading(false);
  }
}

// Start QR code scanner
function startScanner() {
  if (!state.currentPhone) {
    showAlert("Please verify your phone number first", "error");
    return;
  }

  // Reset scan state
  state.scanAttempts = 0;
  state.isProcessingScan = false;
  
  // Update UI
  elements.scanQrBtn.disabled = true;
  updateScanStatus("Preparing scanner...", "info");
  
  // Stop any existing scanner
  if (state.scanner) {
    state.scanner.clear().catch(console.error);
  }

  // Initialize scanner
  state.scanner = new Html5QrcodeScanner("qr-video", {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    rememberLastUsedCamera: true,
    supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
  });

  // Render scanner
  state.scanner.render(
    qrCodeSuccessCallback,
    qrCodeErrorCallback
  );
}

// QR code scan success handler
async function qrCodeSuccessCallback(decodedText) {
  if (state.isProcessingScan || decodedText === state.lastScannedCode) return;
  
  state.isProcessingScan = true;
  state.lastScannedCode = decodedText;
  
  try {
    // Clear scanner
    await state.scanner.clear();
    
    // Process the scan
    await handleScannedQR(decodedText, state.currentPhone);
  } catch (error) {
    console.error("Scanner error:", error);
    updateScanStatus("Scanning error. Please try again.", "error");
  } finally {
    state.isProcessingScan = false;
  }
}

// QR code scan error handler
function qrCodeErrorCallback(errorMessage) {
  state.scanAttempts++;
  
  // Filter out common non-error messages
  if (!errorMessage.includes("NotFoundException") && 
      !errorMessage.includes("No MultiFormat Readers")) {
    console.log("Scanner message:", errorMessage);
    return;
  }
  
  // Handle max attempts
  if (state.scanAttempts >= MAX_SCAN_ATTEMPTS) {
    updateScanStatus(`
      <i class="fas fa-exclamation-triangle"></i> 
      Having trouble scanning? Try better lighting or a different QR code.
      <button id="retryScan" class="secondary-btn small">
        <i class="fas fa-sync-alt"></i> Try Again
      </button>
    `, "warning");
    
    // Add retry button listener
    document.getElementById("retryScan")?.addEventListener("click", startScanner);
    
    elements.scanQrBtn.disabled = false;
    return;
  }
  
  // Update status
  updateScanStatus(`
    <i class="fas fa-spinner fa-spin"></i> 
    Aligning QR code... (${state.scanAttempts}/${MAX_SCAN_ATTEMPTS})
    <div class="scan-tip">Tip: Hold steady and ensure QR code is well-lit</div>
  `, "info");
  
  elements.scanQrBtn.disabled = false;
}

// Process scanned QR code
async function handleScannedQR(decodedText, phone) {
  updateScanStatus("Verifying QR code...", "info");
  
  try {
    const response = await fetch(`${API_BASE_URL}/scan-qr`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.sessionToken}`
      },
      body: JSON.stringify({ 
        serialNumber: decodedText,
        phone
      })
    });
    
    const data = await response.json();
    
    if (data.success) {
      updateScanStatus("QR Code scanned successfully!", "success");
      loadUserScans(phone);
      
      // Add cooldown to prevent rapid scans
      elements.scanQrBtn.disabled = true;
      setTimeout(() => {
        elements.scanQrBtn.disabled = false;
        startScanner();
      }, SCAN_COOLDOWN_MS);
    } else {
      let statusClass = "error";
      let icon = "<i class='fas fa-exclamation-circle'></i>";
      let message = data.message;
      
      if (data.duplicate) {
        statusClass = "warning";
        icon = "<i class='fas fa-exclamation-triangle'></i>";
        if (data.scanTimestamp) {
          message += `<br><small>Previously scanned: ${new Date(data.scanTimestamp).toLocaleString()}</small>`;
        }
      } else if (data.alreadyUsed) {
        statusClass = "error";
        icon = "<i class='fas fa-ban'></i>";
      }
      
      updateScanStatus(`${icon} ${message}`, statusClass);
      elements.scanQrBtn.disabled = false;
    }
  } catch (error) {
    console.error("Scan verification error:", error);
    updateScanStatus("Failed to verify scan. Please try again.", "error");
    elements.scanQrBtn.disabled = false;
  }
}

// Load user's scan history
async function loadUserScans(phone) {
  try {
    const response = await fetch(`${API_BASE_URL}/user-scans`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.sessionToken}`
      },
      body: JSON.stringify({ phone })
    });
    
    const data = await response.json();
    
    if (data.success) {
      renderScanHistory(data.scans, data.count);
    } else {
      console.error("Failed to load scan history:", data.message);
    }
  } catch (error) {
    console.error("Error loading scan history:", error);
  }
}

// Render scan history list
function renderScanHistory(scans, count) {
  const scansList = document.createElement("div");
  scansList.className = "scans-list";
  scansList.innerHTML = `<h4><i class="fas fa-history"></i> Your Scan History (${count}):</h4>`;
  
  if (scans.length > 0) {
    const list = document.createElement("ul");
    
    scans.forEach(scan => {
      const item = document.createElement("li");
      item.innerHTML = `
        <div class="scan-item">
          <i class="fas fa-qrcode"></i>
          <div class="scan-details">
            <span class="scan-serial">${scan.serial_number}</span>
            <span class="scan-time">${new Date(scan.scanned_at).toLocaleString()}</span>
          </div>
          <div class="scan-status success">
            <i class="fas fa-check"></i>
          </div>
        </div>
      `;
      list.appendChild(item);
    });
    
    scansList.appendChild(list);
  } else {
    scansList.innerHTML += "<p>No QR codes scanned yet.</p>";
  }
  
  // Update or create the list
  const existingList = document.getElementById("scansList");
  if (existingList) {
    existingList.replaceWith(scansList);
  } else {
    scansList.id = "scansList";
    elements.qrSection.appendChild(scansList);
  }
}

// OTP Timer functions
function startOtpTimer() {
  clearOtpTimer();
  state.timeLeft = OTP_EXPIRY_MINUTES * 60;
  updateOtpTimerDisplay();

  state.otpTimer = setInterval(() => {
    state.timeLeft--;
    updateOtpTimerDisplay();

    if (state.timeLeft <= 0) {
      clearOtpTimer();
      disableOtpInput();
      elements.otpDisplay.innerText = "OTP expired. Please request a new one.";
      elements.resendOtpBtn.style.display = "inline";
      
      if (state.attemptCount >= MAX_OTP_ATTEMPTS) {
        elements.resendOtpBtn.disabled = true;
        elements.otpDisplay.innerText = "Maximum attempts reached. Please try again later.";
      }
    }
  }, 1000);
}

function clearOtpTimer() {
  if (state.otpTimer) {
    clearInterval(state.otpTimer);
    state.otpTimer = null;
  }
}

function updateOtpTimerDisplay() {
  const minutes = Math.floor(state.timeLeft / 60);
  const seconds = state.timeLeft % 60;
  elements.otpTimer.innerText = `Time remaining: ${minutes}:${seconds.toString().padStart(2, '0')}`;
}

// UI Helper functions
function showOtpSection(otp) {
  elements.otpSection.style.display = "block";
  elements.otpDisplay.innerText = `Your OTP: ${otp}`;
  elements.resendOtpBtn.style.display = "none";

  elements.phoneInput.style.display = "none";
  elements.sendOtpBtn.style.display = "none";
  elements.phoneLabel.style.display = "none";

  elements.otpInput.value = "";
  elements.otpInput.disabled = false;
  elements.verifyOtpBtn.disabled = false;
}

function showQRSection(phone) {
  elements.otpSection.style.display = "none";
  elements.qrSection.style.display = "block";
  state.attemptCount = 0;
  loadUserScans(phone);
}

function disableOtpInput() {
  elements.otpInput.disabled = true;
  elements.verifyOtpBtn.disabled = true;
  elements.resendOtpBtn.disabled = true;
}

function disableOtpButtons() {
  elements.sendOtpBtn.disabled = true;
  elements.resendOtpBtn.disabled = true;
  elements.verifyOtpBtn.disabled = true;
}

function enableOtpButtons() {
  elements.sendOtpBtn.disabled = false;
  elements.resendOtpBtn.disabled = false;
  elements.verifyOtpBtn.disabled = false;
}

function updateScanStatus(message, type) {
  elements.scanStatus.innerHTML = message;
  elements.scanStatus.className = `status-message ${type}`;
}

function showAlert(message, type) {
  const alertDiv = document.createElement("div");
  alertDiv.className = `alert-message ${type} animate__animated animate__fadeInDown`;
  alertDiv.innerHTML = `<i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i> ${message}`;
  
  document.querySelector(".container").appendChild(alertDiv);
  
  setTimeout(() => {
    alertDiv.classList.add("animate__fadeOut");
    setTimeout(() => alertDiv.remove(), 500);
  }, 3000);
}

function showLoading(show, text = "Processing...") {
  const loader = document.getElementById("loadingOverlay");
  const loaderText = document.getElementById("loadingText");
  
  if (show) {
    loaderText.textContent = text;
    loader.classList.add("active");
  } else {
    loader.classList.remove("active");
  }
}

// Initialize loading overlay if not exists
if (!document.getElementById("loadingOverlay")) {
  const loadingOverlay = document.createElement("div");
  loadingOverlay.id = "loadingOverlay";
  loadingOverlay.className = "loading-overlay";
  loadingOverlay.innerHTML = `
    <div class="loader">
      <div class="loader-circle"></div>
      <div class="loader-circle"></div>
      <div class="loader-circle"></div>
      <div class="loader-circle"></div>
    </div>
    <div id="loadingText">Processing...</div>
  `;
  document.body.appendChild(loadingOverlay);
}
