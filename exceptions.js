class PronoteAPIError extends Error {
  constructor(...args) {
    super(...args);
    this.name = "PronoteAPIError";
    this.pronote_error_code = null;
    this.pronote_error_msg = null;
  }
}

class CryptoError extends PronoteAPIError {
  constructor(...args) {
    super(...args);
    this.name = "CryptoError";
  }
}

class ExpiredObject extends PronoteAPIError {
  constructor(...args) {
    super(...args);
    this.name = "ExpiredObject";
  }
}

class ChildNotFound extends PronoteAPIError {
  constructor(...args) {
    super(...args);
    this.name = "ChildNotFound";
  }
}

class DataError extends Error {
  constructor(...args) {
    super(...args);
    this.name = "DataError";
  }
}

class ParsingError extends DataError {
  constructor(message, json_dict, path) {
    super(message);
    this.name = "ParsingError";
    this.json_dict = json_dict;
    this.path = path;
  }
}

class ICalExportError extends PronoteAPIError {
  constructor(...args) {
    super(...args);
    this.name = "ICalExportError";
  }
}

class DateParsingError extends PronoteAPIError {
  constructor(message, date_string) {
    super(message);
    this.name = "DateParsingError";
    this.date_string = date_string;
  }
}

class ENTLoginError extends PronoteAPIError {
  constructor(...args) {
    super(...args);
    this.name = "ENTLoginError";
  }
}

class UnsupportedOperation extends PronoteAPIError {
  constructor(...args) {
    super(...args);
    this.name = "UnsupportedOperation";
  }
}

module.exports = {
  PronoteAPIError,
  CryptoError,
  ExpiredObject,
  ChildNotFound,
  DataError,
  ParsingError,
  ICalExportError,
  DateParsingError,
  ENTLoginError,
  UnsupportedOperation,
};
