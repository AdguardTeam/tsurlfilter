/**
 * Pads a number with leading zeros.
 * @param num The number to pad.
 * @param size The number of digits to pad to.
 * @returns The padded number.
 */
const pad = (num: number, size = 2): string => {
    return num.toString().padStart(size, '0');
};

/**
 * Formats a date into an ISO 8601-like string with milliseconds.
 *
 * @param {Date|number} date The date object or timestamp to format.
 * @returns {string} The formatted date string.
 */
export const formatTime = (date: Date | number): string => {
    const d = (date instanceof Date) ? date : new Date(date);
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1); // Months are 0-based
    const day = pad(d.getDate());
    const hour = pad(d.getHours());
    const minute = pad(d.getMinutes());
    const second = pad(d.getSeconds());
    const millisecond = pad(d.getMilliseconds(), 3); // Milliseconds are 3 digits

    return `${year}-${month}-${day}T${hour}:${minute}:${second}:${millisecond}`;
};
