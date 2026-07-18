# Thiết kế Wireframe & Mockup cho SRS UI Affiliate Benadep

**Ngày:** 18/07/2026  
**Trạng thái:** Đã duyệt trong hội thoại; chờ review tài liệu trước implementation plan  
**Phạm vi Notion:** 12 trang UI `3.01…3.12` thuộc SRS Benadep Affiliate & Creator Commerce  
**Phạm vi màn hình:** `MH-001…MH-059`

## 1. Mục tiêu

Bổ sung một visual contract đầy đủ cho phần thiết kế UI của SRS hiện tại:

- 59 wireframe riêng, mỗi ảnh ánh xạ đúng một mã `MH`;
- 12 mockup high-fidelity đại diện, mỗi trang `3.01…3.12` có một ảnh;
- tổng cộng 71 PNG raster 4K, sắc nét khi đọc và phóng to trên Notion;
- giữ nguyên 12 sơ đồ UI navigation đang có;
- giữ nguyên bảng component contract làm nguồn chuẩn tắc;
- liên kết nội dung ảnh với component ID/type/required/validation/binding trong SRS và với design token/component primitive hiện có trong source Benadep.

Ảnh giúp Product, Design, Engineering và QA hình dung cùng một màn hình. Ảnh không thay thế requirement, component contract, API schema hoặc acceptance test.

## 2. Quyết định đã khóa

| Hạng mục | Quyết định |
|---|---|
| Coverage | 59 wireframe riêng + 12 mockup high-fidelity đại diện |
| Surface | Tất cả ảnh dùng viewport desktop |
| Ngôn ngữ | Toàn bộ UI copy, annotation và caption trong ảnh dùng tiếng Việt |
| Visual style | Benadep Luxury Blush; không sao chép Shopee trade dress |
| Dữ liệu minh họa | Placeholder trung tính; không dùng ảnh sản phẩm/avatar/banner thật |
| Master render | Vector scene `1920×1440` |
| Output | PNG lossless `3840×2880`, raster ở hệ số 2× |
| Font | Plus Jakarta Sans như source Benadep; text được raster hóa vào PNG |
| Notion | Mockup ở gần đầu trang; wireframe ngay sau heading MH tương ứng |
| Version | Không tăng functional baseline chỉ vì thêm visual aid |

UI copy tiếng Việt trong ảnh là ngôn ngữ review nội bộ theo quyết định của stakeholder. Đây không phải quyết định localization cuối cho sản phẩm thị trường Mỹ.

## 3. Nguồn chuẩn tắc và traceability

### 3.1 Nguồn SRS

Mỗi screen contract phải được chuẩn hóa từ nội dung hiện có của 12 trang UI:

- mã và tên `MH`;
- actor/surface;
- component ID;
- component type;
- required/optional/read-only;
- validation và error behavior;
- API/state binding;
- loading, empty, error, disabled, success và recovery behavior;
- liên kết với trang behavior/backend đối ứng.

Expected invariant sau chuẩn hóa:

- 59 mã MH duy nhất, liên tục từ `MH-001` đến `MH-059`;
- 59 component contract;
- 470 component rows;
- không có component row bị mất hoặc ánh xạ sang MH khác.

### 3.2 Nguồn source code Benadep

Visual system bám theo:

- `packages/design-system/src/tokens/colors.css`;
- `packages/design-system/src/tokens/typography.css`;
- `packages/design-system/src/tokens/effects.css`;
- `packages/design-system/src/tokens/shadows.css`;
- `apps/storefront/src/components/ui/*`;
- `apps/vendor-portal/src/components/ui/*`;
- `apps/backend/src/admin/branding/admin-theme.css`;
- surface boundary đã mô tả trong SRS cho storefront, vendor portal và Medusa Admin.

Ảnh có thể mô tả target UI chưa tồn tại trong code, nhưng primitive và visual token phải dùng tên/ý nghĩa tương thích source. Không được làm ảnh tạo cảm giác capability đã được triển khai khi source chưa có.

## 4. Kiến trúc asset pipeline

Pipeline gồm năm lớp độc lập:

1. **Screen contracts** — dữ liệu 59 MH và 470 component rows đã chuẩn hóa.
2. **Layout recipes** — template theo loại màn hình: dashboard, form, table/list, detail, composer, viewer, graph/evidence và reconciliation.
3. **Wireframe renderer** — dựng visual contract grayscale có annotation và semantic states.
4. **Mockup renderer** — áp Benadep token, hierarchy, placeholder và high-fidelity component styling cho 12 màn đại diện.
5. **Rasterizer/validator** — render scene vector `1920×1440` thành PNG `3840×2880`, sau đó kiểm tra kích thước, clipping, contrast, coverage và deterministic metadata.

