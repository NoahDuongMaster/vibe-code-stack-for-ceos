import { TARGET_BY_KEY } from './manifest.ts';

import type { TDiagramSpec } from './types.ts';

const metadata = (
  key: string,
  scope: string,
): Pick<TDiagramSpec, 'key' | 'title' | 'subtitle' | 'scope'> => {
  const target = TARGET_BY_KEY.get(key);
  if (!target) {
    throw new Error(`Unknown diagram target: ${key}`);
  }

  return {
    key: target.key,
    title: target.title,
    subtitle: target.codeRange,
    scope,
  };
};

export const OVERVIEW_AND_TEST_SPECS = [
  {
    ...metadata(
      'page-1-system-context',
      'Tác nhân, bề mặt sản phẩm, miền affiliate, ranh giới bên ngoài và kiểm soát bằng chứng.',
    ),
    columns: [
      {
        title: 'Tác nhân',
        nodes: [
          {
            id: 'context-creator',
            label: 'Creator',
            detail: 'Tạo tài sản affiliate và xem thu nhập được ghi nhận.',
            tone: 'creator',
          },
          {
            id: 'context-seller',
            label: 'Seller / Người bán',
            detail: 'Công bố ưu đãi, tỷ lệ và điều khoản cộng tác.',
            tone: 'seller',
          },
          {
            id: 'context-mcn',
            label: 'MCN / Mạng lưới',
            detail: 'Quản lý roster đã đồng ý, vai trò và chia doanh thu.',
            tone: 'mcn',
          },
          {
            id: 'context-buyer',
            label: 'Buyer',
            detail: 'Khám phá nội dung và hoàn tất đơn hàng đủ điều kiện.',
            tone: 'system',
          },
        ],
      },
      {
        title: 'Vận hành & bề mặt',
        nodes: [
          {
            id: 'context-ops',
            label: 'Ops vận hành',
            detail: 'Xét duyệt định danh, rủi ro, tài chính và khiếu nại.',
            tone: 'ops',
          },
          {
            id: 'context-storefront',
            label: 'Storefront',
            detail:
              'UI cho Creator, Buyer và MCN; route MCN tại apps/storefront/src/app/mcn/*.',
            tone: 'creator',
            badge: 'Hiện có',
          },
          {
            id: 'context-vendor',
            label: 'Vendor Portal',
            detail: 'UI cấu hình và cộng tác dành cho Seller.',
            tone: 'seller',
            badge: 'Mở rộng',
          },
          {
            id: 'context-admin',
            label: 'Medusa Admin',
            detail:
              'UI vận hành cho xét duyệt, rủi ro, đối soát và bằng chứng.',
            tone: 'ops',
            badge: 'Mở rộng',
          },
        ],
      },
      {
        title: 'Miền nghiệp vụ Benadep',
        nodes: [
          {
            id: 'context-identity',
            label: 'Định danh affiliate',
            detail: 'Đăng ký, điều kiện, quyền sở hữu và trạng thái tài khoản.',
            tone: 'creator',
            badge: 'Mới',
          },
          {
            id: 'context-assets',
            label: 'Tài sản / Nội dung',
            detail: 'Link theo dõi, mã, bộ sưu tập, Video và tài sản LIVE.',
            tone: 'creator',
            badge: 'Mới',
          },
          {
            id: 'context-attribution',
            label: 'Attribution có bằng chứng',
            detail:
              'Ứng viên và kết quả có phiên bản, phát lại được bằng chứng.',
            tone: 'system',
            badge: 'Cổng xác thực thực địa',
          },
          {
            id: 'context-ledger',
            label: 'Sổ cái / Payout',
            detail: 'Bút toán hoa hồng theo dòng đơn, đối soát và payout.',
            tone: 'money',
            badge: 'Mới',
          },
        ],
      },
      {
        title: 'Ranh giới bên ngoài',
        nodes: [
          {
            id: 'context-external',
            label: 'Kênh bên ngoài',
            detail: 'Phân phối và tích hợp thương mại theo phạm vi đồng ý.',
            tone: 'system',
            badge: 'Mới',
          },
          {
            id: 'context-payment',
            label: 'Nhà cung cấp thuế / thanh toán',
            detail: 'Thiết lập đã xác minh và kết quả payout từ nhà cung cấp.',
            tone: 'money',
            badge: 'Mở rộng',
          },
          {
            id: 'context-youtube',
            label: 'YouTube / OAuth được cấp quyền',
            detail: 'Phạm vi được cấp quyền, đồng bộ feed và ngắt kết nối.',
            tone: 'system',
            badge: 'Mới',
          },
          {
            id: 'context-notification',
            label: 'Thông báo',
            detail: 'Thông báo trạng thái và khắc phục bất đồng bộ.',
            tone: 'system',
            badge: 'Mở rộng',
          },
        ],
      },
      {
        title: 'Bằng chứng',
        nodes: [
          {
            id: 'context-policy',
            label: 'Chính sách có phiên bản',
            detail: 'Lưu quy tắc và điều khoản hiệu lực cùng mỗi quyết định.',
            tone: 'system',
          },
          {
            id: 'context-audit',
            label: 'Nhật ký audit',
            detail: 'Tác nhân, đầu vào, kết quả, thời điểm và mã tương quan.',
            tone: 'system',
          },
          {
            id: 'context-appeal',
            label: 'Khiếu nại / Hỗ trợ',
            detail: 'Luồng khắc phục an toàn, giữ nguyên bằng chứng vụ việc.',
            tone: 'ops',
          },
        ],
      },
    ],
    edges: [
      {
        from: 'context-creator',
        to: 'context-storefront',
        label: 'tạo và xem kết quả',
        style: 'solid',
      },
      {
        from: 'context-seller',
        to: 'context-vendor',
        label: 'cấu hình ưu đãi',
        style: 'solid',
      },
      {
        from: 'context-mcn',
        to: 'context-storefront',
        label: 'quản lý roster',
        style: 'solid',
      },
      {
        from: 'context-buyer',
        to: 'context-storefront',
        label: 'khám phá và đặt hàng',
        style: 'solid',
      },
      {
        from: 'context-ops',
        to: 'context-admin',
        label: 'xét duyệt và khắc phục',
        style: 'solid',
      },
      {
        from: 'context-creator',
        to: 'context-external',
        label: 'cấp quyền phân phối',
        style: 'solid',
      },
      {
        from: 'context-storefront',
        to: 'context-identity',
        label: 'lệnh tài khoản',
        style: 'solid',
      },
      {
        from: 'context-vendor',
        to: 'context-assets',
        label: 'lệnh ưu đãi và nội dung',
        style: 'solid',
      },
      {
        from: 'context-admin',
        to: 'context-attribution',
        label: 'xét duyệt có thẩm quyền',
        style: 'solid',
      },
      {
        from: 'context-admin',
        to: 'context-ledger',
        label: 'nghiệp vụ tài chính',
        style: 'solid',
      },
      {
        from: 'context-external',
        to: 'context-assets',
        label: 'tài sản theo kênh',
        style: 'solid',
      },
      {
        from: 'context-assets',
        to: 'context-attribution',
        label: 'sự kiện touchpoint',
        style: 'dashed',
      },
      {
        from: 'context-attribution',
        to: 'context-ledger',
        label: 'kết quả theo dòng đơn',
        style: 'dashed',
      },
      {
        from: 'context-ledger',
        to: 'context-payment',
        label: 'yêu cầu và kết quả payout',
        style: 'dashed',
      },
      {
        from: 'context-assets',
        to: 'context-youtube',
        label: 'OAuth và đồng bộ feed',
        style: 'dashed',
      },
      {
        from: 'context-identity',
        to: 'context-notification',
        label: 'sự kiện trạng thái',
        style: 'dashed',
      },
      {
        from: 'context-identity',
        to: 'context-policy',
        label: 'phiên bản chính sách',
        style: 'dotted',
      },
      {
        from: 'context-assets',
        to: 'context-audit',
        label: 'bằng chứng phiên bản tài sản',
        style: 'dotted',
      },
      {
        from: 'context-attribution',
        to: 'context-audit',
        label: 'bằng chứng quyết định',
        style: 'dotted',
      },
      {
        from: 'context-attribution',
        to: 'context-appeal',
        label: 'tham chiếu tranh chấp',
        style: 'dotted',
      },
      {
        from: 'context-ledger',
        to: 'context-audit',
        label: 'bằng chứng bút toán',
        style: 'dotted',
      },
      {
        from: 'context-ledger',
        to: 'context-appeal',
        label: 'khắc phục tài chính',
        style: 'dotted',
      },
      {
        from: 'context-payment',
        to: 'context-audit',
        label: 'bằng chứng kết quả nhà cung cấp',
        style: 'dotted',
      },
    ],
  },
  {
    ...metadata(
      'page-1-end-to-end',
      'Tài sản affiliate, touchpoint quan sát được, attribution, hoa hồng theo dòng đơn, quyết toán và kiểm soát bằng chứng.',
    ),
    columns: [
      {
        title: 'Tạo & quan sát',
        nodes: [
          {
            id: 'e2e-asset',
            label: 'Tài sản / nội dung affiliate',
            detail: 'Link, mã, bộ sưu tập, Video hoặc LIVE có phiên bản.',
            tone: 'creator',
            badge: 'Mới',
          },
          {
            id: 'e2e-touchpoint',
            label: 'Lượt nhấp / touchpoint',
            detail:
              'Ngữ cảnh nguồn có thời điểm và bằng chứng thương mại hợp lệ.',
            tone: 'system',
            badge: 'Mới',
          },
        ],
      },
      {
        title: 'Ra quyết định',
        nodes: [
          {
            id: 'e2e-candidates',
            label: 'Tập ứng viên',
            detail: 'Touchpoint hợp lệ trong cửa sổ chính sách có phiên bản.',
            tone: 'system',
            badge: 'Cổng xác thực thực địa',
          },
          {
            id: 'e2e-winner',
            label: 'Kết quả attribution',
            detail:
              'Kết quả và phiên bản chính sách phát lại được; nội bộ không quan sát được phải field-validation.',
            tone: 'system',
            badge: 'Cổng xác thực thực địa',
          },
        ],
      },
      {
        title: 'Ghi nhận thu nhập',
        nodes: [
          {
            id: 'e2e-rate',
            label: 'Snapshot tỷ lệ dòng đơn',
            detail: 'Số tiền hợp lệ, tỷ lệ, tiền tệ và quy tắc bất biến.',
            tone: 'money',
            badge: 'Mới',
          },
          {
            id: 'e2e-estimated',
            label: 'estimated — ước tính',
            detail: 'Hoa hồng tạm tính sau attribution.',
            tone: 'money',
          },
          {
            id: 'e2e-approved',
            label: 'approved — đã duyệt',
            detail: 'Hoa hồng được chấp nhận sau kiểm tra đơn và chính sách.',
            tone: 'money',
          },
          {
            id: 'e2e-payable',
            label: 'payable — đủ điều kiện chi trả',
            detail: 'Hoa hồng đã duyệt đủ điều kiện vào kỳ payout.',
            tone: 'money',
          },
        ],
      },
      {
        title: 'Quyết toán',
        nodes: [
          {
            id: 'e2e-ledger',
            label: 'Sổ cái / đối soát',
            detail:
              'Bút toán chỉ ghi thêm, khớp nhà cung cấp và bằng chứng đơn.',
            tone: 'money',
            badge: 'Mới',
          },
          {
            id: 'e2e-paid',
            label: 'paid — đã chi trả',
            detail: 'Quyết toán được nhà cung cấp xác nhận kèm tham chiếu.',
            tone: 'money',
          },
        ],
      },
      {
        title: 'Kiểm soát',
        nodes: [
          {
            id: 'e2e-held',
            label: 'held — tạm giữ',
            detail: 'Payout bị chặn với lý do an toàn và đường khắc phục.',
            tone: 'ops',
          },
          {
            id: 'e2e-reversed',
            label: 'reversed — bút toán bù trừ',
            detail: 'Ghi bút toán bù trừ; bằng chứng trước đó vẫn nguyên vẹn.',
            tone: 'ops',
          },
          {
            id: 'e2e-evidence',
            label: 'Tranh chấp / khiếu nại + bằng chứng',
            detail:
              'Đầu vào, quyết định, bút toán và vụ việc đều có phiên bản.',
            tone: 'ops',
          },
        ],
      },
    ],
    edges: [
      {
        from: 'e2e-asset',
        to: 'e2e-touchpoint',
        label: 'phát hành và điều hướng',
        style: 'solid',
      },
      {
        from: 'e2e-touchpoint',
        to: 'e2e-candidates',
        label: 'sự kiện touchpoint',
        style: 'dashed',
      },
      {
        from: 'e2e-candidates',
        to: 'e2e-winner',
        label: 'quyết định có phiên bản',
        style: 'solid',
      },
      {
        from: 'e2e-winner',
        to: 'e2e-rate',
        label: 'dòng đơn đủ điều kiện',
        style: 'solid',
      },
      {
        from: 'e2e-rate',
        to: 'e2e-estimated',
        label: 'tính hoa hồng',
        style: 'solid',
      },
      {
        from: 'e2e-estimated',
        to: 'e2e-approved',
        label: 'duyệt hoa hồng',
        style: 'solid',
      },
      {
        from: 'e2e-approved',
        to: 'e2e-payable',
        label: 'đủ thời hạn',
        style: 'solid',
      },
      {
        from: 'e2e-payable',
        to: 'e2e-ledger',
        label: 'đóng kỳ',
        style: 'solid',
      },
      {
        from: 'e2e-ledger',
        to: 'e2e-paid',
        label: 'nhà cung cấp quyết toán',
        style: 'dashed',
      },
      {
        from: 'e2e-approved',
        to: 'e2e-held',
        label: 'cổng rủi ro, thuế hoặc thanh toán',
        style: 'solid',
      },
      {
        from: 'e2e-paid',
        to: 'e2e-reversed',
        label: 'điều chỉnh bù trừ',
        style: 'solid',
      },
      {
        from: 'e2e-winner',
        to: 'e2e-evidence',
        label: 'bằng chứng quyết định',
        style: 'dotted',
      },
      {
        from: 'e2e-candidates',
        to: 'e2e-evidence',
        label: 'bằng chứng tập ứng viên',
        style: 'dotted',
      },
      {
        from: 'e2e-rate',
        to: 'e2e-evidence',
        label: 'bằng chứng tỷ lệ',
        style: 'dotted',
      },
      {
        from: 'e2e-estimated',
        to: 'e2e-evidence',
        label: 'bằng chứng bút toán',
        style: 'dotted',
      },
      {
        from: 'e2e-approved',
        to: 'e2e-evidence',
        label: 'bằng chứng phê duyệt',
        style: 'dotted',
      },
      {
        from: 'e2e-payable',
        to: 'e2e-evidence',
        label: 'bằng chứng kỳ payout',
        style: 'dotted',
      },
      {
        from: 'e2e-ledger',
        to: 'e2e-evidence',
        label: 'bằng chứng đối soát',
        style: 'dotted',
      },
      {
        from: 'e2e-paid',
        to: 'e2e-evidence',
        label: 'tham chiếu nhà cung cấp',
        style: 'dotted',
      },
      {
        from: 'e2e-held',
        to: 'e2e-evidence',
        label: 'tham chiếu tạm giữ và khiếu nại',
        style: 'dotted',
      },
      {
        from: 'e2e-reversed',
        to: 'e2e-evidence',
        label: 'bằng chứng bút toán đảo',
        style: 'dotted',
      },
    ],
  },
  {
    ...metadata(
      'page-4-traceability',
      'Kết quả quan sát được qua yêu cầu, bề mặt, kiểm thử và bằng chứng được lưu.',
    ),
    columns: [
      {
        title: 'Quan sát & baseline',
        nodes: [
          {
            id: 'trace-observation',
            label: 'Kết quả Shopee quan sát được',
            detail:
              'Chỉ cam kết hành vi bên ngoài; không tuyên bố tương đương nội bộ không quan sát được.',
            tone: 'system',
          },
          {
            id: 'trace-sp',
            label: 'SP — Đối chiếu',
            detail:
              'Phát biểu kết quả tương đương quan sát được và nguồn tham chiếu.',
            tone: 'system',
          },
        ],
      },
      {
        title: 'Sản phẩm & quy tắc',
        nodes: [
          {
            id: 'trace-cn',
            label: 'CN — Năng lực',
            detail: 'Yêu cầu năng lực chức năng mang tính chuẩn tắc.',
            tone: 'creator',
          },
          {
            id: 'trace-qt',
            label: 'QT — Quy tắc',
            detail: 'Quy tắc nghiệp vụ, bất biến và kết quả an toàn.',
            tone: 'seller',
          },
        ],
      },
      {
        title: 'Bề mặt & kiểm thử',
        nodes: [
          {
            id: 'trace-mh',
            label: 'MH / non-UI — Hợp đồng',
            detail: 'Hợp đồng màn hình hoặc ranh giới non-UI được nêu rõ.',
            tone: 'mcn',
          },
          {
            id: 'trace-kt',
            label: 'KT — Kiểm thử',
            detail: 'Kịch bản chấp nhận với kết quả kỳ vọng quan sát được.',
            tone: 'ops',
          },
        ],
      },
      {
        title: 'Bằng chứng & cổng',
        nodes: [
          {
            id: 'trace-evidence',
            label: 'Evidence / bằng chứng tự động, thủ công',
            detail:
              'Test, ảnh chụp, log, build và bằng chứng thực địa đã xác thực.',
            tone: 'system',
          },
          {
            id: 'trace-field-validation',
            label: 'Cổng field-validation',
            detail:
              'Bắt buộc cho hành vi nội bộ không quan sát được; chỉ đóng sau xác thực thực địa.',
            tone: 'ops',
            badge: 'Cổng xác thực thực địa',
          },
        ],
      },
    ],
    edges: [
      {
        from: 'trace-observation',
        to: 'trace-sp',
        label: 'ghi nhận quan sát',
        style: 'solid',
      },
      {
        from: 'trace-sp',
        to: 'trace-cn',
        label: 'đặc tả kết quả',
        style: 'solid',
      },
      {
        from: 'trace-cn',
        to: 'trace-qt',
        label: 'ràng buộc quy tắc',
        style: 'solid',
      },
      {
        from: 'trace-qt',
        to: 'trace-mh',
        label: 'biểu đạt hành vi',
        style: 'solid',
      },
      {
        from: 'trace-mh',
        to: 'trace-kt',
        label: 'bao phủ chấp nhận',
        style: 'solid',
      },
      {
        from: 'trace-kt',
        to: 'trace-evidence',
        label: 'lưu bằng chứng',
        style: 'dotted',
      },
      {
        from: 'trace-observation',
        to: 'trace-field-validation',
        label: 'tuyên bố nội bộ không quan sát được',
        style: 'dotted',
      },
      {
        from: 'trace-field-validation',
        to: 'trace-evidence',
        label: 'bằng chứng thực địa đã xác thực',
        style: 'dotted',
      },
    ],
  },
  {
    ...metadata(
      'page-4-release-gate',
      'Bộ kiểm thử bắt buộc, kiểm soát xuyên suốt, bằng chứng nguồn, phê duyệt và quyết định phát hành.',
    ),
    columns: [
      {
        title: 'Bộ kiểm thử',
        nodes: [
          {
            id: 'release-capability',
            label: 'Capability — Năng lực',
            detail: 'Bao phủ chấp nhận cho CN, QT và MH hoặc non-UI.',
            tone: 'creator',
          },
          {
            id: 'release-golden',
            label: 'Golden E2E — Luồng trọng yếu',
            detail: 'Hành trình tác nhân trọng yếu và chuyển trạng thái.',
            tone: 'creator',
          },
          {
            id: 'release-algorithm',
            label: 'Xác thực logic quyết định',
            detail:
              'Dùng bộ dữ liệu đã duyệt và bằng chứng field-validation khi cần, không suy đoán nội bộ.',
            tone: 'system',
            badge: 'Cổng xác thực thực địa',
          },
        ],
      },
      {
        title: 'Kiểm soát xuyên suốt',
        nodes: [
          {
            id: 'release-security',
            label: 'Bảo mật',
            detail: 'Phân quyền, riêng tư, lạm dụng và xử lý lỗi an toàn.',
            tone: 'ops',
          },
          {
            id: 'release-wcag',
            label: 'WCAG 2.2 AA — Khả năng tiếp cận',
            detail: 'Bàn phím, ngữ nghĩa, nhãn, độ tương phản và responsive.',
            tone: 'system',
          },
          {
            id: 'release-finance',
            label: 'Đối soát tài chính',
            detail: 'Bút toán dòng đơn khớp tổng tiền từ nhà cung cấp.',
            tone: 'money',
          },
        ],
      },
      {
        title: 'Bằng chứng nguồn',
        nodes: [
          {
            id: 'release-code',
            label: 'Code / test / build — Bằng chứng',
            detail: 'Các cổng repository và artifact tái lập được đều đạt.',
            tone: 'system',
          },
          {
            id: 'release-authenticated',
            label: 'Bằng chứng đã xác thực',
            detail: 'Ghi nhận thực địa có thẩm quyền, phạm vi và thời điểm.',
            tone: 'system',
          },
        ],
      },
      {
        title: 'Phê duyệt',
        nodes: [
          {
            id: 'release-approval',
            label: 'Product / Engineering / Legal / Finance / QA — Chủ sở hữu',
            detail: 'Chủ sở hữu bắt buộc duyệt các cổng bằng chứng liên quan.',
            tone: 'ops',
          },
        ],
      },
      {
        title: 'Quyết định',
        nodes: [
          {
            id: 'release-decision',
            label: 'Chỉ phát hành khi mọi cổng bắt buộc đạt',
            detail: 'Cổng bắt buộc thất bại hoặc thiếu đều chặn phát hành.',
            tone: 'ops',
          },
        ],
      },
    ],
    edges: [
      {
        from: 'release-capability',
        to: 'release-code',
        label: 'bằng chứng kiểm thử',
        style: 'dotted',
      },
      {
        from: 'release-golden',
        to: 'release-code',
        label: 'bằng chứng E2E',
        style: 'dotted',
      },
      {
        from: 'release-algorithm',
        to: 'release-authenticated',
        label: 'bằng chứng xác thực',
        style: 'dotted',
      },
      {
        from: 'release-security',
        to: 'release-code',
        label: 'bằng chứng bảo mật',
        style: 'dotted',
      },
      {
        from: 'release-wcag',
        to: 'release-code',
        label: 'bằng chứng khả năng tiếp cận',
        style: 'dotted',
      },
      {
        from: 'release-finance',
        to: 'release-authenticated',
        label: 'bằng chứng đối soát',
        style: 'dotted',
      },
      {
        from: 'release-code',
        to: 'release-approval',
        label: 'nộp bằng chứng nguồn',
        style: 'solid',
      },
      {
        from: 'release-authenticated',
        to: 'release-approval',
        label: 'nộp bằng chứng thực địa',
        style: 'solid',
      },
      {
        from: 'release-approval',
        to: 'release-decision',
        label: 'đủ mọi phê duyệt bắt buộc',
        style: 'solid',
      },
      {
        from: 'release-approval',
        to: 'release-authenticated',
        label: 'bằng chứng phê duyệt',
        style: 'dotted',
      },
      {
        from: 'release-decision',
        to: 'release-authenticated',
        label: 'bằng chứng quyết định',
        style: 'dotted',
      },
    ],
  },
] as const satisfies readonly TDiagramSpec[];
