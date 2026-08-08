/* ==============================
   OTHER FORMAT ELEMENTS
================================ */

const otherFileType =
  document.getElementById("otherFileType");

const otherFile =
  document.getElementById("otherFile");

const otherFileHint =
  document.getElementById("otherFileHint");

const processOtherFileButton =
  document.getElementById("processOtherFileButton");

const downloadProcessedFile =
  document.getElementById("downloadProcessedFile");


/* ==============================
   FORMAT CONFIGURATION
================================ */

const formatConfig = {

 json: {
  accept: ".json,application/json",
  hint: "Choose a .json file",
  endpoint: "/api/process-json"
},

yaml: {
  accept: ".yaml,.yml,text/yaml",
  hint: "Choose a .yaml or .yml file",
  endpoint: "/api/process-yaml"
},

 xml: {
  accept: ".xml,text/xml,application/xml",
  hint: "Choose a .xml file",
  endpoint: "/api/process-xml"
},

  html: {
  accept: ".html,.htm,text/html",
  hint: "Choose a .html or .htm file",
  endpoint: "/api/process-html"
},

  parquet: {
  accept: ".parquet",
  hint: "Choose a .parquet file",
  endpoint: "/api/process-parquet"
},

  avro: {
  accept: ".avro",
  hint: "Choose a .avro file",
  endpoint: "/api/process-avro"
},

  orc: {
    accept: ".orc",
    hint: "Choose a .orc file"
  }

};


/* ==============================
   FILE TYPE SELECTION
================================ */

otherFileType.addEventListener(
  "change",
  () => {

    const selectedType =
      otherFileType.value;

    console.log(
      "Selected format:",
      selectedType
    );


    if (!selectedType) {

      otherFile.disabled = true;

      otherFile.value = "";

      otherFile.removeAttribute(
        "accept"
      );

      otherFileHint.textContent =
        "Select a file type first.";

      return;
    }


    const config =
      formatConfig[selectedType];


    otherFile.disabled = false;

    otherFile.accept =
      config.accept;

    otherFile.value = "";

    otherFileHint.textContent =
      config.hint;


    downloadProcessedFile.hidden =
      true;
  }
);


/* ==============================
   PROCESS FILE
================================ */

processOtherFileButton.addEventListener(
  "click",
  async () => {

    const selectedType =
      otherFileType.value;

    const file =
      otherFile.files[0];


    if (!selectedType) {
      alert(
        "Please select a file type."
      );

      return;
    }


    if (!file) {
      alert(
        "Please choose a file."
      );

      return;
    }


   

    const formData =
      new FormData();

    formData.append(
      "otherFile",
      file
    );


    try {

      processOtherFileButton.disabled =
        true;

      processOtherFileButton.textContent =
        "Processing...";


      const endpoint =
  formatConfig[selectedType].endpoint;



const response =
  await fetch(
    `${API_BASE_URL}${endpoint}`,
          {
            method: "POST",
            body: formData
          }
        );


      const data =
        await response.json();


      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to process file."
        );
      }


      const fileResponse =
  await fetch(
    `${API_BASE_URL}${data.outputFileUrl}`
  );

if (!fileResponse.ok) {
  throw new Error(
    "Processed file was created, but download failed."
  );
}

const fileBlob =
  await fileResponse.blob();

const blobUrl =
  URL.createObjectURL(fileBlob);

downloadProcessedFile.href =
  blobUrl;

const extension =
  selectedType === "yaml"
    ? "yaml"
    : selectedType;

downloadProcessedFile.download =
  `masked-${Date.now()}.${extension}`;

downloadProcessedFile.hidden =
  false;

downloadProcessedFile.textContent =
  `⬇ Download Processed ${selectedType.toUpperCase()}`;
      alert(
        `${data.message}\nSensitive values processed: ${data.processedValues}`
      );


    } catch (error) {

      console.error(error);

      alert(
        error.message
      );


    } finally {

      processOtherFileButton.disabled =
        false;

      processOtherFileButton.textContent =
        "Process File";
    }
  }
);
/* ==============================
   PROCESS HTML
================================ */

app.post(
  "/api/process-html",
  upload.single("otherFile"),

  async (request, response) => {
    try {
      if (!request.file) {
        return response.status(400).json({
          error: "Please choose an HTML file."
        });
      }

      const htmlText =
        fs.readFileSync(
          request.file.path,
          "utf8"
        );

      const result =
        processHtml(
          htmlText,
          detectSensitiveType,
          anonymizeValue
        );

      const outputFileName =
        `masked-${Date.now()}.html`;

      const outputPath =
        path.join(
          outputDirectory,
          outputFileName
        );

      fs.writeFileSync(
        outputPath,
        result.html,
        "utf8"
      );

      fs.unlinkSync(
        request.file.path
      );

      response.json({
        message:
          "HTML sensitive data masked successfully.",

        processedValues:
          result.processedCount,

        outputFileUrl:
          `/output/${outputFileName}`
      });

    } catch (error) {
      console.error(error);

      response.status(400).json({
        error:
          error.message ||
          "Unable to process HTML."
      });
    }
  }
);