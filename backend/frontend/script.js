let scanner;
let otpTimer;
let timeLeft = 30;
let attemptCount = 0;
const MAX_ATTEMPTS = 3;
let lastScannedCode = null;
let isProcessingScan = false;
let scanAttempts = 0;
const MAX_SCAN_ATTEMPTS = 5;

document.addEventListener('DOMContentLoaded', () => {
    // Phone number input validation
    document.getElementById("phone").addEventListener("input", function(e) {
        this.value = this.value.replace(/[^0-9]/g, '');
        if (this.value.length > 10) {
            this.value = this.value.slice(0, 10);
        }
    });

    // Send OTP Functionality
    document.getElementById("sendOTP").addEventListener("click", sendOTP);

    // Resend OTP Functionality
    document.getElementById("resendOTP").addEventListener("click", function() {
        if (attemptCount >= MAX_ATTEMPTS) {
            showAlert("Maximum attempts reached. Please try again later.", "error");
            return;
        }
        sendOTP();
    });

    // Verify OTP Functionality
    document.getElementById("verifyOTP").addEventListener("click", verifyOTP);

    // Scan QR Code Functionality
    document.getElementById("scanQR").addEventListener("click", startScanner);
});

function sendOTP() {
    let phone = document.getElementById("phone").value;
    
    if (phone.length !== 10) {
        showAlert("Please enter exactly 10-digit phone number.", "error");
        return;
    }

    fetch("https://qrcodelogin-9741.onrender.com/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
    })
    .then(res => res.json())
    .then(data => {
        attemptCount++;
        document.getElementById("otpSection").style.display = "block";
        document.getElementById("otpDisplay").innerText = "Your OTP: " + data.otp;
        document.getElementById("resendOTP").style.display = "none";

        document.getElementById("phone").style.display = "none";
        document.getElementById("sendOTP").style.display = "none";
        document.getElementById("phoneLabel").style.display = "none";

        document.getElementById("otp").value = "";
        document.getElementById("otp").disabled = false;
        document.getElementById("verifyOTP").disabled = false;

        startTimer();
    })
    .catch(error => {
        console.error("Error sending OTP:", error);
        showAlert("Failed to send OTP. Try again.", "error");
    });
}

function startTimer() {
    clearInterval(otpTimer);
    timeLeft = 30;
    updateTimerDisplay();

    otpTimer = setInterval(() => {
        timeLeft--;
        updateTimerDisplay();

        if (timeLeft <= 0) {
            clearInterval(otpTimer);
            document.getElementById("otp").disabled = true;
            document.getElementById("verifyOTP").disabled = true;
            document.getElementById("otpDisplay").innerText = "OTP expired. Please request a new one.";
            document.getElementById("resendOTP").style.display = "inline";
            
            if (attemptCount >= MAX_ATTEMPTS) {
                document.getElementById("resendOTP").disabled = true;
                document.getElementById("otpDisplay").innerText = "Maximum attempts reached. Please try again later.";
            }
        }
    }, 1000);
}

function updateTimerDisplay() {
    document.getElementById("otpTimer").innerText = "Time remaining: " + timeLeft + " seconds";
}

function verifyOTP() {
    let phone = document.getElementById("phone").value;
    let otp = document.getElementById("otp").value;

    if (!otp) {
        showAlert("Please enter the OTP", "error");
        return;
    }

    fetch("https://qrcodelogin-9741.onrender.com/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            clearInterval(otpTimer);
            document.getElementById("qrSection").style.display = "block";
            document.getElementById("otpSection").style.display = "none";
            attemptCount = 0;
            loadUserScans(phone);
        } else {
            showAlert("Invalid OTP!", "error");
            if (attemptCount >= MAX_ATTEMPTS) {
                document.getElementById("otpDisplay").innerText = "Maximum attempts reached. Please try again later.";
                document.getElementById("otp").disabled = true;
                document.getElementById("verifyOTP").disabled = true;
                document.getElementById("resendOTP").disabled = true;
                clearInterval(otpTimer);
            }
        }
    })
    .catch(error => {
        console.error("Error verifying OTP:", error);
        showAlert("OTP verification failed.", "error");
    });
}

