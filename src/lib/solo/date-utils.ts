import { parseISO, differenceInCalendarDays, format, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata datas de vencimento de maneira clara, rica e humanizada para o WhatsApp
 * Exemplo de retorno:
 * "15/09/2026 (Terça-feira · vence em 3 dias)"
 * "13/09/2026 (Amanhã · Domingo)"
 * "12/09/2026 (Hoje · Sábado)"
 * "10/09/2026 (Quinta-feira · ⚠️ VENCIDO há 2 dias)"
 */
export function formatDueDateDetails(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return 'Data não especificada';

  let date: Date;
  if (typeof dateInput === 'string') {
    // Normaliza para YYYY-MM-DD
    const cleanDate = dateInput.split('T')[0];
    date = parseISO(cleanDate);
  } else {
    date = dateInput;
  }

  if (!isValid(date)) return String(dateInput);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const diffDays = differenceInCalendarDays(targetDate, today);
  const formattedDate = format(targetDate, 'dd/MM/yyyy');
  const dayOfWeek = format(targetDate, 'EEEE', { locale: ptBR });
  const capitalizedDayOfWeek = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);

  if (diffDays === 0) {
    return `${formattedDate} (Hoje · ${capitalizedDayOfWeek})`;
  }

  if (diffDays === 1) {
    return `${formattedDate} (Amanhã · ${capitalizedDayOfWeek})`;
  }

  if (diffDays === 2) {
    return `${formattedDate} (Depois de amanhã · ${capitalizedDayOfWeek})`;
  }

  if (diffDays > 2) {
    return `${formattedDate} (${capitalizedDayOfWeek} · em ${diffDays} dias)`;
  }

  if (diffDays === -1) {
    return `${formattedDate} (Ontem · ⚠️ VENCIDO)`;
  }

  return `${formattedDate} (${capitalizedDayOfWeek} · ⚠️ VENCIDO há ${Math.abs(diffDays)} dias)`;
}
