import { deepFreeze } from "../workspace/_utils/deepFreeze.js";

export function createBuilderConversationMessage({
  messageId,
  role,
  text,
  at = new Date().toISOString(),
  relatedQuestionId = null,
  metadata = {},
} = {}) {
  if (!messageId) throw new Error("BuilderConversation: messageId required.");
  if (!["assistant", "user", "system"].includes(String(role))) {
    throw new Error(`BuilderConversation: unsupported role: ${role}`);
  }
  return deepFreeze({
    messageId: String(messageId),
    role: String(role),
    text: String(text ?? ""),
    at: String(at),
    relatedQuestionId: relatedQuestionId == null ? null : String(relatedQuestionId),
    metadata: deepFreeze(metadata && typeof metadata === "object" ? { ...metadata } : {}),
  });
}

export function appendConversation(conversation = [], message) {
  return deepFreeze([...(Array.isArray(conversation) ? conversation : []), message]);
}
