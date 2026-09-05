export function generateTicketNumber(sequence: number): string {
  const year = new Date().getFullYear();
  return `TKT-${year}-${String(sequence).padStart(6, "0")}`;
}