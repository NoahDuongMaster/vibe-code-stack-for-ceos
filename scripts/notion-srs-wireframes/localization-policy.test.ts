import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { auditVietnameseScreenContracts } from './localization-policy.ts';
import { SCREEN_CONTRACTS } from './screen-contracts.ts';

import type { TScreenContract } from './types.ts';

const VALID_CONTRACT = {
  code: 'MH-001',
  pageKey: '3-01-ui',
  title: 'Affiliate Center & Eligibility',
  displayTitle: 'Trung tâm Affiliate và điều kiện tham gia',
  surface: 'storefront',
  actor: 'Ứng viên Creator',
  route: '/account/affiliate',
  layoutRecipe: 'dashboard',
  primaryAction: 'Kiểm tra điều kiện tham gia',
  safeExit: 'Quay về trang tài khoản an toàn',
  states: ['loading', 'ready', 'dependency-unavailable'],
  components: [
    {
      id: 'D01',
      annotationCode: 'D01',
      label: 'Tổng quan chương trình',
      type: 'Thẻ nổi bật + Cảnh báo',
      requirement: 'Luôn hiển thị',
      validation:
        'Phiên bản chương trình, quyền lợi và nghĩa vụ; không có dữ liệu chỉnh sửa.',
      binding:
        '`program.*`; hiển thị thông báo điều kiện và liên kết FTC/thuế.',
      states: ['loading', 'ready', 'dependency-unavailable'],
      region: 'primary',
    },
  ],
} as const satisfies TScreenContract;

