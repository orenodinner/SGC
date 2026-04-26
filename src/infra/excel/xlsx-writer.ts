import type {
  ExcelCellStyle,
  ExcelSheetContract,
  ExcelStyledCell,
  ExcelWorkbookContract,
} from "../../domain/excel-contract";

export function exportWorkbookXlsx(workbook: ExcelWorkbookContract): Uint8Array {
  const worksheetEntries = workbook.sheets.map((sheet, index) => {
    const typedSheet = sheet as ExcelSheetContract<object>;
    return {
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: encodeXml(buildWorksheetXml(typedSheet)),
    };
  });

  const entries = [
    { name: "[Content_Types].xml", data: encodeXml(buildContentTypesXml(workbook.sheets.length)) },
    { name: "_rels/.rels", data: encodeXml(buildRootRelationshipsXml()) },
    { name: "docProps/app.xml", data: encodeXml(buildAppXml(workbook.sheets.map((sheet) => sheet.name))) },
    { name: "docProps/core.xml", data: encodeXml(buildCoreXml()) },
    { name: "xl/workbook.xml", data: encodeXml(buildWorkbookXml(workbook)) },
    { name: "xl/_rels/workbook.xml.rels", data: encodeXml(buildWorkbookRelationshipsXml(workbook.sheets.length)) },
    { name: "xl/styles.xml", data: encodeXml(buildStylesXml()) },
    ...worksheetEntries,
  ];

  return buildZip(entries);
}

