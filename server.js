require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const OpenAI = require('openai');
const buildSystemPrompt = require('./systemPrompt');
const pricing = require('./pricingService');

const app = express();
const PORT = process.env.PORT || 3000;
const ORDER_FORM_URL = process.env.ORDER_FORM_URL || 'https://example.com/form-dat-hang-misu';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── Khởi tạo OpenAI client ───────────────────────────────────────────────────
let openai = null;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key-here') {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  console.log('✅ OpenAI client đã khởi tạo.');
} else {
  console.log('⚠️  Không có OPENAI_API_KEY – bot sẽ chạy chế độ FALLBACK.');
}

console.log(`📋 ORDER_FORM_URL: ${ORDER_FORM_URL}`);

// ─── Load bảng giá ────────────────────────────────────────────────────────────
pricing.loadPriceTable();

// ─── Strip opener phrases GPT-4o-mini hay dùng dù đã cấm trong prompt ───────
const OPENER_PATTERNS = [
  /^Em rất vui khi [^.!?]*[.!?]\s*/u,
  /^Cảm ơn anh\s*\/?\s*chị đã [^.!?]*[.!?]\s*/u,
  /^Tuyệt vời[!,][^\n]*\n*/u,
  /^Đây là lựa chọn tuyệt vời[^.!?]*[.!?]\s*/u,
  /^Ý tưởng tuyệt vời[^.!?]*[.!?]\s*/u,
  /^Đó là một ý tưởng thú vị[^.!?]*[.!?]\s*/u,
];

function stripOpeners(text) {
  let result = text;
  for (const pattern of OPENER_PATTERNS) {
    result = result.replace(pattern, '');
  }
  // GPT-4o-mini hay dùng "bạn" dù đã cấm — replace về "anh/chị"
  result = result.replace(/\b[Bb]ạn\b/gu, 'anh/chị');
  return result.trim();
}

// ─── Fallback responses ────────────────────────────────────────────────────────
// Chỉ các tín hiệu đặt hàng RÕ RÀNG — không dùng "muốn mua" vì quá rộng
const ORDER_KEYWORDS = ['đặt hàng', 'muốn đặt', 'chốt đơn', 'gửi form', 'điền form', 'link đặt', 'đặt như thế nào', 'đặt ở đâu', 'mua như nào', 'làm sao để mua', 'tôi chốt'];

function getFallbackResponse(message) {
  const msg = message.toLowerCase();

  if (ORDER_KEYWORDS.some(k => msg.includes(k))) {
    return `Dạ được ạ. Anh/chị có thể điền thông tin đặt hàng MISU tại form này:\n${ORDER_FORM_URL}\n\nTrong form, anh/chị giúp MISU điền số điện thoại, khu vực giao hàng, không gian muốn đặt kệ và kích thước dự kiến. Nếu chưa chắc chọn kích thước nào, anh/chị có thể cho em biết chiều dài khoảng trống – em sẽ tư vấn trước rồi mình điền form sau cũng được ạ.`;
  }
  if (msg.includes('màu') || msg.includes('walnut') || msg.includes('vàng')) {
    return 'MISU có 2 màu:\n- **Walnut**: nâu gỗ đậm, ấm áp, sang trọng – hợp với nội thất tối màu.\n- **Vân gỗ vàng**: sáng nhẹ, tươi – hợp phong cách Bắc Âu, hiện đại.\n\nNhà anh/chị đang theo tone màu nào ạ?';
  }
  if (msg.includes('kích thước') || msg.includes('size') || msg.includes('rộng') || msg.includes('sâu') || msg.includes('cao')) {
    return 'Kệ MISU có kích thước:\n- **Chiều cao**: 50 / 70 / 90 / 110 / 130 / 150 / 170 / 190 / 210 cm\n- **Chiều rộng**: 40 / 50 / 60 / 70 / 80 / 90 / 100 cm\n- **Chiều sâu**: 30 / 35 / 40 / 45 / 50 cm\n- Chân kệ cao ~10 cm, nhịp tầng điều chỉnh được.\n\nAnh/chị đang cần kệ khoảng bao nhiêu cm ạ?';
  }
  if (msg.includes('module') || msg.includes('nối') || msg.includes('ghép')) {
    return 'Module nối là phần kệ để ghép thêm vào kệ chính. Ví dụ muốn làm hệ kệ dài 1m6, mình dùng 1 kệ chính + module nối thay vì mua nhiều kệ đứng riêng – nhìn liền khối hơn và tiết kiệm hơn.\n\nAnh/chị muốn làm hệ kệ dài khoảng bao nhiêu cm ạ?';
  }
  if (msg.includes('độc lập')) {
    return 'Kệ độc lập là một bộ kệ đứng riêng hoàn chỉnh, có đủ 2 bên chân. Mua một bộ là đặt được ngay, không cần nối với kệ khác.\n\nAnh/chị định đặt một kệ riêng hay muốn làm hệ kệ dài theo tường ạ?';
  }
  if (msg.includes('bếp') || msg.includes('phòng khách') || msg.includes('phòng ngủ') || msg.includes('làm việc')) {
    return 'Dạ MISU phù hợp cho nhiều không gian ạ. Anh/chị cho em biết chiều dài khoảng trống chỗ muốn đặt kệ và mình định để đồ gì lên kệ, em tư vấn cấu hình phù hợp nhé.';
  }
  return 'Dạ em tư vấn mình ạ. Anh/chị định đặt kệ ở không gian nào – bếp, phòng khách, phòng ngủ, góc làm việc hay shop nhỏ? Và mình muốn một kệ đứng riêng hay hệ kệ dài theo tường ạ?';
}

