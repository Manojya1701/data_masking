const fs = require("fs");

const { PDFParse } = require("pdf-parse");

const {
  PDFDocument,
  StandardFonts
} = require("pdf-lib");

/* ==============================
   EXTRACT TEXT FROM PDF
================================ */

async function extractPdfText(filePath) {
  const pdfBuffer =
    fs.readFileSync(filePath);

  const parser = new PDFParse({
    data: pdfBuffer
  });

  try {
    const result =
      await parser.getText();

    return result.text || "";
  } finally {
    await parser.destroy();
  }
}

/* ==============================
   SANITIZE SPECIAL CHARACTERS
================================ */

function sanitizeText(text) {
  return String(text)
    .replace(/[’‘ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/•/g, "*")
    .replace(/…/g, "...")
    .replace(/[^\x20-\x7E\n\r\t]/g, "");
}

/* ==============================
   WRAP LONG TEXT LINES
================================ */

function wrapText(
  text,
  maxCharacters = 85
) {
  const wrappedLines = [];

  const paragraphs =
    text.split(/\r?\n/);

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      wrappedLines.push("");
      continue;
    }

    const words =
      paragraph.split(/\s+/);

    let currentLine = "";

    for (const word of words) {
      const candidate =
        currentLine
          ? `${currentLine} ${word}`
          : word;

      if (
        candidate.length >
        maxCharacters
      ) {
        if (currentLine) {
          wrappedLines.push(
            currentLine
          );
        }

        currentLine = word;
      } else {
        currentLine = candidate;
      }
    }

    if (currentLine) {
      wrappedLines.push(
        currentLine
      );
    }
  }

  return wrappedLines;
}

/* ==============================
   CREATE MASKED PDF
================================ */

async function createPdfFromText(
  text,
  outputPath
) {
  const pdfDocument =
    await PDFDocument.create();

  const font =
    await pdfDocument.embedFont(
      StandardFonts.Helvetica
    );

  const safeText =
    sanitizeText(text);

  const pageWidth = 595.28;
  const pageHeight = 841.89;

  const margin = 45;
  const fontSize = 11;
  const lineHeight = 16;

  let page =
    pdfDocument.addPage([
      pageWidth,
      pageHeight
    ]);

  let y =
    pageHeight - margin;

  const lines =
    wrapText(safeText);

  for (const line of lines) {
    if (y < margin) {
      page =
        pdfDocument.addPage([
          pageWidth,
          pageHeight
        ]);

      y =
        pageHeight - margin;
    }

    page.drawText(
      line || " ",
      {
        x: margin,
        y,
        size: fontSize,
        font
      }
    );

    y -= lineHeight;
  }

  const pdfBytes =
    await pdfDocument.save();

  fs.writeFileSync(
    outputPath,
    pdfBytes
  );
}
/* ==============================
EXTRACT TEXT WITH POSITIONS
================================ */

async function extractPdfItemsWithPositions(
  filePath
) {
  const pdfBuffer =
    fs.readFileSync(filePath);

  // pdfjs-dist is ESM, so dynamic import
  // works safely inside our CommonJS project.
  const pdfjsLib =
    await import(
      "pdfjs-dist/legacy/build/pdf.mjs"
    );

  const loadingTask =
    pdfjsLib.getDocument({
      data: new Uint8Array(pdfBuffer)
    });

  const pdf =
    await loadingTask.promise;

  const pages = [];

  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber++
  ) {
    const page =
      await pdf.getPage(pageNumber);

    const viewport =
      page.getViewport({
        scale: 1
      });

    const textContent =
      await page.getTextContent();

    const items = [];

    for (
      const item of textContent.items
    ) {
      if (
        !item.str ||
        !item.str.trim()
      ) {
        continue;
      }

      const transform =
        item.transform;

      const x =
        transform[4];

      const y =
        transform[5];

      const fontSize =
        Math.abs(transform[3]) || 10;

      items.push({
        text: item.str,

        x,

        y,

        width:
          item.width || 0,

        height:
          item.height ||
          fontSize,

        fontSize
      });
    }

    pages.push({
      pageNumber,

      width:
        viewport.width,

      height:
        viewport.height,

      items
    });
  }

  return pages;
}

/* ==============================
   EXPORT FUNCTIONS
================================ */

module.exports = {
  extractPdfText,
  createPdfFromText,
  extractPdfItemsWithPositions
};