const parquet =
  require("parquetjs-lite");


/* ==============================
   READ PARQUET
================================ */

async function readParquet(
  filePath
) {
  const reader =
    await parquet.ParquetReader.openFile(
      filePath
    );

  const cursor =
    reader.getCursor();

  const rows = [];

  let record;

  while (
    (record = await cursor.next())
  ) {
    rows.push(record);
  }

  const schema =
    reader.schema;

  await reader.close();

  return {
    rows,
    schema
  };
}


/* ==============================
   WRITE PARQUET
================================ */

async function writeParquet(
  filePath,
  rows,
  schema
) {
  const writer =
    await parquet.ParquetWriter.openFile(
      schema,
      filePath
    );

  for (const row of rows) {
    await writer.appendRow(row);
  }

  await writer.close();
}


/* ==============================
   PROCESS PARQUET ROWS
================================ */

function processParquetRows(
  rows,
  detectSensitiveType,
  anonymizeValue
) {
  let processedCount = 0;

  const processedRows =
    rows.map(row => {

      const newRow = {
        ...row
      };

      for (
        const columnName of Object.keys(newRow)
      ) {

        const value =
          newRow[columnName];

        if (
          value === null ||
          value === undefined
        ) {
          continue;
        }

        const stringValue =
          String(value).trim();

        if (!stringValue) {
          continue;
        }

        let detectedType =
          detectSensitiveType(
            stringValue
          );

        if (!detectedType) {

          const lowerColumn =
            columnName.toLowerCase();

          if (
            lowerColumn.includes("name")
          ) {
            detectedType = "Name";
          }

          else if (
            lowerColumn.includes("email") ||
            lowerColumn.includes("mail")
          ) {
            detectedType = "Email";
          }

          else if (
            lowerColumn.includes("phone") ||
            lowerColumn.includes("mobile") ||
            lowerColumn.includes("contact")
          ) {
            detectedType = "Phone";
          }

          else if (
            lowerColumn.includes("aadhaar") ||
            lowerColumn.includes("uid")
          ) {
            detectedType = "Aadhaar";
          }

          else if (
            lowerColumn === "pan" ||
            lowerColumn.includes("pan_number")
          ) {
            detectedType = "PAN";
          }
        }

        if (!detectedType) {
          continue;
        }

        const anonymized =
          anonymizeValue(
            stringValue,
            detectedType
          );

        newRow[columnName] =
          anonymized.maskedValue;

        processedCount++;
      }

      return newRow;
    });

  return {
    rows:
      processedRows,

    processedCount
  };
}


module.exports = {
  readParquet,
  writeParquet,
  processParquetRows
};