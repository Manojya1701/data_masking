const crypto = require("crypto");
const { blake3 } = require("hash-wasm");

function generateSalt() {
  return crypto.randomBytes(16).toString("hex");
}

async function generateSaltedHash(value, salt, algorithm) {
  const saltedData = `${value}${salt}`;

  switch (algorithm) {
    case "SHA-256":
      return crypto
        .createHash("sha256")
        .update(saltedData, "utf8")
        .digest("hex");

    case "SHA3-256":
      return crypto
        .createHash("sha3-256")
        .update(saltedData, "utf8")
        .digest("hex");

    case "BLAKE3":
      return await blake3(saltedData);

    default:
      throw new Error("Unsupported hashing algorithm.");
  }
}

async function protectValue(value, algorithm) {
  const salt = generateSalt();

  const saltedHash = await generateSaltedHash(
    value,
    salt,
    algorithm
  );

  return {
    salt,
    saltedHash,
    algorithm
  };
}

module.exports = {
  generateSalt,
  generateSaltedHash,
  protectValue
};