import { TARGET_BY_KEY } from './manifest.ts';

import type {
  TBadge,
  TDiagramColumn,
  TDiagramEdge,
  TDiagramNode,
  TDiagramSpec,
  TEdgeStyle,
  TTone,
} from './types.ts';

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

const node = (
  id: string,
  label: string,
  detail: string,
  tone: TTone,
  badge: TBadge,
): TDiagramNode => ({ id, label, detail, tone, badge });

const column = (
  title: string,
  ...nodes: readonly TDiagramNode[]
): TDiagramColumn => ({ title, nodes });

const edge = (
  from: string,
  to: string,
  label: string,
  style: TEdgeStyle = 'solid',
): TDiagramEdge => ({ from, to, label, style });

const spec = (
  key: string,
  scope: string,
  columns: readonly TDiagramColumn[],
  edges: readonly TDiagramEdge[],
): TDiagramSpec => ({ ...metadata(key, scope), columns, edges });

export const BACKEND_SPECS = [
  spec(
    '2-01-backend',
    'Đơn đăng ký Affiliate, xác minh, xét duyệt, trạng thái tài khoản, khắc phục an toàn và bằng chứng quyết định được lưu giữ.',
    [
      column(
        'Đăng ký',
        node(
          'application',
          'CN-001 Đơn đăng ký',
          'Bản nháp đăng ký được lưu trước khi Creator gửi một bản ghi có phiên bản.',
          'creator',
          'Mới',
        ),
      ),
      column(
        'Xác minh',
        node(
          'identity',
          'CN-003 Định danh',
          'Trạng thái định danh/liên hệ mở rộng ranh giới tài khoản hiện có mà không lưu dữ liệu thô từ nhà cung cấp.',
          'creator',
          'Mở rộng',
        ),
        node(
          'channel',
          'Quyền sở hữu kênh',
          'Xác minh quyền sở hữu kênh ghi lại phương thức, kết quả và property đã xác minh.',
          'system',
          'Mới',
        ),
      ),
      column(
        'Quyết định',
        node(
          'review',
          'Admin xét duyệt',
          'Admin xét duyệt trả về active, needs_action hoặc rejected cùng mã lý do an toàn.',
          'ops',
          'Mở rộng',
        ),
      ),
      column(
        'Vòng đời tài khoản',
        node(
          'suspension',
          'Tạm ngưng',
          'Tạm ngưng và xác minh lại duy trì độc lập trạng thái tài khoản với trạng thái xác minh.',
          'ops',
          'Mới',
        ),
        node(
          '2-01-backend-remediation',
          'Xác minh lại an toàn',
          'Khiếu nại hoặc xác minh lại an toàn đưa người dùng về đúng bước bằng chứng được yêu cầu.',
          'creator',
          'Mới',
        ),
        node(
          'native-parity-gate',
          'CN-004 Cổng parity native',
          'Chỉ đóng parity sau khi ADR được duyệt, có triển khai native và bằng chứng xác thực từ thực địa.',
          'system',
          'Cổng xác thực thực địa',
        ),
      ),
      column(
        'Bằng chứng',
        node(
          'evidence',
          'Bằng chứng có phiên bản',
          'Bằng chứng có phiên bản lưu tác nhân, đầu vào, chính sách, kết quả, thời điểm và tham chiếu.',
          'system',
          'Mở rộng',
        ),
      ),
    ],
    [
      edge('application', 'identity', 'đã gửi'),
      edge('identity', 'review', 'đã xác minh'),
      edge('channel', 'review', 'kết quả sở hữu', 'dashed'),
      edge('review', 'suspension', 'chuyển trạng thái'),
      edge('review', '2-01-backend-remediation', 'cần hành động'),
      edge('review', 'evidence', 'bằng chứng quyết định', 'dotted'),
      edge(
        '2-01-backend-remediation',
        'evidence',
        'bằng chứng khắc phục',
        'dotted',
      ),
      edge('native-parity-gate', 'evidence', 'cổng phát hành', 'dotted'),
    ],
  ),
  spec(
    '2-02-backend',
    'Khám phá ưu đãi có phiên bản, kiểm tra đủ điều kiện, tham gia, tạo tài sản, tổng hợp hiệu suất và khắc phục dữ liệu cũ.',
    [
      column(
        'Khám phá',
        node(
          'dashboard',
          'CN-010 Truy vấn dashboard',
          'Truy vấn dashboard tái sử dụng tổng hợp người bán, sản phẩm và đơn hàng đã xác thực.',
          'creator',
          'Mở rộng',
        ),
      ),
      column(
        'Chính sách ưu đãi',
        node(
          'offer',
          'CN-011–015 Ưu đãi',
          'Phiên bản ưu đãi và phiên bản tỷ lệ là bất biến cho mỗi quyết định đủ điều kiện.',
          'seller',
          'Mới',
        ),
        node(
          'eligibility',
          'Kiểm tra đủ điều kiện',
          'Kiểm tra đủ điều kiện đánh giá phiên bản đã công bố và trả mã kết quả có thể giải thích.',
          'system',
          'Mới',
        ),
      ),
      column(
        'Tham gia ưu đãi',
        node(
          'enrollment',
          'Lời mời / tham gia',
          'Lời mời và việc tham gia liên kết Creator, người bán, phiên bản ưu đãi và trạng thái hiệu lực.',
          'creator',
          'Mới',
        ),
        node(
          'asset',
          'Tài sản Affiliate',
          'Tài sản link/nội dung/giới thiệu giữ lại ngữ cảnh ưu đãi và kênh.',
          'creator',
          'Mới',
        ),
      ),
      column(
        'Đo lường an toàn',
        node(
          'aggregate',
          'Tổng hợp hiệu suất',
          'Chỉ số tổng hợp lượt nhấp/đơn hàng/thu nhập nêu rõ độ mới và định nghĩa.',
          'money',
          'Mở rộng',
        ),
        node(
          '2-02-backend-remediation',
          'Làm mới phiên bản an toàn',
          'Thử lại an toàn làm mới ưu đãi cũ trước khi tham gia hoặc thay đổi tài sản.',
          'system',
          'Mở rộng',
        ),
      ),
      column(
        'Bằng chứng',
        node(
          'offer-evidence',
          'Audit / độ mới',
          'Audit lưu watermark truy vấn, phiên bản ưu đãi, cửa sổ tổng hợp và tham chiếu tương quan.',
          'system',
          'Hiện có',
        ),
      ),
    ],
    [
      edge('dashboard', 'offer', 'truy vấn ưu đãi'),
      edge('offer', 'enrollment', 'phiên bản đủ điều kiện'),
      edge('eligibility', 'enrollment', 'quyết định đủ điều kiện'),
      edge('enrollment', 'aggregate', 'sự kiện tài sản', 'dashed'),
      edge('asset', 'aggregate', 'lượt nhấp và đơn hàng', 'dashed'),
      edge('offer', '2-02-backend-remediation', 'phiên bản đã cũ'),
      edge('aggregate', 'offer-evidence', 'bằng chứng chỉ số', 'dotted'),
      edge(
        '2-02-backend-remediation',
        'offer-evidence',
        'bằng chứng làm mới',
        'dotted',
      ),
    ],
  ),
  spec(
    '2-03-backend',
    'Phân giải tài sản theo dõi, bằng chứng lượt nhấp, chuyển đổi theo dòng đơn hàng, báo cáo, chi tiết thanh toán, xuất dữ liệu và khắc phục giữ nguyên ngữ cảnh.',
    [
      column(
        'Tạo tài sản',
        node(
          'link',
          'CN-020 Link theo dõi',
          'Link theo dõi liên kết Creator, sản phẩm, kênh, chiến dịch và ngữ cảnh sub-ID.',
          'creator',
          'Mới',
        ),
        node(
          'code',
          'CN-021 Mã sản phẩm',
          'Mã được phân giải qua liên kết sản phẩm có phiên bản và chống xung đột.',
          'creator',
          'Mới',
        ),
        node(
          'collection',
          'CN-022 Bộ sưu tập',
          'Công bố bộ sưu tập tạo snapshot thứ tự sản phẩm và ngữ cảnh disclosure.',
          'creator',
          'Mới',
        ),
      ),
      column(
        'Phân giải & chuyển hướng',
        node(
          'resolver',
          'Bộ phân giải / chuyển hướng',
          'Bộ phân giải xác thực token, giữ ngữ cảnh nguồn và thực hiện chuyển hướng an toàn.',
          'system',
          'Mở rộng',
        ),
      ),
      column(
        'Quan sát thương mại',
        node(
          'click-proof',
          'Bằng chứng lượt nhấp',
          'Bằng chứng lượt nhấp ghi nguồn, đích, thời gian, consent và trạng thái khử trùng lặp an toàn về riêng tư.',
          'system',
          'Mới',
        ),
        node(
          'conversion',
          'Chuyển đổi theo dòng đơn hàng',
          'Chuyển đổi theo dòng đơn hàng mở rộng sự kiện checkout và đơn hàng chuẩn tắc.',
          'money',
          'Mở rộng',
        ),
      ),
      column(
        'Báo cáo & khắc phục',
        node(
          'reports',
          'CN-023–025 Báo cáo',
          'Báo cáo hiển thị lượt nhấp và chuyển đổi cùng bộ lọc, định nghĩa và drill-down.',
          'creator',
          'Mới',
        ),
        node(
          'earnings',
          'CN-026–027 Thu nhập',
          'Thu nhập/thanh toán/xuất dữ liệu giữ kỳ sao kê, số tiền, trạng thái và nguồn.',
          'money',
          'Mới',
        ),
        node(
          '2-03-backend-remediation',
          'Thử lại bộ phân giải an toàn',
          'Thử lại an toàn giữ ngữ cảnh nguồn và trả lỗi bộ phân giải có thể xử lý.',
          'system',
          'Mở rộng',
        ),
      ),
      column(
        'Bằng chứng',
        node(
          'report-evidence',
          'Bằng chứng báo cáo có phiên bản',
          'Tham chiếu bất biến của lượt nhấp, dòng đơn hàng, truy vấn và xuất dữ liệu hỗ trợ phát lại.',
          'system',
          'Hiện có',
        ),
      ),
    ],
    [
      edge('link', 'resolver', 'mở link'),
      edge('code', 'resolver', 'phân giải mã'),
      edge('collection', 'resolver', 'chọn sản phẩm'),
      edge('resolver', 'click-proof', 'nguồn hợp lệ'),
      edge('click-proof', 'conversion', 'sự kiện dòng đơn hàng', 'dashed'),
      edge('conversion', 'reports', 'order line đã attribution', 'dashed'),
      edge('reports', 'earnings', 'chi tiết thu nhập'),
      edge('resolver', '2-03-backend-remediation', 'không hợp lệ hoặc hết hạn'),
      edge('reports', 'report-evidence', 'bằng chứng truy vấn', 'dotted'),
      edge('earnings', 'report-evidence', 'bằng chứng tài chính', 'dotted'),
    ],
  ),
  spec(
    '2-04-backend',
    'Chọn ứng viên tất định có thể phát lại, kết quả attribution có phiên bản, snapshot tỷ lệ bất biến, journal theo dòng đơn hàng và khiếu nại an toàn.',
    [
      column(
        'Quan sát',
        node(
          'touchpoints',
          'CN-028 Điểm chạm',
          'Điểm chạm đủ điều kiện trong cửa sổ đã cấu hình tạo thành tập đầu vào hữu hạn.',
          'system',
          'Mới',
        ),
        node(
          'candidates',
          'Tập ứng viên',
          'Tập ứng viên giữ cả ứng viên được chấp nhận và bị loại cùng mã lý do.',
          'system',
          'Mới',
        ),
      ),
      column(
        'Quyết định',
        node(
          'class',
          'CN-031–034 Lớp attribution',
          'Lớp attribution và thứ tự ưu tiên tất định dùng đầu vào quan sát được, có phiên bản và vẫn qua cổng xác thực thực địa.',
          'system',
          'Cổng xác thực thực địa',
        ),
        node(
          'winner',
          'Kết quả thắng / phiên bản',
          'Kết quả thắng lưu phiên bản chính sách, lý do của ứng viên và kết quả quan sát được theo quy tắc tất định.',
          'system',
          'Mới',
        ),
      ),
      column(
        'Snapshot tiền',
        node(
          'rate',
          'CN-029–030 Tỷ lệ',
          'Snapshot tỷ lệ đóng băng sản phẩm đủ điều kiện, người bán, Creator, cơ sở tính và chính sách hiệu lực.',
          'money',
          'Mới',
        ),
      ),
      column(
        'Ghi sổ & khắc phục',
        node(
          'ledger',
          'CN-035–039 Sổ cái',
          'Sổ cái/điều chỉnh theo dòng đơn hàng dùng bút toán chỉ-ghi-thêm và tham chiếu cân bằng.',
          'money',
          'Mới',
        ),
        node(
          '2-04-backend-remediation',
          'Phát lại bằng chứng an toàn',
          'Khiếu nại an toàn phát lại ứng viên, kết quả thắng, snapshot tỷ lệ và điều chỉnh mà không sửa dữ liệu.',
          'ops',
          'Mở rộng',
        ),
      ),
      column(
        'Bằng chứng',
        node(
          'attribution-evidence',
          'Phát lại bằng chứng',
          'Sự kiện đơn hàng hiện có cùng đầu vào có phiên bản hỗ trợ phát lại bằng chứng theo quy tắc tất định.',
          'system',
          'Hiện có',
        ),
      ),
    ],
    [
      edge('touchpoints', 'candidates', 'trong cửa sổ'),
      edge('candidates', 'class', 'tập đủ điều kiện'),
      edge('class', 'winner', 'kết quả tất định'),
      edge('winner', 'rate', 'phiên bản kết quả thắng'),
      edge('rate', 'ledger', 'snapshot dòng đơn hàng'),
      edge('ledger', 'attribution-evidence', 'bằng chứng journal', 'dotted'),
      edge('winner', 'attribution-evidence', 'bằng chứng quyết định', 'dotted'),
      edge('rate', '2-04-backend-remediation', 'tham chiếu tranh chấp'),
      edge(
        '2-04-backend-remediation',
        'attribution-evidence',
        'bằng chứng phát lại',
        'dotted',
      ),
    ],
  ),
  spec(
    '2-05-backend',
    'Xử lý media Video ngắn, liên kết sản phẩm, công bố bất biến, bằng chứng thương mại, kiểm duyệt và khiếu nại.',
    [
      column(
        'Bản nháp media',
        node(
          'video-draft',
          'CN-041 Bản nháp media',
          'Tải lên/transcode bản nháp mở rộng xử lý tệp an toàn cùng quyền sở hữu của Creator.',
          'creator',
          'Mở rộng',
        ),
      ),
      column(
        'Kiểm duyệt & gắn thẻ',
        node(
          'video-moderation',
          'CN-045 Kiểm duyệt',
          'Kiểm tra trước công bố và hành động sau công bố trả phiên bản chính sách, lý do an toàn, phạm vi và tham chiếu.',
          'ops',
          'Mở rộng',
        ),
        node(
          'video-tags',
          'CN-042/044 Tags sản phẩm',
          'Tags sản phẩm và tham chiếu voucher được xác thực trước khi công bố.',
          'creator',
          'Mới',
        ),
        node(
          'catalog-reference',
          'Tham chiếu catalog',
          'Trạng thái sản phẩm và voucher hiện có vẫn là nguồn chuẩn tắc.',
          'seller',
          'Hiện có',
        ),
      ),
      column(
        'Công bố & khám phá',
        node(
          'video-publish',
          'Công bố bất biến',
          'Công bố tạo phiên bản bất biến của nội dung, tags và bằng chứng disclosure.',
          'creator',
          'Mới',
        ),
        node(
          'video-feed',
          'CN-040 Feed / chi tiết',
          'Feed/chi tiết mở rộng khám phá cộng đồng bằng phiên bản Video Affiliate bất biến.',
          'creator',
          'Mở rộng',
        ),
      ),
      column(
        'Thương mại & kiểm soát',
        node(
          'video-commerce',
          'CN-043 Thương mại',
          'Bằng chứng lượt nhấp/đơn hàng thương mại liên kết video, sản phẩm, voucher, điểm chạm và dòng đơn hàng.',
          'money',
          'Mới',
        ),
        node(
          '2-05-backend-remediation',
          'Khiếu nại nội dung an toàn',
          'Khiếu nại an toàn giữ nguyên phiên bản đã công bố và gửi bằng chứng trong phạm vi cho phép.',
          'creator',
          'Mới',
        ),
      ),
      column(
        'Bằng chứng',
        node(
          'video-evidence',
          'Bằng chứng có phiên bản',
          'Bằng chứng media, tags, công bố, thương mại, kiểm duyệt và khiếu nại luôn có thể phát lại.',
          'system',
          'Mở rộng',
        ),
      ),
    ],
    [
      edge('video-draft', 'video-moderation', 'kiểm tra trước công bố'),
      edge('video-moderation', 'video-tags', 'bản nháp được duyệt'),
      edge('video-tags', 'video-publish', 'tags đã xác thực'),
      edge('catalog-reference', 'video-tags', 'trạng thái catalog', 'dashed'),
      edge('video-publish', 'video-feed', 'phiên bản đã công bố'),
      edge('video-feed', 'video-commerce', 'khám phá và nhấp'),
      edge('video-commerce', 'video-evidence', 'bằng chứng đơn hàng', 'dotted'),
      edge(
        'video-publish',
        'video-moderation',
        'tín hiệu sau công bố',
        'dashed',
      ),
      edge(
        'video-moderation',
        '2-05-backend-remediation',
        'hành động hoặc khiếu nại',
      ),
      edge(
        'video-moderation',
        'video-evidence',
        'bằng chứng quyết định',
        'dotted',
      ),
      edge(
        '2-05-backend-remediation',
        'video-evidence',
        'bằng chứng khiếu nại',
        'dotted',
      ),
    ],
  ),
  spec(
    '2-06-backend',
    'Lên lịch LIVE, ingest, thương mại trong phiên hoạt động, tương tác khán giả, chuyển đổi, khôi phục an toàn, replay và bằng chứng kiểm duyệt.',
    [
      column(
        'Chuẩn bị stream',
        node(
          'live-prepare',
          'CN-048 Chuẩn bị',
          'Lên lịch/preflight/ingest mở rộng hạ tầng media cùng quyền của Creator.',
          'creator',
          'Mở rộng',
        ),
      ),
      column(
        'Mở phiên',
        node(
          'live-metadata',
          'CN-049 Metadata phiên',
          'Metadata tạo snapshot tiêu đề, lịch, disclosure, Host và chính sách kiểm duyệt.',
          'creator',
          'Mới',
        ),
        node(
          'live-session',
          'Phiên LIVE',
          'Phiên LIVE có các trạng thái rõ ràng: scheduled, active, reconnecting, ended và failed.',
          'system',
          'Mới',
        ),
      ),
      column(
        'Bán hàng LIVE',
        node(
          'live-products',
          'CN-050 Sản phẩm',
          'Ghim sản phẩm/khay sản phẩm phân giải giá, tồn kho, người bán và ngữ cảnh Affiliate chuẩn tắc.',
          'seller',
          'Mới',
        ),
        node(
          'live-chat',
          'CN-051 Tương tác Chat / Q&A',
          'Chat/Q&A mở rộng nhắn tin realtime với kiểm duyệt và phạm vi phiên.',
          'creator',
          'Mở rộng',
        ),
      ),
      column(
        'Chuyển đổi & khắc phục',
        node(
          'live-conversion',
          'CN-052 Chuyển đổi',
          'Chuyển đổi khám phá liên kết phiên, tương tác sản phẩm, điểm chạm và dòng đơn hàng.',
          'money',
          'Mới',
        ),
        node(
          '2-06-backend-remediation',
          'Khôi phục stream an toàn',
          'Thử lại an toàn xử lý reconnect hoặc stream đã kết thúc mà không trùng sự kiện thương mại.',
          'system',
          'Mở rộng',
        ),
      ),
      column(
        'Bằng chứng',
        node(
          'live-recording',
          'Bản ghi / replay',
          'Phiên kết thúc bắt đầu xử lý bản ghi; bản ghi sẵn sàng trở thành replay cùng trạng thái kiểm duyệt.',
          'system',
          'Mới',
        ),
        node(
          'live-evidence',
          'Bằng chứng kiểm duyệt',
          'Bằng chứng replay/kiểm duyệt giữ phiên bản stream, hành động chat, sự kiện thương mại và tham chiếu.',
          'ops',
          'Mới',
        ),
      ),
    ],
    [
      edge('live-prepare', 'live-metadata', 'preflight đạt yêu cầu'),
      edge('live-metadata', 'live-session', 'mở phiên live'),
      edge('live-session', 'live-products', 'phiên đang active'),
      edge('live-products', 'live-chat', 'ngữ cảnh sản phẩm active'),
      edge('live-chat', 'live-conversion', 'Viewer mua hàng', 'dashed'),
      edge('live-session', '2-06-backend-remediation', 'mất kết nối'),
      edge(
        '2-06-backend-remediation',
        'live-session',
        'tiếp tục an toàn',
        'dashed',
      ),
      edge('live-session', 'live-recording', 'phiên đã kết thúc', 'dashed'),
      edge(
        'live-conversion',
        'live-evidence',
        'bằng chứng chuyển đổi',
        'dotted',
      ),
      edge('live-recording', 'live-evidence', 'bằng chứng replay', 'dotted'),
      edge(
        '2-06-backend-remediation',
        'live-evidence',
        'bằng chứng khôi phục',
        'dotted',
      ),
    ],
  ),
  spec(
    '2-07-backend',
    'Người bán tham gia PPS, quản lý phiên bản tỷ lệ sản phẩm, khám phá Creator, liên hệ theo consent, thu hồi, hết hạn và audit.',
    [
      column(
        'Xét người bán đủ điều kiện',
        node(
          'pps-terms',
          'CN-053 Điều khoản PPS',
          'Điều kiện PPS/điều khoản liên kết người bán, chấp nhận cấp vốn và phiên bản chương trình hiệu lực.',
          'seller',
          'Mới',
        ),
      ),
      column(
        'Tham gia & cấu hình',
        node(
          'pps-enrollment',
          'Tham gia chương trình',
          'Việc tham gia ghi điều khoản đã chấp nhận, tác nhân, thời điểm hiệu lực và trạng thái hiện tại.',
          'seller',
          'Mới',
        ),
        node(
          'pps-rate',
          'CN-054 Tỷ lệ',
          'Phiên bản sản phẩm/tỷ lệ mở rộng catalog hiện có mà không ghi đè sự thật sản phẩm.',
          'money',
          'Mở rộng',
        ),
      ),
      column(
        'Tìm Creator',
        node(
          'creator-discovery',
          'CN-055 Khám phá Creator',
          'Khám phá Creator/chat dùng dữ liệu hồ sơ an toàn theo quyền và nhắn tin nội bộ.',
          'seller',
          'Mở rộng',
        ),
      ),
      column(
        'Liên hệ an toàn',
        node(
          'contact-consent',
          'CN-056 Đồng ý liên hệ',
          'Đồng ý liên hệ nêu rõ mục đích, phạm vi, quyền cấp, thời hạn hết hạn và trạng thái.',
          'creator',
          'Mới',
        ),
        node(
          '2-07-backend-remediation',
          'Thu hồi consent an toàn',
          'Thu hồi/hết hạn an toàn ẩn liên hệ ngoài nền tảng nhưng giữ chat được phép và audit.',
          'creator',
          'Mới',
        ),
      ),
      column(
        'Bằng chứng',
        node(
          'pps-evidence',
          'Audit đồng ý liên hệ',
          'Audit giữ điều khoản, phiên bản tỷ lệ, mục đích truy cập, kết quả consent và tham chiếu thu hồi.',
          'system',
          'Hiện có',
        ),
      ),
    ],
    [
      edge('pps-terms', 'pps-enrollment', 'chấp nhận điều khoản'),
      edge('pps-enrollment', 'creator-discovery', 'chương trình active'),
      edge('pps-rate', 'creator-discovery', 'tỷ lệ đã công bố'),
      edge('creator-discovery', 'contact-consent', 'yêu cầu liên hệ'),
      edge(
        'creator-discovery',
        '2-07-backend-remediation',
        'consent đã thu hồi',
      ),
      edge('contact-consent', 'pps-evidence', 'bằng chứng consent', 'dotted'),
      edge(
        '2-07-backend-remediation',
        'pps-evidence',
        'bằng chứng thu hồi',
        'dotted',
      ),
    ],
  ),
  spec(
    '2-08-backend',
    'Hợp đồng cộng tác có phiên bản, phí đã cấp vốn, hoàn tất hàng mẫu, nghiệm thu sản phẩm bàn giao, giải ngân, hủy, tranh chấp và bằng chứng.',
    [
      column(
        'Bắt đầu cộng tác',
        node(
          'conversation',
          'CN-057 Cuộc hội thoại',
          'Cuộc hội thoại mở rộng nhắn tin nội bộ bằng ngữ cảnh cộng tác và tác nhân.',
          'creator',
          'Mở rộng',
        ),
      ),
      column(
        'Hợp đồng & cấp vốn',
        node(
          'proposal',
          'CN-058 Đề xuất',
          'Đề xuất/hợp đồng giữ các bản sửa đổi bất biến, chấp nhận, sản phẩm bàn giao và quyền sử dụng.',
          'seller',
          'Mới',
        ),
        node(
          'funded-fee',
          'CN-060 Phí đã cấp vốn',
          'Phí đã cấp vốn ghi tham chiếu nhà cung cấp và điều kiện giải ngân mà không tuyên bố số dư gộp.',
          'money',
          'Mới',
        ),
      ),
      column(
        'Hoàn tất hàng mẫu',
        node(
          'sample',
          'CN-059 Sample / Hàng mẫu',
          'Vận chuyển hàng mẫu PPP mới tái dùng adapter giao hàng/theo dõi; không dùng fulfillment thương mại nếu thiếu ADR.',
          'seller',
          'Mới',
        ),
      ),
      column(
        'Nghiệm thu & khắc phục',
        node(
          'deliverable',
          'CN-061 Sản phẩm bàn giao',
          'Sản phẩm bàn giao/xét duyệt tham chiếu phiên bản hợp đồng đã chấp nhận trước khi CN-062 giải ngân.',
          'creator',
          'Mới',
        ),
        node(
          '2-08-backend-remediation',
          'CN-063–065 Khắc phục',
          'Hủy/tranh chấp an toàn giữ bất biến bằng chứng hợp đồng, phí đã cấp vốn, hàng mẫu và xét duyệt.',
          'ops',
          'Mới',
        ),
      ),
      column(
        'Bằng chứng',
        node(
          'collaboration-evidence',
          'Bằng chứng giải ngân',
          'Giải ngân và bằng chứng liên kết việc chấp nhận, số tiền, tham chiếu sổ cái, tác nhân và thời gian.',
          'money',
          'Mở rộng',
        ),
      ),
    ],
    [
      edge('conversation', 'proposal', 'đàm phán'),
      edge('proposal', 'sample', 'hợp đồng đã chấp nhận'),
      edge('funded-fee', 'sample', 'đã xác nhận cấp vốn', 'dashed'),
      edge('sample', 'deliverable', 'hàng mẫu đã giao'),
      edge('deliverable', 'collaboration-evidence', 'giải ngân'),
      edge('sample', '2-08-backend-remediation', 'hủy hoặc tranh chấp'),
      edge(
        'funded-fee',
        'collaboration-evidence',
        'bằng chứng tài chính',
        'dotted',
      ),
      edge(
        '2-08-backend-remediation',
        'collaboration-evidence',
        'bằng chứng tranh chấp',
        'dotted',
      ),
    ],
  ),
  spec(
    '2-09-backend',
    'Onboarding MCN, tư cách thành viên có consent, RBAC hiệu lực, phân công chiến dịch, báo cáo, phân chia doanh thu, quyết toán, thông báo và audit.',
    [
      column(
        'Nộp đăng ký',
        node(
          'mcn-application',
          'CN-066 Đơn đăng ký MCN',
          'Đơn đăng ký MCN ghi định danh agency, thẩm quyền, điều khoản và trạng thái xét duyệt.',
          'mcn',
          'Mới',
        ),
      ),
      column(
        'Xây roster',
        node(
          'membership',
          'CN-067 Tư cách thành viên',
          'Lời mời roster/tư cách thành viên yêu cầu Creator chấp nhận và có ngày hiệu lực.',
          'mcn',
          'Mới',
        ),
      ),
      column(
        'Phân quyền công việc',
        node(
          'mcn-rbac',
          'CN-069 Phân quyền RBAC',
          'RBAC mở rộng primitive vai trò hiện có bằng phạm vi roster và tài chính.',
          'mcn',
          'Mở rộng',
        ),
        node(
          'mcn-assignment',
          'CN-068 Phân công',
          'Phân công tham chiếu tư cách thành viên active, phạm vi vai trò, chiến dịch và thời gian.',
          'mcn',
          'Mới',
        ),
      ),
      column(
        'Ghi nhận & khắc phục',
        node(
          'mcn-revenue',
          'CN-070–071 Báo cáo doanh thu',
          'Báo cáo và phân chia dùng phiên bản phân chia doanh thu bất biến cho từng dòng thu nhập.',
          'money',
          'Mới',
        ),
        node(
          '2-09-backend-remediation',
          'Thu hồi thành viên an toàn',
          'Thu hồi hoặc khiếu nại an toàn cập nhật quyền hiệu lực mà không xóa phân công lịch sử.',
          'ops',
          'Mở rộng',
        ),
      ),
      column(
        'Bằng chứng',
        node(
          'mcn-settlement',
          'CN-072 Quyết toán',
          'Quyết toán/thông báo/audit liên kết phiên bản phân chia, số tiền, người nhận, trạng thái và tham chiếu.',
          'money',
          'Mở rộng',
        ),
      ),
    ],
    [
      edge('mcn-application', 'membership', 'agency đã được duyệt'),
      edge('membership', 'mcn-rbac', 'thành viên đã chấp nhận'),
      edge('mcn-rbac', 'mcn-assignment', 'phạm vi đã cấp quyền'),
      edge('mcn-assignment', 'mcn-revenue', 'kết quả chiến dịch', 'dashed'),
      edge('membership', '2-09-backend-remediation', 'rời hoặc thu hồi'),
      edge('mcn-revenue', 'mcn-settlement', 'quyết toán phân chia', 'dashed'),
      edge('mcn-rbac', 'mcn-settlement', 'bằng chứng truy cập', 'dotted'),
      edge(
        '2-09-backend-remediation',
        'mcn-settlement',
        'bằng chứng thay đổi',
        'dotted',
      ),
    ],
  ),
  spec(
    '2-10-backend',
    'Tích lũy thu nhập được duyệt, đối soát kỳ mở, cổng người nhận tiền, phân bổ giữ lại/payable, sao kê bất biến, payout, khắc phục và bằng chứng bù trừ.',
    [
      column(
        'Tích lũy',
        node(
          'approved-earning',
          'Thu nhập được duyệt',
          'Bút toán Affiliate đã duyệt đi vào kỳ mở để đối soát trước khi qua cổng người nhận tiền.',
          'money',
          'Mới',
        ),
        node(
          'wallet-period',
          'Wallet / kỳ mở',
          'Wallet và kỳ mở tổng hợp số dư sổ phụ Affiliate nhưng không tạo giá trị lưu trữ có thể chuyển nhượng.',
          'money',
          'Mới',
        ),
      ),
      column(
        'Đối soát & kiểm tra',
        node(
          'reconciliation',
          'Đối soát',
          'Dữ kiện đơn hàng, refund, journal và nhà cung cấp được đối soát trước khi khóa kỳ.',
          'money',
          'Mở rộng',
        ),
        node(
          'payment-gates',
          'CN-077 Cổng người nhận tiền',
          'Cổng định danh/thuế/thanh toán chỉ dùng trạng thái nhà cung cấp đã che sau khi đối soát kỳ.',
          'money',
          'Mở rộng',
        ),
      ),
      column(
        'Phân loại phân bổ',
        node(
          'held-payout',
          'Giữ lại',
          'Cổng người nhận, rủi ro hoặc ngưỡng tối thiểu không đạt sẽ giữ lại phân bổ cùng lý do an toàn.',
          'money',
          'Mới',
        ),
        node(
          'payable-payout',
          'Đủ điều kiện payable',
          'Cổng đã đạt tạo phân bổ payable được cấp vốn nhưng chưa thực hiện chuyển tiền.',
          'money',
          'Mới',
        ),
      ),
      column(
        'Sao kê, trả tiền & khắc phục',
        node(
          'statement',
          'CN-073 Sao kê',
          'Sao kê tạo snapshot số đầu kỳ, thu nhập, điều chỉnh, khấu trừ, phân bổ payout và số cuối kỳ.',
          'money',
          'Mới',
        ),
        node(
          'provider-payout',
          'Payout qua nhà cung cấp',
          'Payout qua nhà cung cấp và đối soát dùng kết quả bất đồng bộ chuẩn tắc.',
          'money',
          'Hiện có',
        ),
        node(
          '2-10-backend-remediation',
          'CN-074–076 Khắc phục',
          'Hành động thông báo/giữ lại/thử lại/điều chỉnh an toàn dùng lệnh idempotent và mã lý do.',
          'ops',
          'Mở rộng',
        ),
      ),
      column(
        'Bằng chứng',
        node(
          'payout-evidence',
          'Bằng chứng bù trừ',
          'Bằng chứng bù trừ liên kết sao kê, sự kiện nhà cung cấp, đối soát và bút toán điều chỉnh.',
          'system',
          'Mở rộng',
        ),
      ),
    ],
    [
      edge('approved-earning', 'wallet-period', 'đi vào kỳ mở'),
      edge('wallet-period', 'reconciliation', 'đối soát rồi khóa'),
      edge('reconciliation', 'payment-gates', 'kỳ đã khóa'),
      edge('payment-gates', 'held-payout', 'bị giữ lại'),
      edge('payment-gates', 'payable-payout', 'đủ điều kiện'),
      edge('held-payout', '2-10-backend-remediation', 'hành động an toàn'),
      edge('payable-payout', 'statement', 'snapshot phân bổ'),
      edge('statement', 'provider-payout', 'payout đã cấp vốn'),
      edge(
        'provider-payout',
        'payout-evidence',
        'kết quả nhà cung cấp',
        'dashed',
      ),
      edge(
        'provider-payout',
        '2-10-backend-remediation',
        'thất bại / bút toán bù trừ',
      ),
      edge('statement', 'payout-evidence', 'bằng chứng sao kê', 'dotted'),
      edge(
        '2-10-backend-remediation',
        'payout-evidence',
        'bằng chứng điều chỉnh',
        'dotted',
      ),
    ],
  ),
  spec(
    '2-11-backend',
    'Bằng chứng gian lận quan sát được, phân loại rủi ro, đồ thị thực thể, chính sách qua xác thực thực địa, thực thi, khiếu nại, thu hồi và bằng chứng được bảo toàn.',
    [
      column(
        'Tiếp nhận báo cáo',
        node(
          'fraud-report',
          'CN-080 Báo cáo',
          'Báo cáo/bằng chứng chỉ nhận dữ kiện trong phạm vi và bảo vệ dữ liệu người báo cáo lẫn đối tượng.',
          'ops',
          'Mới',
        ),
      ),
      column(
        'Điều tra',
        node(
          'risk-triage',
          'Phân loại rủi ro',
          'Phân loại rủi ro mở rộng xử lý case Admin bằng mức ưu tiên, người phụ trách và SLA.',
          'ops',
          'Mở rộng',
        ),
        node(
          'entity-graph',
          'Đồ thị thực thể',
          'Đồ thị thực thể hiển thị quan hệ được phép và bằng chứng nguồn mà không lộ dữ liệu thô nhạy cảm.',
          'ops',
          'Mới',
        ),
      ),
      column(
        'Quyết định',
        node(
          'risk-policy',
          'CN-078–079 Chính sách',
          'Chính sách quyết định cần xác thực thực địa; không tuyên bố parity cho ngưỡng hay mô hình không quan sát được.',
          'ops',
          'Cổng xác thực thực địa',
        ),
      ),
      column(
        'Thực thi & khắc phục',
        node(
          'enforcement',
          'CN-081 Thực thi',
          'Hành động giữ lại/đảo ngược/thực thi có phạm vi, idempotent, xác nhận và mã lý do.',
          'ops',
          'Mới',
        ),
        node(
          '2-11-backend-remediation',
          'Khiếu nại thực thi an toàn',
          'Khiếu nại an toàn giữ quyết định ban đầu hiệu lực đến khi có kết quả được cấp quyền.',
          'creator',
          'Mới',
        ),
      ),
      column(
        'Bằng chứng',
        node(
          'recall',
          'CN-082 Thu hồi',
          'Thu hồi/gỡ bỏ và bằng chứng được bảo toàn giữ chính sách, tác nhân, phạm vi, thời gian và tham chiếu.',
          'ops',
          'Mở rộng',
        ),
      ),
    ],
    [
      edge('fraud-report', 'risk-triage', 'mở case điều tra'),
      edge('entity-graph', 'risk-policy', 'dữ kiện được phép'),
      edge('risk-triage', 'risk-policy', 'case đã phân loại'),
      edge('risk-policy', 'enforcement', 'quyết định đã duyệt'),
      edge('risk-policy', '2-11-backend-remediation', 'đường khiếu nại'),
      edge('risk-policy', 'recall', 'bằng chứng quyết định', 'dotted'),
      edge('enforcement', 'recall', 'bằng chứng hành động', 'dotted'),
      edge(
        '2-11-backend-remediation',
        'recall',
        'bằng chứng khiếu nại',
        'dotted',
      ),
    ],
  ),
  spec(
    '2-12-backend',
    'Property ngoài nền tảng đã xác minh, hỗ trợ disclosure, OAuth theo phạm vi quyền, đồng bộ catalog/feed, gắn tag ngoài nền tảng, báo cáo, ngắt kết nối và audit sức khỏe.',
    [
      column(
        'Xác minh property',
        node(
          'property',
          'CN-083 Đăng ký property',
          'Đăng ký property/xác minh ghi chủ sở hữu, định danh chuẩn, phương thức và kết quả.',
          'creator',
          'Mới',
        ),
        node(
          'disclosure',
          'Hỗ trợ disclosure',
          'Hỗ trợ disclosure trình bày hướng dẫn chính sách mà không tự chứng nhận nội dung Creator.',
          'creator',
          'Mới',
        ),
      ),
      column(
        'Cho phép kênh',
        node(
          'oauth',
          'CN-084 Kết nối OAuth',
          'OAuth/phạm vi quyền mở rộng ủy quyền nhà cung cấp bằng quyền tối thiểu và trạng thái thu hồi.',
          'system',
          'Mở rộng',
        ),
      ),
      column(
        'Đồng bộ & gắn tag',
        node(
          'catalog-sync',
          'YouTube feed / tag mới',
          'Tích hợp mới chỉ tái sử dụng đọc catalog chuẩn tắc; đồng bộ feed, điều kiện và vòng đời tag ngoài nền tảng thuộc Affiliate.',
          'seller',
          'Mới',
        ),
      ),
      column(
        'Phân phối & khắc phục',
        node(
          'channel-report',
          'Báo cáo kênh',
          'Báo cáo lượt nhấp/đơn hàng/thu nhập giữ nguồn ngoài nền tảng và kết quả thương mại chuẩn tắc.',
          'money',
          'Mới',
        ),
        node(
          '2-12-backend-remediation',
          'Ngắt kết nối an toàn',
          'Ngắt kết nối/kết nối lại an toàn giữ lịch sử và hiển thị trạng thái sức khỏe có thể xử lý.',
          'system',
          'Mở rộng',
        ),
      ),
      column(
        'Bằng chứng',
        node(
          'external-evidence',
          'Audit kênh',
          'Audit giữ bằng chứng property, phiên bản phạm vi quyền, cursor đồng bộ, tag, báo cáo và tham chiếu ngắt kết nối.',
          'system',
          'Mở rộng',
        ),
      ),
    ],
    [
      edge('property', 'oauth', 'property đã xác minh'),
      edge('disclosure', 'oauth', 'đã xác nhận chính sách'),
      edge('oauth', 'catalog-sync', 'phạm vi quyền đã cấp'),
      edge(
        'catalog-sync',
        'channel-report',
        'thương mại ngoài nền tảng',
        'dashed',
      ),
      edge('oauth', '2-12-backend-remediation', 'thu hồi hoặc hết hạn'),
      edge(
        'channel-report',
        'external-evidence',
        'bằng chứng báo cáo',
        'dotted',
      ),
      edge(
        '2-12-backend-remediation',
        'external-evidence',
        'bằng chứng ngắt kết nối',
        'dotted',
      ),
    ],
  ),
] as const satisfies readonly TDiagramSpec[];
