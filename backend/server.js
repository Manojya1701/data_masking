const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");
const db = require("./database");

const {
  anonymizeValue,
  anonymizePdfText
} = require("./anonymize");

const {
  protectValue
} = require("./hash");

const {
  detectSensitiveType
} = require("./detector");

const {
  extractPdfText,
  createPdfFromText
} = require("./pdf-utils");

const app = express();
const PORT = process.env.PORT || 3000;
const {
  encryptText,
  decryptText,
  encryptBuffer,
  decryptBuffer
} = require("./encryption");

/* ==============================
   FOLDERS
================================ */

const uploadDirectory = path.join(
  __dirname,
  "uploads"
);

const outputDirectory = path.join(
  __dirname,
  "output"
);

fs.mkdirSync(uploadDirectory, {
  recursive: true
});

fs.mkdirSync(outputDirectory, {
  recursive: true
});

/* ==============================
   MULTER CONFIGURATION
================================ */

const storage = multer.diskStorage({
  destination: (_, __, callback) => {
    callback(null, uploadDirectory);
  },

  filename: (_, file, callback) => {
    const safeName = file.originalname.replace(
      /[^a-zA-Z0-9._-]/g,
      "_"
    );

    callback(
      null,
      `${Date.now()}-${safeName}`
    );
  }
});

const upload = multer({
  storage,

  limits: {
    fileSize: 15 * 1024 * 1024
  },

  fileFilter: (_, file, callback) => {
  const lowerName =
    file.originalname.toLowerCase();

  const allowed =
    lowerName.endsWith(".csv") ||
    lowerName.endsWith(".pdf") ||
    lowerName.endsWith(".bin") ||
    lowerName.endsWith(".enc");

  if (!allowed) {
    return callback(
      new Error(
        "Only CSV, PDF, BIN and ENC files are allowed."
      )
    );
  }

  callback(null, true);
}
});

/* ==============================
   EXPRESS MIDDLEWARE
================================ */
app.use(cors());
app.use(express.json());

app.use(
  express.static(
    path.join(__dirname, "../frontend/public")
  )
);

app.use(
  "/uploads",
  express.static(uploadDirectory)
);

app.use(
  "/output",
  express.static(outputDirectory)
);

/* ==============================
   CSV UPLOAD ROUTE
================================ */

