const EM_DASH = '—';

const USD_PRICE_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const SMALL_USD_PRICE_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

const COMPACT_USD_FORMATTER = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const MARKET_TIMESTAMP_FORMATTER = new Intl.DateTimeFormat('en-US', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
});

export const formatMarketPrice = (value: number | undefined): string => {
  if (value === undefined) return EM_DASH;
  return value < 1
    ? SMALL_USD_PRICE_FORMATTER.format(value)
    : USD_PRICE_FORMATTER.format(value);
};

export const formatCompactUsd = (value: number | undefined): string =>
  value === undefined ? EM_DASH : COMPACT_USD_FORMATTER.format(value);

export const formatMarketChange = (value: number | undefined): string => {
  if (value === undefined) return EM_DASH;
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  return `${sign}${Math.abs(value).toFixed(2)}%`;
};

export const formatMarketTimestamp = (value: string | undefined): string => {
  if (value === undefined) return EM_DASH;
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime())
    ? EM_DASH
    : MARKET_TIMESTAMP_FORMATTER.format(timestamp);
};
