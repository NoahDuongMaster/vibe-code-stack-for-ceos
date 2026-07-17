import type { TDiagramSpec, TDiagramTarget } from './types.ts';

const VIETNAMESE_SIGNAL =
  /[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

const TECHNICAL_ONLY_PATTERNS = [
  /^(?:SP|CN|QT|MH|KT)-\d{3}(?:–(?:SP|CN|QT|MH|KT)-\d{3})?$/,
  /^SRS-BENA-AFF-US-\d{3}$/,
  /^\/(?:[A-Za-z0-9_{}:.*-]+\/)*[A-Za-z0-9_{}:.*-]+$/,
  /^(?:GET|POST|PUT|PATCH|DELETE) \/[A-Za-z0-9_/{ }:.*-]+$/,
  /^(?:apps|services|packages|scripts|docs|src)\/[A-Za-z0-9_./{}*-]+$/,
  /^(?:Storefront|Vendor Portal|Medusa Admin|YouTube(?: Shopping| feed\/tag)?|OAuth|BFF\/API|RBAC|LIVE Commerce|Buyer|Viewer|Creator|Host|Sample)$/,
];

const FORBIDDEN_PATTERNS = [
  /Visual aid/i,
  /normative text/i,
  /request \/ navigation/i,
  /audit \/ evidence/i,
  /Loading\/error\/denied/i,
  /Remediation \/ safe exit/i,
];

export const auditVietnameseCopy = (
  targets: readonly TDiagramTarget[],
  specs: readonly TDiagramSpec[],
): string[] => {
  const errors: string[] = [];
  const visibleValues = [
    ...targets.flatMap((target) => [
      target.title,
      target.codeRange,
      target.alt,
      target.caption,
    ]),
    ...specs.flatMap((spec) => [
      spec.title,
      spec.subtitle,
      spec.scope,
      ...spec.columns.flatMap((column) => [
        column.title,
        ...column.nodes.flatMap((node) => [node.label, node.detail]),
      ]),
      ...spec.edges.map((edge) => edge.label),
    ]),
  ];

  for (const [index, value] of visibleValues.entries()) {
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(value)) {
        errors.push(`visible[${index}]: ${pattern}`);
      }
    }

    const isTechnicalOnly = TECHNICAL_ONLY_PATTERNS.some((pattern) =>
      pattern.test(value),
    );
    if (!VIETNAMESE_SIGNAL.test(value) && !isTechnicalOnly) {
      errors.push(`visible[${index}]: missing Vietnamese explanatory copy`);
    }
  }

  return errors;
};
