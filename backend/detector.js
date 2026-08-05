function detectSensitiveType(value) {

    const text = String(value).trim();

    if (!text) return null;

    const email =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

    const phone =
        /^(\+91)?[6-9]\d{9}$/;

    const aadhaar =
        /^\d{4}\s?\d{4}\s?\d{4}$/;

    const pan =
        /^[A-Z]{5}[0-9]{4}[A-Z]$/i;

    if (email.test(text))
        return "Email";

    if (phone.test(text.replace(/\s|-/g, "")))
        return "Phone";

    if (aadhaar.test(text))
        return "Aadhaar";

    if (pan.test(text))
        return "PAN";

    return null;
}

module.exports = {
    detectSensitiveType
};