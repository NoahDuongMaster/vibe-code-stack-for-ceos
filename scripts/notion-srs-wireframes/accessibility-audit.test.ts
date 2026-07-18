import assert from 'node:assert/strict';
import test from 'node:test';
import { auditSceneAccessibility } from './accessibility-audit.ts';

test('should independently accept resolved AA text, focus, status and control geometry', () => {
  const scene = `<svg xmlns="http://www.w3.org/2000/svg" data-screen-code="MH-999" viewBox="0 0 1920 1440">
    <rect x="0" y="0" width="1920" height="1440" fill="#FFF9F8"/>
    <g data-component-id="A01">
      <g data-a11y-kind="control">
        <rect x="40" y="40" width="160" height="48" rx="10" fill="#A21C38"/>
        <text data-a11y-kind="text" data-text-role="body" x="72" y="70" fill="rgb(255, 255, 255)" font-size="16">Lưu thay đổi</text>
      </g>
    </g>
    <g data-component-id="D01" data-status="success">
      <rect x="40" y="112" width="240" height="48" rx="10" fill="#D9F6E8"/>
      <text data-a11y-kind="text" data-text-role="status" x="56" y="142" fill="#1D1018" font-size="16">Đã hoàn tất</text>
    </g>
    <g data-component-id="D02" data-status="error">
      <rect x="304" y="112" width="240" height="48" rx="10" fill="#FFE8E8"/>
      <text data-a11y-kind="text" data-text-role="status" x="320" y="142" fill="#1D1018" font-size="16">Cần khắc phục</text>
    </g>
    <g data-component-id="D03" data-status="disabled">
      <rect x="568" y="112" width="240" height="48" rx="10" fill="#F6F8FC"/>
      <text data-a11y-kind="text" data-text-role="status" x="584" y="142" fill="#5F5A63" font-size="16">Tạm vô hiệu</text>
    </g>
    <rect data-a11y-kind="focus" x="36" y="36" width="168" height="56" rx="12" fill="none" stroke="rgb(143, 103, 110)" stroke-width="2"/>
  </svg>`;

  assert.deepEqual(auditSceneAccessibility(scene), []);
});

