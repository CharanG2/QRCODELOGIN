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
        document.getElementById("otpSection").style.display = "block";
        document.getElementById("otpDisplay").innerText = "Your OTP: " + data.otp;
    })
    .catch(err => console.error("Error sending OTP:", err));
}

function verifyOTP() {
    let phone = document.getElementById("phone").value;
    let otp = document.getElementById("otp").value;

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
            
            // Load user's previous scans
            loadUserScans(phone);
        } else {
            alert("Invalid OTP! Please try again.");
        }
    })
    .catch(err => console.error("Error verifying OTP:", err));
}

function startScanner() {
    if (!scanner) {
        scanner = new Html5QrcodeScanner("qr-video", { fps: 10, qrbox: 250 });
    }

    scanner.render((decodedText) => {
        scanner.clear();
        scanner = null;

        let phone = document.getElementById("phone").value;
        
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
            if (data.duplicate) {
                alert("You've already scanned this QR code!");
            } else if (data.success) {
                alert("QR Code scanned successfully!");
                loadUserScans(phone);
            } else {
                alert(data.message || "Error scanning QR code");
            }
        })
        .catch(err => {
            console.error("Error scanning QR Code:", err);
            alert("Failed to scan QR Code. Please try again.");
        });
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
    .catch(err => console.error("Error loading user scans:", err));
}
