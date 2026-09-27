import { describe, expect, it } from "vitest";

import { getTopic, TOPICS } from "@/lib/topics";

describe("topic landing pages", () => {
  it("use unique slugs and complete editorial guidance", () => {
    expect(new Set(TOPICS.map((topic) => topic.slug)).size).toBe(TOPICS.length);
    for (const topic of TOPICS) {
      expect(topic.seoDescription.length).toBeGreaterThanOrEqual(90);
      expect(topic.introduction).toHaveLength(2);
      expect(topic.introduction.join(" ").split(/\s+/).length).toBeGreaterThanOrEqual(75);
      expect(topic.questions.length).toBeGreaterThanOrEqual(3);
      expect(topic.sourceGuidance.length).toBeGreaterThanOrEqual(80);
      expect(getTopic(topic.slug)).toBe(topic);
    }
  });
});