Đầu ra dự kiến:

```text
scripts/notion-srs-wireframes/
  types.ts
  screen-contracts.ts
  layout-recipes.ts
  wireframe-renderer.ts
  mockup-renderer.ts
  rasterize.ts
  generate.ts
  validate.ts
  *.test.ts

docs/superpowers/assets/notion-srs-wireframes/
  wireframes/
    {mh-code-lower}-{screen-slug}-wireframe.png
  mockups/
    srs-{page-number}-{screen-slug}-mockup.png
  contact-sheet-wireframes.html
  contact-sheet-mockups.html
```

Vector scene là intermediate deterministic; output được publish vào Notion chỉ là PNG raster theo yêu cầu stakeholder.

Renderer dùng `PlusJakartaSans-VariableFont_wght.ttf` có Vietnamese glyph, được
pin checksum tại `scripts/notion-srs-wireframes/fonts/` cùng license tương ứng.
Lệnh generate không tải font qua mạng và fail nếu checksum hoặc font family
không khớp.

## 5. Screen contract

Mỗi màn hình có contract tối thiểu:

```typescript
type TScreenContract = {
  code: `MH-${string}`;
  pageKey: `3-${string}-ui`;
  title: string;
  surface: 'storefront' | 'vendor' | 'admin';
  actor: string;
  layoutRecipe:
    | 'dashboard'
    | 'form'
    | 'list'
    | 'detail'
    | 'composer'
    | 'viewer'
    | 'evidence'
    | 'reconciliation';
  components: readonly TScreenComponent[];
  states: readonly TScreenState[];
  primaryAction: string;
  safeExit: string;
};
```

Mỗi component giữ nguyên ID từ SRS và có ít nhất:

- label tiếng Việt;
- component type;
- required/optional/read-only;
- validation/constraint;
- authoritative binding;
- vị trí trong layout;
- trạng thái áp dụng;
- annotation code hiển thị trong wireframe.

Nếu một component không hợp lý để vẽ trực tiếp, nó vẫn phải xuất hiện trong annotation directory của đúng màn hình. Nhờ vậy coverage 470/470 không phụ thuộc vào việc mọi row đều có một rectangle riêng.

## 6. Wireframe system

### 6.1 Bố cục

Mỗi wireframe có bốn vùng cố định:

1. **Chrome/surface header** — nhận diện storefront, vendor hoặc admin.
2. **Primary canvas** — layout thật của màn hình trên desktop.
3. **State strip** — loading, empty, error, disabled, success hoặc recovery cần thiết.
4. **Annotation directory** — mapping component ID → component type → required → binding.

Wireframe dùng nền trắng/xám; Dusty Rose chỉ dành cho primary CTA, focus, selection và annotation highlight. Không dùng decoration high-fidelity làm che lấp cấu trúc.

### 6.2 Component semantics

- Mỗi input có label hiển thị; required dùng `*` và annotation text, không chỉ dùng màu.
- Mỗi action có hierarchy primary/secondary/destructive.
- Table/list thể hiện header, filter, pagination, empty và error/retry.
- Form dài thể hiện grouping, helper text, inline validation và safe cancel/back.
- Modal/sheet thể hiện trigger, focus target, close/cancel và destructive confirmation khi áp dụng.
- Financial/evidence screens dùng số tabular, state badge có text và đường dẫn drill-down.
- Video/LIVE vẫn được trình bày trong desktop viewport theo quyết định stakeholder; annotation phải ghi rõ capability có thể yêu cầu native/mobile parity gate trong implementation.

## 7. High-fidelity mockup system

### 7.1 Benadep visual tokens

- Font: Plus Jakarta Sans.
- Primary: `#E9486A`.
- Dusty Rose: `#F67993`.
- Deep Plum: `#A21C38`.
- Warm page: `#FFF9F8`.
- Card: `#FFFDFB`.
- Body/ink: token hiện có từ `colors.css`.
- Spacing: grid 8px.
- Radius: 10px.
- Shadow: blush-tinted, dùng scale hiện có.
- Focus: ring có contrast đạt WCAG AA.

