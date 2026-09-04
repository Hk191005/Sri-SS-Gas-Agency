/**
 * Time-aware, IST-safe Greeting Helper for SRI SS GAS AGENCY
 * 
 * Rules:
 * - 05:00 – 11:59 -> "Good morning"
 * - 12:00 – 16:59 -> "Good afternoon"
 * - 17:00 – 20:59 -> "Good evening"
 * - 21:00 – 04:59 -> "Good night"
 * 
 * @param date Optional Date instance to evaluate (defaults to device local time)
 * @returns Time-aware greeting string
 */
export function getTimeBasedGreeting(date: Date = new Date()): string {
  const hours = date.getHours();

  if (hours >= 5 && hours < 12) {
    return 'Good morning';
  }
  if (hours >= 12 && hours < 17) {
    return 'Good afternoon';
  }
  if (hours >= 17 && hours < 21) {
    return 'Good evening';
  }
  return 'Good night';
}