function startScanner() {
    const phone = document.getElementById("phone").value;
    if (!phone) {
        showAlert("Please verify your phone number first.", "error");
        return;
    }

    // Reset scan attempts counter
    scanAttempts = 0;
    
    document.getElementById("scanQR").disabled = true;
    document.getElementById("scanStatus").innerHTML = "<i class='fas fa-spinner fa-spin'></i> Preparing scanner...";
    document.getElementById("scanStatus").className = "status-message info";

    // Stop any existing scanner first
    if (scanner) {
        scanner.clear().catch(error => {
            console.log("Clearing previous scanner:", error);
        });
    }

    // Initialize scanner with better configuration
    scanner = new Html5QrcodeScanner("qr-video", {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA],
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE]
    });

    scanner.render(
        (decodedText) => {
            if (isProcessingScan || decodedText === lastScannedCode) return;
            
            isProcessingScan = true;
            lastScannedCode = decodedText;
            
            scanner.clear().then(() => {
                handleScannedQR(decodedText, phone);
            }).catch(error => {
                console.log("Scanner clear error:", error);
                handleScannedQR(decodedText, phone);
            });
        },
        (errorMessage) => {
            scanAttempts++;
            
            // Filter out common non-error messages
            if (!errorMessage.includes("NotFoundException") && 
                !errorMessage.includes("No MultiFormat Readers")) {
                console.log("Scanner message:", errorMessage);
                return;
            }
            
            // Don't show error if we've reached max attempts
            if (scanAttempts >= MAX_SCAN_ATTEMPTS) {
                document.getElementById("scanStatus").innerHTML = `
                    <i class="fas fa-exclamation-triangle"></i> 
                    Having trouble scanning? Try better lighting or a different QR code.
                    <button id="retryScan" class="secondary-btn small">
                        <i class="fas fa-sync-alt"></i> Try Again
                    </button>
                `;
                document.getElementById("scanStatus").className = "status-message warning";
                
                // Add event listener for retry button
                document.getElementById("retryScan").addEventListener("click", function() {
                    startScanner();
                });
                
                document.getElementById("scanQR").disabled = false;
                isProcessingScan = false;
                return;
            }
            
            document.getElementById("scanStatus").innerHTML = `
                <i class="fas fa-spinner fa-spin"></i> 
                Aligning QR code... (${scanAttempts}/${MAX_SCAN_ATTEMPTS})
                <div class="scan-tip">Tip: Hold steady and ensure QR code is well-lit</div>
            `;
            document.getElementById("scanStatus").className = "status-message info";
            
            document.getElementById("scanQR").disabled = false;
            isProcessingScan = false;
        }
    );
}

function handleScannedQR(decodedText, phone) {
    document.getElementById("scanStatus").innerHTML = "<i class='fas fa-spinner fa-spin'></i> Verifying QR code...";
    document.getElementById("scanStatus").className = "status-message info";
    
    fetch("https://qrcodelogin-9741.onrender.com/scan-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            serialNumber: decodedText,
            phone: phone
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById("scanStatus").innerHTML = "<i class='fas fa-check-circle'></i> QR Code scanned successfully!";
            document.getElementById("scanStatus").className = "status-message success";
            loadUserScans(phone);
        } else {
            let statusClass = "error";
            let icon = "<i class='fas fa-exclamation-circle'></i>";
            
            if (data.status === "warning") {
                statusClass = "warning";
                icon = "<i class='fas fa-exclamation-triangle'></i>";
            }
            
            let message = `${icon} ${data.message}`;
            
            if (data.scanTimestamp) {
                message += `<br><small>Previously scanned: ${new Date(data.scanTimestamp).toLocaleString()}</small>`;
            }
            
            document.getElementById("scanStatus").innerHTML = message;
            document.getElementById("scanStatus").className = `status-message ${statusClass}`;
        }
        document.getElementById("scanQR").disabled = false;
        isProcessingScan = false;
    })
    .catch(error => {
        console.error("Scan verification error:", error);
        document.getElementById("scanStatus").innerHTML = "<i class='fas fa-exclamation-circle'></i> Failed to verify scan. Please try again.";
        document.getElementById("scanStatus").className = "status-message error";
        document.getElementById("scanQR").disabled = false;
        isProcessingScan = false;
    });
}

function loadUserScans(phone) {
    fetch("https://qrcodelogin-9741.onrender.com/get-user-scans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            const scansList = document.createElement("div");
            scansList.className = "scans-list";
            scansList.innerHTML = `<h4><i class="fas fa-history"></i> Your Scan History (${data.count}):</h4>`;
            
            if (data.scans.length > 0) {
                const list = document.createElement("ul");
                data.scans.forEach(scan => {
                    const item = document.createElement("li");
                    item.innerHTML = `
                        <div class="scan-item">
                            <i class="fas fa-qrcode"></i>
                            <div class="scan-details">
                                <span class="scan-serial">${scan.serial_number}</span>
                                <span class="scan-time">${new Date(scan.scanned_at).toLocaleString()}</span>
                            </div>
                        </div>
                    `;
                    list.appendChild(item);
                });
                scansList.appendChild(list);
            } else {
                scansList.innerHTML += "<p>No QR codes scanned yet.</p>";
            }
            
            const existingList = document.getElementById("scansList");
            if (existingList) {
                existingList.replaceWith(scansList);
            } else {
                scansList.id = "scansList";
                document.getElementById("qrSection").appendChild(scansList);
            }
        }
    })
    .catch(err => {
        console.error("Error loading user scans:", err);
        document.getElementById("scanStatus").innerHTML = "<i class='fas fa-exclamation-circle'></i> Failed to load scan history";
        document.getElementById("scanStatus").className = "status-message error";
    });
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
