let scanner;
let otpTimer;
let timeLeft = 30;
let attemptCount = 0;
const MAX_ATTEMPTS = 3;
let lastScannedCode = null;
let isProcessingScan = false;

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

    document.getElementById("scanQR").disabled = true;
    document.getElementById("scanStatus").innerHTML = "Preparing scanner...";
    document.getElementById("scanStatus").className = "status-message info";

    if (!scanner) {
        scanner = new Html5QrcodeScanner("qr-video", { 
            fps: 10, 
            qrbox: 250,
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        });
    }

    scanner.render(
        (decodedText) => {
            // Prevent processing if already processing or if this is the same code
            if (isProcessingScan || decodedText === lastScannedCode) {
                return;
            }

            isProcessingScan = true;
            lastScannedCode = decodedText;
            
            scanner.clear().then(() => {
                scanner = null;
                handleScannedQR(decodedText, phone);
            }).catch(error => {
                console.error("Failed to clear scanner:", error);
                scanner = null;
                handleScannedQR(decodedText, phone);
            });
        },
        (errorMessage) => {
            console.error("QR Scanner Error:", errorMessage);
            document.getElementById("scanStatus").innerHTML = "Scanner error: " + errorMessage;
            document.getElementById("scanStatus").className = "status-message error";
            document.getElementById("scanQR").disabled = false;
            isProcessingScan = false;
        }
    );
}

function handleScannedQR(decodedText, phone) {
    document.getElementById("scanStatus").innerHTML = "<i class='fas fa-spinner fa-spin'></i> Processing QR code...";
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
                message += `<br><small>Scanned on: ${new Date(data.scanTimestamp).toLocaleString()}</small>`;
            }
            
            document.getElementById("scanStatus").innerHTML = message;
            document.getElementById("scanStatus").className = `status-message ${statusClass}`;
        }
        document.getElementById("scanQR").disabled = false;
        isProcessingScan = false;
    })
    .catch(error => {
        console.error("Error scanning QR Code:", error);
        document.getElementById("scanStatus").innerHTML = "<i class='fas fa-exclamation-circle'></i> Failed to scan QR Code. Please try again.";
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