Placeholder sản phẩm, avatar và media là shape trung tính có label mô tả. Không lấy asset thật và không mô phỏng logo/brand/trade dress Shopee.

### 7.2 Mười hai màn hình đại diện

| Trang | MH | Mockup |
|---|---|---|
| 3.01 | MH-001 | Affiliate Center & Eligibility |
| 3.02 | MH-006 | Affiliate Dashboard |
| 3.03 | MH-012 | Trình tạo affiliate link |
| 3.04 | MH-018 | Chi tiết quyết định attribution |
| 3.05 | MH-022 | Feed Video commerce |
| 3.06 | MH-030 | Phòng LIVE Viewer |
| 3.07 | MH-033 | Cấu hình tỷ lệ hoa hồng |
| 3.08 | MH-036 | Hộp thư cộng tác |
| 3.09 | MH-042 | Quản lý MCN roster |
| 3.10 | MH-046 | Ví Creator |
| 3.11 | MH-052 | Hàng đợi Risk |
| 3.12 | MH-058 | Tình trạng product feed |

Mockup dùng cùng screen contract với wireframe tương ứng. Mockup không được thêm field/action không có trong contract chỉ để làm ảnh đẹp hơn.

## 8. Typography và độ phân giải

- Scene logical: `1920×1440`.
- PNG output: `3840×2880` RGB lossless, nền opaque.
- Không dùng JPEG.
- Không upscale từ bitmap kích thước thấp.
- Text được render ở hệ số 2× và raster hóa vào PNG.
- Body text trên scene logical không nhỏ hơn 16px; annotation không nhỏ hơn 14px.
- Line, border và icon stroke phải rơi vào pixel grid sau scale để không bị mờ.
- Font fallback là validation failure; pipeline không âm thầm đổi sang system font.
- Mỗi file phải khai báo width/height chính xác và có alt/caption tiếng Việt trên Notion.

## 9. UI states và error recovery

Không phải mọi màn hình cần mọi state, nhưng contract phải khai báo rõ state áp dụng. Renderer fail nếu state bắt buộc theo component behavior bị thiếu.

Các state chuẩn:

- loading/skeleton;
- empty có next action;
- validation error đặt gần field;
- query/API error có retry hoặc safe exit;
- permission denied không rò rỉ dữ liệu;
- disabled có lý do;
- destructive confirmation;
- success/confirmation;
- stale/version conflict;
- held/failed/remediation cho payout hoặc enforcement;
- reconnect/ended cho LIVE;
- moderation/appeal cho Video và policy flows.

Mỗi wireframe chọn một state chính trong canvas và dùng state strip để thể hiện các state còn lại mà không tạo thêm ảnh ngoài phạm vi 59 file.

## 10. Cập nhật Notion

### 10.1 Vị trí chèn

Trên mỗi trang `3.xx`:

1. giữ nguyên sơ đồ navigation hiện tại;
2. chèn mockup high-fidelity trước heading `### Quy ước Component Contract`;
3. chèn wireframe ngay sau heading `## {code} — {title}` tương ứng trong screen contract;
4. không thay đổi bảng component, API/source map, behavior hoặc related-page link.

### 10.2 Alt và caption

Mockup:

```text
Mockup high-fidelity trang {pageLabel} cho {code}, sử dụng Benadep Luxury Blush và dữ liệu placeholder trung tính.
```

Wireframe:

```text
Wireframe desktop {code} thể hiện component contract, required state, validation, binding và recovery của {title}.
```

`code` và `title` được lấy trực tiếp từ screen contract; renderer không nhận
alt text viết tay tách rời. Ví dụ MH-001: `Wireframe desktop MH-001 thể hiện
component contract, required state, validation, binding và recovery của
Affiliate Center & Eligibility.`

Caption kết thúc bằng cảnh báo:

```text
Visual aid; component contract và nội dung SRS chuẩn tắc vẫn là nguồn quyết định.
```

### 10.3 Quy trình ghi an toàn

- Fetch trang ngay trước khi ghi.
- Kiểm tra heading/anchor xuất hiện đúng một lần.
- Upload ảnh và chỉ chèn vào anchor đã khóa.
- Upload PNG bằng phiên Notion đã xác thực hoặc File Upload API nhận local file;
  không đưa ảnh lên host công khai/trung gian.
