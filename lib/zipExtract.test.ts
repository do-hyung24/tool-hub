import { crc32 } from "node:zlib";
import { describe, expect, it } from "vitest";
import { extractScannableFiles, ZipValidationError } from "./zipExtract";

// yauzl이 읽을 수 있는 최소한의 zip을 순수 Buffer 연산으로 직접 만든다 (외부
// zip 라이브러리/CLI 의존 없이, 압축(method 0: stored)만 사용).
function buildZip(entries: Array<{ name: string; content: string }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const { name, content } of entries) {
    const nameBuf = Buffer.from(name, "utf-8");
    const dataBuf = Buffer.from(content, "utf-8");
    const crc = crc32(dataBuf);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version needed
    local.writeUInt16LE(0, 6); // flags
    local.writeUInt16LE(0, 8); // method: stored
    local.writeUInt16LE(0, 10); // mod time
    local.writeUInt16LE(0, 12); // mod date
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(dataBuf.length, 18); // compressed size
    local.writeUInt32LE(dataBuf.length, 22); // uncompressed size
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // extra length

    localParts.push(local, nameBuf, dataBuf);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed
    central.writeUInt16LE(0, 8); // flags
    central.writeUInt16LE(0, 10); // method
    central.writeUInt16LE(0, 12); // mod time
    central.writeUInt16LE(0, 14); // mod date
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(dataBuf.length, 20);
    central.writeUInt32LE(dataBuf.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt16LE(0, 30); // extra length
    central.writeUInt16LE(0, 32); // comment length
    central.writeUInt16LE(0, 34); // disk number start
    central.writeUInt16LE(0, 36); // internal attrs
    central.writeUInt32LE(0, 38); // external attrs
    central.writeUInt32LE(offset, 42); // offset of local header

    centralParts.push(central, nameBuf);

    offset += local.length + nameBuf.length + dataBuf.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const localSection = Buffer.concat(localParts);

  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(localSection.length, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([localSection, centralDirectory, end]);
}

describe("extractScannableFiles - error taxonomy", () => {
  it("throws ZipValidationError, not a raw Error, when actual content exceeds the remaining byte budget mid-read", async () => {
    const zip = buildZip([
      { name: "a.py", content: "x".repeat(100) },
      { name: "b.py", content: "y".repeat(30) },
    ]);

    await expect(
      extractScannableFiles(zip, { maxFileBytes: 100, maxTotalBytes: 120 })
    ).rejects.toThrow(ZipValidationError);
  });
});

describe("extractScannableFiles - memory budget accounting", () => {
  it("counts UTF-8 byte length toward the total budget, not UTF-16 code units", async () => {
    // '가'는 UTF-16 1코드유닛이지만 UTF-8로는 3바이트 - .length로 예산을 재면
    // 실제 바이트 수를 3배 과소 계산해서 예산을 조용히 넘길 수 있다.
    const koreanContent = "가".repeat(50); // 문자열 길이 50, 실제 150바이트
    const asciiContent = "z".repeat(100); // 100바이트

    const zip = buildZip([
      { name: "a.py", content: koreanContent },
      { name: "b.py", content: asciiContent },
    ]);

    // 올바르게 세면 첫 파일만으로 150/200바이트를 소모해 두 번째 파일(100바이트)이
    // 남은 예산(50바이트)을 넘어서 에러가 나야 한다. .length로 잘못 세면(50으로
    // 계산) 두 파일 다 조용히 통과해버린다.
    await expect(
      extractScannableFiles(zip, { maxFileBytes: 500, maxTotalBytes: 200 })
    ).rejects.toThrow(ZipValidationError);
  });
});

describe("extractScannableFiles - ignored paths", () => {
  it("ignores vendor directories regardless of case", async () => {
    const zip = buildZip([
      { name: "Node_Modules/pkg/index.js", content: "eval(x)" },
      { name: "src/bot.py", content: "print(1)" },
    ]);

    const files = await extractScannableFiles(zip);

    expect(files.some((f) => f.path.startsWith("Node_Modules"))).toBe(false);
    expect(files.some((f) => f.path === "src/bot.py")).toBe(true);
  });
});
