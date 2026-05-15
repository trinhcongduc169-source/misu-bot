'use strict';

const XLSX = require('xlsx');
const path = require('path');

const PRICE_FILE = path.join(__dirname, 'data', 'bang_gia_de_xuat_misu.xlsx');
const DEPTHS = [30, 35, 40, 45, 50];
// 3 block column offsets per row-group in the spreadsheet
const BLOCK_OFFSETS = [0, 8, 16];

const PRICE_QUERY_KEYWORDS = ['giá', 'bao nhiêu', 'tiền', 'báo giá', 'mấy tiền', 'giá tiền', 'price'];

let priceTable = null;
let totalEntries = 0;

// ─── Load ─────────────────────────────────────────────────────────────────────

function loadPriceTable() {
  try {
    const wb = XLSX.readFile(PRICE_FILE);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

    priceTable = {};
    totalEntries = 0;

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];

      for (const bOffset of BLOCK_OFFSETS) {
        const cellVal = String(row[bOffset] || '').trim();
        const heightMatch = cellVal.match(/CAO\s+(\d+)\s+CM/i);
        if (!heightMatch) continue;

        const height = parseInt(heightMatch[1]);

        // Data rows start 2 rows below the height label row
        for (let dr = r + 2; dr < rows.length; dr++) {
          const dataRow = rows[dr];
          const widthCell = dataRow[bOffset + 1];

          if (widthCell === '' || widthCell === undefined || widthCell === null) break;
          const width = parseInt(widthCell);
          if (isNaN(width)) break;

          for (let di = 0; di < DEPTHS.length; di++) {
            const depth = DEPTHS[di];
            const priceCell = dataRow[bOffset + 2 + di];
            const priceNum = parseFloat(priceCell);
            if (priceCell !== '' && priceCell !== undefined && !isNaN(priceNum) && priceNum > 0) {
              priceTable[`${height}-${width}-${depth}`] = priceNum;
              totalEntries++;
            }
          }
        }
      }
    }

    console.log(`✅ Bảng giá đã load thành công – ${totalEntries} cấu hình giá`);
    return true;
  } catch (err) {
    console.error('❌ Lỗi load bảng giá:', err.message);
    priceTable = {};
    return false;
  }
}

// ─── Format ───────────────────────────────────────────────────────────────────

function formatPrice(rawPrice) {
  // Round up to nearest 10,000
  return Math.ceil(rawPrice / 10000) * 10000;
}