test('should report screen, component and resolved foreground/background pairs without trusting passed flags', () => {
  const scene = `<svg xmlns="http://www.w3.org/2000/svg" data-screen-code="MH-998" data-passed="true" viewBox="0 0 1920 1440">
    <rect x="0" y="0" width="1920" height="1440" fill="#FFFDFB"/>
    <g data-component-id="F01" data-passed="true">
      <g data-a11y-kind="control"><rect x="24" y="24" width="40" height="40" fill="#FFFDFB"/></g>
      <text data-a11y-kind="text" data-text-role="body" x="24" y="88" fill="rgb(148, 163, 184)" font-size="12">Nội dung khó đọc</text>
      <rect data-a11y-kind="focus" x="20" y="20" width="48" height="48" fill="none" stroke="#F67993" stroke-width="2"/>
      <g data-status="error"><rect x="24" y="104" width="180" height="48" fill="#FFE8E8"/></g>
    </g>
  </svg>`;

  const errors = auditSceneAccessibility(scene);
  assert.ok(errors.length >= 5, errors.join('\n'));
  assert.match(errors.join('\n'), /MH-998\/F01/u);
  assert.match(errors.join('\n'), /#94A3B8\/#FFFDFB/u);
  assert.match(errors.join('\n'), /cỡ chữ 12px/u);
  assert.match(errors.join('\n'), /40×40.*44×44/u);
  assert.match(errors.join('\n'), /control.*#FFFDFB\/#FFFDFB/iu);
  assert.match(errors.join('\n'), /focus.*#F67993\/#FFFDFB/iu);
  assert.match(errors.join('\n'), /trạng thái.*văn bản/iu);
});

test('should reject unsafe, unresolved or malformed scene colors and geometry', () => {
  const scene = `<svg xmlns="http://www.w3.org/2000/svg" data-screen-code="MH-997" viewBox="0 0 1920 1440">
    <rect x="0" y="0" width="1920" height="1440" fill="var(--page)"/>
    <g data-component-id="A01" data-a11y-kind="control">
      <rect x="NaN" y="20" width="44" height="44" fill="#A21C38"/>
      <text data-a11y-kind="text" data-text-role="body" x="20" y="50" fill="currentColor" font-size="16">Hành động</text>
    </g>
  </svg>`;

  const errors = auditSceneAccessibility(scene).join('\n');
  assert.match(errors, /MH-997\/A01/u);
  assert.match(errors, /màu.*không được phân giải/iu);
  assert.match(errors, /hình học.*không hợp lệ/iu);
});

test('should reject non-canonical attributes and malformed XML instead of silently skipping them', () => {
  const cases = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g data-a11y-kind='control'><rect x='0' y='0' width='10' height='10' fill='#000000'/></g></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g></g>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><g data-a11y-kind=control><rect x="0" y="0" width="10" height="10" fill="#000000"/></g></svg>`,
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="0" y="0" width="100" height="100" fill="#FFFFFF"/><text x="10" y="24" fill="#000000" font-size="16" style="fill:#FFFFFF;font-size:2px;display:none">Ẩn bằng style</text></svg>`,
  ];

  for (const scene of cases) {
    const errors = auditSceneAccessibility(scene);
    assert.notDeepEqual(errors, [], scene);
    assert.match(errors.join('\n'), /XML|thuộc tính|style/iu, scene);
  }
});

test('should resolve effective opacity, fill opacity and visibility for text', () => {
  const scene = `<svg xmlns="http://www.w3.org/2000/svg" data-screen-code="MH-996" viewBox="0 0 400 220">
    <rect x="0" y="0" width="400" height="220" fill="#FFFFFF"/>
    <text x="20" y="40" fill="#000000" font-size="16" opacity="0">Opacity zero</text>
    <text x="20" y="80" fill="#000000" font-size="16" fill-opacity="0">Fill opacity zero</text>
    <g visibility="hidden"><text x="20" y="120" fill="#000000" font-size="16">Hidden ancestor</text></g>
  </svg>`;

  const errors = auditSceneAccessibility(scene).join('\n');
  assert.match(errors, /MH-996/u);
  assert.match(errors, /opacity|không hiển thị/iu);
  assert.ok(errors.split('\n').length >= 3, errors);
});

test('should use visible geometry and actual alpha-composited paint order', () => {
  const geometryScene = `<svg xmlns="http://www.w3.org/2000/svg" data-screen-code="MH-995" viewBox="0 0 200 200">
    <rect x="0" y="0" width="200" height="200" fill="#FFFFFF"/>
    <g data-component-id="A01" data-a11y-kind="control">
      <circle cx="50" cy="50" r="5" fill="#A21C38"/>
      <rect x="28" y="28" width="44" height="44" fill="#A21C38" opacity="0"/>
    </g>
  </svg>`;
  const geometryErrors = auditSceneAccessibility(geometryScene).join('\n');
  assert.match(geometryErrors, /MH-995\/A01/u);
  assert.match(geometryErrors, /10×10.*44×44/u);

  const paintOrderScene = `<svg xmlns="http://www.w3.org/2000/svg" data-screen-code="MH-994" viewBox="0 0 300 200">
    <rect x="0" y="0" width="300" height="200" fill="#FFFFFF"/>
    <rect x="40" y="40" width="100" height="100" fill="#000000"/>
    <rect x="0" y="0" width="300" height="200" fill="#FFFFFF" fill-opacity="0.8"/>
    <text x="60" y="80" fill="#FFFFFF" font-size="16">Bị lớp phủ che</text>
  </svg>`;
  const paintErrors = auditSceneAccessibility(paintOrderScene).join('\n');
  assert.match(paintErrors, /MH-994/u);
  assert.match(paintErrors, /tương phản/iu);
  assert.doesNotMatch(paintErrors, /#FFFFFF\/#000000 = 21\.00/u);
});

test('should reject text bounds outside the viewBox including anchors and tspans', () => {
  const scene = `<svg xmlns="http://www.w3.org/2000/svg" data-screen-code="MH-993" viewBox="0 0 1920 1440">
    <rect x="0" y="0" width="1920" height="1440" fill="#FFFFFF"/>
    <text x="1900" y="1430" fill="#000000" font-size="100">Tràn mép phải</text>
    <text x="10" y="180" text-anchor="end" fill="#000000" font-size="32">Tràn mép trái</text>
    <text x="100" y="1280" fill="#000000" font-size="48"><tspan x="100" dy="0">Dòng một</tspan><tspan x="100" dy="170">Dòng hai</tspan></text>
  </svg>`;

  const errors = auditSceneAccessibility(scene).join('\n');
  assert.match(errors, /MH-993/u);
  assert.match(errors, /viewBox|vượt.*khung/iu);
  assert.ok(errors.split('\n').length >= 3, errors);
});