// ─── GET /health ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MISU Sales Bot',
    mode: openai ? 'openai' : 'fallback',
    orderFormUrl: ORDER_FORM_URL,
    orderFormConfigured: ORDER_FORM_URL !== 'https://example.com/form-dat-hang-misu',
    priceTableLoaded: pricing.getTotalEntries() > 0,
    priceEntries: pricing.getTotalEntries(),
    timestamp: new Date().toISOString(),
  });
});

// ─── POST /chat ───────────────────────────────────────────────────────────────
app.post('/chat', async (req, res) => {
  const { message, history } = req.body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'Thiếu trường "message".' });
  }

  const trimmedMsg = message.trim();

  // ── 1. Pricing intercept (chạy trước cả OpenAI và fallback) ─────────────────
  const priceReply = pricing.tryPriceResponse(trimmedMsg, history);
  if (priceReply) {
    return res.json({ reply: priceReply, mode: openai ? 'openai' : 'fallback', source: 'price_table' });
  }

  // ── 2. Fallback mode ─────────────────────────────────────────────────────────
  if (!openai) {
    const reply = getFallbackResponse(trimmedMsg);
    return res.json({ reply, mode: 'fallback' });
  }

  // ── 3. OpenAI mode ───────────────────────────────────────────────────────────
  const messages = [{ role: 'system', content: buildSystemPrompt(ORDER_FORM_URL) }];

  if (Array.isArray(history)) {
    for (const turn of history) {
      if (turn.role && turn.content) {
        messages.push({ role: turn.role, content: turn.content });
      }
    }
  }

  messages.push({ role: 'user', content: trimmedMsg });

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages,
      max_tokens: 600,
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content || 'Dạ anh/chị có thể nói rõ hơn để em tư vấn tốt hơn không ạ?';
    const reply = stripOpeners(raw);
    res.json({ reply, mode: 'openai' });
  } catch (err) {
    console.error('OpenAI error:', err.message);

    if (err.status === 401) {
      return res.status(500).json({ error: 'OPENAI_API_KEY không hợp lệ. Kiểm tra lại file .env.' });
    }
    if (err.status === 429) {
      return res.status(429).json({ error: 'Đã vượt quá giới hạn API. Vui lòng thử lại sau.' });
    }

    res.status(500).json({ error: 'Lỗi kết nối AI. Vui lòng thử lại.' });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 MISU Bot đang chạy tại http://localhost:${PORT}`);
  console.log(`   GET  http://localhost:${PORT}/health`);
  console.log(`   POST http://localhost:${PORT}/chat`);
  console.log(`   UI   file:///${__dirname.replace(/\\/g, '/')}/test-chat.html\n`);
});
