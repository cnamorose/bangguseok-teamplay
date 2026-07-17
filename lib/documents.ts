import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import pptxgen from "pptxgenjs";
import { VisualizeOutput } from "@/lib/pipeline-types";

// 보고서/논문 → docx Buffer
export async function createDocx(data: VisualizeOutput): Promise<Buffer> {
  const isPaper = data.format === "paper";
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({
      text: data.title,
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
    })
  );

  for (const section of data.sections) {
    children.push(
      new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1 })
    );
    for (const para of section.content) {
      children.push(
        new Paragraph({
          children: [new TextRun(para)],
          spacing: { after: 200 },
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: isPaper
          ? { column: { count: 2, space: 708 } } // 논문: 2단
          : {},
        children,
      },
    ],
  });

  return Packer.toBuffer(doc);
}

// PPT → pptx Buffer
export async function createPptx(data: VisualizeOutput): Promise<Buffer> {
  const pptx = new pptxgen();

  const cover = pptx.addSlide();
  cover.addText(data.title, {
    x: 0.5, y: 2.5, w: 9, h: 1.5,
    fontSize: 32, bold: true, align: "center",
  });

  for (const section of data.sections) {
    const slide = pptx.addSlide();
    slide.addText(section.heading, {
      x: 0.5, y: 0.4, w: 9, h: 1, fontSize: 24, bold: true,
    });
    slide.addText(
      section.content.map((c) => ({ text: c, options: { bullet: true } })),
      { x: 0.7, y: 1.5, w: 8.6, h: 5, fontSize: 16 }
    );
  }

  return (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
}

// format 보고 알맞은 파일 생성 → { buffer, ext }
export async function createDocument(data: VisualizeOutput) {
  if (data.format === "slides") {
    return { buffer: await createPptx(data), ext: "pptx" };
  }
  return { buffer: await createDocx(data), ext: "docx" };
}