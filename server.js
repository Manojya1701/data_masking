const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const cors = require("cors");
const { parse } = require("csv-parse/sync");

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
      lowerName.endsWith(".pdf");

    if (!allowed) {
      return callback(
        new Error(
          "Only CSV and PDF files are allowed."
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
    path.join(__dirname, "public")
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