import type { TScreenContract } from './types.ts';

const VIETNAMESE_SIGNAL =
  /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

const INLINE_CODE = /`([^`]*)`/g;
const LOGICAL_ROUTE =
  /(^|[\s(])\/(?:account|app|admin|affiliate|video|live|mcn|help|c)(?:\/[a-z0-9._~!$&'()*+,;=:@%[\]-]+)*(?=$|[\s).,;])/gi;
const ABSOLUTE_URL = /https?:\/\/\S+/g;

const APPROVED_TECHNICAL =
  /\b(?:Affiliate|API|BFF|FTC|RBAC|MCN|PPS|PPP|LIVE|Video|USD|OAuth|YouTube|KYC|OBS|PDP|SLA|ID|QR|DNS|URL|CSV|JSON|UTC|HTTP|MFA|PII|W-9|W-8|Stripe|Medusa|Creator|token)\b/g;

const UNFINISHED_COPY =
  /\b(?:TODO|TBD|FIXME|lorem ipsum|placeholder|translate later|dịch sau)\b/i;

const TECHNICAL_VALUE = /`([^`]*)`/g;
const ASCII_VIETNAMESE_IDENTIFIER =
  /(?:nhu_cau|hanh_dong|trang_thai|du_lieu|nguoi_dung|thanh_toan|chi_tra|dang_cho|da_duyet|that_bai|tam_giu)/i;
const FORBIDDEN_TRANSLATIONS =
  /(?:Đột biến|tính lặp an toàn|Bộ Bộ chọn|Công tắc tiêu diệt|mũ lưỡi trai|nhà soạn nhạc|Máy nghe nhạc|bẫy tập trung|sự suy giảm|sự kiệnexport|current-phiên bản|nhà nước|tiểu bang|tạp chí|Nút hủy|kết nối vật liệu|xóa nhãn|dai dẳng|Tùy chọn tùy chọn|Thời gian hiệu quả|Không có sự kiên trì|kinh điển hóa|sự cho phép|Máy chủ tập giá trị|Trạng thái tập giá trị|Kiểm toán Thao tác ghi dữ liệu|\bThao tác ghi dữ liệu\b|Tiểu ID|Quay về điểm vào trước|\bbẩn\b|\bhiện vật\b|cuộn lên|phương sai|người trợ giúp|được biên tập lại|đã được chỉnh sửa|lộ trình nội bộ|người tạo được chỉ định và mở|Mã mời dài 1–64 ký tự|Bộ lọc tương tự|Tình trạng công dân Hoa Kỳ|Trường do nhà cung cấp lưu trữ|Biện pháp khắc phục an toàn, thời hạn|Trạng thái tình trạng|Chứng thực chính xác|đường dẫn địa phương|Trạng thái URL|URL-trạng thái|Lưới thẻ đáp ứng|route nội bộ|tài sản\/thuộc tính|thuộc tính kênh|Luôn theo sau hành động|điều khiển kép|sau nỗ lực)/i;

// These are explanatory English words, not approved product/API tokens. The
// audit checks them even when a Vietnamese fragment is present in the value.
const ENGLISH_EXPLANATORY =
  /\b(?:the|and|or|for|with|without|when|where|only|always|never|no|must|should|current|visible|editable|required|optional|conditional|computed|read-only|primary|secondary|button|card|alert|status|state|program|summary|benefits|obligations|check|eligibility|action|actions|continue|application|help|disclosure|input|select|table|list|menu|dialog|field|error|loading|result|open|copy|save|submit|create|update|delete|download|upload|view|search|filter|sort|enabled|disabled|permission|success|successful|after|before|available|availability|selected|valid|invalid|detail|evidence|appeal|retry|support|execute|rollback|claim|assignee|assign|escalate|start|end|reconnect|reconcile|release|correct|schedule|publish|profile|settings|draft|cart|buy|invite|request|approve|ship|receive|review|reviewing|statement|payment|takedown|restore|label|version|owner|role|reason|safe|data|enforcement|audit|link|video|live|collection|image|title|price|size|duration|resolution|transcode|new|calculation|hold|reported|history|source|tooltips|order|conversions|feed|unicode|punctuation|analytics|job|old|amount|rate|tracking|sync|export|player|host|last|email|html|patch|clipboard|kebab|reorder|unlisted|accordion|click|sums|autoplay|sign-in|pin|chat|ask|restricted|taken_down|signatures|sku|denied|token|access|log|accounts|code|media|tag|schema|step|form|last4|auth|dual|admin|asset|context|reference|timeline|freshness|scope|scopes|catalog|report|recall|exposure|emergency|split|net|fees|terms|country|register|representation|documents|reverification|active|countered|accepted|declined|completed|shipped|delivered|received|cancelled|scan|transcoded|deemed|drill-down|affiliate|creator|revoked|expired|allowed|critical)\b/i;

const isTechnicalValue = (value: string): boolean =>
  value.length > 0 &&
  !/\s/.test(value) &&
  /^[A-Za-z0-9_.*[\]{}|/,≠=<>:-]+$/.test(value);

const stripTechnicalValues = (value: string): string =>
  value
    .replace(INLINE_CODE, ' ')
    .replace(ABSOLUTE_URL, ' ')
    .replace(LOGICAL_ROUTE, '$1 ')
    .replace(APPROVED_TECHNICAL, ' ')
    .replace(/[A-Z]\d{2}|MH-\d{3}/g, ' ')
    .replace(/[\d|.*_[\]{}()=<>:+/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const auditValue = (
  errors: string[],
  owner: string,
  field: string,
  value: string,
  options: {
    readonly visible?: boolean;
    readonly allowTechnical?: boolean;
  } = {},
): void => {
  if (UNFINISHED_COPY.test(value)) {
    errors.push(`${owner}/${field}: nội dung chưa hoàn thiện`);
  }

  if (FORBIDDEN_TRANSLATIONS.test(value)) {
    errors.push(`${owner}/${field}: thuật ngữ dịch sai`);
  }
  if (options.visible && !options.allowTechnical && INLINE_CODE.test(value)) {
    errors.push(
      `${owner}/${field}: không cho phép ẩn nội dung hiển thị trong code`,
    );
  }
  INLINE_CODE.lastIndex = 0;
  if (options.allowTechnical) {
    for (const match of value.matchAll(TECHNICAL_VALUE)) {
      const technical = match[1] ?? '';
      if (
        VIETNAMESE_SIGNAL.test(technical) ||
        ASCII_VIETNAMESE_IDENTIFIER.test(technical)
      ) {
        errors.push(`${owner}/${field}: định danh kỹ thuật chứa tiếng Việt`);
        break;
      }
      if (!isTechnicalValue(technical)) {
        errors.push(
          `${owner}/${field}: không cho phép ẩn nội dung hiển thị trong code`,
        );
        break;
      }
    }
  }

  const explanatory = stripTechnicalValues(value);
  const hasEnglishExplanation = ENGLISH_EXPLANATORY.test(explanatory);
  if (hasEnglishExplanation) {
    errors.push(`${owner}/${field}: còn câu giải thích tiếng Anh`);
  }
  if (
    !hasEnglishExplanation &&
    explanatory.length > 0 &&
    !VIETNAMESE_SIGNAL.test(explanatory)
  ) {
    errors.push(`${owner}/${field}: thiếu nội dung giải thích tiếng Việt`);
  }
  const approvedOnly = value
    .replace(INLINE_CODE, ' ')
    .replace(ABSOLUTE_URL, ' ')
    .replace(LOGICAL_ROUTE, '$1 ')
    .replace(APPROVED_TECHNICAL, ' ')
    .replace(/[\d|.*_[\]{}()=<>:+/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (
    approvedOnly.length === 0 &&
    !VIETNAMESE_SIGNAL.test(value) &&
    (value.match(APPROVED_TECHNICAL)?.length ?? 0) >= 1
  ) {
    errors.push(`${owner}/${field}: thiếu nội dung giải thích tiếng Việt`);
  }
};

export const auditVietnameseScreenContracts = (
  contracts: readonly TScreenContract[],
): string[] => {
  const errors: string[] = [];

  for (const screen of contracts) {
    // `title` is the authoritative English MH heading frozen by Task 1 and is
    // intentionally not rewritten. The remaining visible annotation copy is
    // Vietnamese; `route` is a logical code value rather than visible prose.
    if (UNFINISHED_COPY.test(screen.title)) {
      errors.push(`${screen.code}/title: nội dung chưa hoàn thiện`);
    }
    auditValue(errors, screen.code, 'displayTitle', screen.displayTitle, {
      visible: true,
    });
    auditValue(errors, screen.code, 'actor', screen.actor, { visible: true });
    auditValue(errors, screen.code, 'primaryAction', screen.primaryAction, {
      visible: true,
    });
    auditValue(errors, screen.code, 'safeExit', screen.safeExit, {
      visible: true,
    });

    for (const component of screen.components) {
      const owner = `${screen.code}/${component.id}`;
      auditValue(errors, owner, 'label', component.label, { visible: true });
      auditValue(errors, owner, 'type', component.type, { visible: true });
      auditValue(errors, owner, 'requirement', component.requirement, {
        visible: true,
        allowTechnical: true,
      });
      auditValue(errors, owner, 'validation', component.validation, {
        allowTechnical: true,
      });
      auditValue(errors, owner, 'binding', component.binding, {
        allowTechnical: true,
      });
    }
  }

  return [...new Set(errors)];
};
