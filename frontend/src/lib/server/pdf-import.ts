import { PDFParse } from "pdf-parse";

export type ExtractedReference = {
  raw: string;
  title?: string;
  source_file?: string;
};

const MAX_REFERENCES = 1000;

function normalizeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function findReferencesText(text: string) {
  const lower = text.toLowerCase();
  const markers = ["references", "bibliography", "参考文献", "参考资料"];
  const starts = markers
    .map(marker => lower.lastIndexOf(marker.toLowerCase()))
    .filter(index => index >= 0);
  if (!starts.length) return text;
  return text.slice(Math.max(...starts));
}

function splitReferences(text: string) {
  const lines = normalizeText(text)
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  const refs: string[] = [];
  let current = "";
  const refStart = /^(\[\d+\]|\d+[\).]|[A-Z][a-z]+,\s+[A-Z]\.)\s+/;

  for (const line of lines) {
    if (refStart.test(line) && current) {
      refs.push(current.trim());
      current = line;
    } else {
      current = current ? `${current} ${line}` : line;
    }
  }
  if (current) refs.push(current.trim());

  if (refs.length > 1) return refs.slice(0, MAX_REFERENCES);

  return normalizeText(text)
    .split(/\n\s*\n|(?=\[\d+\]\s+)|(?=\d+[\).]\s+)/)
    .map(item => item.trim())
    .filter(item => item.length > 20)
    .slice(0, MAX_REFERENCES);
}

function cleanCandidateTitle(text: string) {
  return text
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/\s*--\s*\d+\s+of\s+\d+\s*--\s*$/i, "")
    .replace(/\s+/g, " ")
    .replace(/\bdoi\s*:\s*\S+/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s+[.。,:，；;]+$/g, "")
    .trim();
}

function looksLikeTitle(text: string) {
  const value = cleanCandidateTitle(text);
  if (value.length < 8 || value.length > 260) return false;
  if (/^(references|bibliography|doi|http|retrieved|available|proceedings)$/i.test(value)) return false;
  if (/^\d+$/.test(value)) return false;
  return /[A-Za-z\u4e00-\u9fff]/.test(value);
}

function extractTitle(rawReference: string) {
  const raw = rawReference
    .replace(/^(\[\d+\]|\d+[\).])\s*/, "")
    .replace(/\s+/g, " ")
    .trim();

  const quoted = raw.match(/[“"]([^”"]{8,260})[”"]/);
  if (quoted?.[1] && looksLikeTitle(quoted[1])) return cleanCandidateTitle(quoted[1]);

  const afterYear = raw.match(/(?:19|20)\d{2}[).,]?\s+([^。.!?]{8,260})(?:[。.!?]|$)/);
  if (afterYear?.[1] && looksLikeTitle(afterYear[1])) return cleanCandidateTitle(afterYear[1]);

  const parts = raw
    .split(/(?<=[.!?。])\s+/)
    .map(cleanCandidateTitle)
    .filter(looksLikeTitle);

  if (parts.length >= 2) return parts[1];
  return parts[0];
}

export async function extractReferencesFromPdf(file: File): Promise<ExtractedReference[]> {
  if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
    throw new Error("Only PDF files are supported.");
  }

  const data = new Uint8Array(await file.arrayBuffer());
  const parser = new PDFParse({ data });
  try {
    const result = await parser.getText();
    const referencesText = findReferencesText(result.text || "");
    return splitReferences(referencesText)
      .map(raw => ({ raw, title: extractTitle(raw), source_file: file.name }))
      .filter(ref => ref.title);
  } finally {
    await parser.destroy();
  }
}

export async function extractReferencesFromPdfs(files: File[]): Promise<ExtractedReference[]> {
  const groups = await Promise.all(files.map(file => extractReferencesFromPdf(file)));
  return groups.flat();
}

export function referencesToBatchItems(references: ExtractedReference[]) {
  return references.map((reference, index) => ({
    index: index + 1,
    found: false,
    query_title: reference.title || reference.raw,
    duration_ms: 0,
    source_file: reference.source_file,
    error_message: "PDF imported; database verification is not configured in the Vite API.",
  }));
}