- Read-back ngay sau từng trang.
- Dừng rollout khi một trang không đạt read-back; không tiếp tục ghi trang kế tiếp.
- Không tăng version hoặc thay functional baseline nếu chỉ thêm ảnh.
- Cập nhật changelog master bằng targeted text replacement sau khi cả 12 trang đạt audit.

## 11. Validation và review

### 11.1 Automated gates

Pipeline phải fail khi có một trong các lỗi:

- thiếu/trùng MH hoặc page key;
- coverage khác 59/59/470;
- filename trùng hoặc sai convention;
- component ID thuộc sai MH;
- annotation directory thiếu component row;
- title, label, annotation hoặc state copy không phải tiếng Việt theo policy đã duyệt;
- output khác `3840×2880`;
- PNG hỏng, có alpha ngoài dự kiến hoặc metadata không deterministic;
- font fallback;
- text clipping, component overlap hoặc annotation overflow;
- contrast dưới WCAG 2.2 AA đối với text/function color;
- touch/click target được mô tả nhỏ hơn 44px trên scene logical khi component có tương tác;
- unfinished placeholder token, lorem ipsum hoặc nội dung giả không có nghĩa;
- mockup dùng asset thật hoặc Shopee branding/trade dress.

### 11.2 Visual review

Sinh hai contact sheet riêng:

- 59 wireframe, nhóm theo trang 3.01–3.12;
- 12 mockup high-fidelity.

Duyệt mỗi ảnh ở fit-to-width và 100% pixel. Reject khi chữ khó đọc, hierarchy mơ hồ, component ID sai owner, state strip không rõ, placeholder giống dữ liệu thật, hoặc ảnh high-fidelity không còn khớp wireframe/contract.

### 11.3 Notion audit

Sau rollout phải xác nhận:

- 12 mockup mới;
- 59 wireframe mới;
- 71 filename duy nhất;
- 71 alt và caption tiếng Việt;
- 12 navigation diagram cũ vẫn còn;
- đúng 83 image block trên 12 trang UI: 12 navigation + 12 mockup + 59 wireframe;
- đúng 100 visual block trên toàn bộ cây SRS: 29 visual hiện có + 71 visual mới;
- 59 MH heading, 59 component contract và 470 component row giữ nguyên;
- related-page link giữ nguyên;
- page/master version giữ nguyên baseline đã duyệt;
- không có ảnh trùng, ảnh thiếu hoặc anchor sai thứ tự.

Expected image count theo trang sau rollout:

| Trang | Navigation | Mockup | Wireframe | Tổng |
|---|---:|---:|---:|---:|
| 3.01 | 1 | 1 | 5 | 7 |
| 3.02 | 1 | 1 | 6 | 8 |
| 3.03 | 1 | 1 | 6 | 8 |
| 3.04 | 1 | 1 | 4 | 6 |
| 3.05 | 1 | 1 | 5 | 7 |
| 3.06 | 1 | 1 | 5 | 7 |
| 3.07 | 1 | 1 | 4 | 6 |
| 3.08 | 1 | 1 | 5 | 7 |
| 3.09 | 1 | 1 | 5 | 7 |
| 3.10 | 1 | 1 | 5 | 7 |
| 3.11 | 1 | 1 | 5 | 7 |
| 3.12 | 1 | 1 | 4 | 6 |
| **Tổng** | **12** | **12** | **59** | **83** |

## 12. Non-goals

- Không triển khai UI production trong source Benadep.
- Không thay đổi API, schema, routing hoặc component contract.
- Không thiết kế mobile variant trong vòng này.
- Không tạo 59 high-fidelity mockup.
- Không dùng ảnh sản phẩm/người dùng thật.
- Không sao chép pixel, icon, màu, logo hoặc trade dress Shopee.
- Không tuyên bố ranking, attribution arbitration hoặc anti-fraud secret giống Shopee.

## 13. Acceptance criteria

Work hoàn tất khi:

1. 59 wireframe PNG và 12 mockup PNG được sinh deterministic ở `3840×2880`.
2. Coverage đạt chính xác 59 MH, 59 contract và 470 component rows.
3. Mỗi ảnh khớp source surface, component primitive và Benadep visual token.
4. Automated validation, raster validation và visual review đều pass.
5. 71 ảnh được đặt đúng anchor trên 12 trang Notion.
6. Read-back và audit xác nhận không thay đổi nội dung chuẩn tắc hoặc version ngoài changelog mô tả visual enhancement.
7. Các thay đổi ngoài phạm vi trong worktree được giữ nguyên.
