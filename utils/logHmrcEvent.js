import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * ==================================================
 * HMRC AUDIT LOGGER
 * ==================================================
 * Centralized production-grade HMRC logging utility
 *
 * Used by:
 * - login.js
 * - callback.js
 * - refresh.js
 * - status.js
 * - validate.js
 * - submit.js
 * - disconnect.js
 *
 * Purpose:
 * - audit trail
 * - HMRC compliance
 * - debugging
 * - production support
 * - submission tracing
 * ==================================================
 */

export async function logHmrcEvent({
  user_id,

  endpoint = null,

  method = null,

  request_headers = null,

  request_body = null,

  response_status = null,

  response_body = null,

  correlation_id = null,

  error_message = null,
}) {
  try {
    // =========================
    // SANITIZE HEADERS
    // =========================
    const safeHeaders =
      sanitizeHeaders(request_headers);

    // =========================
    // SANITIZE RESPONSE
    // =========================
    const safeResponse =
      sanitizeTokens(response_body);

    // =========================
    // SANITIZE REQUEST
    // =========================
    const safeRequest =
      sanitizeTokens(request_body);

    // =========================
    // INSERT LOG
    // =========================
    const { error } = await supabase
      .from("hmrc_logs")
      .insert({
        user_id,

        endpoint,

        method,

        request_headers:
          safeHeaders,

        request_body:
          safeRequest,

        response_status,

        response_body:
          safeResponse,

        correlation_id,

        error_message,

        created_at:
          new Date().toISOString(),
      });

    if (error) {
      console.error(
        "❌ HMRC LOG INSERT ERROR:",
        error
      );
    }

  } catch (err) {
    console.error(
      "💥 HMRC LOGGER CRASH:",
      err
    );
  }
}

/**
 * ==================================================
 * SANITIZE AUTH HEADERS
 * ==================================================
 */

function sanitizeHeaders(headers) {
  if (!headers) return null;

  try {
    const cleanHeaders = {
      ...headers,
    };

    if (
      cleanHeaders.Authorization
    ) {
      cleanHeaders.Authorization =
        "[REDACTED]";
    }

    if (
      cleanHeaders.authorization
    ) {
      cleanHeaders.authorization =
        "[REDACTED]";
    }

    return cleanHeaders;

  } catch {
    return null;
  }
}

/**
 * ==================================================
 * REMOVE TOKENS FROM LOGS
 * ==================================================
 */

function sanitizeTokens(data) {
  if (!data) return data;

  try {
    const clone = JSON.parse(
      JSON.stringify(data)
    );

    recursiveSanitize(clone);

    return clone;

  } catch {
    return null;
  }
}

/**
 * ==================================================
 * RECURSIVE TOKEN SANITIZER
 * ==================================================
 */

function recursiveSanitize(obj) {
  if (
    !obj ||
    typeof obj !== "object"
  ) {
    return;
  }

  for (const key of Object.keys(obj)) {
    const lower =
      key.toLowerCase();

    // =========================
    // REDACT SENSITIVE FIELDS
    // =========================
    if (
      lower.includes("token") ||
      lower.includes("secret") ||
      lower.includes("authorization") ||
      lower.includes("password")
    ) {
      obj[key] =
        "[REDACTED]";
      continue;
    }

    // =========================
    // RECURSIVE WALK
    // =========================
    if (
      typeof obj[key] ===
      "object"
    ) {
      recursiveSanitize(
        obj[key]
      );
    }
  }
}
