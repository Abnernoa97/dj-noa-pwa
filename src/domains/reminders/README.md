# Dominio de recordatorios

`reminderRecurrence.ts` es la implementación canónica de próxima fecha para el cliente, con `date-fns`. App y ReminderWorkspace delegan a ella. El Worker tiene una programación de push independiente y no se modifica sin pruebas específicas de zona horaria.
