/**
 * Shared types for the slopocalypse pipeline.
 */

/** A single incident of buggy software shipping. */
export interface BugIncident {
  /** Short title / headline */
  title: string;
  /** The software product or service affected */
  software: string;
  /** Company / vendor that shipped the buggy software */
  vendor: string;
  /** Brief description of the bug(s) */
  description: string;
  /** Severity: "critical" | "major" | "minor" */
  severity: "critical" | "major" | "minor";
  /** ISO date string when the bug was reported / published */
  date_reported: string;
  /** Source URL of the article or report */
  source_url: string;
  /** Source name (e.g. "ZDNet", "The Verge") */
  source_name: string;
}

/** JSON Schema for structured output from Parallel APIs */
export const BUG_INCIDENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    title: {
      type: "string",
      description: "Headline or title of the bug report / article",
    },
    software: {
      type: "string",
      description:
        "The specific software product or service that shipped with bugs (e.g. 'Windows 11 24H2', 'iOS 18.2')",
    },
    vendor: {
      type: "string",
      description:
        "Company or vendor that shipped the buggy software (e.g. 'Microsoft', 'Apple')",
    },
    description: {
      type: "string",
      description:
        "Brief summary of the bug(s) and their impact on users, 2-3 sentences",
    },
    severity: {
      type: "string",
      enum: ["critical", "major", "minor"],
      description:
        "Severity level: 'critical' = data loss, security vulnerability, or system unusable; 'major' = significant functionality broken; 'minor' = cosmetic or minor inconvenience",
    },
    date_reported: {
      type: "string",
      description: "ISO 8601 date when the bug was reported (e.g. '2025-11-15')",
    },
    source_url: {
      type: "string",
      description: "URL of the article or report",
    },
    source_name: {
      type: "string",
      description:
        "Name of the publication or source (e.g. 'ZDNet', 'The Verge', 'Ars Technica')",
    },
  },
  required: [
    "title",
    "software",
    "vendor",
    "description",
    "severity",
    "date_reported",
    "source_url",
    "source_name",
  ],
  additionalProperties: false,
} as const;
