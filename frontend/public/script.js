const API_BASE_URL =
  "https://data-masking-2tai.onrender.com";
const csvModeButton =
  document.getElementById("csvModeButton");

const pdfModeButton =
  document.getElementById("pdfModeButton");

const csvSection =
  document.getElementById("csvSection");

const pdfSection =
  document.getElementById("pdfSection");

const algorithmButtons =
  document.querySelectorAll(".algorithm-button");

const algorithmName =
  document.getElementById("algorithmName");

const pdfAlgorithmName =
  document.getElementById("pdfAlgorithmName");

const csvFileInput =
  document.getElementById("csvFile");

const pdfFileInput =
  document.getElementById("pdfFile");

const uploadCsvButton =
  document.getElementById("uploadCsvButton");

const uploadPdfButton =
  document.getElementById("uploadPdfButton");

const viewHistoryButton =
  document.getElementById("viewHistoryButton");

const clearHistoryButton =
  document.getElementById("clearHistoryButton");

const totalRecords =
  document.getElementById("totalRecords");

const totalFields =
  document.getElementById("totalFields");

const resultBody =
  document.getElementById("resultBody");

const messageBox =
  document.getElementById("messageBox");

const originalPdfPreview =
  document.getElementById("originalPdfPreview");

const maskedPdfPreview =
  document.getElementById("maskedPdfPreview");

const originalPdfText =
  document.getElementById("originalPdfText");

const maskedPdfText =
  document.getElementById("maskedPdfText");

const pdfSalt =
  document.getElementById("pdfSalt");

const pdfHash =
  document.getElementById("pdfHash");

let selectedAlgorithm = "SHA-256";

/* =========================
   MODE SWITCHING
========================= */

function activateMode(mode) {
  const isCsv = mode === "csv";

  csvModeButton.classList.toggle("active", isCsv);
  pdfModeButton.classList.toggle("active", !isCsv);

  csvSection.classList.toggle("hidden", !isCsv);
  pdfSection.classList.toggle("hidden", isCsv);

  hideMessage();
}

csvModeButton.addEventListener("click", () => {
  activateMode("csv");
});

pdfModeButton.addEventListener("click", () => {
  activateMode("pdf");
});

/* =========================
   ALGORITHM SELECTION
========================= */

algorithmButtons.forEach(button => {
  button.addEventListener("click", () => {
    algorithmButtons.forEach(item => {
      item.classList.remove("active");
    });

    button.classList.add("active");

    selectedAlgorithm =
      button.dataset.algorithm;

    algorithmName.textContent =
      selectedAlgorithm;

    pdfAlgorithmName.textContent =
      selectedAlgorithm;

    showMessage(
      `${selectedAlgorithm} selected.`,
      "loading"
    );
  });
});

/* =========================
   MESSAGE HELPERS
========================= */

function showMessage(message, type = "success") {
  messageBox.hidden = false;
  messageBox.textContent = message;
  messageBox.className =
    `message-box ${type}`;
}

function hideMessage() {
  messageBox.hidden = true;
  messageBox.textContent = "";
}

/* =========================
   SAFE DISPLAY HELPERS
========================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shortenValue(value, maxLength = 26) {
  const text = String(value ?? "");

  if (!text) {
    return "-";
  }

  return text.length > maxLength
    ? `${text.slice(0, maxLength)}...`
    : text;
}

/* =========================
   CSV TABLE DISPLAY
========================= */

function displayRecords(records) {
  resultBody.innerHTML = "";

  if (
    !Array.isArray(records) ||
    records.length === 0
  ) {
    resultBody.innerHTML = `
      <tr>
        <td colspan="7">
          No records available.
        </td>
      </tr>
    `;

    return;
  }

  for (const record of records) {
    const row = document.createElement("tr");

    row.innerHTML = `
      <td>
        <span class="type-badge">
          ${escapeHtml(record.dataType)}
        </span>
      </td>

      <td title="${escapeHtml(record.originalValue)}">
        ${escapeHtml(
          shortenValue(record.originalValue, 22)
        )}
      </td>

      <td class="masked">
        ${escapeHtml(record.maskedValue)}
      </td>

      <td class="redacted">
        ${escapeHtml(record.redactedValue)}
      </td>

      <td
        class="salt"
        title="${escapeHtml(record.salt)}"
      >
        ${escapeHtml(
          shortenValue(record.salt, 16)
        )}
      </td>

      <td>
        <span class="algorithm-badge">
          ${escapeHtml(record.algorithm)}
        </span>
      </td>

      <td
        class="hash"
        title="${escapeHtml(record.saltedHash)}"
      >
        ${escapeHtml(
          shortenValue(record.saltedHash, 28)
        )}
      </td>
    `;

    resultBody.appendChild(row);
  }
}

/* =========================
   CSV UPLOAD
========================= */

