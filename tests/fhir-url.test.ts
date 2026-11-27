import { describe, expect, it } from "vitest";
import { isWithinBase, parseBaseUrl } from "@/lib/fhir/url";

const base = (raw: string) => {
  const r = parseBaseUrl(raw);
  if (!r.ok) throw new Error(r.message);
  return r.baseUrl;
};

describe("parseBaseUrl", () => {
  it("normaliza la barra final", () => {
    expect(base("https://hapi.fhir.org/baseR4/").href).toBe(
      "https://hapi.fhir.org/baseR4",
    );
  });
  it.each([
    [undefined],
    [""],
    ["no-es-url"],
    ["ftp://x/fhir"],
    ["https://user:pw@x/fhir"],
    ["https://x/fhir?a=1"],
  ])("rechaza %s", (raw) => {
    expect(parseBaseUrl(raw).ok).toBe(false);
  });
});

describe("isWithinBase", () => {
  const b = base("https://hapi.fhir.org/baseR4");
  it.each([
    ["https://hapi.fhir.org/baseR4?_getpages=x&_getpagesoffset=20", true],
    ["https://hapi.fhir.org/baseR4/Patient?_count=20", true],
    ["http://hapi.fhir.org/baseR4?_getpages=x", false], // otro protocolo = otro origen
    ["https://hapi.fhir.org:8443/baseR4?_getpages=x", false],
    ["https://evil.example/baseR4?_getpages=x", false],
    ["https://hapi.fhir.org.evil.example/baseR4", false],
    ["https://hapi.fhir.org/baseR4evil/Patient", false], // prefijo engañoso
    ["https://hapi.fhir.org/otro", false],
    ["https://u:p@hapi.fhir.org/baseR4", false],
    ["/baseR4?_getpages=x", false], // relativa: no es absoluta
  ])("%s → %s", (url, expected) => {
    expect(isWithinBase(url, b)).toBe(expected);
  });
});