function buildContentTypesXml(sheetCount: number): string {
  const worksheetOverrides = Array.from({ length: sheetCount }, (_, index) => {
    const sheetNumber = index + 1;
    return `<Override PartName="/xl/worksheets/sheet${sheetNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
  ${worksheetOverrides}
</Types>`;
}

function buildRootRelationshipsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function buildAppXml(sheetNames: readonly string[]): string {
  const titles = sheetNames.map((name) => `<vt:lpstr>${escapeXml(name)}</vt:lpstr>`).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>SGC</Application>
  <HeadingPairs>
    <vt:vector size="2" baseType="variant">
      <vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant>
      <vt:variant><vt:i4>${sheetNames.length}</vt:i4></vt:variant>
    </vt:vector>
  </HeadingPairs>
  <TitlesOfParts>
    <vt:vector size="${sheetNames.length}" baseType="lpstr">${titles}</vt:vector>
  </TitlesOfParts>
</Properties>`;
}

function buildCoreXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:creator>SGC</dc:creator>
  <cp:lastModifiedBy>SGC</cp:lastModifiedBy>
</cp:coreProperties>`;
}

function buildWorkbookXml(workbook: ExcelWorkbookContract): string {
  const sheetsXml = workbook.sheets
    .map(
      (sheet, index) =>
        `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetsXml}</sheets>
</workbook>`;
}

function buildWorkbookRelationshipsXml(sheetCount: number): string {
  const worksheetRelationships = Array.from({ length: sheetCount }, (_, index) => {
    const sheetNumber = index + 1;
    return `<Relationship Id="rId${sheetNumber}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${sheetNumber}.xml"/>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${worksheetRelationships}
  <Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><name val="Calibri"/></font>
  </fonts>
  <fills count="7">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF4F81BD"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF9BBB59"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF79646"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFBFBFBF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD9EAF7"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="7">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0" applyFill="1"/>
    <xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>
    <xf numFmtId="0" fontId="1" fillId="4" borderId="0" xfId="0" applyFill="1" applyFont="1"/>
    <xf numFmtId="0" fontId="0" fillId="5" borderId="0" xfId="0" applyFill="1"/>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="0" xfId="0" applyFill="1"/>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`;
}

function buildWorksheetXml<Row extends object>(sheet: ExcelSheetContract<Row>): string {
  const rowsXml = [
    buildWorksheetRow(sheet.columns, toHeaderRow(sheet.columns), 1, true),
    ...sheet.rows.map((row, index) => buildWorksheetRow(sheet.columns, row, index + 2, false)),
  ].join("");
  const lastColumn = columnNumberToName(Math.max(sheet.columns.length, 1));
  const lastRow = Math.max(sheet.rows.length + 1, 1);
  const columnsXml = buildColumnsXml(sheet);

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastColumn}${lastRow}"/>
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  ${columnsXml}
  <sheetData>${rowsXml}</sheetData>
</worksheet>`;
}

function buildColumnsXml<Row extends object>(sheet: ExcelSheetContract<Row>): string {
  if (!sheet.columnWidths) {
    return "";
  }

  const columnsXml = sheet.columns
    .map((column, index) => {
      const width = sheet.columnWidths?.[column];
      if (!width) {
        return "";
      }
      const columnNumber = index + 1;
      return `<col min="${columnNumber}" max="${columnNumber}" width="${width}" customWidth="1"/>`;
    })
    .filter(Boolean)
    .join("");

  return columnsXml ? `<cols>${columnsXml}</cols>` : "";
}

function buildWorksheetRow(
  columns: readonly string[],
  row: object,
  rowIndex: number,
  isHeader: boolean
): string {
  const rowValues = row as Record<string, unknown>;
  const cellsXml = columns
    .map((column, columnIndex) =>
      buildWorksheetCell(column, rowValues[column], rowIndex, columnIndex + 1, isHeader)
    )
    .filter(Boolean)
    .join("");

  return `<row r="${rowIndex}">${cellsXml}</row>`;
}

function buildWorksheetCell(
  columnName: string,
  value: unknown,
  rowIndex: number,
  columnIndex: number,
  isHeader: boolean
): string {
  const cellRef = `${columnNumberToName(columnIndex)}${rowIndex}`;
  const cell = normalizeCellValue(value);
  const styleIndex = isHeader ? 1 : getCellStyleIndex(cell.style);
  const styleAttr = styleIndex > 0 ? ` s="${styleIndex}"` : "";

  if (cell.value === null || cell.value === undefined || cell.value === "") {
    if (isHeader) {
      return `<c r="${cellRef}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${escapeXml(columnName)}</t></is></c>`;
    }
    if (styleIndex > 0) {
      return `<c r="${cellRef}"${styleAttr}/>`;
    }
    return "";
  }

  if (typeof cell.value === "number") {
    return `<c r="${cellRef}"${styleAttr}><v>${cell.value}</v></c>`;
  }

  return `<c r="${cellRef}" t="inlineStr"${styleAttr}><is><t xml:space="preserve">${escapeXml(String(cell.value))}</t></is></c>`;
}

function normalizeCellValue(value: unknown): { value: unknown; style?: ExcelCellStyle } {
  if (isStyledCell(value)) {
    return {
      value: value.value,
      style: value.style,
    };
  }

  return { value };
}

function isStyledCell(value: unknown): value is ExcelStyledCell {
  return (
    typeof value === "object" &&
    value !== null &&
    "value" in value &&
    !Array.isArray(value)
  );
}

function getCellStyleIndex(style: ExcelCellStyle | undefined): number {
  switch (style) {
    case "header":
      return 1;
    case "projectBar":
      return 2;
    case "taskBar":
      return 3;
    case "milestone":
      return 4;
    case "doneBar":
      return 5;
    case "context":
      return 6;
    case "normal":
    default:
      return 0;
  }
}

function toHeaderRow(columns: readonly string[]): Record<string, string> {
  return Object.fromEntries(columns.map((column) => [column, column]));
}

function columnNumberToName(columnNumber: number): string {
  let value = columnNumber;
  let result = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }

  return result;
}

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function encodeXml(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function buildZip(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = new TextEncoder().encode(entry.name);
    const crc = crc32(entry.data);
    const localHeader = createLocalFileHeader(nameBytes, entry.data.length, crc);
    localParts.push(localHeader, nameBytes, entry.data);

    const centralHeader = createCentralDirectoryHeader(nameBytes, entry.data.length, crc, offset);
    centralParts.push(centralHeader, nameBytes);

    offset += localHeader.length + nameBytes.length + entry.data.length;
  }

  const centralDirectory = concatUint8Arrays(centralParts);
  const endOfCentralDirectory = createEndOfCentralDirectory(entries.length, centralDirectory.length, offset);

  return concatUint8Arrays([...localParts, centralDirectory, endOfCentralDirectory]);
}

function createLocalFileHeader(nameBytes: Uint8Array, dataLength: number, crc: number): Uint8Array {
  const header = new Uint8Array(30);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, crc >>> 0, true);
  view.setUint32(18, dataLength, true);
  view.setUint32(22, dataLength, true);
  view.setUint16(26, nameBytes.length, true);
  view.setUint16(28, 0, true);
  return header;
}

function createCentralDirectoryHeader(
  nameBytes: Uint8Array,
  dataLength: number,
  crc: number,
  localHeaderOffset: number
): Uint8Array {
  const header = new Uint8Array(46);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, crc >>> 0, true);
  view.setUint32(20, dataLength, true);
  view.setUint32(24, dataLength, true);
  view.setUint16(28, nameBytes.length, true);
  view.setUint16(30, 0, true);
  view.setUint16(32, 0, true);
  view.setUint16(34, 0, true);
  view.setUint16(36, 0, true);
  view.setUint32(38, 0, true);
  view.setUint32(42, localHeaderOffset, true);
  return header;
}

function createEndOfCentralDirectory(
  entryCount: number,
  centralDirectorySize: number,
  centralDirectoryOffset: number
): Uint8Array {
  const footer = new Uint8Array(22);
  const view = new DataView(footer.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entryCount, true);
  view.setUint16(10, entryCount, true);
  view.setUint32(12, centralDirectorySize, true);
  view.setUint32(16, centralDirectoryOffset, true);
  view.setUint16(20, 0, true);
  return footer;
}

function concatUint8Arrays(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

const CRC32_TABLE = buildCrc32Table();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildCrc32Table(): Uint32Array {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }

  return table;
}
