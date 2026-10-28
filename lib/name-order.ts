import {personFields,type Person} from './model.ts';
/** Name order is independent of the chosen display format and preferred-name punctuation. */
export function lastNameOrder(person:Person):string[]{const fields=personFields(person);return [fields.lastName||fields.firstName,fields.firstName,fields.preferredFirstName];}
