const crypto = require("crypto");

/* ==============================
   ALGORITHM CONFIGURATION
================================ */

const algorithms = {
  AES: {
    cipher: "aes-256-cbc",
    keyLength: 32,
    ivLength: 16
  },

  "3DES": {
    cipher: "des-ede3-cbc",
    keyLength: 24,
    ivLength: 8
  }
};

/* ==============================
   KEY GENERATION
================================ */

function generateKey(password, keyLength) {
  return crypto
    .createHash("sha256")
    .update(String(password))
    .digest()
    .subarray(0, keyLength);
}

/* ==============================
   ENCRYPT DATA
================================ */

function encryptText(
  plainText,
  password,
  selectedAlgorithm
) {
  const config =
    algorithms[selectedAlgorithm];

  if (!config) {
    throw new Error(
      "Unsupported encryption algorithm."
    );
  }

  if (!plainText || !String(plainText).trim()) {
    throw new Error(
      "Text is required for encryption."
    );
  }

  if (!password || String(password).length < 4) {
    throw new Error(
      "Encryption key must contain at least 4 characters."
    );
  }

  const key = generateKey(
    password,
    config.keyLength
  );

  const iv = crypto.randomBytes(
    config.ivLength
  );

  const cipher = crypto.createCipheriv(
    config.cipher,
    key,
    iv
  );

  let encryptedText = cipher.update(
    String(plainText),
    "utf8",
    "base64"
  );

  encryptedText += cipher.final(
    "base64"
  );

  return {
    algorithm: selectedAlgorithm,
    cipherName: config.cipher,
    iv: iv.toString("base64"),
    encryptedText
  };
}

/* ==============================
   DECRYPT DATA
================================ */

function decryptText(
  encryptedText,
  password,
  selectedAlgorithm,
  ivValue
) {
  const config =
    algorithms[selectedAlgorithm];

  if (!config) {
    throw new Error(
      "Unsupported encryption algorithm."
    );
  }

  if (!encryptedText) {
    throw new Error(
      "Encrypted text is required."
    );
  }

  if (!password) {
    throw new Error(
      "Decryption key is required."
    );
  }

  if (!ivValue) {
    throw new Error(
      "Initialization vector is required."
    );
  }

  const key = generateKey(
    password,
    config.keyLength
  );

  const iv = Buffer.from(
    ivValue,
    "base64"
  );

  const decipher =
    crypto.createDecipheriv(
      config.cipher,
      key,
      iv
    );

  let decryptedText =
    decipher.update(
      encryptedText,
      "base64",
      "utf8"
    );

  decryptedText += decipher.final(
    "utf8"
  );

  return {
    algorithm: selectedAlgorithm,
    decryptedText
  };
}
/* ==============================
   ENCRYPT FILE BUFFER
================================ */

function encryptBuffer(
  inputBuffer,
  password,
  selectedAlgorithm
) {
  const config =
    algorithms[selectedAlgorithm];

  if (!config) {
    throw new Error(
      "Unsupported encryption algorithm."
    );
  }

  const key = generateKey(
    password,
    config.keyLength
  );

  const iv = crypto.randomBytes(
    config.ivLength
  );

  const cipher =
    crypto.createCipheriv(
      config.cipher,
      key,
      iv
    );

  const encryptedBuffer =
    Buffer.concat([
      cipher.update(inputBuffer),
      cipher.final()
    ]);

  return {
    algorithm: selectedAlgorithm,
    iv: iv.toString("base64"),
    encryptedBuffer
  };
}

/* ==============================
   DECRYPT FILE BUFFER
================================ */

function decryptBuffer(
  encryptedBuffer,
  password,
  selectedAlgorithm,
  ivValue
) {
  const config =
    algorithms[selectedAlgorithm];

  if (!config) {
    throw new Error(
      "Unsupported encryption algorithm."
    );
  }

  const key = generateKey(
    password,
    config.keyLength
  );

  const iv = Buffer.from(
    ivValue,
    "base64"
  );

  const decipher =
    crypto.createDecipheriv(
      config.cipher,
      key,
      iv
    );

  return Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final()
  ]);
}

/* ==============================
   EXPORT FUNCTIONS
================================ */

module.exports = {
  encryptText,
  decryptText,
  encryptBuffer,
  decryptBuffer
};