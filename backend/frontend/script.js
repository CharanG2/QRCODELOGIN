let scanner;

document.getElementById("sendOTP").addEventListener("click", sendOTP);
document.getElementById("verifyOTP").addEventListener("click", verifyOTP);
document.getElementById("scanQR").addEventListener("click", startScanner);

function sendOTP() {
    let phone = document.getElementById("phone").value;
    
    if (!/^\d{10}$/.test(phone)) {
        alert("Please enter a valid 10-digit phone number.");
        return;
    }

    fetch("https://qrcodelogin-9741.onrender.com/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            document.getElementById("otpSection").style.display = "block";
            document.getElementById("otpDisplay").innerText = "Your OTP: " + data.otp;
        } else {
            alert(data.message || "Failed to send OTP");
        }
    })
    .catch(err => {
        console.error("Error sending OTP:", err);
        alert("Failed to send OTP. Please try again.");
    });
}

function verifyOTP() {
    let phone = document.getElementById("phone").value;
    let otp = document.getElementById("otp").value;

    if (!otp || otp.length !== 6) {
        alert("Please enter a valid 6-digit OTP.");
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
            alert("OTP Verified Successfully!");
            document.getElementById("qrSection").style.display = "block";
            document.getElementById("otpSection").style.display = "none";
            loadUserScans(phone);
        } else {
            alert(data.message || "Invalid OTP! Please try again.");
        }
    })
    .catch(err => {
        console.error("Error verifying OTP:", err);
        alert("Failed to verify OTP. Please try again.");
    });
}

function startScanner() {
    const phone = document.getElementById("phone").value;
    if (!phone) {
        alert("Please verify your phone number first.");
        return;
    }

    if (!scanner) {
        scanner = new Html5QrcodeScanner("qr-video", { 
            fps: 10, 
            qrbox: 250 
        });
    }

    scanner.render((decodedText) => {
        scanner.clear();
        scanner = null;

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
                alert(data.message);
                loadUserScans(phone);
            } else {
                alert(data.message || "Error scanning QR code");
            }
        })
        .catch(err => {
            console.error("Error scanning QR Code:", err);
            alert("Failed to scan QR Code. Please try again.");
        });
    }, (error) => {
        console.error("QR Scanner error:", error);
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
            const scansList = document.getElementById("scansList") || document.createElement("div");
            scansList.id = "scansList";
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
            
            document.getElementById("qrSection").appendChild(scansList);
        } else {
            alert(data.message || "Failed to load your scans");
        }
    })
    .catch(err => {
        console.error("Error loading user scans:", err);
        alert("Failed to load your scanned QR codes.");
    });
}
