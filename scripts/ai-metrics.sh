#!/bin/bash
# AI Metrics Reporter
#
# Measures real AI coding impact using the same methodology as:
#   - Cursor study (Borusyak et al., arxiv 2511.04427, MSR 2026 Distinguished Paper)
#     → Monthly cohort analysis: lines added, commits per month
#   - Microsoft RCT (Butler et al., arxiv 2410.18334)
#     → Objective telemetry: actual lines changed (not subjective satisfaction)
#
# Usage:
#   ./scripts/ai-metrics.sh          # full report
#   ./scripts/ai-metrics.sh monthly  # monthly breakdown only
#   ./scripts/ai-metrics.sh ratio    # AI vs manual commit ratio

set -euo pipefail

LOG_FILE=".ai-metrics/log.jsonl"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_PATH="$ROOT_DIR/$LOG_FILE"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; BOLD='\033[1m'; RESET='\033[0m'

if [ ! -f "$LOG_PATH" ]; then
  echo -e "${YELLOW}No metrics data yet.${RESET} Commit some code first."
  echo "AI-session commits are tagged automatically when Claude Code is running."
  exit 0
fi

TOTAL=$(wc -l < "$LOG_PATH" | tr -d ' ')
if [ "$TOTAL" -eq 0 ]; then
  echo "No commits logged yet."
  exit 0
fi

echo -e "\n${BOLD}━━━ AI Metrics Report ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "  Methodology: Cursor study (arxiv:2511.04427) + Microsoft RCT (arxiv:2410.18334)"
echo -e "  Log: $LOG_FILE  |  Total commits: $TOTAL\n"

