# Thiết kế lại sơ đồ SRS tiếng Việt và dễ đọc trên Notion

**Ngày:** 18/07/2026  
**Trạng thái:** Đã được người dùng duyệt; đang triển khai
**Phạm vi:** 28 SVG kỹ thuật của SRS Benadep Affiliate & Creator Commerce  
**Thiết kế gốc:** `2026-07-18-notion-srs-visual-diagrams-design.md`

## 1. Vấn đề cần sửa

Bộ 28 SVG hiện tại đúng về inventory và phần lớn traceability, nhưng chưa đạt mục tiêu sử dụng thực tế trên Notion:

- nội dung hiển thị chủ yếu bằng tiếng Anh;
- canvas ngang `1600 × 900` chứa 4–5 cột nên Notion thu nhỏ toàn bộ ảnh;
- font nội dung 15–22 px trở nên quá nhỏ ở chiều rộng trang Notion;
- một số sơ đồ chứa 19 node và 23 edge trong cùng một khung;
- same-column edge, back-edge và label pill dùng chung gutter nên tạo cảm giác đường nối chồng chéo;
- mô tả node bị rút còn hai dòng và dùng dấu `…`, làm mất chi tiết đúng lúc người đọc cần hiểu luồng.

Đợt sửa này là hiệu chỉnh presentation và khả năng đọc. Baseline chức năng, mã `SP/CN/QT/MH/KT`, source-fit decision và component contracts không thay đổi.

## 2. Quyết định thiết kế

Sử dụng **một SVG khổ dọc hai tầng cho mỗi target hiện tại**. Không tăng số lượng ảnh và không tách thêm trang.

- ViewBox chuẩn: `0 0 1400 1800`.
- Mỗi ảnh có hai flow band xếp dọc.
- Mỗi band có tối đa ba cột.
- Sơ đồ bốn cột được chia `2 + 2`; sơ đồ năm cột được chia `3 + 2`.
- Mỗi band sử dụng gần toàn bộ chiều rộng Notion, nhờ đó node và chữ không còn bị ép vào năm cột nhỏ.
- Mỗi semantic edge có một mã ổn định; marker trong flow chỉ hiện mã, còn footer edge directory hiển thị đầy đủ mã và ý nghĩa của mọi edge.
- Giữ đúng 28 SVG mới và 29 visual blocks tổng cộng, bao gồm infographic master cũ.

## 3. Quy tắc Việt hóa

Toàn bộ nội dung phục vụ đọc hiểu trong SVG phải dùng tiếng Việt:

- tiêu đề ảnh và mô tả phạm vi;
- tên cột;
- nhãn và mô tả node;
- code-only marker trên connector hoặc trong node sở hữu reference, cùng nhãn đầy đủ trong footer edge directory;
- badge trạng thái;
- chú giải và cảnh báo ở footer;
- alt text, caption và heading `## Sơ đồ — ...` trên Notion.

Các nội dung sau được giữ nguyên:

- mã `SP-xxx`, `CN-xxx`, `QT-xxx`, `MH-xxx`, `KT-xxx`;
- URL route, API endpoint, event name, package/path source code;
- tên sản phẩm hoặc surface như `Storefront`, `Vendor Portal`, `Medusa Admin`, `YouTube`, `OAuth`, `BFF/API`;
- thuật ngữ kỹ thuật phổ biến khi việc dịch làm giảm độ chính xác, ví dụ webhook, replay, ledger, RBAC và idempotency. Phần diễn giải xung quanh vẫn phải bằng tiếng Việt.

Giữ nguyên định danh và khoảng số của `codeRange`, nhưng phần mô tả tiếng Anh gắn sau mã phải được Việt hóa; ví dụ `SP-001–SP-084 overview` trở thành `SP-001–SP-084 — tổng quan`.

Badge chuẩn:

| Hiện tại | Sau khi Việt hóa |
|---|---|
| `New` | `Mới` |
| `Extend` | `Mở rộng` |
| `Existing` | `Hiện có` |
| `Field-validation gate` | `Cổng xác thực thực địa` |