describe('[SRSScreenContractLocalization]', () => {
  it('should expose Vietnamese visible copy without hiding technical values', () => {
    assert.deepEqual(auditVietnameseScreenContracts(SCREEN_CONTRACTS), []);
  });

  it('should accept Vietnamese prose with approved routes and technical tokens', () => {
    assert.deepEqual(auditVietnameseScreenContracts([VALID_CONTRACT]), []);
  });

  it('should reject explanatory English even when Vietnamese words surround it', () => {
    const invalid = {
      ...VALID_CONTRACT,
      components: [
        {
          ...VALID_CONTRACT.components[0],
          validation: 'Program summary phải luôn hiển thị cho Creator.',
        },
      ],
    } as const satisfies TScreenContract;

    assert.ok(auditVietnameseScreenContracts([invalid]).length > 0);
  });

  it('should reject untranslated type and requirement phrases', () => {
    const invalid = {
      ...VALID_CONTRACT,
      components: [
        {
          ...VALID_CONTRACT.components[0],
          type: 'Primary Button',
          requirement: 'Always visible',
        },
      ],
    } as const satisfies TScreenContract;

    assert.ok(auditVietnameseScreenContracts([invalid]).length >= 2);
  });

  it('should reject unfinished placeholder copy', () => {
    const invalid = {
      ...VALID_CONTRACT,
      safeExit: 'TODO: dịch sau',
    } as const satisfies TScreenContract;

    assert.ok(auditVietnameseScreenContracts([invalid]).length > 0);
  });

  it('should report exact owners for reviewer false-negative phrases', () => {
    const cases = [
      {
        contract: {
          ...VALID_CONTRACT,
          primaryAction: 'Gửi khiếu nại enforcement',
        },
        expected: 'MH-001/primaryAction: còn câu giải thích tiếng Anh',
      },
      {
        contract: {
          ...VALID_CONTRACT,
          safeExit: 'Công tắc tiêu diệt và mũ lưỡi trai',
        },
        expected: 'MH-001/safeExit: thuật ngữ dịch sai',
      },
      {
        contract: {
          ...VALID_CONTRACT,
          components: [
            {
              ...VALID_CONTRACT.components[0],
              binding: '`payout.nhu_cầu_hành_động`',
            },
          ],
        },
        expected: 'MH-001/D01/binding: định danh kỹ thuật chứa tiếng Việt',
      },
      {
        contract: {
          ...VALID_CONTRACT,
          components: [
            {
              ...VALID_CONTRACT.components[0],
              label: 'Chọn link/video/live/bộ sưu tập',
            },
          ],
        },
        expected: 'MH-001/D01/label: còn câu giải thích tiếng Anh',
      },
      {
        contract: { ...VALID_CONTRACT, title: 'TODO' },
        expected: 'MH-001/title: nội dung chưa hoàn thiện',
      },
      {
        contract: {
          ...VALID_CONTRACT,
          components: [
            {
              ...VALID_CONTRACT.components[0],
              requirement: '`Always visible`',
            },
          ],
        },
        expected:
          'MH-001/D01/requirement: không cho phép ẩn nội dung hiển thị trong code',
      },
    ] as const;

    for (const item of cases) {
      assert.deepEqual(auditVietnameseScreenContracts([item.contract]), [
        item.expected,
      ]);
    }
  });

  it('should accept exact technical timestamps and reject localized identifiers', () => {
    const valid = {
      ...VALID_CONTRACT,
      components: [
        {
          ...VALID_CONTRACT.components[0],
          binding: '`acceptedAt`; dấu thời gian chấp nhận.',
        },
      ],
    } as const satisfies TScreenContract;
    const invalid = {
      ...VALID_CONTRACT,
      components: [
        {
          ...VALID_CONTRACT.components[0],
          binding: '`chấpNhậnAt`; dấu thời gian chấp nhận.',
        },
      ],
    } as const satisfies TScreenContract;

    assert.deepEqual(auditVietnameseScreenContracts([valid]), []);
    assert.deepEqual(auditVietnameseScreenContracts([invalid]), [
      'MH-001/D01/binding: định danh kỹ thuật chứa tiếng Việt',
    ]);
  });

  it('should reject reviewer English and mistranslation fixtures in every annotation field', () => {
    const cases = [
      ['label', 'Máy nghe nhạc Video', 'thuật ngữ dịch sai'],
      [
        'safeExit',
        'Quay về an toàn; giữ audit.',
        'còn câu giải thích tiếng Anh',
      ],
      [
        'label',
        'Chọn link/video/live/bộ sưu tập được hỗ trợ.',
        'còn câu giải thích tiếng Anh',
      ],
      [
        'binding',
        '`payout.nhu_cau_hanh_dong`; tải dữ liệu.',
        'định danh kỹ thuật chứa tiếng Việt',
      ],
      [
        'actor',
        'Affiliate Creator Video',
        'thiếu nội dung giải thích tiếng Việt',
      ],
      [
        'primaryAction',
        'Đóng/reconcile/hold/release/correct',
        'còn câu giải thích tiếng Anh',
      ],
      ['validation', 'Unicode/punctuation', 'còn câu giải thích tiếng Anh'],
      ['validation', 'successful', 'còn câu giải thích tiếng Anh'],
      ['binding', 'source/tooltips', 'còn câu giải thích tiếng Anh'],
      ['label', 'conversions/order', 'còn câu giải thích tiếng Anh'],
      [
        'validation',
        '`Always visible`; dùng cho giao diện.',
        'không cho phép ẩn nội dung hiển thị trong code',
      ],
    ] as const;

    for (const [field, value, message] of cases) {
      const componentFields = [
        'label',
        'type',
        'requirement',
        'validation',
        'binding',
      ] as const;
      const isComponentField = componentFields.includes(
        field as (typeof componentFields)[number],
      );
      const contract = isComponentField
        ? {
            ...VALID_CONTRACT,
            components: [{ ...VALID_CONTRACT.components[0], [field]: value }],
          }
        : { ...VALID_CONTRACT, [field]: value };
      const owner = isComponentField ? 'MH-001/D01' : 'MH-001';

      assert.deepEqual(auditVietnameseScreenContracts([contract]), [
        `${owner}/${field}: ${message}`,
      ]);
    }
  });

  it('should accept only exact technical identifiers and enum literals in code spans', () => {
    const valid = {
      ...VALID_CONTRACT,
      components: [
        {
          ...VALID_CONTRACT.components[0],
          validation:
            'Tập giá trị `pending|verified|failed|expired`; dùng `acceptedAt` và `payout.status`.',
        },
      ],
    } as const satisfies TScreenContract;

    assert.deepEqual(auditVietnameseScreenContracts([valid]), []);
  });

  it('should accept the Vietnamese tabs component term but reject bare English tabs', () => {
    const valid = {
      ...VALID_CONTRACT,
      components: [
        {
          ...VALID_CONTRACT.components[0],
          type: 'Giao diện tab + Bản xem trước an toàn',
        },
      ],
    } as const satisfies TScreenContract;
    const invalid = {
      ...VALID_CONTRACT,
      components: [
        {
          ...VALID_CONTRACT.components[0],
          type: 'Tabs',
        },
      ],
    } as const satisfies TScreenContract;

    assert.deepEqual(auditVietnameseScreenContracts([valid]), []);
    assert.deepEqual(auditVietnameseScreenContracts([invalid]), [
      'MH-001/D01/type: thiếu nội dung giải thích tiếng Việt',
    ]);
  });

  it('should reject code spans in user-facing fields that do not own technical values', () => {
    const fields = [
      'displayTitle',
      'actor',
      'primaryAction',
      'safeExit',
      'label',
      'type',
    ] as const;

    for (const field of fields) {
      const isComponentField = field === 'label' || field === 'type';
      const contract = isComponentField
        ? {
            ...VALID_CONTRACT,
            components: [
              { ...VALID_CONTRACT.components[0], [field]: '`Always visible`' },
            ],
          }
        : { ...VALID_CONTRACT, [field]: '`Always visible`' };
      const owner = isComponentField ? 'MH-001/D01' : 'MH-001';

      assert.deepEqual(auditVietnameseScreenContracts([contract]), [
        `${owner}/${field}: không cho phép ẩn nội dung hiển thị trong code`,
      ]);
    }
  });

  it('should require Vietnamese role or action copy around approved product tokens', () => {
    const cases = [
      ['displayTitle', 'Affiliate'],
      ['actor', 'Creator'],
      ['primaryAction', 'Video'],
      ['safeExit', 'OAuth'],
    ] as const;

    for (const [field, value] of cases) {
      assert.deepEqual(
        auditVietnameseScreenContracts([{ ...VALID_CONTRACT, [field]: value }]),
        [`MH-001/${field}: thiếu nội dung giải thích tiếng Việt`],
      );
    }
  });

  it('should not mistake slash-separated English state prose for logical routes', () => {
    const cases = [
      ['validation', 'Trạng thái /denied cần xử lý.'],
      ['binding', 'Đã /revoked/expired theo chính sách.'],
      ['requirement', 'Yêu cầu /sign-in trước khi gửi.'],
    ] as const;

    for (const [field, value] of cases) {
      const contract = {
        ...VALID_CONTRACT,
        components: [{ ...VALID_CONTRACT.components[0], [field]: value }],
      };
      assert.deepEqual(auditVietnameseScreenContracts([contract]), [
        `MH-001/D01/${field}: còn câu giải thích tiếng Anh`,
      ]);
    }

    const validRoute = {
      ...VALID_CONTRACT,
      components: [
        {
          ...VALID_CONTRACT.components[0],
          binding: 'Điều hướng /account/affiliate/apply an toàn.',
        },
      ],
    } as const satisfies TScreenContract;
    assert.deepEqual(auditVietnameseScreenContracts([validRoute]), []);
  });

  it('should reject lowercase product nouns and untranslated policy states', () => {
    const cases = [
      ['label', 'Mở affiliate'],
      ['actor', 'creator'],
      ['validation', 'Trạng thái revoked hoặc expired.'],
      ['requirement', 'Chỉ allowed khi policy-critical.'],
      ['binding', 'Yêu cầu sign-in.'],
    ] as const;

    for (const [field, value] of cases) {
      const isComponentField = !['actor'].includes(field);
      const contract = isComponentField
        ? {
            ...VALID_CONTRACT,
            components: [{ ...VALID_CONTRACT.components[0], [field]: value }],
          }
        : { ...VALID_CONTRACT, [field]: value };
      const owner = isComponentField ? 'MH-001/D01' : 'MH-001';
      assert.deepEqual(auditVietnameseScreenContracts([contract]), [
        `${owner}/${field}: còn câu giải thích tiếng Anh`,
      ]);
    }
  });

  it('should reject the exhaustive-review Vietnamese calque glossary', () => {
    const values = [
      'Có điều kiện · sự cho phép',
      'Máy chủ tập giá trị',
      'Trạng thái tập giá trị',
      'Kiểm toán Thao tác ghi dữ liệu',
      'Tiểu ID',
      'Quay về điểm vào trước',
      'Kích hoạt khi bẩn',
      'Hiện vật đã sẵn sàng',
      'Tóm tắt cuộn lên',
      'Bảng phương sai',
      'Người trợ giúp tiết lộ',
      'Gói đã được biên tập lại',
      'Đi theo lộ trình nội bộ',
      'Người tạo được chỉ định và mở',
      'Mã mời dài 1–64 ký tự',
      'Bộ lọc tương tự',
      'Tình trạng công dân Hoa Kỳ',
      'Trường do nhà cung cấp lưu trữ',
      'Biện pháp khắc phục an toàn, thời hạn',
      'Trạng thái tình trạng',
      'Chứng thực chính xác',
      'Không gửi đường dẫn địa phương',
      'Trạng thái URL',
      'URL-trạng thái an toàn',
      'Lưới thẻ đáp ứng',
      'Đi theo route nội bộ',
      'Kênh/tài sản/thuộc tính',
      'Thuộc tính kênh',
      'Luôn theo sau hành động',
      'Yêu cầu điều khiển kép',
      'Luôn hiển thị sau nỗ lực',
    ] as const;

    for (const value of values) {
      const invalid = {
        ...VALID_CONTRACT,
        components: [{ ...VALID_CONTRACT.components[0], validation: value }],
      } as const satisfies TScreenContract;

      assert.ok(
        auditVietnameseScreenContracts([invalid]).includes(
          'MH-001/D01/validation: thuật ngữ dịch sai',
        ),
        value,
      );
    }
  });
});
