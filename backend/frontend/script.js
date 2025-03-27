
//const BACKEND_URL = "https://qrcodelogin.onrender.com"; // Cloud Backend URL

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

    fetch(`${BACKEND_URL}/send-otp`, {
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

    fetch(`${BACKEND_URL}/verify-otp`, {
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

<<<<<<< HEAD
        // Send scanned serial number to backend
        fetch("https://qrcodelogin-main-5j9v.onrender.com/fetch-user-details", {
=======
        let phoneNumber = document.getElementById("phone").value;
        fetch(`${BACKEND_URL}/scan-qr`, {
>>>>>>> 1c56fcd (first commit)
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ serialNumber: decodedText, phone: phoneNumber })
        })
        .then(res => res.json())
        .then(data => alert(data.message))
        .catch(err => console.error("❌ Error storing scan:", err));
    });
});
<<<<<<< HEAD

// Download PDF when the button is clicked
document.getElementById("downloadPDF").addEventListener("click", function () {
    let userId = this.getAttribute("data-user-id");

    fetch(`https://qrcodelogin-main-5j9v.onrender.com/download-pdf?userId=${userId}`, {
        method: "GET"
    })
    .then(response => response.blob())
    .then(blob => {
        let link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "UserDetails.pdf";
        link.click();
    })
    .catch(error => {
        console.error("Error downloading PDF:", error);
        alert("Failed to download the PDF.");
    });
});


=======
>>>>>>> 1c56fcd (first commit)