Không dùng bản dịch để tuyên bố biết thuật toán bí mật, ranking hoặc anti-fraud nội bộ của Shopee. Các nội dung không quan sát được vẫn phải ghi rõ là proposed default có version/audit và cần xác thực thực địa.

## 4. Bố cục và typography

Canvas được chia thành các vùng cố định:

| Vùng | Khoảng dọc | Nội dung |
|---|---:|---|
| Header | `0–145` | Tiêu đề, code range, mô tả phạm vi |
| Band 1 | `155–845` | Nửa đầu luồng |
| Handoff | `845–900` | Khoảng tách thị giác giữa hai band; không có path xuyên band |
| Band 2 | `900–1590` | Nửa sau luồng |
| Footer | `1610–1800` | Edge directory đầy đủ và cảnh báo normative text |

Kích thước chữ tối thiểu:

| Thành phần | Cỡ chữ |
|---|---:|
| Tiêu đề ảnh | 46 px |
| Code range / subtitle | 30 px |
| Mô tả phạm vi | 24 px |
| Tiêu đề cột | 26 px |
| Tên node | 30 px |
| Chi tiết node | 24 px, line-height 28 px |
| Badge | 20 px |
| Mã connector / edge directory | 22 px |
| Chú giải/footer | 22 px |

Node được tăng chiều cao theo số dòng thực tế, tối đa hai dòng tiêu đề và bốn dòng chi tiết. Cột mật độ cao có thể buộc câu chi tiết ngắn hơn để bốn node vẫn vừa band, nhưng không được bỏ yêu cầu hoặc đổi nghĩa. Không cắt nội dung bằng dấu `…`. Nếu nội dung hoặc toàn cột không vừa, generation phải thất bại và yêu cầu biên tập lại câu chữ thay vì âm thầm truncate.

Đường dẫn, route và mã dài được phép ngắt tại dấu phân cách như `/`, `.`, `-` mà không làm mất hoặc thay đổi ký tự. Layout engine phải tính trước rectangle cho header, tiêu đề cột, tiêu đề/chi tiết/badge node, code-only marker của local path, reference chip trong owner node và từng cell của footer edge directory; renderer chỉ dùng metadata này, không tự tính lại vị trí chữ.

## 5. Routing không chồng chéo

Mỗi semantic edge được cấp mã ổn định theo thứ tự xuất hiện trong `spec.edges`. Visible marker trong flow luôn là **code-only**; nhãn đầy đủ chỉ xuất hiện trong footer edge directory. Routing được chuẩn hóa như sau:

1. **Forward edge trong cùng band:** đường orthogonal đi qua gutter giữa hai cột; mỗi edge có lane riêng và mã local `L1`, `L2`,... đặt trên connector rail.
2. **Same-column edge:** đi theo side rail của cột; ở cột giữa phải thử cả hai phía và chỉ dùng cặp `S1`, `S2`,... khi cả hai rail đều bị chặn bởi local path nằm bên trong span. Các rail vẽ được tiếp tục dùng dãy mã local `L*`.
3. **Forward edge bỏ qua một cột:** dùng cặp reference marker `N1`, `N2`,... thay vì kéo path xuyên cột trung gian.
4. **Cross-band edge:** không kéo một đường dài qua hai tầng; hai đầu chỉ hiển thị cùng mã `①`, `②`,... trong node nguồn và node đích tương ứng.
5. **Back-edge:** dùng cặp reference marker `R1`, `R2`,... thay cho đường quay ngược xuyên sơ đồ.
6. **Audit/evidence edge:** dùng cặp evidence marker `E1`, `E2`,... thay cho nhãn dài tại node nguồn hoặc node bằng chứng.
7. **Async/webhook edge:** chỉ vẽ nét đứt khi nằm trong cùng band, nối hai cột kề nhau và có lane trống; trường hợp local này dùng mã `L*`, còn các trường hợp khác dùng cặp marker `A1`, `A2`,...

