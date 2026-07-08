/**
 * @typedef {object} KnowledgeStoragePutInput
 * @property {string} businessId
 * @property {string} storageKey
 * @property {Buffer} buffer
 * @property {string} mimeType
 */

/**
 * @typedef {object} KnowledgeStorageObjectRef
 * @property {string} businessId
 * @property {string} storageKey
 */

/**
 * @typedef {object} KnowledgeStorageProvider
 * @property {(input: KnowledgeStoragePutInput) => Promise<void>} putObject
 * @property {(ref: KnowledgeStorageObjectRef) => Promise<void>} deleteObject
 * @property {(ref: KnowledgeStorageObjectRef) => Promise<boolean>} objectExists
 */

export {};
