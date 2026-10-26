/**
 * Resolve para a própria ordem quando ela cobre toda a união `U`, e para `never`
 * quando falta algum valor: atribuir uma ordem incompleta a este tipo não compila.
 */
export type Exaustiva<U extends string, Ordem extends readonly U[]> = [U] extends [Ordem[number]] ? Ordem : never;
