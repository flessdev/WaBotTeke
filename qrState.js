let currentQR = null;

export const getQR = () => currentQR;
export const setQR = v => { currentQR = v };
export const clearQR = () => { currentQR = null };