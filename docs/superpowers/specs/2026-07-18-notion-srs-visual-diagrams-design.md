# Thiết kế visual cho SRS Affiliate & Creator Commerce trên Notion

Ngày: 2026-07-18  
Tài liệu áp dụng: `SRS-BENA-AFF-US-001`  
Notion master: `3a0ad27c-8378-81ca-8720-ca59bfabf67f`  
Source baseline được SRS tham chiếu: `/Users/truongdn/Desktop/benadep`, branch `truongdn`, commit `7e548421`

## 1. Mục tiêu

Bổ sung visual có tính kỹ thuật cho toàn bộ SRS để Product, Engineering, QA, Legal, Finance và Operations có thể hiểu actor, boundary, state, navigation, money flow, evidence flow và traceability mà không phải suy luận từ các đoạn text dài.

Visual là lớp giải thích bổ sung. Page 1–4, các mã `SP/CN/QT/MH/KT` và component contract vẫn là normative requirement. Diagram không được tự tạo thêm chức năng, thay đổi outcome hoặc thay thế validation gate đã được mô tả trong SRS.

## 2. Phạm vi

Tạo 28 SVG mới và giữ lại infographic tổng thể hiện có:

| Nhóm tài liệu | Số visual mới | Nội dung |
|---|---:|---|
| Page 1 | 2 | System context & actor map; end-to-end data, money và evidence flow |
| Page 2.01–2.12 | 12 | Một domain/backend lifecycle diagram cho mỗi module |
| Page 3.01–3.12 | 12 | Một UI/navigation diagram cho mỗi module |
| Page 4 | 2 | Traceability chain; test/evidence release gate |
| Master | 0 | Giữ infographic hiện có và bổ sung link/caption nếu cần |

Tổng sau cập nhật: 29 visual, gồm 28 SVG mới và 1 infographic hiện có.

## 3. Phương pháp biểu diễn

SVG technical blueprint được chọn thay cho ảnh AI hoặc diagram dạng text vì nhãn, mã SRS, hướng mũi tên và boundary phải chính xác; hình phải sắc nét khi phóng to; và nội dung phải có thể kiểm tra bằng máy trước khi upload.

Mỗi SVG có kích thước viewBox `1600 × 900`, nền sáng, typography hệ thống, contrast tối thiểu 4.5:1 cho text chính và 3:1 cho đường viền/thành phần lớn. Text quan trọng không nhỏ hơn 18 px trong SVG gốc.

### 3.1 Màu actor/domain

| Màu | Phạm vi |
|---|---|
| Xanh dương | Creator/affiliate |
| Cam | Seller/vendor |
| Tím | MCN/Agency |
| Đỏ | Admin, Risk, Finance, Enforcement |
| Xanh lá | Commission, ledger, reconciliation, payout |
| Xám | Platform service, external provider và system boundary |

Màu không phải tín hiệu duy nhất. Mỗi node phải có label và icon hình học để diagram vẫn đọc được khi in grayscale hoặc với người dùng gặp khó khăn về phân biệt màu.

### 3.2 Mũi tên và boundary

| Ký hiệu | Nghĩa |
|---|---|
| Đường liền | Request, command hoặc navigation trực tiếp |
| Đường đứt | Async event, webhook, queue hoặc delayed processing |
| Đường chấm | Audit, evidence, immutable snapshot hoặc traceability |
| Khung bo tròn | UI surface hoặc aggregate/capability |
| Khung nét đôi | External provider/trust boundary |
| Badge góc phải | `Existing`, `Extend`, `New` hoặc `Field-validation gate` |

## 4. Cấu trúc visual theo trang

### 4.1 Page 1

1. **System context & actor map**: Creator, Seller, MCN, Buyer/Viewer, Admin/Risk/Finance, Benadep storefront/vendor/admin, affiliate domain, commerce domain, provider và external channel. Mũi tên chỉ rõ ai thao tác ở surface nào và dữ liệu nào đi qua trust boundary.
2. **End-to-end data, money & evidence flow**: asset/link/content → click/touchpoint → attribution decision → order-line commission → creator subledger → reconciliation → tax/payout; evidence/audit chạy song song và dẫn đến dispute/appeal.

### 4.2 Page 2.01–2.12

Mỗi Page 2 có một diagram đặt sau phần source implementation map và trước quy tắc chi tiết. Diagram gồm:

- actor hoặc upstream trigger;
- aggregate/capability chính theo phạm vi CN của module;
- state transition quan trọng và nhánh lỗi/held/rejected/appeal;
- service/API boundary theo source map trong SRS;
- async event/webhook nếu có;
- audit/evidence/version snapshot;
- source-fit badge để phân biệt phần đã có, cần mở rộng, phải tạo mới hoặc cần field validation.

Danh sách diagram:

1. Identity, Onboarding & Account Lifecycle — application, channel verification, review, active/suspended/reverification.
2. Dashboard, Offer, Commission Discovery & Referral — offer version, eligibility, enrollment, asset/referral creation và performance aggregation.
3. Link, Product Code, Collection & Reporting — asset generation, redirect/click evidence, conversion report và earning statement.
4. Attribution, Rate Snapshot & Ledger — candidate set, winner, immutable rate snapshot, order-line journal và adjustment.
5. Short Video Commerce — upload/transcode, product tagging, publish, discovery, conversion evidence, moderation/appeal.
6. LIVE Commerce — schedule/preflight, ingest, live session, product pin, viewer commerce, replay/moderation.
7. Seller PPS, Rate Configuration & Contact — enrollment, rate version, creator discovery và consent-scoped contact.
8. PPP, Collaboration, Sample & Seller Affiliate — proposal, contract version, sample shipment, deliverable acceptance và release.
9. MCN/Agency, Roster, RBAC & Revenue Split — application, membership, role/scope, assignment, split/settlement.
10. Reconciliation, Payout, Tax & Remediation — tax/payment setup, wallet, statement, provider reconciliation, hold/retry/correction.
11. Fraud, Policy, Enforcement & Appeals — report, triage, case graph, decision, enforcement, appeal và recall kill switch.
12. External Distribution & YouTube Shopping — property verification, OAuth, catalog/feed sync, external tagging và reporting.

