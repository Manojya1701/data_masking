const YAML = require("yaml");

function parseYaml(text) {
  try {
    return YAML.parse(text);
  } catch (error) {
    throw new Error("Invalid YAML file.");
  }
}

function stringifyYaml(data) {
  return YAML.stringify(data);
}

/*
  Reuse same recursive traversal idea
  used for JSON.
*/
function walkYaml(
  value,
  callback,
  keyName = ""
) {
  if (Array.isArray(value)) {
    return value.map(item =>
      walkYaml(
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
        walkYaml(
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
  parseYaml,
  stringifyYaml,
  walkYaml
};