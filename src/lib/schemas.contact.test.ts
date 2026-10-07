import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTACT_LIMITS,
  CONTACT_TOPICS,
  contactFormSchema,
  contactTopicLabel,
} from "./schemas";

const valid = {
  topic: "role",
  name: "Ada Lovelace",
  email: "ada@example.com",
  subject: "A role",
  message: "Hello, I would like to talk about a role.",
};

describe("contactFormSchema", () => {
  it("accepts a normal message", () => {
    expect(contactFormSchema.safeParse(valid).success).toBe(true);
  });

  it.each([
    ["name", "A"],
    ["email", "not-an-email"],
    ["subject", "Hi"],
    ["message", "too short"],
    ["message", "x".repeat(CONTACT_LIMITS.MESSAGE + 1)],
  ])("rejects a bad %s", (field, value) => {
    expect(
      contactFormSchema.safeParse({ ...valid, [field]: value }).success,
    ).toBe(false);
  });
});

/*
  The browser check is a courtesy; the database CHECK is the rule. If the two
  drift, the form either refuses messages the database would take or lets
  through messages that then fail with a raw constraint error.
*/
describe("contact topic", () => {
  it("is required, so every message can be triaged", () => {
    const { topic: _topic, ...withoutTopic } = valid;
    const result = contactFormSchema.safeParse(withoutTopic);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Choose what this is about");
  });

  it("only accepts the known topics", () => {
    expect(
      contactFormSchema.safeParse({ ...valid, topic: "spam" }).success,
    ).toBe(false);
  });

  it("labels known topics and nothing else", () => {
    expect(contactTopicLabel("project")).toBe("A project");
    expect(contactTopicLabel(null)).toBeNull();
    expect(contactTopicLabel("nope")).toBeNull();
  });
});

describe("contact limits match db/schema.sql", () => {
  const sql = readFileSync(
    path.resolve(__dirname, "../../db/schema.sql"),
    "utf8",
  );
  const check =
    /contact_submissions_length_check CHECK \(([\s\S]*?)\)\r?\n\s*\)/.exec(
      sql,
    )?.[1];

  it("finds the constraint", () => {
    expect(check).toBeTruthy();
  });

  it("the topics are exactly the ones the database accepts", () => {
    const check =
      /contact_submissions_topic_check\s+CHECK \(topic IS NULL OR topic IN \(([^)]*)\)\)/.exec(
        sql,
      )?.[1];
    const dbTopics = (check ?? "")
      .split(",")
      .map((value) => value.trim().replace(/'/g, ""));
    expect(dbTopics).toEqual(CONTACT_TOPICS.map((option) => option.value));
  });

  it.each([
    ["name", 2, CONTACT_LIMITS.NAME],
    ["email", 3, CONTACT_LIMITS.EMAIL],
    ["subject", 3, CONTACT_LIMITS.SUBJECT],
    ["message", 10, CONTACT_LIMITS.MESSAGE],
  ])("%s is %i..%i in both places", (column, min, max) => {
    const range = new RegExp(
      `char_length\\(${column}\\)\\s+BETWEEN (\\d+) AND (\\d+)`,
    ).exec(check ?? "");
    expect(range?.slice(1).map(Number)).toEqual([min, max]);
  });
});
