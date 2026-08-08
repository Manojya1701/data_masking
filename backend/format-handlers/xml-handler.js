const {
  XMLParser,
  XMLBuilder
} = require("fast-xml-parser");


const parser =
  new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_"
  });


const builder =
  new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    format: true
  });


/* ==============================
   PARSE XML
================================ */

function parseXml(text) {
  try {
    return parser.parse(text);
  } catch (error) {
    throw new Error(
      "Invalid XML file."
    );
  }
}


/* ==============================
   CONVERT BACK TO XML
================================ */

function stringifyXml(data) {
  return builder.build(data);
}


/* ==============================
   RECURSIVE XML WALKER
================================ */

function walkXml(
  value,
  callback,
  keyName = ""
) {

  if (Array.isArray(value)) {
    return value.map(item =>
      walkXml(
        item,
        callback,
        keyName
      )
    );
  }


  if (
    value !== null &&
    typeof value === "object"
  ) {

    const result = {};

    for (
      const [key, childValue]
      of Object.entries(value)
    ) {

      result[key] =
        walkXml(
          childValue,
          callback,
          key
        );
    }

    return result;
  }


  return callback(
    value,
    keyName
  );
}


module.exports = {
  parseXml,
  stringifyXml,
  walkXml
};