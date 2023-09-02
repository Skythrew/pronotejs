/**
 * An API wrapper for pronote.
 */

const title = "pronotepy";
const author = "bain, Xiloe";
const license = "MIT";
const copyright = "Copyright (c) 2020-2022 bain, Xiloe";
const version = "2.10.0";

const dataClasses = require('./dataClasses');
const clients = require('./clients');
const exceptions = require('./exceptions');

module.exports = {
    title,
    author,
    license,
    version,
    ...dataClasses,
    ...clients,
    ...exceptions,
};
