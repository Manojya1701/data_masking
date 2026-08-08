/* ==============================
   JSON FORMAT HANDLER
================================ */

/*
  Recursively walks through JSON data.

  It supports:
  - Objects
  - Nested objects
  - Arrays
  - Nested arrays
*/


function walkJson(
  value,
  callback,
  keyName = ""
) {

  // ------------------------------
  // ARRAY
  // ------------------------------

  if (Array.isArray(value)) {

    return value.map(item =>
      walkJson(
        item,
        callback,
        keyName
      )
    );
  }


  // ------------------------------
  // OBJECT
  // ------------------------------

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
        walkJson(
          childValue,
          callback,
          key
        );
    }

    return result;
  }


  // ------------------------------
  // PRIMITIVE VALUE
  // ------------------------------

  return callback(
    value,
    keyName
  );
}


/* ==============================
   PARSE JSON
================================ */

function parseJson(text) {

  try {

    return JSON.parse(text);

  } catch (error) {

    throw new Error(
      "Invalid JSON file."
    );
  }
}


/* ==============================
   CONVERT BACK TO JSON
================================ */

function stringifyJson(data) {

  return JSON.stringify(
    data,
    null,
    2
  );
}


/* ==============================
   EXPORT
================================ */

module.exports = {
  parseJson,
  stringifyJson,
  walkJson
};