Marker `L*` phải nằm trong gutter stripe được cấp phát cho local path. Mỗi endpoint reference phải nằm **bên trong đúng owner node**, sau phần title/detail/badge; source chip đứng trước target chip và tối đa bốn chip mỗi hàng. Layout phải tính các hàng chip vào chiều cao node để không giao text, badge hay nội dung khác. Cả hai endpoint vẫn có SVG `<title>` chứa nhãn edge đầy đủ để hỗ trợ accessibility, nhưng `<title>` không thay thế edge directory hiển thị.

Footer edge directory liệt kê **mọi edge** theo đúng thứ tự `spec.edges`, mỗi entry có dạng `{code} — {edge.label}`. Directory dùng tối đa bốn cột và sáu hàng, tức tối đa 24 edge; thứ tự đọc là row-major. Mỗi entry phải vừa đúng một dòng 22 px, không wrap, truncate hoặc dùng ellipsis. Generation phải thất bại nếu có hơn 24 edge hoặc nếu bất kỳ entry, directory hay cảnh báo footer nào không vừa vùng `1610–1800`.

Thứ tự phân loại bắt buộc giữ nghĩa của edge trước vị trí: edge `dotted` luôn dùng `E*`; edge `dashed` chỉ được vẽ khi đi tới cột liền kề trong cùng band, còn lại dùng `A*`; sau đó edge `solid` mới lần lượt xét cross-band `①`, back-edge `R*`, forward jump `N*`, same-column rail/`S*` fallback hoặc forward lane.

## 6. Mô hình dữ liệu và renderer

Semantic specs tiếp tục là nguồn sự thật cho 28 sơ đồ. Thay đổi chính:

- bổ sung lớp localization để toàn bộ visible copy được định nghĩa bằng tiếng Việt;
- renderer tự chia `columns` thành hai band theo quy tắc `2 + 2` hoặc `3 + 2`;
- edge classifier quyết định một edge được vẽ bằng local path hay bằng reference pair, đồng thời cấp mã ổn định `L*`, `①`, `N*`, `R*`, `E*` hoặc `A*` theo thứ tự source spec;
- semantic node order được giữ nguyên mặc định; chỉ cột khai báo rõ `allowVisualReorder: true` mới được phép đổi thứ tự trình bày để giảm crossing;
- layout engine cấp phát node rectangle, gutter path/marker, reference chip trong owner node và footer edge-directory cell trước khi render;
- validator dùng chính layout metadata để kiểm tra collision thay vì chỉ tìm chuỗi trong SVG;
- manifest đổi title, alt và caption sang tiếng Việt nhưng giữ nguyên `key`, `filename`, `pageId`, code range và insertion target.

Không thêm thư viện runtime. Toolchain vẫn chạy bằng Node 22 TypeScript và sinh SVG deterministic.

## 7. Kiểm thử bắt buộc

Thực hiện theo TDD: thêm test thất bại trước mỗi thay đổi production.

### 7.1 Localization contract

- 28/28 spec có title, scope, column, node, edge label và footer tiếng Việt;
- không còn các câu tiếng Anh cũ trong visible text;
- allowlist chỉ chứa code, route, API/path và proper noun đã nêu;
- badge chỉ dùng bốn nhãn tiếng Việt chuẩn.

### 7.2 Legibility contract

- viewBox chính xác `0 0 1400 1800`;
- không quá ba cột trong một band;
- font nhỏ nhất 20 px, font nội dung node ít nhất 24 px;
- không có dấu ellipsis do renderer tạo;
- mọi node detail vừa tối đa bốn dòng;
- mọi footer directory entry giữ nguyên toàn bộ `{code} — {edge.label}`, không truncate, và directory không vượt quá bốn cột × sáu hàng;
- contact sheet có preview ở chiều rộng tương đương Notion để review.

### 7.3 Geometry contract

