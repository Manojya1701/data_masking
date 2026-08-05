/* ==============================
   DATA TYPE DETECTION
================================ */

function detectDataType(value) {
  const text = String(value).trim();

  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

  const phonePattern =
    /^(?:\+91[\s-]?)?[6-9]\d{9}$/;

  const aadhaarPattern =
    /^\d{4}[\s-]?\d{4}[\s-]?\d{4}$/;

  const panPattern =
    /^[A-Z]{5}[0-9]{4}[A-Z]$/i;

  if (emailPattern.test(text)) {
    return "Email";
  }

  if (
    phonePattern.test(
      text.replace(/\s|-/g, "")
    )
  ) {
    return "Phone";
  }

  if (aadhaarPattern.test(text)) {
    return "Aadhaar";
  }

  if (panPattern.test(text)) {
    return "PAN";
  }

  return "Name";
}

/* ==============================
   EMAIL MASKING
================================ */

function maskEmail(email) {
  const [username, domain] =
    String(email).split("@");

  if (!domain) {
    return "[MASKED]";
  }

  if (username.length <= 1) {
    return `*@${domain}`;
  }

  return (
    username.charAt(0) +
    "*".repeat(username.length - 1) +
    `@${domain}`
  );
}

/* ==============================
   PHONE MASKING
================================ */

function maskPhone(phone) {
  const normalizedPhone =
    String(phone).replace(/\D/g, "");

  const visibleDigits =
    normalizedPhone.slice(-4);

  return (
    "*".repeat(
      Math.max(
        normalizedPhone.length - 4,
        0
      )
    ) +
    visibleDigits
  );
}

/* ==============================
   NAME MASKING
================================ */

function maskName(name) {
  const trimmedName =
    String(name).trim();

  if (trimmedName.length <= 1) {
    return "*";
  }

  return (
    trimmedName.charAt(0) +
    "*".repeat(
      trimmedName.length - 1
    )
  );
}

/* ==============================
   AADHAAR MASKING
================================ */

function maskAadhaar(aadhaar) {
  const normalizedAadhaar =
    String(aadhaar).replace(/\D/g, "");

  const visibleDigits =
    normalizedAadhaar.slice(-4);

  return `XXXX XXXX ${visibleDigits}`;
}

/* ==============================
   PAN MASKING
================================ */

function maskPan(pan) {
  const normalizedPan =
    String(pan)
      .trim()
      .toUpperCase();

  if (normalizedPan.length !== 10) {
    return "[MASKED]";
  }

  return (
    normalizedPan.charAt(0) +
    "****" +
    normalizedPan.slice(5)
  );
}

/* ==============================
   MASK VALUE BY DATA TYPE
================================ */

function maskValue(value, dataType) {
  const trimmedValue =
    String(value).trim();

  switch (dataType) {
    case "Email":
      return maskEmail(trimmedValue);

    case "Phone":
      return maskPhone(trimmedValue);

    case "Name":
      return maskName(trimmedValue);

    case "Aadhaar":
      return maskAadhaar(trimmedValue);

    case "PAN":
      return maskPan(trimmedValue);

    default:
      return "[MASKED]";
  }
}

/* ==============================
   REDACTION
================================ */

function redactValue() {
  return "[REDACTED]";
}

/* ==============================
   PROCESS ONE SENSITIVE VALUE
================================ */

function anonymizeValue(
  value,
  forcedType = null
) {
  const originalValue =
    String(value).trim();

  const dataType =
    forcedType ||
    detectDataType(originalValue);

  return {
    dataType,
    originalValue,

    maskedValue:
      maskValue(
        originalValue,
        dataType
      ),

    redactedValue:
      redactValue()
  };
}

/* ==============================
   PROCESS COMPLETE PDF TEXT
================================ */

function anonymizePdfText(text) {
  let result = String(text);

  /*
    Mask email addresses.
    Example:
    harika@gmail.com
    becomes:
    h*****@gmail.com
  */

  result = result.replace(
    /\b([A-Z0-9._%+-]+)@([A-Z0-9.-]+\.[A-Z]{2,})\b/gi,

    (_, username, domain) => {
      const visibleCharacter =
        username.charAt(0);

      const hiddenCharacters =
        "*".repeat(
          Math.max(
            username.length - 1,
            1
          )
        );

      return (
        `${visibleCharacter}` +
        `${hiddenCharacters}` +
        `@${domain}`
      );
    }
  );

  /*
    Mask Indian phone numbers.
    Supports optional +91.
  */

  result = result.replace(
    /\b(?:\+91[\s-]?)?([6-9]\d{9})\b/g,

    (_, phone) =>
      "******" +
      phone.slice(-4)
  );

  /*
    Mask Aadhaar numbers.
    Supports spaces or hyphens.
  */

  result = result.replace(
    /\b(\d{4})[\s-]?(\d{4})[\s-]?(\d{4})\b/g,

    (_, first, middle, last) =>
      `XXXX XXXX ${last}`
  );

  /*
    Mask PAN numbers.
    Example:
    ABCDE1234F
    becomes:
    A****1234F
  */

  result = result.replace(
    /\b[A-Z]{5}[0-9]{4}[A-Z]\b/gi,

    pan =>
      maskPan(pan)
  );

  /*
    Mask values appearing after
    a Name label.
  */

  result = result.replace(
    /(Name\s*:\s*)([^\n\r]+)/gi,

    (_, label, nameValue) => {
      const name =
        nameValue.trim();

      if (!name) {
        return `${label}[MASKED]`;
      }

      return (
        label +
        maskName(name)
      );
    }
  );

  return result;
}

/* ==============================
   EXPORT FUNCTIONS
================================ */

module.exports = {
  detectDataType,
  maskEmail,
  maskPhone,
  maskName,
  maskAadhaar,
  maskPan,
  maskValue,
  redactValue,
  anonymizeValue,
  anonymizePdfText
};