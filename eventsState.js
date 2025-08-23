let anotherEventsIsActive = false;
let anotherEventsCode = '';

export const getEventsCode = () => anotherEventsCode;
export const setEventsCode = code => { anotherEventsCode = code };

export const isEventsActive = () => anotherEventsIsActive;
export const setEventsActive = v => { anotherEventsIsActive = v };