- node rectangle không giao nhau;
- local marker/directory text rectangle không giao node hoặc nội dung khác ngoài gutter/cell sở hữu nó; reference chip phải nằm trong đúng owner node và không giao owner text/badge/control khác;
- path không đi qua node, trừ điểm neo tại source/target;
- không có hai path dùng cùng lane/segment;
- không có path quay ngược hoặc cross-band; các trường hợp đó bắt buộc dùng reference marker;
- marker pair xuất hiện đúng hai owner node, marker local xuất hiện đúng một lần trên gutter stripe của path sở hữu nó và không trùng mã trong cùng diagram;
- mỗi semantic edge có đúng một footer directory entry, cùng mã và đúng full label;
- path và marker nằm hoàn toàn phía trên footer (`y < 1610`); directory entry nằm trong footer `1610–1800`; tất cả geometry nằm trong canvas bounds.

### 7.4 Content preservation

- đủ 28 target, 12 backend, 12 UI, 2 Page 1 và 2 Page 4;
- 59/59 MH vẫn xuất hiện đúng một lần trong primary nodes;
- money lifecycle vẫn giữ sáu thuật ngữ trạng thái và phân biệt `reversed` là compensating entry;
- native parity vẫn cần ADR, implementation và authenticated evidence;
- MCN vẫn map vào `apps/storefront/src/app/mcn/*`;
- Sample và YouTube feed/tag không bị đổi lại thành `Existing`.

## 8. Quy trình thay ảnh trên Notion

Không chèn thêm block mới. Với từng target:

1. fetch trang hiện tại;
2. xác nhận đúng một heading, filename, alt, caption và image block cũ;
3. upload SVG tiếng Việt mới;
4. dùng `update_content` với exact `old_str/new_str` để thay toàn bộ visual block cũ bằng visual block mới;
5. fetch lại ngay và xác nhận image count không tăng;
6. xác nhận version vẫn là `0.5`, anchor và nội dung sau ảnh còn nguyên.

Sau 28 lần thay, audit lại:

- 28 ảnh mới và 29 visual blocks tổng cộng;
- Page 1/Page 4 mỗi trang hai ảnh; Page 2/Page 3 mỗi trang một ảnh;
- không còn heading, caption hoặc alt tiếng Anh cũ;
- 26 child pages, 59 MH, 59 component contracts và 470 component rows còn nguyên;
- không có attachment, heading, filename hoặc caption trùng.

Master giữ phiên bản `0.5` vì đây là đợt hiệu chỉnh trong cùng vòng review, không thay đổi đường cơ sở chức năng. Dòng changelog `0.5` được cập nhật để ghi nhận ảnh đã được Việt hóa và tái bố cục cho khả năng đọc.

## 9. Tiêu chí nghiệm thu

Thiết kế đạt khi:

1. Người đọc có thể đọc node detail ở chế độ Notion thông thường mà không phải mở ảnh hoặc zoom trình duyệt.
2. Toàn bộ nội dung đọc hiểu trong 28 ảnh là tiếng Việt theo allowlist đã chốt.
3. Geometry validator báo 0 node collision, 0 label collision và 0 shared path segment.
4. Không còn back-edge hoặc cross-band path; mọi trường hợp dùng reference marker rõ ràng.
5. Mọi edge có mã ổn định, marker code-only đúng owner và một entry `{code} — {edge.label}` đọc được trong footer; không entry nào bị truncate hoặc ellipsis.
6. Visual review đủ 28 ảnh ở preview 700 px và 1000 px không phát hiện chữ cắt, nét chồng hoặc marker khó theo dõi.
7. Notion giữ đúng 28 ảnh mới, version `0.5` và toàn bộ baseline nội dung hiện có.

## 10. Ngoài phạm vi

- thay đổi chức năng affiliate hoặc component contract;
- thay đổi thuật toán attribution, ranking hay anti-fraud;
- sửa source application của Benadep;
- xử lý concurrency timeout đang tồn tại trong test `trading-rpc`;
- deploy bất kỳ ứng dụng hoặc service nào.
