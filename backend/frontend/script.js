class QRCodeLogin {
  constructor() {
    this.scanner = null;
    this.otpTimer = null;
    this.timeLeft = 30;
    this.attemptCount = 0;
    this.MAX_ATTEMPTS = 5;
    this.lastScannedCode = null;
    this.isProcessingScan = false;
    this.scanAttempts = 0;
    this.MAX_SCAN_ATTEMPTS = 5;
    this.API_BASE_URL = "https://qrcodelogin-9741.onrender.com";
    this.currentUser = null;

    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      // Phone number input validation
      document.getElementById("phone").addEventListener("input", (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
        if (e.target.value.length > 10) {
          e.target.value = e.target.value.slice(0, 10);
        }
      });

      // Send OTP
      document.getElementById("sendOTP").addEventListener("click", () => this.sendOTP());

      // Resend OTP
      document.getElementById("resendOTP").addEventListener("click", () => {
        if (this.attemptCount >= this.MAX_ATTEMPTS) {
          this.showAlert("Maximum attempts reached. Please try again later.", "error");
          return;
        }
        this.sendOTP();
      });

      // Verify OTP
      document.getElementById("verifyOTP").addEventListener("click", () => this.verifyOTP());

      // Scan QR Code
      document.getElementById("scanQR").addEventListener("click", () => this.startScanner());

      // Logout
      document.getElementById("logoutBtn")?.addEventListener("click", () => this.logout());
    });
  }

  async sendOTP() {
    const phone = document.getElementById("phone").value;
    
    if (phone.length !== 10) {
      this.showAlert("Please enter exactly 10-digit phone number.", "error");
      return;
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
      });

      if (!response.ok) throw new Error("Network response was not ok");

      const data = await response.json();
      
      if (data.success) {
        this.attemptCount++;
        document.getElementById("otpSection").style.display = "block";
        document.getElementById("otpDisplay").innerText = `OTP sent to ${phone}`;
        document.getElementById("otpValue").innerText = data.otp; // For demo only
        document.getElementById("resendOTP").style.display = "none";

        document.getElementById("phone").style.display = "none";
        document.getElementById("sendOTP").style.display = "none";
        document.getElementById("phoneLabel").style.display = "none";

        document.getElementById("otp").value = "";
        document.getElementById("otp").disabled = false;
        document.getElementById("verifyOTP").disabled = false;

        this.startTimer();
      } else {
        this.showAlert(data.message || "Failed to send OTP", "error");
      }
    } catch (error) {
      console.error("Error sending OTP:", error);
      this.showAlert("Failed to send OTP. Please try again.", "error");
    }
  }

  startTimer() {
    clearInterval(this.otpTimer);
    this.timeLeft = 30;
    this.updateTimerDisplay();

    this.otpTimer = setInterval(() => {
      this.timeLeft--;
      this.updateTimerDisplay();

      if (this.timeLeft <= 0) {
        clearInterval(this.otpTimer);
        document.getElementById("otp").disabled = true;
        document.getElementById("verifyOTP").disabled = true;
        document.getElementById("otpDisplay").innerText = "OTP expired. Please request a new one.";
        document.getElementById("resendOTP").style.display = "inline";
        
        if (this.attemptCount >= this.MAX_ATTEMPTS) {
          document.getElementById("resendOTP").disabled = true;
          document.getElementById("otpDisplay").innerText = "Maximum attempts reached. Please try again later.";
        }
      }
    }, 1000);
  }

  updateTimerDisplay() {
    const timerElement = document.getElementById("otpTimer");
    if (timerElement) {
      timerElement.innerText = `Time remaining: ${this.timeLeft} seconds`;
      if (this.timeLeft < 10) {
        timerElement.classList.add("pulse");
      } else {
        timerElement.classList.remove("pulse");
      }
    }
  }

  async verifyOTP() {
    const phone = document.getElementById("phone").value;
    const otp = document.getElementById("otp").value;

    if (!otp) {
      this.showAlert("Please enter the OTP", "error");
      return;
    }

    try {
      const response = await fetch(`${this.API_BASE_URL}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp })
      });

      if (!response.ok) throw new Error("Network response was not ok");

      const data = await response.json();
      
      if (data.success) {
        clearInterval(this.otpTimer);
        this.currentUser = { phone };
        this.showAlert("OTP verified successfully!", "success");
        this.showQRScanner();
        this.loadUserScans(phone);
      } else {
        this.showAlert(data.message || "Invalid OTP!", "error");
        if (this.attemptCount >= this.MAX_ATTEMPTS) {
          document.getElementById("otpDisplay").innerText = "Maximum attempts reached. Please try again later.";
          document.getElementById("otp").disabled = true;
          document.getElementById("verifyOTP").disabled = true;
          document.getElementById("resendOTP").disabled = true;
          clearInterval(this.otpTimer);
        }
      }
    } catch (error) {
      console.error("Error verifying OTP:", error);
      this.showAlert("OTP verification failed. Please try again.", "error");
    }
  }

  showQRScanner() {
    document.getElementById("loginSection").style.display = "none";
    document.getElementById("qrSection").style.display = "block";
    document.getElementById("otpSection").style.display = "none";
    document.getElementById("userInfo").innerText = this.currentUser.phone;
  }

  async startScanner() {
    if (!this.currentUser?.phone) {
      this.showAlert("Please verify your phone number first.", "error");
      return;
    }

    // Reset scan attempts counter
    this.scanAttempts = 0;
    
    document.getElementById("scanQR").disabled = true;
    this.updateScanStatus("<i class='fas fa-spinner fa-spin'></i> Preparing scanner...", "info");

    // Stop any existing scanner first
    if (this.scanner) {
      try {
        await this.scanner.clear();
      } catch (error) {
        console.log("Scanner clear error:", error);
      }
    }

    // Initialize scanner
    this.scanner = new Html5QrcodeScanner("qr-video", {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      rememberLastUsedCamera: true,
      supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
      formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
    });

    this.scanner.render(
      (decodedText) => this.handleQRDetection(decodedText),
      (errorMessage) => this.handleScannerError(errorMessage)
    );
  }

  async handleQRDetection(decodedText) {
    if (this.isProcessingScan || decodedText === this.lastScannedCode) return;
    
    this.isProcessingScan = true;
    this.lastScannedCode = decodedText;
    
    try {
      await this.scanner.clear();
      await this.handleScannedQR(decodedText, this.currentUser.phone);
    } catch (error) {
      console.log("Scanner clear error:", error);
      await this.handleScannedQR(decodedText, this.currentUser.phone);
    } finally {
      this.isProcessingScan = false;
    }
  }

  handleScannerError(errorMessage) {
    this.scanAttempts++;
    
    // Filter out common non-error messages
    if (!errorMessage.includes("NotFoundException") && 
        !errorMessage.includes("No MultiFormat Readers")) {
      console.log("Scanner message:", errorMessage);
      return;
    }
    
    // Don't show error if we've reached max attempts
    if (this.scanAttempts >= this.MAX_SCAN_ATTEMPTS) {
      this.updateScanStatus(
        `<i class="fas fa-exclamation-triangle"></i> 
         Having trouble scanning? Try better lighting or a different QR code.
         <button id="retryScan" class="secondary-btn small">
           <i class="fas fa-sync-alt"></i> Try Again
         </button>`,
        "warning"
      );
      
      // Add event listener for retry button
      document.getElementById("retryScan").addEventListener("click", () => {
        this.startScanner();
      });
      
      document.getElementById("scanQR").disabled = false;
      return;
    }
    
    this.updateScanStatus(
      `<i class="fas fa-spinner fa-spin"></i> 
       Aligning QR code... (${this.scanAttempts}/${this.MAX_SCAN_ATTEMPTS})
       <div class="scan-tip">Tip: Hold steady and ensure QR code is well-lit</div>`,
      "info"
    );
    
    document.getElementById("scanQR").disabled = false;
  }

  async handleScannedQR(decodedText, phone) {
    this.updateScanStatus("<i class='fas fa-spinner fa-spin'></i> Verifying QR code...", "info");
    
    try {
      const response = await fetch(`${this.API_BASE_URL}/scan-qr`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          serialNumber: decodedText,
          phone: phone
        })
      });

      if (!response.ok) throw new Error("Network response was not ok");

      const data = await response.json();
      
      if (data.success) {
        this.updateScanStatus("<i class='fas fa-check-circle'></i> QR Code scanned successfully!", "success");
        this.showAlert("QR Code scanned successfully!", "success");
        this.loadUserScans(phone);
      } else {
        let statusClass = "error";
        let icon = "<i class='fas fa-exclamation-circle'></i>";
        let message = data.message;
        
        if (data.status === "duplicate") {
          statusClass = "warning";
          icon = "<i class='fas fa-exclamation-triangle'></i>";
          if (data.scanTimestamp) {
            message += `<br><small>Previously scanned: ${new Date(data.scanTimestamp).toLocaleString()}</small>`;
          }
        } else if (data.status === "already_used") {
          statusClass = "error";
          icon = "<i class='fas fa-ban'></i>";
        }
        
        this.updateScanStatus(`${icon} ${message}`, statusClass);
        this.showAlert(message, statusClass);
      }
    } catch (error) {
      console.error("Scan verification error:", error);
      this.updateScanStatus("<i class='fas fa-exclamation-circle'></i> Failed to verify scan. Please try again.", "error");
      this.showAlert("Failed to verify scan. Please try again.", "error");
    } finally {
      document.getElementById("scanQR").disabled = false;
    }
  }

  updateScanStatus(message, type) {
    const statusElement = document.getElementById("scanStatus");
    if (statusElement) {
      statusElement.innerHTML = message;
      statusElement.className = `status-message ${type}`;
    }
  }

  async loadUserScans(phone) {
    try {
      const response = await fetch(`${this.API_BASE_URL}/user-scans/${phone}`);
      
      if (!response.ok) throw new Error("Network response was not ok");

      const data = await response.json();
      
      if (data.success) {
        this.renderScansList(data.scans, data.count);
      } else {
        throw new Error(data.message || "Failed to load scans");
      }
    } catch (error) {
      console.error("Error loading user scans:", error);
      this.updateScanStatus("<i class='fas fa-exclamation-circle'></i> Failed to load scan history", "error");
    }
  }

  renderScansList(scans, count) {
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
      scansList.innerHTML += "<p class='no-scans'>No QR codes scanned yet.</p>";
    }
    
    const existingList = document.getElementById("scansList");
    if (existingList) {
      existingList.replaceWith(scansList);
    } else {
      scansList.id = "scansList";
      document.getElementById("qrSection").appendChild(scansList);
    }
  }

  showAlert(message, type) {
    const alertDiv = document.createElement("div");
    alertDiv.className = `alert-message ${type} animate__animated animate__fadeInDown`;
    alertDiv.innerHTML = `<i class="fas fa-${type === 'error' ? 'exclamation-circle' : 'check-circle'}"></i> ${message}`;
    
    const container = document.querySelector(".container");
    if (container) {
      container.appendChild(alertDiv);
      
      setTimeout(() => {
        alertDiv.classList.add("animate__fadeOut");
        setTimeout(() => alertDiv.remove(), 500);
      }, 3000);
    }
  }

  logout() {
    this.currentUser = null;
    document.getElementById("qrSection").style.display = "none";
    document.getElementById("loginSection").style.display = "block";
    document.getElementById("phone").style.display = "block";
    document.getElementById("sendOTP").style.display = "block";
    document.getElementById("phoneLabel").style.display = "block";
    document.getElementById("phone").value = "";
    document.getElementById("otpSection").style.display = "none";
    document.getElementById("scansList")?.remove();
    
    if (this.scanner) {
      this.scanner.clear().catch(console.error);
      this.scanner = null;
    }
  }
}

// Initialize the application
new QRCodeLogin();