uploadCsvButton.addEventListener(
  "click",
  async () => {
    const selectedFile =
      csvFileInput.files[0];

    if (!selectedFile) {
      showMessage(
        "Please choose a CSV file first.",
        "error"
      );
      return;
    }

    if (
      !selectedFile.name
        .toLowerCase()
        .endsWith(".csv")
    ) {
      showMessage(
        "Only CSV files are supported in CSV mode.",
        "error"
      );
      return;
    }

    try {
      uploadCsvButton.disabled = true;
      uploadCsvButton.textContent =
        "Processing CSV...";

      showMessage(
        `Processing CSV using ${selectedAlgorithm} with random salt...`,
        "loading"
      );

      const formData =
        new FormData();

      formData.append(
        "csvFile",
        selectedFile
      );

      formData.append(
        "algorithm",
        selectedAlgorithm
      );

      const response = await fetch(
      `${API_BASE_URL}/api/upload-csv`,
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
          "Unable to process CSV."
        );
      }

      totalRecords.textContent =
        data.uploadedRows;

      totalFields.textContent =
        data.processedValues;

      algorithmName.textContent =
        data.selectedAlgorithm ||
        selectedAlgorithm;

      displayRecords(data.records);

      showMessage(
        `${data.message} ${data.processedValues} sensitive values protected.`,
        "success"
      );

    } catch (error) {
      console.error(error);

      showMessage(
        error.message,
        "error"
      );

    } finally {
      uploadCsvButton.disabled = false;
      uploadCsvButton.textContent =
        "Upload & Process CSV";
    }
  }
);

/* =========================
   PDF UPLOAD
========================= */

uploadPdfButton.addEventListener(
  "click",
  async () => {
    const selectedFile =
      pdfFileInput.files[0];

    if (!selectedFile) {
      showMessage(
        "Please choose a PDF file first.",
        "error"
      );
      return;
    }

    if (
      !selectedFile.name
        .toLowerCase()
        .endsWith(".pdf")
    ) {
      showMessage(
        "Only PDF files are supported in PDF mode.",
        "error"
      );
      return;
    }

    try {
      uploadPdfButton.disabled = true;
      uploadPdfButton.textContent =
        "Processing PDF...";

      showMessage(
        `Extracting and anonymizing PDF using ${selectedAlgorithm}...`,
        "loading"
      );

      const formData =
        new FormData();

      formData.append(
        "pdfFile",
        selectedFile
      );

      formData.append(
        "algorithm",
        selectedAlgorithm
      );

      const response = await fetch(
        `${API_BASE_URL}/api/upload-pdf`,
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
          "Unable to process PDF."
        );
      }

      originalPdfPreview.src =
  `${API_BASE_URL}${data.originalPdfUrl}?t=${Date.now()}`;

maskedPdfPreview.src =
  `${API_BASE_URL}${data.maskedPdfUrl}?t=${Date.now()}`;

      originalPdfText.textContent =
        data.originalText ||
        "No readable text found.";

      maskedPdfText.textContent =
        data.maskedText ||
        "No masked text generated.";

      pdfAlgorithmName.textContent =
        data.algorithm ||
        selectedAlgorithm;

      pdfSalt.textContent =
        shortenValue(data.salt, 22);

      pdfSalt.title =
        data.salt || "";

      pdfHash.textContent =
        shortenValue(data.saltedHash, 28);

      pdfHash.title =
        data.saltedHash || "";

      showMessage(
        data.message,
        "success"
      );

    } catch (error) {
      console.error(error);

      showMessage(
        error.message,
        "error"
      );

    } finally {
      uploadPdfButton.disabled = false;
      uploadPdfButton.textContent =
        "Upload & Process PDF";
    }
  }
);

/* =========================
   DATABASE HISTORY
========================= */

async function loadDatabaseHistory() {
  try {
    showMessage(
      "Loading records from SQLite database...",
      "loading"
    );

    const response =
      await fetch(`${API_BASE_URL}/api/history`);

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        "Unable to load database records."
      );
    }

    const formattedRecords =
      data.records.map(record => ({
        dataType:
          record.data_type,

        originalValue:
          record.original_value,

        maskedValue:
          record.masked_value,

        redactedValue:
          record.redacted_value,

        salt:
          record.salt,

        algorithm:
          record.hash_algorithm,

        saltedHash:
          record.salted_hash
      }));

    displayRecords(formattedRecords);

    totalFields.textContent =
      formattedRecords.length;

    totalRecords.textContent =
      Math.ceil(
        formattedRecords.length / 3
      );

    if (formattedRecords.length > 0) {
      algorithmName.textContent =
        formattedRecords[0].algorithm;
    }

    activateMode("csv");

    showMessage(
      `${formattedRecords.length} database records loaded.`,
      "success"
    );

  } catch (error) {
    console.error(error);

    showMessage(
      error.message,
      "error"
    );
  }
}

viewHistoryButton.addEventListener(
  "click",
  loadDatabaseHistory
);

/* =========================
   CLEAR DATABASE
========================= */

clearHistoryButton.addEventListener(
  "click",
  async () => {
    const confirmed =
      window.confirm(
        "Are you sure you want to clear all database records?"
      );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/history`,
        {
          method: "DELETE"
        }
      );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ||
          "Unable to clear database."
        );
      }

      resultBody.innerHTML = `
        <tr>
          <td colspan="7">
            No records available.
          </td>
        </tr>
      `;

      totalRecords.textContent = "0";
      totalFields.textContent = "0";

      showMessage(
        data.message,
        "success"
      );

    } catch (error) {
      console.error(error);

      showMessage(
        error.message,
        "error"
      );
    }
  }
);