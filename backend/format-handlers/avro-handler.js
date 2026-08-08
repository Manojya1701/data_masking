const avro =
  require("avsc");

//read arvo file
function readAvro(filePath) {
  return new Promise(
    (resolve, reject) => {

      const records = [];
      let avroType = null;

      const decoder =
        avro.createFileDecoder(
          filePath
        );

      decoder.on(
        "metadata",
        type => {
          avroType = type;
        }
      );

      decoder.on(
        "data",
        record => {
          records.push(record);
        }
      );

      decoder.on(
        "error",
        error => {
          reject(error);
        }
      );

      decoder.on(
        "end",
        () => {

          if (!avroType) {
            return reject(
              new Error(
                "Unable to read Avro schema."
              )
            );
          }

          resolve({
            records,
            type: avroType
          });
        }
      );
    }
  );
}

/* ==============================
   WRITE AVRO FILE
================================ */

function writeAvro(
  filePath,
  records,
  type
) {
  return new Promise(
    (resolve, reject) => {

      const encoder =
        avro.createFileEncoder(
          filePath,
          type
        );

      encoder.on(
        "error",
        reject
      );

      encoder.on(
        "finish",
        resolve
      );

      for (const record of records) {
        encoder.write(record);
      }

      encoder.end();
    }
  );
}


/* ==============================
   PROCESS AVRO RECORDS
================================ */

function processAvroRecords(
  records,
  detectSensitiveType,
  anonymizeValue
) {

  let processedCount = 0;


  const processedRecords =
    records.map(record => {

      const newRecord = {
        ...record
      };


      for (
        const fieldName
        of Object.keys(newRecord)
      ) {

        const value =
          newRecord[fieldName];


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


        /*
          If value detection fails,
          use the field name.
        */

        if (!detectedType) {

          const lowerField =
            fieldName.toLowerCase();


          if (
            lowerField.includes("name")
          ) {
            detectedType = "Name";
          }

          else if (
            lowerField.includes("email") ||
            lowerField.includes("mail")
          ) {
            detectedType = "Email";
          }

          else if (
            lowerField.includes("phone") ||
            lowerField.includes("mobile") ||
            lowerField.includes("contact")
          ) {
            detectedType = "Phone";
          }

          else if (
            lowerField.includes("aadhaar") ||
            lowerField.includes("uid")
          ) {
            detectedType = "Aadhaar";
          }

          else if (
            lowerField === "pan" ||
            lowerField.includes("pan_number")
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


        newRecord[fieldName] =
          anonymized.maskedValue;

        processedCount++;
      }


      return newRecord;
    });


  return {
    records:
      processedRecords,

    processedCount
  };
}


module.exports = {
  readAvro,
  writeAvro,
  processAvroRecords
};