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
   EXPORT FUNCTIONS
================================ */

module.exports = {
  extractPdfText,
  createPdfFromText
};