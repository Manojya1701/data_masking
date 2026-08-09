'use strict';

const fs = require('fs');
const cheerio = require('cheerio');
const { shouldProtect } = require('../services/sensitive-data-detector');
const { hash } = require('../services/hashing-service');
const { encrypt } = require('../services/encryption-service');
const { maskValue } = require('./mask-utils');
const { makeOutputPath } = require('./handler-utils');

// Tags whose text content should NOT be processed
const SKIP_TAGS = new Set(['script', 'style', 'meta', 'link', 'head > title']);

async function process({ filePath, originalName, outputDir, operation, options }) {
  if (operation === 'encrypt') {
    const plaintext = fs.readFileSync(filePath);
    const encrypted = encrypt(plaintext, options.password);
    const outPath = makeOutputPath(outputDir, originalName, 'enc');
    fs.writeFileSync(outPath, encrypted);
    return { outputPath: outPath, count: 0 };
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const $ = cheerio.load(raw, { decodeEntities: false });
  let count = 0;

  // Walk all text nodes, skipping script/style
  $('body *').contents().filter(function () {
    return this.type === 'text';
  }).each(function () {
    const parent = $(this).parent();
    const tagName = parent.prop('tagName')?.toLowerCase();
    if (tagName && (SKIP_TAGS.has(tagName))) return;

    const words = $(this).text().split(/\s+/);
    const newWords = words.map(word => {
      const { protect } = shouldProtect(word.trim());
      if (protect && word.trim().length > 0) {
        count++;
        return operation === 'hash' ? hash(word.trim(), options.algorithm) : maskValue(word.trim());
      }
      return word;
    });
    $(this).replaceWith(newWords.join(' '));
  });

  const outHtml = $.html();
  const outPath = makeOutputPath(outputDir, originalName, operation);
  fs.writeFileSync(outPath, outHtml, 'utf8');
  return { outputPath: outPath, count, notes: ['HTML text masking is applied to visible body text. Script/style blocks are preserved unchanged.'] };
}

module.exports = { process };
