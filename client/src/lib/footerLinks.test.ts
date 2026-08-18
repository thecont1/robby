import { describe, expect, it } from "vitest";
import { footerSocialLinks } from "./footerLinks";

describe("footer social links", () => {
  it("keeps the requested social destinations distinct and secure", () => {
    expect(footerSocialLinks).toHaveLength(3);
    expect(new Set(footerSocialLinks.map(link => link.href)).size).toBe(3);
    expect(footerSocialLinks.map(link => link.href)).toEqual([
      "https://x.com/thecontrarian/",
      "https://www.linkedin.com/in/mahesh-shantaram/",
      "https://github.com/thecont1",
    ]);
  });
});
