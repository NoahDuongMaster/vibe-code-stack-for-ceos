const getInfoDevice = () => {
  const device = /(iPhone|iPad|iPod|iOS|Android)/i.test(navigator.userAgent)
    ? 'MOBILE'
    : 'DESKTOP';
  const collapsed = device !== 'DESKTOP';

  return {
    device,
    collapsed,
  } as const;
};

export { getInfoDevice };
