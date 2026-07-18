import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, it } from 'node:test';

import { WIREFRAME_TARGETS } from './manifest.ts';
import {
  auditScreenContractRuntime,
  SCREEN_COMPONENT_ID_SIGNATURE_BY_CODE,
  SCREEN_CONTRACT_GOLDEN_DIGEST_BY_CODE,
  SCREEN_CONTRACTS,
  SCREEN_STATE_LABELS,
} from './screen-contracts.ts';

const EXPECTED_COMPONENT_TOTALS_BY_PAGE = [
  41, 51, 46, 31, 38, 39, 29, 43, 43, 37, 40, 32,
] as const;

const EXPECTED_ROUTES = [
  '/account/affiliate',
  '/account/affiliate/apply',
  '/account/affiliate/channels',
  '/account/affiliate/settings',
  '/app/affiliate/applications',
  '/account/affiliate/dashboard',
  '/account/affiliate/offers',
  '/account/affiliate/offers/[id]',
  '/account/affiliate/invitations',
  '/account/affiliate/referral',
  '/affiliate/offers',
  '/account/affiliate/tools/link',
  '/account/affiliate/tools/code',
  '/account/affiliate/collections',
  '/c/[handle]/[slug]',
  '/account/affiliate/reports',
  '/account/affiliate/earnings',
  '/account/affiliate/conversions/[id]',
  '/affiliate/rates',
  '/account/affiliate/earnings/[id]',
  '/admin/affiliate/attribution',
  '/video',
  '/account/affiliate/video/new',
  '/account/affiliate/video/[id]/commerce',
  '/video/[id]',
  '/account/affiliate/video/[id]/status',
  '/live',
  '/account/affiliate/live/new',
  '/account/affiliate/live/[id]/host',
  '/live/[id]',
  '/admin/affiliate/live/[id]',
  '/affiliate/pps',
  '/affiliate/pps/products',
  '/affiliate/creators',
  '/account/affiliate/settings/contact',
  '/account/affiliate/collaborations',
  '/affiliate/collaborations/[id]/proposal',
  '/account/affiliate/collaborations/[id]/sample',
  '/account/affiliate/collaborations/[id]/deliverable',
  '/affiliate/publisher',
  '/mcn/apply',
  '/mcn/creators',
  '/mcn/team',
  '/mcn/assignments',
  '/mcn/reports',
  '/account/affiliate/wallet',
  '/account/affiliate/settings/payout-tax',
  '/account/affiliate/statements/[id]',
  '/account/affiliate/payouts',
  '/admin/affiliate/finance',
  '/help/report-affiliate',
  '/admin/affiliate/risk',
  '/admin/affiliate/risk/[id]',
  '/account/affiliate/appeals/[id]',
  '/admin/affiliate/policy',
  '/account/affiliate/channels',
  '/account/affiliate/channels/youtube',
  '/account/affiliate/channels/youtube/products',
  '/account/affiliate/reports/channels',
] as const;

const EXPECTED_UPPER_BOUND_OWNERS = [
  'MH-002/F04',
  'MH-002/F08',
  'MH-003/F04',
  'MH-004/F02',
  'MH-007/F03',
  'MH-009/F02',
  'MH-012/F01',
  'MH-013/F03',
  'MH-014/F03',
  'MH-015/F01',
  'MH-023/F02',
  'MH-028/F02',
  'MH-036/F01',
  'MH-037/F06',
  'MH-038/F04',
  'MH-039/F02',
  'MH-041/F04',
  'MH-041/F05',
  'MH-044/F04',
  'MH-050/F03',
  'MH-053/F03',
] as const;

const EXPECTED_PENDING_OWNERS = [
  'MH-003/A01',
  'MH-003/D02',
  'MH-004/D01',
  'MH-010/D03',
  'MH-016/F03',
  'MH-026/A01',
  'MH-032/D03',
  'MH-041/D01',
  'MH-042/D02',
  'MH-046/D01',
  'MH-047/A01',
  'MH-056/D01',
  'MH-058/D01',
] as const;
const REVIEWED_LOCALIZATION_FIELDS_BY_SCREEN = {
  'MH-002': ['F02.validation', 'F02.binding'],
  'MH-004': ['A03.binding'],
  'MH-005': ['safeExit', 'A01.binding'],
  'MH-006': ['A02.requirement'],
  'MH-007': ['A02.validation'],
  'MH-008': ['D01.validation', 'A01.binding'],
  'MH-010': ['F01.label', 'D02.validation', 'D04.requirement'],
  'MH-011': ['D01.validation', 'D02.validation'],
  'MH-012': ['D01.validation', 'A02.label', 'A02.validation'],
  'MH-013': ['F01.validation', 'A02.label'],
  'MH-014': ['D03.validation'],
  'MH-015': ['D01.validation', 'D03.validation', 'A01.validation'],
  'MH-016': ['F02.validation', 'F03.validation', 'D01.validation'],
  'MH-017': ['D04.validation'],
  'MH-018': ['safeExit', 'D06.validation'],
  'MH-020': ['safeExit', 'F01.label', 'D03.validation'],
  'MH-021': [
    'primaryAction',
    'safeExit',
    'F01.label',
    'F01.validation',
    'F02.validation',
  ],
  'MH-022': ['D04.validation', 'A01.validation', 'A01.binding'],
  'MH-023': ['F01.validation', 'F03.validation', 'A02.validation'],
  'MH-024': ['displayTitle', 'F02.validation', 'F03.validation'],
  'MH-025': [
    'D01.validation',
    'D03.validation',
    'D04.type',
    'D04.validation',
    'A01.label',
    'A01.validation',
    'A01.binding',
    'D05.label',
    'D05.validation',
  ],
  'MH-026': ['safeExit', 'D02.validation', 'D04.label', 'D05.validation'],
  'MH-027': ['A01.requirement'],
  'MH-028': ['F04.validation', 'F05.validation', 'F06.validation'],
  'MH-029': ['D03.validation', 'A01.binding', 'A02.binding'],
  'MH-030': [
    'D02.validation',
    'D04.validation',
    'A01.label',
    'A01.validation',
    'D06.label',
    'D06.validation',
  ],
  'MH-031': ['F01.validation', 'D01.label', 'A01.label'],
  'MH-032': ['D01.validation', 'A01.binding', 'D03.validation', 'A02.label'],
  'MH-033': ['F01.validation'],
  'MH-034': ['D02.validation', 'A01.label'],
  'MH-035': ['F01.validation'],
  'MH-036': ['D02.validation', 'F03.validation', 'A02.validation'],
  'MH-037': [
    'F02.validation',
    'F04.validation',
    'D01.validation',
    'A01.label',
    'A01.requirement',
    'A01.binding',
  ],
  'MH-038': ['D01.validation'],
  'MH-039': [
    'safeExit',
    'F01.validation',
    'D02.validation',
    'A01.requirement',
    'D03.label',
  ],
  'MH-040': ['F01.validation', 'A02.label'],
  'MH-041': [
    'F01.validation',
    'F03.label',
    'F03.validation',
    'F06.validation',
    'F08.validation',
  ],
  'MH-042': ['primaryAction', 'F01.validation', 'D02.validation', 'A02.label'],
  'MH-043': ['F03.validation', 'A01.validation', 'A02.validation'],
  'MH-044': ['D01.binding', 'A02.label', 'A02.validation', 'D02.validation'],
  'MH-045': [
    'F01.validation',
    'D02.label',
    'D02.validation',
    'D04.validation',
    'A02.binding',
  ],
  'MH-046': ['F01.label', 'D04.label'],
  'MH-047': [
    'F02.validation',
    'F03.validation',
    'F04.validation',
    'A01.requirement',
    'D01.validation',
    'F06.validation',
  ],
  'MH-048': ['D01.label'],
  'MH-049': ['primaryAction', 'D03.label', 'D03.validation'],
  'MH-050': [
    'F01.validation',
    'D02.validation',
    'F02.validation',
    'F03.requirement',
    'A01.label',
    'A01.binding',
  ],
  'MH-051': ['F04.validation', 'F06.validation', 'A01.validation'],
  'MH-053': ['safeExit', 'D02.validation', 'A01.binding'],
  'MH-054': [
    'safeExit',
    'D02.validation',
    'F03.validation',
    'F04.validation',
    'D03.validation',
  ],
  'MH-055': [
    'safeExit',
    'F01.binding',
    'D01.validation',
    'F03.validation',
    'D02.validation',
  ],
  'MH-056': ['A01.label', 'D03.validation'],
  'MH-057': ['D01.label', 'D02.validation', 'A02.label', 'A02.validation'],
  'MH-058': [
    'primaryAction',
    'F01.label',
    'F01.validation',
    'D04.validation',
    'A02.validation',
    'D05.validation',
  ],
  'MH-059': ['D02.validation', 'D03.label'],
} as const;
const EXPECTED_REVIEWED_LOCALIZATION_DIGEST =
  'b9616b4f583f4f52ce7d88259220e28923fc1522963c85f1efde63edfce547e7';