### 4.3 Page 3.01–3.12

Mỗi Page 3 có một UI/navigation diagram đặt sau `Bản đồ màn hình` hoặc `Source UI/API map` và trước đặc tả MH đầu tiên. Diagram gồm:

- entry point và actor;
- tất cả mã `MH` thuộc module;
- route/surface boundary: storefront, vendor portal, Medusa Admin hoặc external OAuth;
- navigation trực tiếp, modal/drawer/bottom sheet và deep-link;
- loading, empty, error, permission-denied, held/rejected và appeal/remediation state có tác động tới navigation;
- API/BFF boundary và authoritative result;
- mobile-first path cho Video/LIVE, nhưng không được dùng responsive web để tự đóng native-app gate.

UI diagram không phải wireframe pixel-perfect và không sao chép Shopee trade dress. Component type, requirement, validation và binding tiếp tục lấy từ 470 component contract rows trong Page 3.

### 4.4 Page 4

1. **Traceability chain**: Shopee observable outcome → `SP` → `CN` → `QT` → `MH` hoặc non-UI surface → `KT` → automated/manual evidence. Field-validation gate được hiển thị là nhánh bắt buộc cho thuật toán/ranking/anti-fraud không quan sát được.
2. **Test/evidence release gate**: capability test, golden scenario, algorithm validation, security/accessibility/financial reconciliation, source-code gate và approval gate hội tụ vào release decision. Failed hoặc missing evidence không được chuyển thành empty/pass.

## 5. Tích hợp vào Notion

Mỗi hình được upload dưới dạng SVG attachment và chèn bằng image block, không dùng URL ngoài hoặc link tạm. Ngay dưới hình có caption gồm:

- tên diagram và phạm vi mã;
- cách đọc màu/mũi tên;
- tuyên bố “visual aid, normative text remains authoritative”;
- link tới trang đối ứng Page 2 hoặc Page 3 khi có.

SVG filename dùng format:

- `srs-page-1-system-context.svg`;
- `srs-page-1-end-to-end-flow.svg`;
- `srs-2-01-backend-lifecycle.svg` … `srs-2-12-backend-lifecycle.svg`;
- `srs-3-01-ui-navigation.svg` … `srs-3-12-ui-navigation.svg`;
- `srs-page-4-traceability.svg`;
- `srs-page-4-release-evidence-gate.svg`.

Không duplicate cùng một attachment cho nội dung khác nhau. Alt text phải mô tả mục đích hình, actor chính và phạm vi mã; caption không lặp lại toàn bộ nội dung SVG.

## 6. Tính đúng và khả năng truy vết

Nguồn tạo diagram chỉ gồm nội dung hiện tại của SRS v0.4 và source implementation map đã được audit ở commit `7e548421`. Mỗi node mang mã phải tồn tại trong đúng trang. Diagram không được:

- tuyên bố thuật toán Shopee bí mật;
- đổi thuật ngữ money state `estimated/approved/payable/paid/held/reversed`;
- nhập nhằng creator với vendor/seller identity;
- dùng chung seller tax/commission row cho creator nếu SRS cấm;
- đóng native parity bằng responsive web;
- hiển thị PII, secret, raw provider error hoặc anti-fraud threshold.

## 7. Validation trước và sau upload

Trước upload, chạy kiểm tra tự động cho toàn bộ SVG:

- XML hợp lệ, đúng `viewBox`, không có script, external image/font hoặc embedded secret;
- filename duy nhất và đủ 28 file;
- không còn placeholder `TBD`, `TODO`, `Lorem`;
- mọi mã `CN/MH/KT` xuất hiện trong phạm vi hợp lệ của trang đích;
- contrast và font size theo quy tắc thiết kế;
- title/description có trong SVG để hỗ trợ accessibility.

Sau upload, fetch lại 27 trang để xác nhận:

- Page 1 có 2 hình mới;
- mỗi Page 2 và Page 3 có đúng 1 hình mới;
- Page 4 có 2 hình mới;
- master giữ 1 infographic hiện có;
- tổng cộng 29 visual;
- không mất child page, bảng, component contract hoặc source map;
- caption, page link và version hiển thị đúng.

## 8. Versioning và rollback

Sau khi toàn bộ visual qua validation, nâng master và 26 trang con từ v0.4 lên v0.5. Changelog v0.5 ghi rõ bổ sung 28 SVG technical diagrams, phạm vi placement và khẳng định không đổi functional baseline.

Nếu một upload hoặc update thất bại, không tăng version và không ghi hoàn thành. Các trang đã chèn thành công được ghi nhận theo page ID để retry có kiểm soát; không replace toàn trang. Rollback là xóa đúng image block/caption vừa thêm và trả version về v0.4, không đụng tới nội dung SRS khác.

## 9. Tiêu chí hoàn thành

- Có đúng 28 SVG mới theo inventory.
- 28/28 file vượt qua validation tự động.
- 26/26 trang con có số hình đúng thiết kế; master giữ nguyên infographic.
- 12 backend diagrams và 12 UI diagrams khớp phạm vi mã của trang.
- Không có visual clone Shopee hoặc claim về thuật toán bí mật.
- SRS master và trang con đồng bộ v0.5 với changelog.
- Fetch hậu kiểm không phát hiện mất nội dung, duplicate block hoặc link hỏng.
