const cheerio =
  require("cheerio");


/* ==============================
   PARSE + MASK HTML
================================ */

function processHtml(
  htmlText,
  detectSensitiveType,
  anonymizeValue
) {
  const $ =
    cheerio.load(
      htmlText,
      {
        decodeEntities: false
      }
    );

  let processedCount = 0;


  /*
    Process visible text nodes only.
    Avoid script/style content.
  */

  $("body *")
    .contents()
    .filter(function () {
      return (
        this.type === "text" &&
        this.parent &&
        !["script", "style"].includes(
          this.parent.name
        )
      );
    })
    .each(function () {
      const originalText =
        $(this).text();

      const trimmed =
        originalText.trim();

      if (!trimmed) {
        return;
      }

      let detectedType =
        detectSensitiveType(
          trimmed
        );

      /*
        If whole text node is not directly
        detected, try common label:value
        patterns.
      */

      if (!detectedType) {
        return;
      }

      const anonymized =
        anonymizeValue(
          trimmed,
          detectedType
        );

      $(this).replaceWith(
        originalText.replace(
          trimmed,
          anonymized.maskedValue
        )
      );

      processedCount++;
    });


  return {
    html:
      $.html(),

    processedCount
  };
}


module.exports = {
  processHtml
};