const EXPECTED_NORMALIZED_COPY_DIGEST =
  '01e23fd0cffa545570d6c71f27b81139524b82120dbf41f10976fde1da7097c0';

describe('[SRSScreenContracts]', () => {
  it('should preserve all fifty-nine Notion screen contracts in MH order', () => {
    assert.equal(SCREEN_CONTRACTS.length, 59);
    assert.deepEqual(
      SCREEN_CONTRACTS.map((screen) => screen.code),
      WIREFRAME_TARGETS.map((target) => target.code),
    );
  });

  it('should preserve the authoritative Notion title snapshot', () => {
    assert.deepEqual(
      SCREEN_CONTRACTS.map((screen) => screen.title),
      WIREFRAME_TARGETS.map((target) => target.screenTitle),
    );
  });

  it('should expose a natural Vietnamese display title for every screen', () => {
    assert.equal(
      SCREEN_CONTRACTS.filter((screen) => screen.displayTitle).length,
      59,
    );
    for (const screen of SCREEN_CONTRACTS) {
      assert.match(
        screen.displayTitle,
        /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i,
        screen.code,
      );
      assert.notEqual(screen.displayTitle, screen.title, screen.code);
    }
  });

  it('should preserve all fifty-nine clean logical routes exactly', () => {
    assert.deepEqual(
      SCREEN_CONTRACTS.map((screen) => screen.route),
      EXPECTED_ROUTES,
    );
    assert.doesNotMatch(
      JSON.stringify(SCREEN_CONTRACTS.map((screen) => screen.route)),
      /\\\\/,
    );
  });

  it('should preserve all twenty-one source upper bounds', () => {
    const owners = SCREEN_CONTRACTS.flatMap((screen) =>
      screen.components
        .filter((component) => component.validation.includes('≤'))
        .map((component) => `${screen.code}/${component.id}`),
    );

    assert.deepEqual(owners, EXPECTED_UPPER_BOUND_OWNERS);
  });

  it('should preserve source pending state ownership', () => {
    const owners = SCREEN_CONTRACTS.flatMap((screen) =>
      screen.components
        .filter((component) => component.states.includes('pending'))
        .map((component) => `${screen.code}/${component.id}`),
    );

    assert.deepEqual(owners, EXPECTED_PENDING_OWNERS);
    for (const screen of SCREEN_CONTRACTS) {
      if (
        screen.components.some((component) =>
          component.states.includes('pending'),
        )
      ) {
        assert.ok(screen.states.includes('pending'), screen.code);
      }
    }
  });

  it('should use moderator terminology for moderation actors', () => {
    assert.equal(
      SCREEN_CONTRACTS.find((screen) => screen.code === 'MH-026')?.actor,
      'Creator/Người kiểm duyệt',
    );
    assert.equal(
      SCREEN_CONTRACTS.find((screen) => screen.code === 'MH-029')?.actor,
      'Người dẫn LIVE/Người kiểm duyệt',
    );
  });

  it('should preserve all four hundred seventy component rows by page', () => {
    const totalsByPage = Array.from({ length: 12 }, (_, index) => {
      const pageKey = `3-${String(index + 1).padStart(2, '0')}-ui`;
      return SCREEN_CONTRACTS.filter(
        (screen) => screen.pageKey === pageKey,
      ).reduce((total, screen) => total + screen.components.length, 0);
    });

    assert.deepEqual(totalsByPage, EXPECTED_COMPONENT_TOTALS_BY_PAGE);
    assert.equal(
      SCREEN_CONTRACTS.reduce(
        (total, screen) => total + screen.components.length,
        0,
      ),
      470,
    );
  });

  it('should retain all one hundred sixty-nine reviewer localization fields', () => {
    const reviewedFields = Object.entries(
      REVIEWED_LOCALIZATION_FIELDS_BY_SCREEN,
    ).flatMap(([code, fields]) =>
      fields.map((field) => [code, field] as const),
    );

    assert.equal(reviewedFields.length, 169);
    const reviewedValues: string[] = [];
    for (const [code, field] of reviewedFields) {
      const screen = SCREEN_CONTRACTS.find((item) => item.code === code);
      assert.ok(screen, code);
      if (!field.includes('.')) {
        const value =
          screen[field as 'primaryAction' | 'safeExit' | 'displayTitle'];
        assert.equal(typeof value, 'string');
        reviewedValues.push(`${code}/${field}:${value}`);
        continue;
      }
      const [componentId, componentField] = field.split('.');
      const component = screen.components.find(
        (item) => item.id === componentId,
      );
      assert.ok(component, `${code}/${componentId}`);
      assert.equal(
        typeof component[
          componentField as
            | 'label'
            | 'validation'
            | 'binding'
            | 'requirement'
            | 'type'
        ],
        'string',
        `${code}/${field}`,
      );
      reviewedValues.push(
        `${code}/${field}:${
          component[
            componentField as
              | 'label'
              | 'validation'
              | 'binding'
              | 'requirement'
              | 'type'
          ]
        }`,
      );
    }
    assert.equal(
      createHash('sha256').update(JSON.stringify(reviewedValues)).digest('hex'),
      EXPECTED_REVIEWED_LOCALIZATION_DIGEST,
    );
  });

  it('should freeze all normalized visible and annotation copy independently', () => {
    const normalizedCopy = SCREEN_CONTRACTS.map((screen) => ({
      code: screen.code,
      displayTitle: screen.displayTitle,
      actor: screen.actor,
      primaryAction: screen.primaryAction,
      safeExit: screen.safeExit,
      components: screen.components.map((component) => ({
        id: component.id,
        label: component.label,
        type: component.type,
        requirement: component.requirement,
        validation: component.validation,
        binding: component.binding,
      })),
    }));

    assert.equal(
      createHash('sha256').update(JSON.stringify(normalizedCopy)).digest('hex'),
      EXPECTED_NORMALIZED_COPY_DIGEST,
    );
  });

  it('should own every unique component ID and annotation inside one screen', () => {
    for (const screen of SCREEN_CONTRACTS) {
      assert.equal(
        new Set(screen.components.map((component) => component.id)).size,
        screen.components.length,
        screen.code,
      );
      assert.deepEqual(
        screen.components.map((component) => component.annotationCode),
        screen.components.map((component) => component.id),
        screen.code,
      );
    }
  });

  it('should assign only screen-owned states to every component', () => {
    for (const screen of SCREEN_CONTRACTS) {
      for (const component of screen.components) {
        assert.equal(
          component.states.every((state) => screen.states.includes(state)),
          true,
          `${screen.code}/${component.id}`,
        );
      }
    }
  });

  it('should normalize the first MH-001 component exactly', () => {
    assert.deepEqual(SCREEN_CONTRACTS.at(0)?.components.at(0), {
      id: 'D01',
      annotationCode: 'D01',
      label: 'Tổng quan chương trình',
      type: 'Thẻ nổi bật + Cảnh báo',
      requirement: 'Luôn hiển thị',
      validation:
        'Phiên bản chương trình, quyền lợi và nghĩa vụ; không cho phép chỉnh sửa dữ liệu.',
      binding:
        '`program.*`; hiển thị thông báo điều kiện và liên kết FTC/thuế.',
      states: ['loading', 'ready', 'dependency-unavailable'],
      region: 'primary',
    });
  });

  it('should keep routes and bindings free of transient Notion attachments', () => {
    const serialized = JSON.stringify(SCREEN_CONTRACTS);

    assert.doesNotMatch(serialized, /prod-files-secure|X-Amz-|amazonaws\.com/i);
    for (const screen of SCREEN_CONTRACTS) {
      assert.match(screen.route, /^\//, screen.code);
      assert.ok(screen.primaryAction.length > 0, screen.code);
      assert.ok(screen.safeExit.length > 0, screen.code);
      assert.ok(screen.states.length > 0, screen.code);
    }
  });

  it('should derive meaningful primary actions instead of the overview placeholder', () => {
    const actions = SCREEN_CONTRACTS.map((screen) => screen.primaryAction);

    assert.ok(
      actions.every(
        (action) =>
          action.length > 0 &&
          action !==
            'Đạt outcome mô tả; mutation có idempotency và result state.',
      ),
    );
    assert.ok(new Set(actions).size > 12);
  });

  it('should publish Vietnamese labels for every used screen state', () => {
    const usedStates = new Set(
      SCREEN_CONTRACTS.flatMap((screen) => [
        ...screen.states,
        ...screen.components.flatMap((component) => component.states),
      ]),
    );

    assert.deepEqual(
      [...usedStates].filter((state) => !SCREEN_STATE_LABELS[state]),
      [],
    );
    for (const state of usedStates) {
      assert.notEqual(SCREEN_STATE_LABELS[state], state);
      assert.match(
        SCREEN_STATE_LABELS[state],
        /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i,
        state,
      );
    }
  });

  it('should deep-freeze the complete normalized snapshot', () => {
    assert.equal(Object.isFrozen(SCREEN_CONTRACTS), true);
    assert.equal(Object.isFrozen(SCREEN_STATE_LABELS), true);
    for (const screen of SCREEN_CONTRACTS) {
      assert.equal(Object.isFrozen(screen), true, screen.code);
      assert.equal(Object.isFrozen(screen.states), true, screen.code);
      assert.equal(Object.isFrozen(screen.components), true, screen.code);
      for (const component of screen.components) {
        assert.equal(
          Object.isFrozen(component),
          true,
          `${screen.code}/${component.id}`,
        );
        assert.equal(
          Object.isFrozen(component.states),
          true,
          `${screen.code}/${component.id}`,
        );
      }
    }
  });

  it('should reject invalid runtime discriminants without relying on TypeScript', () => {
    const invalid = structuredClone(SCREEN_CONTRACTS.at(0));
    assert.ok(invalid);
    Object.assign(invalid, { surface: 'mobile', layoutRecipe: 'grid' });
    Object.assign(invalid.components[0], {
      region: 'navigation',
      states: ['unknown-state'],
    });

    assert.deepEqual(auditScreenContractRuntime([invalid]), [
      'MH-001/surface: mobile',
      'MH-001/layoutRecipe: grid',
      'MH-001/D01/region: navigation',
      'MH-001/D01/state: unknown-state',
    ]);
  });

  it('should reject malformed runtime identity, copy, arrays, and component ownership', () => {
    const malformed = structuredClone(SCREEN_CONTRACTS.at(0));
    assert.ok(malformed);
    Object.assign(malformed, {
      code: 'MH-999',
      pageKey: '3-99-ui',
      route: 'account/affiliate',
      displayTitle: '',
      actor: '',
      primaryAction: '',
      safeExit: '',
      states: 'ready',
    });
    Object.assign(malformed.components[0], {
      id: 'bad',
      annotationCode: 'D99',
      label: '',
      type: '',
      requirement: '',
      validation: '',
      binding: '',
      states: 'ready',
    });

    assert.deepEqual(auditScreenContractRuntime([malformed]), [
      'MH-999/code: MH-999',
      'MH-999/pageKey: 3-99-ui',
      'MH-999/route: account/affiliate',
      'MH-999/displayTitle: empty',
      'MH-999/actor: empty',
      'MH-999/primaryAction: empty',
      'MH-999/safeExit: empty',
      'MH-999/states: invalid',
      'MH-999/bad/id: bad',
      'MH-999/bad/annotationCode: D99',
      'MH-999/bad/label: empty',
      'MH-999/bad/type: empty',
      'MH-999/bad/requirement: empty',
      'MH-999/bad/validation: empty',
      'MH-999/bad/binding: empty',
      'MH-999/bad/states: invalid',
    ]);

    const unownedState = structuredClone(SCREEN_CONTRACTS.at(0));
    assert.ok(unownedState);
    Object.assign(unownedState.components[0], { states: ['editing'] });
    assert.deepEqual(auditScreenContractRuntime([unownedState]), [
      'MH-001/D01/state-not-owned: editing',
    ]);

    const invalidComponents = structuredClone(SCREEN_CONTRACTS.at(0));
    assert.ok(invalidComponents);
    Object.assign(invalidComponents, { components: 'D01' });
    assert.deepEqual(auditScreenContractRuntime([invalidComponents]), [
      'MH-001/components: invalid',
    ]);

    const emptyComponents = structuredClone(SCREEN_CONTRACTS.at(0));
    assert.ok(emptyComponents);
    Object.assign(emptyComponents, { components: [] });
    assert.deepEqual(auditScreenContractRuntime([emptyComponents]), [
      'MH-001/components: empty',
    ]);

    const mismatchedAnnotation = structuredClone(SCREEN_CONTRACTS.at(0));
    assert.ok(mismatchedAnnotation);
    Object.assign(mismatchedAnnotation.components[0], {
      annotationCode: 'F01',
    });
    assert.deepEqual(auditScreenContractRuntime([mismatchedAnnotation]), [
      'MH-001/D01/annotationCode: F01',
    ]);

    const emptyTitle = structuredClone(SCREEN_CONTRACTS.at(0));
    assert.ok(emptyTitle);
    Object.assign(emptyTitle, { title: '' });
    assert.deepEqual(auditScreenContractRuntime([emptyTitle]), [
      'MH-001/title: empty',
    ]);
  });

  it('should accept the complete production snapshot at runtime', () => {
    assert.deepEqual(auditScreenContractRuntime(SCREEN_CONTRACTS), []);
  });

  it('should preserve corrected Vietnamese semantics and exact technical predicates', () => {
    const screen = (code: string) => {
      const value = SCREEN_CONTRACTS.find((item) => item.code === code);
      assert.ok(value, code);
      return value;
    };
    const component = (owner: string) => {
      const [code, id] = owner.split('/');
      const value = screen(code ?? '').components.find(
        (item) => item.id === id,
      );
      assert.ok(value, owner);
      return value;
    };

    assert.equal(
      screen('MH-021').primaryAction,
      'Phát lại quyết định phân bổ ghi nhận',
    );
    assert.equal(screen('MH-042').primaryAction, 'Gửi lời mời thành viên');
    assert.equal(
      screen('MH-049').primaryAction,
      'Thử lại hoặc khắc phục chi trả hoa hồng',
    );
    assert.equal(
      screen('MH-058').primaryAction,
      'Thử đồng bộ lại nguồn dữ liệu sản phẩm',
    );
    assert.equal(
      screen('MH-024').displayTitle,
      'Bộ chọn sản phẩm và phiếu ưu đãi cho Video',
    );
    assert.equal(component('MH-022/D02').label, 'Trình phát Video');
    assert.equal(component('MH-025/D01').label, 'Trình phát Video');
    assert.equal(component('MH-030/D01').label, 'Trình phát LIVE');
    assert.equal(
      component('MH-002/F06').requirement,
      'Có điều kiện · `participantType=business`',
    );
    assert.equal(
      component('MH-038/F05').requirement,
      'Có điều kiện · `action=report_issue`',
    );
    assert.equal(
      component('MH-039/F04').requirement,
      'Có điều kiện · `decision=request_revision|reject`',
    );
    assert.equal(
      component('MH-047/F06').requirement,
      'Có điều kiện · `needs_action`',
    );
    assert.equal(
      component('MH-049/D02').requirement,
      'Có điều kiện · `needs_action|failed|held`',
    );
    assert.match(
      component('MH-003/A01').binding,
      /`pending`.*`verified`.*`failed`.*`expired`/,
    );
    assert.equal(
      component('MH-050/A01').label,
      'Đóng kỳ, đối soát, tạm giữ, giải phóng hoặc điều chỉnh',
    );
    assert.equal(
      component('MH-006/A01').binding,
      'Tạo tác vụ xuất dữ liệu; thông báo kèm mã tham chiếu nhật ký kiểm toán.',
    );
    assert.equal(
      component('MH-012/A02').binding,
      'Nhật ký phân tích chỉ ghi mã tài sản, không ghi toàn bộ URL nhạy cảm.',
    );
    assert.equal(component('MH-018/D04').type, 'Bảng tỷ lệ');
    assert.match(
      component('MH-018/D06').validation,
      /trước và sau.*mã tham chiếu/,
    );
    assert.match(
      component('MH-019/A01').validation,
      /không lưu dữ liệu lâu dài/i,
    );
    assert.match(
      component('MH-021/D02').validation,
      /đường dẫn tới quyết định được chọn/,
    );
    assert.match(component('MH-022/A01').binding, /máy chủ đối soát/);
    assert.match(component('MH-023/A01').binding, /Lưu lâu dài/);
    assert.match(
      component('MH-024/F03').validation,
      /sản phẩm và biến thể.*duy nhất/i,
    );
    assert.match(component('MH-025/D03').validation, /giá, tồn kho/);
    assert.match(
      component('MH-027/A01').requirement,
      /`live\|replay`.*`upcoming`/,
    );
    assert.match(component('MH-029/D01').validation, /kết nối tiếp nhận luồng/);
    assert.equal(component('MH-029/A02').label, 'Ghim hoặc bỏ ghim sản phẩm');
    assert.match(component('MH-033/A01').requirement, /không còn lỗi chặn/);
    assert.equal(
      component('MH-036/A01').binding,
      'Trả về mã và trạng thái tin nhắn.',
    );
    assert.equal(
      component('MH-042/A02').label,
      'Chấp nhận, từ chối, rời hoặc gỡ thành viên',
    );
    assert.match(component('MH-046/D02').validation, /4 ký tự cuối/);
    assert.match(component('MH-046/D04').validation, /số tiền bị ảnh hưởng/);
    assert.match(component('MH-052/F01').validation, /người phụ trách/);
    assert.equal(
      component('MH-052/A01').label,
      'Nhận xử lý, phân công hoặc chuyển cấp',
    );
    assert.match(component('MH-058/A02').validation, /nội dung và theo dõi/);
    assert.match(
      component('MH-058/D05').validation,
      /đồng bộ gần nhất.*thành công/,
    );

    const serialized = JSON.stringify(SCREEN_CONTRACTS);
    assert.doesNotMatch(
      serialized,
      /Máy nghe nhạc|dai dẳng|Tùy chọn tùy chọn|Thời gian hiệu quả|vệ sinh|Không có sự kiên trì|điều hòa|kinh điển hóa|\bbình thường\b/iu,
    );
  });

  it('should preserve correction-batch-two source meaning in representative contracts', () => {
    const screen = (code: string) => {
      const value = SCREEN_CONTRACTS.find((item) => item.code === code);
      assert.ok(value, code);
      return value;
    };
    const component = (owner: string) => {
      const [code, id] = owner.split('/');
      const value = screen(code ?? '').components.find(
        (item) => item.id === id,
      );
      assert.ok(value, owner);
      return value;
    };

    assert.equal(
      component('MH-001/D03').validation,
      'Mã lý do, thời điểm có hiệu lực và URL khắc phục; không để lộ quy tắc chống gian lận.',
    );
    assert.equal(
      component('MH-002/F03').binding,
      '`application.displayName`; xem trước tên công khai hiển thị cho người dùng.',
    );
    assert.equal(
      component('MH-003/F04').requirement,
      'Có điều kiện · `method=evidence|dns|code`',
    );
    assert.match(component('MH-003/A02').validation, /tạo thử thách mới/i);
    assert.match(
      component('MH-004/F03').validation,
      /quan trọng theo chính sách/,
    );
    assert.match(component('MH-005/A01').validation, /kiểu nút nguy hiểm/);
    assert.equal(
      component('MH-009/F02').requirement,
      'Có điều kiện · `action=decline` và chương trình yêu cầu lý do',
    );
    assert.match(
      component('MH-009/D03').validation,
      /đồng hồ phía máy khách không phải nguồn thời gian có thẩm quyền/i,
    );
    assert.match(component('MH-009/A01').binding, /đăng ký tham gia/);
    assert.match(
      component('MH-009/A02').validation,
      /không báo thành công giả/i,
    );
    assert.match(
      component('MH-011/F04').validation,
      /không dùng số dấu phẩy động/i,
    );
    assert.match(
      component('MH-013/A01').validation,
      /bản chụp mức hoa hồng.*phiên bản.*mã sản phẩm được tạo/,
    );
    assert.equal(
      component('MH-015/A01').binding,
      'Điều hướng PDP; giữ nguyên tài sản, Creator và sub-ID.',
    );
    assert.equal(
      component('MH-016/A01').binding,
      'Tạo tác vụ xuất dữ liệu; tải xuống được kiểm toán.',
    );
    assert.equal(component('MH-018/A01').label, 'Mở bằng chứng/khiếu nại');
    assert.match(
      component('MH-018/D05').validation,
      /cơ sở tính đủ điều kiện theo xu/,
    );
    assert.equal(
      component('MH-022/D03').type,
      'Chip hồ sơ + Trạng thái theo dõi',
    );
    assert.match(
      component('MH-022/D05').binding,
      /nội dung chính sách được quản lý theo phiên bản/,
    );
    assert.equal(
      component('MH-025/A02').requirement,
      'Có điều kiện · theo chính sách và trạng thái đăng nhập',
    );
    assert.equal(component('MH-027/A01').label, 'Vào phòng/Đặt lời nhắc');
    assert.equal(
      component('MH-030/D04').requirement,
      'Có điều kiện · khi có sản phẩm đang hoạt động',
    );
    assert.equal(
      component('MH-030/A02').requirement,
      'Có điều kiện · theo trạng thái đăng nhập và chính sách',
    );
    assert.match(component('MH-031/D01').validation, /người được giao xử lý/);
    assert.equal(component('MH-031/D02').label, 'Trình xem bằng chứng');
    assert.equal(
      component('MH-031/D02').type,
      'Trình phát Video an toàn + Điểm đánh dấu sự kiện',
    );
    assert.match(component('MH-033/F06').binding, /tác vụ xác thực/);
    assert.equal(
      component('MH-035/D02').validation,
      'Phiên bản, phạm vi, mục đích và nhóm người nhận; thời điểm cấp, thu hồi và hết hạn.',
    );
    assert.match(
      component('MH-036/D04').binding,
      /liên kết sâu đến đúng cuộc trò chuyện và phiên bản/i,
    );
    assert.match(
      component('MH-042/F02').validation,
      /tập giá trị do máy chủ quy định/i,
    );
    assert.match(
      component('MH-042/A01').validation,
      /thời điểm hết hạn do máy chủ tạo/,
    );
    assert.match(
      component('MH-043/D01').validation,
      /quyền được cho phép, bị từ chối hoặc kế thừa/i,
    );
    assert.equal(
      component('MH-050/F01').requirement,
      'Bắt buộc chọn khoảng thời gian; các bộ lọc khác là tùy chọn',
    );
    assert.match(
      component('MH-052/D03').validation,
      /thời hạn và thời gian phía máy chủ/,
    );
    assert.equal(
      component('MH-054/D03').binding,
      '`appeal.history/result`; bao gồm thời điểm có hiệu lực.',
    );
    assert.match(
      component('MH-058/D03').validation,
      /giá trị nội bộ.*giá trị từ nguồn dữ liệu bên ngoài/i,
    );
    assert.match(
      component('MH-058/A01').validation,
      /không báo thành công tức thì giả/,
    );
    assert.equal(
      component('MH-058/A01').binding,
      'Tạo tác vụ đồng bộ và mã tham chiếu; hiển thị trạng thái đã xếp hàng, đang chạy hoặc kết quả.',
    );
    assert.match(
      component('MH-059/A01').binding,
      /tác vụ xuất dữ liệu và mã tham chiếu/,
    );
    assert.equal(screen('MH-012').primaryAction, 'Tạo liên kết Affiliate');
    assert.equal(
      screen('MH-040').primaryAction,
      'Tạo tài sản Affiliate cho người bán',
    );

    for (const owner of [
      'MH-007/D02',
      'MH-011/A02',
      'MH-019/A02',
      'MH-042/F02',
      'MH-043/D01',
      'MH-057/A02',
    ]) {
      assert.doesNotMatch(
        JSON.stringify(component(owner)),
        /phạm vi hiệu quả|phiên bản hiệu quả|quyền hiệu quả|trạng thái hiệu quả/i,
        owner,
      );
    }

    const serialized = JSON.stringify(SCREEN_CONTRACTS);
    assert.doesNotMatch(
      serialized,
      /đối diện với người sáng tạo|thử thách xoay vòng|kiểu dáng nguy hiểm|thẩm quyền của khách hàng|tuyển sinh|thành công sai lầm|không bao giờ nổi|ảnh chụp nhanh tốc độ liên kết|sự thành công ngay lập tức giả|công việc xuất|những người khác tùy chọn/iu,
    );
  });

  it('should preserve correction-batch-three composite and operational source meaning', () => {
    const component = (owner: string) => {
      const [code, id] = owner.split('/');
      const value = SCREEN_CONTRACTS.find(
        (screen) => screen.code === code,
      )?.components.find((item) => item.id === id);
      assert.ok(value, owner);
      return value;
    };

    assert.equal(
      component('MH-022/D03').type,
      'Chip hồ sơ + Trạng thái theo dõi',
    );
    assert.equal(
      component('MH-031/D02').type,
      'Trình phát Video an toàn + Điểm đánh dấu sự kiện',
    );
    assert.equal(
      component('MH-005/D01').validation,
      'Các cột: mã tham chiếu, người nộp đơn, loại, thời điểm gửi, trạng thái, rủi ro, người được giao xử lý và SLA; hỗ trợ sắp xếp phía máy chủ.',
    );
    assert.equal(
      component('MH-053/D01').validation,
      'Phạm vi vụ việc, mức độ nghiêm trọng, trạng thái, người được giao xử lý, SLA và nguồn; PII được che bớt.',
    );
    assert.equal(
      component('MH-005/D02').requirement,
      'Luôn hiển thị trong màn hình chi tiết · Chỉ đọc',
    );
    assert.equal(
      component('MH-042/D03').requirement,
      'Luôn hiển thị trong màn hình chi tiết · Chỉ đọc',
    );
    assert.deepEqual(
      [component('MH-005/D03').label, component('MH-053/D03').label],
      ['Trình xem bằng chứng', 'Trình xem bằng chứng'],
    );
    assert.deepEqual(
      [component('MH-005/D03').type, component('MH-053/D03').type],
      [
        'Giao diện tab + Bản xem trước an toàn',
        'Giao diện tab + Bản xem trước an toàn',
      ],
    );
    assert.equal(
      component('MH-005/D03').binding,
      'Quyền truy cập có chữ ký ngắn hạn kèm sự kiện nhật ký kiểm toán.',
    );
    assert.equal(
      component('MH-058/D03').label,
      'So sánh chênh lệch tồn kho/khả dụng và mức hoa hồng',
    );

    assert.equal(
      component('MH-010/A01').binding,
      'Tạo tài sản giới thiệu và trả về mã tham chiếu.',
    );
    assert.equal(
      component('MH-020/A02').requirement,
      'Có điều kiện · khi có mã tham chiếu',
    );
    assert.equal(
      component('MH-039/D04').validation,
      'Điều kiện phát hành, trạng thái tạm giữ và lý do, số tiền theo xu và mã tham chiếu.',
    );
    assert.equal(
      component('MH-049/D01').validation,
      'Sự kiện, trạng thái, thời điểm có hiệu lực, hành động cần thực hiện và mã tham chiếu; phân trang bằng con trỏ.',
    );
    assert.equal(
      component('MH-050/D04').validation,
      'Tác nhân, mục đích, phiên bản, hành động và mã tham chiếu; dữ liệu xuất đã che thông tin nhạy cảm.',
    );
    assert.equal(
      component('MH-059/D04').validation,
      'Trạng thái thu nhập, số tiền theo xu, nhà tài trợ và mã tham chiếu điều chỉnh hoặc thanh toán.',
    );
    assert.match(component('MH-046/D03').validation, /^Mã tham chiếu,/);
    assert.match(component('MH-051/D01').validation, /^Mã tham chiếu,/);

    assert.equal(
      component('MH-006/D04').label,
      'Độ mới của dữ liệu/định nghĩa',
    );
    assert.equal(
      component('MH-008/D01').binding,
      '`offer.product/*`; kèm thời điểm cập nhật gần nhất.',
    );
    assert.equal(
      component('MH-016/D04').label,
      'Độ mới của dữ liệu/định nghĩa',
    );
    assert.equal(component('MH-058/D05').label, 'Thời điểm cập nhật gần nhất');
    assert.equal(
      component('MH-059/D05').label,
      'Độ mới của dữ liệu/định nghĩa',
    );
    assert.equal(
      component('MH-044/A01').validation,
      'Lô có tính lũy đẳng; trả về rõ ràng kết quả của từng mục, không bỏ qua kết quả mà không thông báo.',
    );

    assert.doesNotMatch(
      JSON.stringify(SCREEN_CONTRACTS),
      /người được chuyển nhượng|Người xem bằng chứng|Luôn chi tiết|tài liệu tham khảo|Độ tươi|tươi mới|không bao giờ im lặng|xuất dữ liệu được điều chỉnh lại|Sẵn có\/tỷ lệ khác|Thẻ lọc hồ sơ|sự kiện kiểm tra/iu,
    );
  });

  it('should preserve correction-batch-four Vietnamese glossary and source semantics', () => {
    const screen = (code: string) => {
      const value = SCREEN_CONTRACTS.find((item) => item.code === code);
      assert.ok(value, code);
      return value;
    };
    const component = (owner: string) => {
      const [code, id] = owner.split('/');
      const value = screen(code ?? '').components.find(
        (item) => item.id === id,
      );
      assert.ok(value, owner);
      return value;
    };

    assert.equal(
      component('MH-005/D03').validation,
      'Trạng thái quét, nguồn gốc và thời hạn; không cung cấp URL trực tiếp có hiệu lực vĩnh viễn tới tệp.',
    );
    assert.equal(
      component('MH-035/F03').requirement,
      'Bắt buộc nếu bật bất kỳ hình thức chia sẻ nào',
    );
    assert.equal(
      component('MH-039/D03').validation,
      'Thời hạn do máy chủ quy định, SLA xét duyệt, quy tắc mặc nhiên chấp nhận và phiên bản áp dụng.',
    );
    assert.equal(
      component('MH-040/A02').binding,
      'Tạo tác vụ xuất dữ liệu hoặc điều hướng tới đường dẫn nội bộ.',
    );
    assert.equal(
      component('MH-047/F01').label,
      'Phân loại đối tượng Hoa Kỳ (US person) và phân loại thuế',
    );
    assert.equal(
      component('MH-047/F01').validation,
      'Tập giá trị do máy chủ cung cấp xác định luồng W-9/W-8; không trình bày nội dung như tư vấn thuế.',
    );
    assert.equal(
      component('MH-020/D04').validation,
      'Nhà tài trợ phải thuộc tập giá trị cho phép; quyền truy cập bằng chứng có chữ ký, thời hạn ngắn và được ghi nhật ký kiểm toán.',
    );
    assert.match(
      component('MH-021/A02').validation,
      /đã che\/lược bỏ thông tin nhạy cảm.*hình mờ và mã tham chiếu/i,
    );
    assert.match(
      component('MH-031/A02').validation,
      /đã che\/lược bỏ thông tin nhạy cảm/i,
    );
    assert.equal(
      component('MH-022/D02').binding,
      '`video.playback.*`; URL phương tiện có chữ ký và thời hạn, không chứa bí mật có hiệu lực vĩnh viễn.',
    );
    assert.equal(
      component('MH-048/A01').validation,
      'URL có chữ ký và thời hạn; an toàn trước chèn công thức CSV; có ghi nhật ký kiểm toán.',
    );
    assert.equal(
      component('MH-044/A02').requirement,
      'Có điều kiện · Creator được phân công và phân công đang mở',
    );
    assert.equal(component('MH-052/D02').type, 'Ô chọn người phụ trách');
    assert.equal(
      component('MH-055/D03').label,
      'Bằng chứng và nhật ký kiểm toán',
    );
    assert.equal(
      component('MH-024/A01').requirement,
      'Được bật khi tập sản phẩm đã chọn hợp lệ',
    );
    assert.equal(
      component('MH-025/D05').type,
      'Biểu ngữ công bố + Ngữ cảnh ẩn có chữ ký',
    );
    assert.equal(
      component('MH-027/D02').requirement,
      'Có điều kiện · có phiên LIVE sắp diễn ra',
    );
    assert.equal(
      component('MH-035/A01').requirement,
      'Được bật khi hợp lệ và có thay đổi chưa lưu',
    );
    assert.equal(component('MH-037/D01').label, 'So sánh khác biệt phiên bản');
    assert.equal(
      component('MH-039/D02').requirement,
      'Có điều kiện · nội dung hoặc tệp bài nộp đã sẵn sàng',
    );
    assert.equal(component('MH-045/D01').label, 'Tóm tắt tổng hợp');
    assert.equal(component('MH-050/D02').label, 'Bảng chênh lệch');
    assert.equal(component('MH-051/F01').label, 'URL hoặc ID đối tượng');
    assert.equal(
      component('MH-051/D01').label,
      'Biên nhận báo cáo và trạng thái vụ việc',
    );
    assert.equal(component('MH-056/D02').label, 'Hướng dẫn công bố');
    assert.equal(
      component('MH-057/A02').requirement,
      'Có điều kiện theo tình trạng kết nối và chủ sở hữu',
    );
    assert.equal(
      component('MH-058/D03').label,
      'So sánh chênh lệch tồn kho/khả dụng và mức hoa hồng',
    );

    for (const owner of [
      'MH-007/F02',
      'MH-009/F01',
      'MH-013/F02',
      'MH-026/F01',
      'MH-034/F02',
      'MH-035/F03',
      'MH-041/F02',
      'MH-043/F02',
      'MH-047/F01',
      'MH-055/F02',
      'MH-056/F01',
      'MH-059/F02',
    ]) {
      assert.match(
        component(owner).validation,
        /(?:Tập|tập) (?:trạng thái|biến thể|vai trò|giá trị).*do máy chủ (?:cung cấp|quy định)/,
        owner,
      );
    }

    for (const code of [
      'MH-003',
      'MH-004',
      'MH-006',
      'MH-007',
      'MH-008',
      'MH-009',
      'MH-010',
      'MH-012',
      'MH-013',
      'MH-014',
      'MH-016',
      'MH-017',
      'MH-018',
      'MH-020',
      'MH-035',
      'MH-046',
      'MH-056',
      'MH-057',
      'MH-059',
    ]) {
      assert.equal(screen(code).actor, 'Người sáng tạo (Creator)', code);
    }

    const serialized = JSON.stringify(SCREEN_CONTRACTS);
    assert.doesNotMatch(
      serialized,
      /sự cho phép|Máy chủ tập giá trị|Trạng thái tập giá trị|Kiểm toán Thao tác ghi dữ liệu|\bThao tác ghi dữ liệu\b|Tiểu ID|Quay về điểm vào trước|\bbẩn\b|\bhiện vật\b|cuộn lên|phương sai|người trợ giúp|được biên tập lại|đã được chỉnh sửa|lộ trình nội bộ|người tạo được chỉ định và mở/iu,
    );
  });

  it('should preserve correction-batch-five exact source semantics and Vietnamese copy', () => {
    const component = (owner: string) => {
      const [code, id] = owner.split('/');
      const value = SCREEN_CONTRACTS.find(
        (screen) => screen.code === code,
      )?.components.find((item) => item.id === id);
      assert.ok(value, owner);
      return value;
    };
    const expected = {
      'MH-010/F01.validation':
        'Tập giá trị `link|code`; chỉ mặc định giá trị dùng gần nhất khi vẫn được phép.',
      'MH-036/D02.requirement': 'Luôn hiển thị khi được chọn · Chỉ đọc',
      'MH-040/A02.validation':
        'Dùng chính xác cùng bộ lọc; xuất dữ liệu được ghi nhật ký kiểm toán; liên kết tới sổ cái hoặc chuyển đổi.',
      'MH-047/F01.label':
        'Phân loại đối tượng Hoa Kỳ (US person) và phân loại thuế',
      'MH-047/F04.type':
        'Trường giao diện do nhà cung cấp vận hành / Bộ chọn token',
      'MH-049/D02.validation':
        'Biện pháp khắc phục cụ thể và an toàn, thời hạn và tác động; không hiển thị thông báo nội bộ thô từ nhà cung cấp.',
      'MH-028/D01.type': 'Danh sách kiểm tra + Chỉ báo trạng thái kỹ thuật',
      'MH-013/A01.validation':
        'Giới hạn tần suất và bảo đảm tính lũy đẳng; gắn bản chụp mức hoa hồng và phiên bản vào mã sản phẩm được tạo.',
      'MH-003/F02.binding':
        '`channel.property`; máy chủ phân giải URL chuẩn tắc.',
      'MH-051/F06.label': 'Cam kết tính chính xác',
      'MH-059/F02.label': 'Kênh/tài sản số/sub-ID/trạng thái',
      'MH-059/D03.validation':
        'Kênh, tài sản số, sub-ID, dòng đơn hàng, trạng thái phân bổ ghi nhận, doanh số, hoa hồng và phiên bản.',
      'MH-023/F01.binding':
        '`draft.mediaUploadId`; không bao giờ gửi đường dẫn tệp cục bộ.',
      'MH-055/A01.validation':
        'Công tắc dừng khẩn cấp có tính lũy đẳng; phải nêu rõ mọi kết quả từng phần; chỉ khôi phục khi được hỗ trợ.',
      'MH-006/D04.type': 'Biểu ngữ thông tin + Chú giải công cụ (tooltip)',
      'MH-007/D02.type': 'Huy hiệu + Chú giải công cụ (tooltip)',
      'MH-016/D04.type': 'Biểu ngữ thông tin + Chú giải công cụ (tooltip)',
      'MH-024/D02.type': 'Huy hiệu + Chú giải công cụ (tooltip)',
      'MH-040/D04.type': 'Biểu ngữ thông tin / Chú giải công cụ (tooltip)',
      'MH-058/D05.type': 'Dấu thời gian + Chú giải công cụ (tooltip)',
      'MH-002/F04.requirement':
        'Bắt buộc · Nếu lấy từ tài khoản đã xác minh thì trường chỉ đọc',
      'MH-006/F02.validation':
        'Chỉ các kênh và tài sản thuộc sở hữu; `empty=all`; trạng thái bộ lọc có thể lưu an toàn trong URL.',
      'MH-006/A02.binding': 'Mở MH-016/17 với ngữ cảnh bộ lọc có chữ ký.',
      'MH-008/A01.requirement': 'Được bật khi biểu mẫu hợp lệ',
      'MH-008/F02.validation':
        '1–64; `[A-Za-z0-9._-]`; không bắt buộc duy nhất; không có PII.',
      'MH-011/D01.label': 'Xem trước tác động ngân sách',
      'MH-013/A02.validation':
        'Phản hồi thao tác sao chép phải hỗ trợ tiếp cận; thao tác kiểm tra dùng trình phân giải mà không ghi nhận chuyển đổi giả.',
      'MH-019/F06.validation':
        'Số xu USD phải >0; số dư còn lại không được âm.',
      'MH-021/D02.validation':
        'Hiển thị thứ tự và đường dẫn tới quyết định được chọn; cung cấp nội dung văn bản thay thế hỗ trợ tiếp cận.',
      'MH-023/F04.validation':
        'Tập giá trị `public|followers|private` theo chính sách chương trình; chỉ mặc định `public` khi có quyết định sản phẩm rõ ràng đã được phê duyệt, nếu không người dùng phải chọn.',
      'MH-027/D01.type': 'Lưới thẻ thích ứng',
      'MH-034/F02.binding':
        'Áp dụng bộ lọc truy vấn; lưu trạng thái bộ lọc an toàn trong URL.',
      'MH-034/A01.requirement':
        'Có điều kiện · người bán có quyền và Creator cho phép liên hệ qua kênh đó',
      'MH-038/A02.validation':
        'Có tính lũy đẳng; tạo vụ việc và mã tham chiếu; tạm dừng luồng liên quan khi chính sách yêu cầu.',
      'MH-039/D01.label': 'Yêu cầu của hợp đồng',
      'MH-040/D02.validation':
        'Loại nội dung, đích đến, lượt nhấp, đơn hàng, thu nhập, trạng thái và phiên bản.',
      'MH-040/A02.binding':
        'Tạo tác vụ xuất dữ liệu hoặc điều hướng tới đường dẫn nội bộ.',
      'MH-043/F01.label': 'Thông tin tài khoản phụ',
      'MH-043/F04.requirement':
        'Bắt buộc · Mặc định là thời điểm hiện tại nếu chính sách cho phép',
      'MH-045/F01.label': 'Kỳ quyết toán',
      'MH-050/D02.validation':
        'Mã tham chiếu, giá trị dự kiến, giá trị được báo cáo, chênh lệch, nguyên nhân và trạng thái, người phụ trách và SLA; phân trang bằng con trỏ.',
      'MH-051/A01.validation':
        'Có giới hạn tần suất và tính lũy đẳng; máy chủ xác thực quyền sở hữu và quyền truy cập mà không tiết lộ thông tin nội bộ của vụ việc.',
      'MH-053/D04.requirement': 'Luôn hiển thị sau hành động · Chỉ đọc',
      'MH-055/F03.requirement':
        'Bắt buộc · Chỉ mặc định là thời điểm hiện tại nếu chính sách cho phép',
      'MH-055/F05.requirement': 'Có điều kiện · yêu cầu kiểm soát kép',
      'MH-056/F04.validation':
        'Mẫu và phiên bản do máy chủ phê duyệt; nội dung tùy chỉnh phải tuân thủ chính sách; xem trước vị trí hiển thị dễ thấy.',
      'MH-057/A01.binding':
        'Bắt đầu OAuth; lệnh gọi lại lưu mã tham chiếu tới token phía máy chủ.',
      'MH-057/D03.requirement': 'Luôn hiển thị sau mỗi lần kết nối · Chỉ đọc',
      'MH-058/A02.requirement':
        'Có điều kiện · thẻ đang hoạt động và người dùng có quyền',
      'MH-012/F01.validation':
        'HTTPS; miền và đường dẫn thuộc danh sách cho phép; ≤2048 ký tự; chỉ loại bỏ phần sau dấu # theo chính sách.',
      'MH-048/A02.validation':
        'Chỉ điều hướng đường dẫn nội bộ thuộc danh sách cho phép với ID bút toán bất biến.',
      'MH-015/D04.type':
        'Trạng thái ẩn có chữ ký + Giao diện không hiển thị thông tin gỡ lỗi',
      'MH-022/D01.type': 'Luồng nội dung ảo hóa / Danh sách ảo hóa',
      'MH-024/D01.type': 'Lưới sản phẩm có thể chọn / Bảng dữ liệu có thể chọn',
      'MH-015/D01.type': 'Phần đầu hồ sơ',
      'MH-025/D02.type': 'Phần đầu hồ sơ + Nhóm nút biểu tượng',
      'MH-017/A02.binding': 'Giữ nguyên mã tham chiếu bất biến.',
      'MH-043/D01.validation':
        'Quyền có hiệu lực sau khi áp dụng chính sách, gồm quyền được cho phép, bị từ chối hoặc kế thừa, cùng quyền truy cập dữ liệu nhạy cảm.',
    } as const;

    for (const [key, expectedValue] of Object.entries(expected)) {
      const splitAt = key.lastIndexOf('.');
      const owner = key.slice(0, splitAt);
      const field = key.slice(splitAt + 1) as keyof ReturnType<
        typeof component
      >;
      assert.equal(component(owner)[field], expectedValue, key);
    }

    assert.match(component('MH-010/F01').validation, /`link\|code`/);
    assert.doesNotMatch(
      JSON.stringify(SCREEN_CONTRACTS),
      /Mã mời dài 1–64 ký tự|Bộ lọc tương tự|Tình trạng công dân Hoa Kỳ|Trường do nhà cung cấp lưu trữ|Biện pháp khắc phục an toàn, thời hạn|Trạng thái tình trạng|Chứng thực chính xác|đường dẫn địa phương|Trạng thái URL|URL-trạng thái|Lưới thẻ đáp ứng|route nội bộ|tài sản\/thuộc tính|thuộc tính kênh|Luôn theo sau hành động|điều khiển kép|sau nỗ lực/iu,
    );
  });

  it('should preserve correction-batch-six exact component alternatives and privacy authority', () => {
    const component = (owner: string) => {
      const [code, id] = owner.split('/');
      const value = SCREEN_CONTRACTS.find(
        (screen) => screen.code === code,
      )?.components.find((item) => item.id === id);
      assert.ok(value, owner);
      return value;
    };
    const expected = {
      'MH-015/D01.type': 'Phần đầu hồ sơ',
      'MH-040/D04.type': 'Biểu ngữ thông tin / Chú giải công cụ (tooltip)',
      'MH-047/F04.type':
        'Trường giao diện do nhà cung cấp vận hành / Bộ chọn token',
      'MH-049/F02.type': 'Biểu mẫu động / Tải tệp lên',
      'MH-051/F01.type': 'Ô nhập URL / Ô nhập văn bản',
      'MH-055/F05.type': 'Bộ chọn người phê duyệt / Xác nhận',
      'MH-022/D01.type': 'Luồng nội dung ảo hóa / Danh sách ảo hóa',
      'MH-024/D01.type': 'Lưới sản phẩm có thể chọn / Bảng dữ liệu có thể chọn',
      'MH-013/A01.validation':
        'Giới hạn tần suất và bảo đảm tính lũy đẳng; gắn bản chụp mức hoa hồng và phiên bản vào mã sản phẩm được tạo.',
      'MH-028/D01.type': 'Danh sách kiểm tra + Chỉ báo trạng thái kỹ thuật',
      'MH-010/F01.label': 'Kênh/định dạng giới thiệu',
      'MH-023/F04.validation':
        'Tập giá trị `public|followers|private` theo chính sách chương trình; chỉ mặc định `public` khi có quyết định sản phẩm rõ ràng đã được phê duyệt, nếu không người dùng phải chọn.',
      'MH-021/D02.validation':
        'Hiển thị thứ tự và đường dẫn tới quyết định được chọn; cung cấp nội dung văn bản thay thế hỗ trợ tiếp cận.',
      'MH-008/A01.requirement': 'Được bật khi biểu mẫu hợp lệ',
    } as const;

    for (const [key, expectedValue] of Object.entries(expected)) {
      const splitAt = key.lastIndexOf('.');
      const owner = key.slice(0, splitAt);
      const field = key.slice(splitAt + 1) as keyof ReturnType<
        typeof component
      >;
      assert.equal(component(owner)[field], expectedValue, key);
    }

    for (const owner of [
      'MH-040/D04',
      'MH-047/F04',
      'MH-049/F02',
      'MH-051/F01',
      'MH-055/F05',
      'MH-022/D01',
      'MH-024/D01',
    ]) {
      assert.match(component(owner).type, / \/ /u, owner);
      assert.doesNotMatch(component(owner).type, / \+ /u, owner);
    }
    assert.match(component('MH-006/D04').type, / \+ /u);
    assert.match(component('MH-015/D04').type, / \+ /u);
  });

  it('should preserve correction-batch-seven referral format and approved product decision authority', () => {
    const component = (owner: string) => {
      const [code, id] = owner.split('/');
      const value = SCREEN_CONTRACTS.find(
        (screen) => screen.code === code,
      )?.components.find((item) => item.id === id);
      assert.ok(value, owner);
      return value;
    };
    const referralFormat = component('MH-010/F01');

    assert.deepEqual(
      {
        label: referralFormat.label,
        validation: referralFormat.validation,
        binding: referralFormat.binding,
      },
      {
        label: 'Kênh/định dạng giới thiệu',
        validation:
          'Tập giá trị `link|code`; chỉ mặc định giá trị dùng gần nhất khi vẫn được phép.',
        binding: '`referral.format`.',
      },
    );
    assert.equal(
      component('MH-023/F04').validation,
      'Tập giá trị `public|followers|private` theo chính sách chương trình; chỉ mặc định `public` khi có quyết định sản phẩm rõ ràng đã được phê duyệt, nếu không người dùng phải chọn.',
    );
  });

  it('should freeze exact component signatures and full-screen golden digests', () => {
    assert.equal(Object.keys(SCREEN_COMPONENT_ID_SIGNATURE_BY_CODE).length, 59);
    assert.equal(Object.keys(SCREEN_CONTRACT_GOLDEN_DIGEST_BY_CODE).length, 59);

    for (const screen of SCREEN_CONTRACTS) {
      assert.equal(
        screen.components.map((component) => component.id).join(','),
        SCREEN_COMPONENT_ID_SIGNATURE_BY_CODE[screen.code],
        screen.code,
      );
      assert.equal(
        createHash('sha256').update(JSON.stringify(screen)).digest('hex'),
        SCREEN_CONTRACT_GOLDEN_DIGEST_BY_CODE[screen.code],
        screen.code,
      );
    }
  });

  it('should assign one primary footer action and non-degenerate semantic regions', () => {
    const allComponents = SCREEN_CONTRACTS.flatMap(
      (screen) => screen.components,
    );
    const actions = allComponents.filter((component) =>
      component.id.startsWith('A'),
    );
    const footerActions = actions.filter(
      (component) => component.region === 'footer',
    );

    assert.equal(actions.length, 99);
    assert.equal(footerActions.length, 59);
    assert.ok(
      allComponents.filter((component) => component.region === 'header')
        .length >= 40,
    );
    assert.ok(actions.some((component) => component.region === 'secondary'));
    assert.ok(actions.some((component) => component.region === 'aside'));
    for (const screen of SCREEN_CONTRACTS) {
      assert.equal(
        screen.components.filter(
          (component) =>
            component.id.startsWith('A') && component.region === 'footer',
        ).length,
        1,
        screen.code,
      );
    }
  });
});
