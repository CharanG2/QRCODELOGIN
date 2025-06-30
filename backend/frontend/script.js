let scanner;
let otpTimer;
let timeLeft = 30;
let attemptCount = 0;
const MAX_ATTEMPTS = 3;

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
            alert("Maximum attempts reached. Please try again later.");
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
        alert("Please enter exactly 10-digit phone number.");
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

        // Clear and enable OTP digits
        document.querySelectorAll(".otp-digit").forEach(d => {
            d.value = "";
            d.disabled = false;
        });

        document.getElementById("verifyOTP").disabled = false;

        startTimer();
    })
    .catch(error => {
        console.error("Error sending OTP:", error);
        alert("Failed to send OTP. Try again.");
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
            document.querySelectorAll(".otp-digit").forEach(d => d.disabled = true);
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
    let otp = Array.from(document.querySelectorAll(".otp-digit"))
                   .map(d => d.value)
                   .join('');

    if (otp.length !== 6) {
        alert("Please enter the full 6-digit OTP");
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
            alert("Invalid OTP!");
            if (attemptCount >= MAX_ATTEMPTS) {
                document.getElementById("otpDisplay").innerText = "Maximum attempts reached. Please try again later.";
                document.querySelectorAll(".otp-digit").forEach(d => d.disabled = true);
                document.getElementById("verifyOTP").disabled = true;
                document.getElementById("resendOTP").disabled = true;
                clearInterval(otpTimer);
            }
        }
    })
    .catch(error => {
        console.error("Error verifying OTP:", error);
        alert("OTP verification failed.");
    });
}

function startScanner() {
    const phone = document.getElementById("phone").value;
    if (!phone) {
        alert("Please verify your phone number first.");
        return;
    }

    document.getElementById("scanQR").disabled = true;
    document.getElementById("scanStatus").innerHTML = "Preparing scanner...";
    document.getElementById("scanStatus").style.backgroundColor = "#e6f7ff";
    document.getElementById("scanStatus").style.color = "#0066cc";

    if (!scanner) {
        scanner = new Html5QrcodeScanner("qr-video", { 
            fps: 10, 
            qrbox: 250,
            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
        });
    }

    scanner.render(
        (decodedText) => {
            scanner.clear();
            scanner = null;
            handleScannedQR(decodedText, phone);
        },
        (errorMessage) => {
            console.error("QR Scanner Error:", errorMessage);
            document.getElementById("scanStatus").innerHTML = "Scanner error: " + errorMessage;
            document.getElementById("scanStatus").style.backgroundColor = "#ffebee";
            document.getElementById("scanStatus").style.color = "#c62828";
            document.getElementById("scanQR").disabled = false;
        }
    );
}

function handleScannedQR(decodedText, phone) {
    document.getElementById("scanStatus").innerHTML = "Processing QR code...";
    document.getElementById("scanStatus").style.backgroundColor = "#e6f7ff";
    document.getElementById("scanStatus").style.color = "#0066cc";
    
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
            document.getElementById("scanStatus").innerHTML = "QR Code scanned successfully!";
            document.getElementById("scanStatus").style.backgroundColor = "#e8f5e9";
            document.getElementById("scanStatus").style.color = "#2e7d32";
            loadUserScans(phone);
        } else {
            document.getElementById("scanStatus").innerHTML = data.message;
            document.getElementById("scanStatus").style.backgroundColor = "#ffebee";
            document.getElementById("scanStatus").style.color = "#c62828";
            
            if (data.alreadyUsed) {
                document.getElementById("scanStatus").innerHTML += "<br>This QR code is already assigned to another user.";
            }
        }
        document.getElementById("scanQR").disabled = false;
    })
    .catch(error => {
        console.error("Error scanning QR Code:", error);
        document.getElementById("scanStatus").innerHTML = "Failed to scan QR Code. Please try again.";
        document.getElementById("scanStatus").style.backgroundColor = "#ffebee";
        document.getElementById("scanStatus").style.color = "#c62828";
        document.getElementById("scanQR").disabled = false;
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
            scansList.innerHTML = `<h3>Your Scanned QR Codes (${data.count}):</h3>`;
            
            if (data.scans.length > 0) {
                const list = document.createElement("ul");
                data.scans.forEach(scan => {
                    const item = document.createElement("li");
                    item.textContent = `${scan.serial_number} - ${new Date(scan.scanned_at).toLocaleString()}`;
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
        document.getElementById("scanStatus").innerHTML = "Failed to load scan history";
        document.getElementById("scanStatus").style.backgroundColor = "#ffebee";
        document.getElementById("scanStatus").style.color = "#c62828";
    });
}
