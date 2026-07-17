// 업로드한 문서(txt / docx / hwp / hwpx)에서 본문 텍스트를 뽑아낸다.
// 평가단 "파일 불러오기"에서 사용.

import JSZip from "jszip";
import * as CFB from "cfb";
import zlib from "zlib";

/** 지원 확장자 */
export const SUPPORTED_EXTS = [".txt", ".docx", ".hwp", ".hwpx"] as const;

export class ParseDocError extends Error {}

/** XML 엔티티 복원 */
function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

/* ── txt ── */
function parseTxt(buf: Buffer): string {
  // 일단 UTF-8로 읽고, 깨진 글자(U+FFFD)가 많으면 EUC-KR(CP949)로 재시도
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
  const broken = (utf8.match(/�/g) || []).length;
  if (broken === 0) return utf8;

  try {
    return new TextDecoder("euc-kr").decode(buf);
  } catch {
    return utf8; // euc-kr 디코더가 없으면 그냥 UTF-8 결과 사용
  }
}

/* ── docx (zip 안의 word/document.xml) ── */
async function parseDocx(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const doc = zip.file("word/document.xml");
  if (!doc) throw new ParseDocError("워드 문서 형식이 아니에요. (.docx만 지원)");

  const xml = await doc.async("string");

  // 문단(</w:p>) 단위로 줄바꿈을 만들고, 각 문단의 <w:t> 텍스트를 이어붙인다
  const paragraphs = xml.split(/<\/w:p>/);
  const lines = paragraphs.map((p) => {
    const runs = [...p.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)];
    return runs.map((m) => decodeEntities(m[1])).join("");
  });

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* ── hwpx (zip 안의 Contents/section*.xml) ── */
async function parseHwpx(buf: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buf);
  const sections = Object.keys(zip.files)
    .filter((name) => /^Contents\/section\d+\.xml$/i.test(name))
    .sort();

  if (sections.length === 0) throw new ParseDocError("한글(hwpx) 문서 형식이 아니에요.");

  const parts: string[] = [];
  for (const name of sections) {
    const xml = await zip.file(name)!.async("string");
    const paragraphs = xml.split(/<\/hp:p>/);
    const lines = paragraphs.map((p) => {
      const runs = [...p.matchAll(/<hp:t(?:\s[^>]*)?>([\s\S]*?)<\/hp:t>/g)];
      return runs.map((m) => decodeEntities(m[1].replace(/<[^>]+>/g, ""))).join("");
    });
    parts.push(lines.join("\n"));
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* ── hwp 5.x (CFB 컨테이너 + 압축된 BodyText 레코드) ── */

// 한 문단 레코드(HWPTAG_PARA_TEXT)의 UTF-16LE 본문에서 텍스트만 추출.
// 32 미만은 제어문자: 일부는 뒤따르는 7워드와 함께 8워드를 차지한다.
function readParaText(data: Buffer): string {
  let out = "";
  const len = Math.floor(data.length / 2);
  let i = 0;
  while (i < len) {
    const c = data.readUInt16LE(i * 2);
    if (c >= 32) {
      out += String.fromCharCode(c);
      i += 1;
    } else if (c === 13 || c === 10) {
      out += "\n";
      i += 1;
    } else if (c === 9) {
      out += "\t";
      i += 8; // 탭은 인라인 컨트롤(8워드)
    } else if ((c >= 1 && c <= 8) || (c >= 11 && c <= 12) || (c >= 14 && c <= 23)) {
      i += 8; // 인라인/확장 컨트롤(8워드)
    } else {
      i += 1; // 그 외 제어문자(1워드)
    }
  }
  return out;
}

const HWPTAG_PARA_TEXT = 67;

function parseHwp(buf: Buffer): string {
  let cfb: CFB.CFB$Container;
  try {
    cfb = CFB.read(buf, { type: "buffer" });
  } catch {
    throw new ParseDocError("한글(hwp) 문서를 열 수 없어요.");
  }

  const header = CFB.find(cfb, "FileHeader");
  if (!header || !header.content) {
    throw new ParseDocError("한글(hwp) 문서 형식이 아니에요.");
  }

  const headerBuf = Buffer.from(header.content as Uint8Array);
  const signature = headerBuf.subarray(0, 17).toString("latin1");
  if (!signature.startsWith("HWP Document File")) {
    throw new ParseDocError("한글(hwp) 문서 형식이 아니에요.");
  }

  const flags = headerBuf.readUInt32LE(36);
  const compressed = (flags & 0x1) !== 0;
  if ((flags & 0x2) !== 0) {
    throw new ParseDocError("암호가 걸린 한글 문서는 읽을 수 없어요.");
  }

  // BodyText/Section0, Section1, ... 순서대로
  const sectionPaths = cfb.FullPaths
    .map((p, idx) => ({ p, idx }))
    .filter(({ p }) => /BodyText\/Section\d+$/.test(p))
    .sort((a, b) => {
      const na = Number(a.p.match(/Section(\d+)$/)![1]);
      const nb = Number(b.p.match(/Section(\d+)$/)![1]);
      return na - nb;
    });

  if (sectionPaths.length === 0) throw new ParseDocError("본문을 찾을 수 없어요.");

  const parts: string[] = [];

  for (const { idx } of sectionPaths) {
    const entry = cfb.FileIndex[idx];
    if (!entry?.content) continue;

    let section = Buffer.from(entry.content as Uint8Array);
    if (compressed) {
      try {
        section = zlib.inflateRawSync(section);
      } catch {
        continue; // 이 섹션은 건너뜀
      }
    }

    // 레코드 순회: 헤더 4바이트 = tag(10) | level(10) | size(12)
    let pos = 0;
    while (pos + 4 <= section.length) {
      const hdr = section.readUInt32LE(pos);
      pos += 4;
      const tag = hdr & 0x3ff;
      let size = (hdr >>> 20) & 0xfff;
      if (size === 0xfff) {
        if (pos + 4 > section.length) break;
        size = section.readUInt32LE(pos);
        pos += 4;
      }
      if (pos + size > section.length) break;

      if (tag === HWPTAG_PARA_TEXT) {
        parts.push(readParaText(section.subarray(pos, pos + size)));
      }
      pos += size;
    }
  }

  return parts.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/* ── 공개 API ── */

/** 파일명 + 버퍼 → 본문 텍스트. 지원하지 않는 형식이면 ParseDocError. */
export async function extractText(filename: string, buf: Buffer): Promise<string> {
  const ext = (filename.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase();

  switch (ext) {
    case ".txt":
      return parseTxt(buf).trim();
    case ".docx":
      return parseDocx(buf);
    case ".hwpx":
      return parseHwpx(buf);
    case ".hwp":
      return parseHwp(buf);
    case ".doc":
      throw new ParseDocError("옛 워드(.doc)는 지원하지 않아요. .docx로 저장해서 올려주세요.");
    default:
      throw new ParseDocError("txt, 워드(.docx), 한글(.hwp/.hwpx) 파일만 올릴 수 있어요.");
  }
}

/** 본문에서 주제를 추측: 첫 줄이 짧으면 제목으로, 아니면 파일명으로 */
export function deriveTopic(filename: string, text: string): string {
  const firstLine = text
    .split("\n")
    .map((s) => s.trim())
    .find(Boolean);

  if (firstLine && firstLine.length <= 60) return firstLine;
  return filename.replace(/\.[^.]+$/, "");
}