app.post(
  "/api/upload-csv",
  upload.single("csvFile"),

  async (request, response) => {
    try {
      if (!request.file) {
        return response.status(400).json({
          error: "Please choose a CSV file."
        });
      }

      const selectedAlgorithm =
        request.body.algorithm;

      const supportedAlgorithms = [
        "SHA-256",
        "SHA3-256",
        "BLAKE3"
      ];

      if (
        !supportedAlgorithms.includes(
          selectedAlgorithm
        )
      ) {
        return response.status(400).json({
          error:
            "Please select a valid hashing algorithm."
        });
      }

      const csvText = fs.readFileSync(
        request.file.path,
        "utf8"
      );

      const rows = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      if (rows.length === 0) {
        return response.status(400).json({
          error: "CSV file contains no records."
        });
      }

      const sensitiveKeywords = {
  name: [
    "name",
    "full name",
    "employee name",
    "student name",
    "candidate name"
  ],

  email: [
    "email",
    "mail",
    "email address",
    "official email",
    "personal email"
  ],

  phone: [
    "phone",
    "mobile",
    "mobile number",
    "contact",
    "phone number"
  ],

  aadhaar: [
    "aadhaar",
    "aadhaar number",
    "uid"
  ],

  pan: [
    "pan",
    "pan number"
  ]
};

      

      
const processedRecords = [];

const nameKeywords = [
  "name",
  "full name",
  "employee",
  "student",
  "candidate"
];

for (const row of rows) {

  for (const columnName of Object.keys(row)) {

    const value = String(
      row[columnName] || ""
    ).trim();

    if (!value) continue;

    // Step 1: Detect from VALUE
    let detectedType =
      detectSensitiveType(value);

    // Step 2: Fallback to column name
    if (!detectedType) {

      const lowerColumn =
        columnName.toLowerCase();

      if (
        nameKeywords.some(keyword =>
          lowerColumn.includes(keyword)
        )
      ) {
        detectedType = "Name";
      }

    }

    if (!detectedType)
      continue;

    const anonymized =
      anonymizeValue(
        value,
        detectedType
      );

    const protectedData =
      await protectValue(
        value,
        selectedAlgorithm
      );

    processedRecords.push({

      dataType:
        detectedType,

      originalValue:
        value,

      maskedValue:
        anonymized.maskedValue,

      redactedValue:
        anonymized.redactedValue,

      salt:
        protectedData.salt,

      algorithm:
        protectedData.algorithm,

      saltedHash:
        protectedData.saltedHash

    });

  }

}

      const insertRecord = db.prepare(`
        INSERT INTO privacy_records (
          data_type,
          original_value,
          masked_value,
          redacted_value,
          salt,
          hash_algorithm,
          salted_hash
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const saveTransaction =
        db.transaction(records => {
          for (const record of records) {
            insertRecord.run(
              record.dataType,
              record.originalValue,
              record.maskedValue,
              record.redactedValue,
              record.salt,
              record.algorithm,
              record.saltedHash
            );
          }
        });

      saveTransaction(processedRecords);

      fs.unlinkSync(request.file.path);

      response.json({
        message:
          `${selectedAlgorithm} applied successfully.`,

        uploadedRows:
          rows.length,

        processedValues:
          processedRecords.length,

        selectedAlgorithm,

        records:
          processedRecords
      });

    } catch (error) {
      console.error(error);

      response.status(500).json({
        error:
          error.message ||
          "Unable to process CSV file."
      });
    }
  }
);

/* ==============================
   PDF UPLOAD ROUTE
================================ */

app.post(
  "/api/upload-pdf",
  upload.single("pdfFile"),

  async (request, response) => {
    try {
      if (!request.file) {
        return response.status(400).json({
          error: "Please choose a PDF file."
        });
      }

      const selectedAlgorithm =
        request.body.algorithm;

      const supportedAlgorithms = [
        "SHA-256",
        "SHA3-256",
        "BLAKE3"
      ];

      if (
        !supportedAlgorithms.includes(
          selectedAlgorithm
        )
      ) {
        return response.status(400).json({
          error:
            "Please select a valid hashing algorithm."
        });
      }

      const originalText =
        await extractPdfText(
          request.file.path
        );

      if (!originalText.trim()) {
        return response.status(400).json({
          error:
            "No readable text found in the PDF."
        });
      }

      const maskedText =
        anonymizePdfText(originalText);

      const maskedPdfFileName =
        `masked-${Date.now()}.pdf`;

      const maskedPdfPath =
        path.join(
          outputDirectory,
          maskedPdfFileName
        );

      await createPdfFromText(
        maskedText,
        maskedPdfPath
      );

      const protectedData =
        await protectValue(
          originalText,
          selectedAlgorithm
        );

      const insertPdfRecord =
        db.prepare(`
          INSERT INTO pdf_records (
            file_name,
            original_pdf_path,
            masked_pdf_path,
            original_text,
            masked_text,
            salt,
            hash_algorithm,
            salted_hash
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

      insertPdfRecord.run(
        request.file.originalname,
        request.file.path,
        maskedPdfPath,
        originalText,
        maskedText,
        protectedData.salt,
        protectedData.algorithm,
        protectedData.saltedHash
      );

      response.json({
        message:
          "PDF anonymized and stored successfully.",

        algorithm:
          protectedData.algorithm,

        salt:
          protectedData.salt,

        saltedHash:
          protectedData.saltedHash,

        originalText,
        maskedText,

        originalPdfUrl:
          `/uploads/${path.basename(
            request.file.path
          )}`,

        maskedPdfUrl:
          `/output/${maskedPdfFileName}`
      });

    } catch (error) {
      console.error(error);

      response.status(500).json({
        error:
          error.message ||
          "Unable to process PDF."
      });
    }
  }
);
/* ==============================
   ENCRYPT TEXT
================================ */

app.post("/api/encrypt", (request, response) => {
  try {
    const {
      text,
      password,
      algorithm
    } = request.body;

    const result = encryptText(
      text,
      password,
      algorithm
    );

    response.json({
      message: `${algorithm} encryption successful.`,
      ...result
    });

  } catch (error) {
    console.error(error);

    response.status(400).json({
      error:
        error.message ||
        "Unable to encrypt text."
    });
  }
});
/* ==============================
ENCRYPT CSV
================================ */

app.post(
  "/api/encrypt-csv",
  upload.single("csvFile"),

  async (request, response) => {
    try {
      if (!request.file) {
        return response.status(400).json({
          error: "Please choose a CSV file."
        });
      }

      const {
        password,
        algorithm
      } = request.body;

      if (!password) {
        return response.status(400).json({
          error: "Please enter an encryption key."
        });
      }

      if (
        !["AES", "3DES"].includes(algorithm)
      ) {
        return response.status(400).json({
          error: "Invalid encryption algorithm."
        });
      }

      const csvText = fs.readFileSync(
        request.file.path,
        "utf8"
      );

      const rows = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      if (rows.length === 0) {
        return response.status(400).json({
          error: "CSV contains no records."
        });
      }

      let encryptedCount = 0;

      for (const row of rows) {

        for (
          const columnName of Object.keys(row)
        ) {

          const value = String(
            row[columnName] || ""
          ).trim();

          if (!value) continue;

          // Same detection logic used by
          // our existing anonymization system
          let detectedType =
            detectSensitiveType(value);

          if (!detectedType) {

            const lowerColumn =
              columnName.toLowerCase();

            const nameKeywords = [
              "name",
              "full name",
              "employee",
              "student",
              "candidate"
            ];

            if (
              nameKeywords.some(keyword =>
                lowerColumn.includes(keyword)
              )
            ) {
              detectedType = "Name";
            }
          }

          // Non-sensitive data remains unchanged
          if (!detectedType) {
            continue;
          }

          const encrypted =
            encryptText(
              value,
              password,
              algorithm
            );

          /*
            Store everything required for
            decryption inside the CSV cell.

            Format:
            ENC|algorithm|iv|ciphertext
          */

          row[columnName] =
            `ENC|${algorithm}|${encrypted.iv}|${encrypted.encryptedText}`;

          encryptedCount++;
        }
      }

      // We will stringify the modified rows
      // in the next step.

     const encryptedCsv =
  stringify(rows, {
    header: true
  });

const encryptedFileName =
  `encrypted-${Date.now()}.csv`;

const encryptedFilePath =
  path.join(
    outputDirectory,
    encryptedFileName
  );

fs.writeFileSync(
  encryptedFilePath,
  encryptedCsv,
  "utf8"
);

fs.unlinkSync(request.file.path);

response.json({
  message:
    "Sensitive CSV values encrypted successfully.",

  algorithm,

  encryptedValues:
    encryptedCount,

  encryptedFileUrl:
    `/output/${encryptedFileName}`,

  preview:
    rows.slice(0, 5)
});

    } catch (error) {
      console.error(error);

      response.status(500).json({
        error:
          error.message ||
          "Unable to encrypt CSV."
      });
    }
  }
);
/* ==============================
DECRYPT CSV
================================ */

app.post(
  "/api/decrypt-csv",
  upload.single("csvFile"),

  async (request, response) => {
    try {
      if (!request.file) {
        return response.status(400).json({
          error: "Please choose an encrypted CSV file."
        });
      }

      const { password } = request.body;

      if (!password) {
        return response.status(400).json({
          error: "Please enter the decryption key."
        });
      }

      const csvText = fs.readFileSync(
        request.file.path,
        "utf8"
      );

      const rows = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      if (rows.length === 0) {
        return response.status(400).json({
          error: "CSV contains no records."
        });
      }

      let decryptedCount = 0;

      for (const row of rows) {
        for (const columnName of Object.keys(row)) {
          const value = String(
            row[columnName] || ""
          ).trim();

          if (!value.startsWith("ENC|")) {
            continue;
          }

          const parts = value.split("|");

          if (parts.length < 4) {
            continue;
          }

          const algorithm = parts[1];
          const iv = parts[2];

          // Ciphertext may theoretically contain
          // the separator, so join the rest back.
          const encryptedText =
            parts.slice(3).join("|");

          const decrypted =
            decryptText(
              encryptedText,
              password,
              algorithm,
              iv
            );

          row[columnName] =
            decrypted.decryptedText;

          decryptedCount++;
        }
      }

      const decryptedCsv =
        stringify(rows, {
          header: true
        });

      const decryptedFileName =
        `decrypted-${Date.now()}.csv`;

      const decryptedFilePath =
        path.join(
          outputDirectory,
          decryptedFileName
        );

      fs.writeFileSync(
        decryptedFilePath,
        decryptedCsv,
        "utf8"
      );

      fs.unlinkSync(request.file.path);

      response.json({
        message:
          "Encrypted CSV decrypted successfully.",

        decryptedValues:
          decryptedCount,

        decryptedFileUrl:
          `/output/${decryptedFileName}`,

        preview:
          rows.slice(0, 5)
      });

    } catch (error) {
      console.error(error);

      response.status(400).json({
        error:
          "Decryption failed. Check that you uploaded an encrypted CSV and entered the correct key."
      });
    }
  }
);

/* ==============================
   DECRYPT TEXT
================================ */

app.post("/api/decrypt", (request, response) => {
  try {
    const {
      encryptedText,
      password,
      algorithm,
      iv
    } = request.body;

    const result = decryptText(
      encryptedText,
      password,
      algorithm,
      iv
    );

    response.json({
      message: `${algorithm} decryption successful.`,
      ...result
    });

  } catch (error) {
    console.error(error);

    response.status(400).json({
      error:
        error.message ||
        "Unable to decrypt text."
    });
  }
});
/* ==============================
   ENCRYPT PDF FILE
================================ */

app.post(
  "/api/encrypt-pdf",
  upload.single("pdfFile"),

  async (request, response) => {
    try {
      if (!request.file) {
        return response.status(400).json({
          error: "Please choose a PDF file."
        });
      }

      const {
        password,
        algorithm
      } = request.body;

      if (!password) {
        return response.status(400).json({
          error: "Please enter an encryption key."
        });
      }

      if (
        !["AES", "3DES"].includes(algorithm)
      ) {
        return response.status(400).json({
          error: "Invalid encryption algorithm."
        });
      }

      const originalBuffer =
        fs.readFileSync(
          request.file.path
        );

      const encrypted =
        encryptBuffer(
          originalBuffer,
          password,
          algorithm
        );

      const encryptedFileName =
        `encrypted-${Date.now()}.bin`;

      const encryptedFilePath =
        path.join(
          outputDirectory,
          encryptedFileName
        );

      /*
       * Store metadata at the beginning
       * of the encrypted file.
       */

      const metadata = JSON.stringify({
        algorithm:
          encrypted.algorithm,

        iv:
          encrypted.iv,

        originalName:
          request.file.originalname
      });

      const finalBuffer =
        Buffer.concat([
          Buffer.from(
            metadata + "\n",
            "utf8"
          ),
          encrypted.encryptedBuffer
        ]);

      fs.writeFileSync(
        encryptedFilePath,
        finalBuffer
      );

      fs.unlinkSync(
        request.file.path
      );

      response.json({
        message:
          "PDF encrypted successfully.",

        algorithm,

        encryptedFileUrl:
          `/output/${encryptedFileName}`,

        encryptedFileName
      });

    } catch (error) {
      console.error(error);

      response.status(500).json({
        error:
          error.message ||
          "Unable to encrypt PDF."
      });
    }
  }
);


/* ==============================
   DECRYPT PDF FILE
================================ */

app.post(
  "/api/decrypt-pdf",
  upload.single("encryptedPdfFile"),

  async (request, response) => {
    try {
      if (!request.file) {
        return response.status(400).json({
          error:
            "Please choose an encrypted PDF file."
        });
      }

      const {
        password
      } = request.body;

      if (!password) {
        return response.status(400).json({
          error:
            "Please enter the decryption key."
        });
      }

      const encryptedFileBuffer =
        fs.readFileSync(
          request.file.path
        );

      const newlineIndex =
        encryptedFileBuffer.indexOf(10);

      if (newlineIndex === -1) {
        throw new Error(
          "Invalid encrypted file format."
        );
      }

      const metadataText =
        encryptedFileBuffer
          .subarray(
            0,
            newlineIndex
          )
          .toString("utf8");

      const metadata =
        JSON.parse(
          metadataText
        );

      const encryptedPayload =
        encryptedFileBuffer.subarray(
          newlineIndex + 1
        );

      const decryptedBuffer =
        decryptBuffer(
          encryptedPayload,
          password,
          metadata.algorithm,
          metadata.iv
        );

      const restoredFileName =
        `restored-${Date.now()}.pdf`;

      const restoredFilePath =
        path.join(
          outputDirectory,
          restoredFileName
        );

      fs.writeFileSync(
        restoredFilePath,
        decryptedBuffer
      );

      fs.unlinkSync(
        request.file.path
      );

      response.json({
        message:
          "PDF decrypted and restored successfully.",

        originalName:
          metadata.originalName,

        restoredPdfUrl:
          `/output/${restoredFileName}`
      });

    } catch (error) {
      console.error(error);

      response.status(400).json({
        error:
          "PDF decryption failed. Check the file and secret key."
      });
    }
  }
);
/* ==============================
   CSV DATABASE HISTORY
================================ */

app.get(
  "/api/history",
  (_, response) => {
    try {
      const records = db.prepare(`
        SELECT
          id,
          data_type,
          original_value,
          masked_value,
          redacted_value,
          salt,
          hash_algorithm,
          salted_hash,
          created_at
        FROM privacy_records
        ORDER BY id DESC
      `).all();

      response.json({
        records
      });

    } catch (error) {
      console.error(error);

      response.status(500).json({
        error:
          "Unable to load database history."
      });
    }
  }
);

/* ==============================
   PDF DATABASE HISTORY
================================ */

app.get(
  "/api/pdf-history",
  (_, response) => {
    try {
      const records = db.prepare(`
        SELECT
          id,
          file_name,
          original_pdf_path,
          masked_pdf_path,
          salt,
          hash_algorithm,
          salted_hash,
          created_at
        FROM pdf_records
        ORDER BY id DESC
      `).all();

      response.json({
        records
      });

    } catch (error) {
      console.error(error);

      response.status(500).json({
        error:
          "Unable to load PDF database history."
      });
    }
  }
);

/* ==============================
   CLEAR CSV DATABASE
================================ */

app.delete(
  "/api/history",
  (_, response) => {
    try {
      db.prepare(`
        DELETE FROM privacy_records
      `).run();

      response.json({
        message:
          "CSV database history cleared."
      });

    } catch (error) {
      console.error(error);

      response.status(500).json({
        error:
          "Unable to clear CSV history."
      });
    }
  }
);

/* ==============================
   CLEAR PDF DATABASE
================================ */

app.delete(
  "/api/pdf-history",
  (_, response) => {
    try {
      db.prepare(`
        DELETE FROM pdf_records
      `).run();

      response.json({
        message:
          "PDF database history cleared."
      });

    } catch (error) {
      console.error(error);

      response.status(500).json({
        error:
          "Unable to clear PDF history."
      });
    }
  }
);

/* ==============================
   ERROR HANDLER
================================ */

app.use(
  (error, _, response, __) => {
    console.error(error);

    response.status(500).json({
      error:
        error.message ||
        "Unexpected server error."
    });
  }
);

/* ==============================
   START SERVER
================================ */

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Server running on port ${PORT}`
  );
});