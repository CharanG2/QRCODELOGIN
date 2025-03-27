let scanner;

// ✅ Send OTP Button Click
document.getElementById("sendOtpBtn").addEventListener("click", function () {
    let phone = document.getElementById("phone").value;
    let otpDisplay = document.getElementById("otpDisplay");
    let otpSection = document.getElementById("otpSection");

    if (phone.length !== 10) {
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
        otpDisplay.innerText = "OTP: " + data.otp;
        otpSection.style.display = "block";
    })
    .catch(err => console.error("Error sending OTP:", err));
});

// ✅ Verify OTP Button Click
document.getElementById("verifyOtpBtn").addEventListener("click", function () {
    let phone = document.getElementById("phone").value;
    let otpInput = document.getElementById("otpInput").value;
    let scanBtn = document.getElementById("scanQR");

    fetch("https://qrcodelogin-9741.onrender.com/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: otpInput })
    })
    .then(res => res.json())
    .then(data => {
        alert("✅ OTP Verified Successfully!");
        scanBtn.style.display = "block"; // Show scan button
    })
    .catch(err => console.error("Error verifying OTP:", err));
});

// ✅ Scan QR Code Button Click
document.getElementById("scanQR").addEventListener("click", function () {
    if (!scanner) {
        scanner = new Html5QrcodeScanner("qr-video", { fps: 10, qrbox: 250 });
    }

    scanner.render((decodedText) => {
        scanner.clear();
        scanner = null;

        let phoneNumber = document.getElementById("phone").value;
        
        fetch("https://qrcodelogin-9741.onrender.com/fetch-user-details", {  // ✅ Fixed the API endpoint
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ serialNumber: decodedText, phone: phoneNumber })
        })
        .then(res => res.json())
        .then(data => {
            alert(data.message);

            if (data.expired) {
                alert("⚠️ This QR Code has already been used!");
            }
        })
        .catch(err => console.error("❌ Error storing scan:", err));
    });
});