# ── Summary ──────────────────────────────────────────────────────────────────
AI_COMMITS=$(python3 -c "
import json, sys
data = [json.loads(l) for l in open('$LOG_PATH') if l.strip()]
ai = sum(1 for d in data if d.get('ai'))
manual = len(data) - ai
ai_ins = sum(d.get('ins',0) for d in data if d.get('ai'))
manual_ins = sum(d.get('ins',0) for d in data if not d.get('ai'))
ai_del = sum(d.get('del',0) for d in data if d.get('ai'))
manual_del = sum(d.get('del',0) for d in data if not d.get('ai'))
print(f'{ai},{manual},{ai_ins},{manual_ins},{ai_del},{manual_del}')
")
AI_C=$(echo $AI_COMMITS | cut -d',' -f1)
MAN_C=$(echo $AI_COMMITS | cut -d',' -f2)
AI_INS=$(echo $AI_COMMITS | cut -d',' -f3)
MAN_INS=$(echo $AI_COMMITS | cut -d',' -f4)
AI_DEL=$(echo $AI_COMMITS | cut -d',' -f5)
MAN_DEL=$(echo $AI_COMMITS | cut -d',' -f6)

echo -e "${BOLD}OVERALL SUMMARY${RESET}"
printf "  %-22s %s\n" "AI-assisted commits:" "${GREEN}${AI_C}${RESET} / $TOTAL ($(python3 -c "print(f'{int($AI_C)*100//int($TOTAL) if int($TOTAL)>0 else 0}%')"))"
printf "  %-22s %s\n" "Manual commits:" "${YELLOW}${MAN_C}${RESET}"
printf "  %-22s %s\n" "AI lines added:" "${GREEN}+${AI_INS}${RESET}"
printf "  %-22s %s\n" "Manual lines added:" "${YELLOW}+${MAN_INS}${RESET}"
if [ "$AI_C" -gt 0 ] && [ "$MAN_C" -gt 0 ] && [ "$MAN_INS" -gt 0 ]; then
  RATIO=$(python3 -c "r=$AI_INS/$MAN_INS if $MAN_INS>0 else 0; print(f'{r:.1f}x')")
  echo -e "  ${BOLD}AI lines/commit ratio vs manual: ${GREEN}${RATIO}${RESET}"
fi

# ── Monthly breakdown (Cursor study methodology) ─────────────────────────────
echo -e "\n${BOLD}MONTHLY BREAKDOWN${RESET} (Cursor study: gains peaked M1=+281%, decayed to ~0% by M3+)"

python3 -c "
import json, sys
from collections import defaultdict
from datetime import datetime, timezone

data = [json.loads(l) for l in open('$LOG_PATH') if l.strip()]
if not data:
    print('  No data.')
    sys.exit(0)

# Find project start = first commit date
first_ts = min(datetime.fromisoformat(d['ts'].replace('Z','+00:00')) for d in data)
months = defaultdict(lambda: {'ai_commits':0,'man_commits':0,'ai_ins':0,'man_ins':0,'ai_del':0,'man_del':0})

for d in data:
    ts = datetime.fromisoformat(d['ts'].replace('Z','+00:00'))
    # Month number since project start (1-indexed)
    delta_months = (ts.year - first_ts.year)*12 + (ts.month - first_ts.month) + 1
    key = f'Month {delta_months:02d} ({ts.strftime(\"%Y-%m\")})'
    if d.get('ai'):
        months[key]['ai_commits'] += 1
        months[key]['ai_ins'] += d.get('ins',0)
        months[key]['ai_del'] += d.get('del',0)
    else:
        months[key]['man_commits'] += 1
        months[key]['man_ins'] += d.get('ins',0)
        months[key]['man_del'] += d.get('del',0)

print(f'  {\"Period\":<28} {\"AI commits\":>10} {\"AI +lines\":>10} {\"Manual +lines\":>14}')
print(f'  {\"-\"*28} {\"-\"*10} {\"-\"*10} {\"-\"*14}')
for key in sorted(months.keys()):
    m = months[key]
    total_c = m['ai_commits'] + m['man_commits']
    ai_pct = f\"({m['ai_commits']*100//total_c}%)\" if total_c > 0 else ''
    print(f'  {key:<28} {m[\"ai_commits\"]:>6} {ai_pct:>4} {m[\"ai_ins\"]:>10} {m[\"man_ins\"]:>14}')
"

# ── Dose-response check (Copilot study methodology) ───────────────────────────
echo -e "\n${BOLD}USAGE INTENSITY${RESET} (Copilot study: high usage = +40.5% PRs vs low = +21%)"
python3 -c "
import json
from collections import defaultdict
from datetime import datetime

data = [json.loads(l) for l in open('$LOG_PATH') if l.strip()]
# Group by week and check AI ratio
weeks = defaultdict(lambda: {'ai':0,'total':0})
for d in data:
    ts = datetime.fromisoformat(d['ts'].replace('Z','+00:00'))
    wk = ts.strftime('%Y-W%W')
    weeks[wk]['total'] += 1
    if d.get('ai'): weeks[wk]['ai'] += 1

high = sum(1 for w in weeks.values() if w['total']>0 and w['ai']/w['total']>=0.7)
mid  = sum(1 for w in weeks.values() if w['total']>0 and 0.3<=w['ai']/w['total']<0.7)
low  = sum(1 for w in weeks.values() if w['total']>0 and w['ai']/w['total']<0.3)
total_wks = len(weeks)
print(f'  High AI usage weeks  (≥70% commits AI): {high}/{total_wks}')
print(f'  Mid  AI usage weeks (30-70% AI):        {mid}/{total_wks}')
print(f'  Low  AI usage weeks  (<30% AI):         {low}/{total_wks}')
if total_wks > 0:
    overall = sum(w['ai'] for w in weeks.values()) / sum(w['total'] for w in weeks.values())
    tier = 'High (+40.5% PR gain predicted)' if overall>=0.7 else 'Mid (+39.4%)' if overall>=0.3 else 'Low (+21%)'
    print(f'  Overall AI intensity: {overall:.0%} → {tier}')
"

echo -e "\n${BOLD}TIP${RESET}: Run ${BLUE}./scripts/ai-metrics.sh${RESET} after each sprint to track month-over-month trend."
echo -e "Objective: keep AI usage in ${GREEN}High tier${RESET} to sustain the Copilot dose-response benefit.\n"