function formatPriceDisplay(price) {
  // Vietnamese thousands separator: 980000 → "980.000"
  return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ─── Lookup ───────────────────────────────────────────────────────────────────

function findPrice({ width, height, depth }) {
  if (!priceTable) loadPriceTable();
  const raw = priceTable[`${height}-${width}-${depth}`];
  if (raw === undefined) return null;
  return formatPrice(raw);
}

// ─── Parse dimensions ─────────────────────────────────────────────────────────

function parseDimensions(message) {
  if (!message || typeof message !== 'string') return { width: null, height: null, depth: null };

  // Normalize: remove "cm", lowercase, collapse spaces
  const msg = message
    .replace(/cm/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Pattern: 50x130x40 or 50 x 130 x 40  (rộng × cao × sâu)
  const xyzMatch = msg.match(/(\d+)\s*[xX×]\s*(\d+)\s*[xX×]\s*(\d+)/);
  if (xyzMatch) {
    return {
      width:  parseInt(xyzMatch[1]),
      height: parseInt(xyzMatch[2]),
      depth:  parseInt(xyzMatch[3]),
    };
  }

  // Named patterns – order-independent
  const widthMatch  = msg.match(/(?:rộng|ngang)\s+(\d+)/);
  const heightMatch = msg.match(/(?:(?:chiều\s+)?cao)\s+(\d+)/);
  const depthMatch  = msg.match(/(?:(?:chiều\s+)?sâu)\s+(\d+)/);

  return {
    width:  widthMatch  ? parseInt(widthMatch[1])  : null,
    height: heightMatch ? parseInt(heightMatch[1]) : null,
    depth:  depthMatch  ? parseInt(depthMatch[1])  : null,
  };
}

// ─── Extract dims from current message + conversation history ─────────────────
// Accumulates across all user messages (later messages override earlier ones per dimension)

function extractDimensionsFromContext(message, history) {
  let width = null, height = null, depth = null;

  const userMessages = Array.isArray(history)
    ? history.filter(m => m.role === 'user').map(m => m.content)
    : [];

  for (const text of [...userMessages, message]) {
    const d = parseDimensions(text);
    if (d.width  !== null) width  = d.width;
    if (d.height !== null) height = d.height;
    if (d.depth  !== null) depth  = d.depth;
  }

  return { width, height, depth };
}

// ─── Detect price query ───────────────────────────────────────────────────────

function detectPriceQuery(message) {
  const msg = message.toLowerCase();
  return PRICE_QUERY_KEYWORDS.some(k => msg.includes(k));
}

// ─── Build replies ────────────────────────────────────────────────────────────

function getSpaceHint(height) {
  if (height <= 90)  return 'góc bếp nhỏ, bàn trang điểm hoặc góc làm việc';
  if (height <= 150) return 'phòng ngủ, góc làm việc hoặc phòng khách';
  return 'phòng khách, tủ sách hoặc hệ kệ tường';
}

function getPriceReply(dims, price) {
  const { width, height, depth } = dims;
  const dimStr = `rộng ${width}cm × cao ${height}cm × sâu ${depth}cm`;

  if (price !== null) {
    const display = formatPriceDisplay(price);
    const hint = getSpaceHint(height);
    return (
      `Dạ với kích thước ${dimStr}, giá bán đề xuất hiện tại là khoảng **${display}đ/bộ**. ` +
      `Kích thước này phù hợp cho ${hint}. ` +
      `Anh/chị muốn chọn màu Walnut hay Vân gỗ vàng ạ?`
    );
  }

  return (
    `Dạ em đã hiểu kích thước ${dimStr}, nhưng cấu hình này hiện chưa có trong bảng giá MISU. ` +
    `Anh/chị có thể chọn kích thước gần nhất hoặc để lại thông tin trong form để MISU báo giá chính xác ạ.`
  );
}

function getMissingDimsReply(dims) {
  const { width, height, depth } = dims;
  const missing = [];
  if (!width)  missing.push('chiều rộng');
  if (!height) missing.push('chiều cao');
  if (!depth)  missing.push('chiều sâu');

  if (missing.length === 3) {
    return (
      'Dạ để tra giá chính xác từ bảng giá MISU, anh/chị cho em biết kích thước cần tư vấn: ' +
      'chiều rộng, chiều cao và chiều sâu của kệ ạ? (Ví dụ: rộng 60cm, cao 130cm, sâu 35cm)'
    );
  }
  return `Dạ để tra giá chính xác, anh/chị cho em biết thêm ${missing.join(' và ')} của kệ ạ?`;
}

// ─── Main entry – called from server.js before OpenAI ────────────────────────
// Returns a reply string if handled here, or null to fall through to OpenAI/fallback

function tryPriceResponse(message, history) {
  if (!detectPriceQuery(message)) return null;

  const dims = extractDimensionsFromContext(message, history);
  const { width, height, depth } = dims;

  if (width && height && depth) {
    const price = findPrice({ width, height, depth });
    return getPriceReply(dims, price);
  }

  return getMissingDimsReply(dims);
}

module.exports = {
  loadPriceTable,
  parseDimensions,
  findPrice,
  formatPrice,
  detectPriceQuery,
  extractDimensionsFromContext,
  getPriceReply,
  getMissingDimsReply,
  tryPriceResponse,
  getTotalEntries: () => totalEntries,
};
