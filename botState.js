let isActive = false;
let ownerJid = null;

export const getIsActive = () => isActive; 
export const setIsActive = v => { isActive = v };

export const getOwnerJid = () => ownerJid; 
export const setOwnerJid = v => { ownerJid = v };