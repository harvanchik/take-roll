import {LEGAL_VERSION,agreementDigest} from './legal-documents';
export async function hasLegalAgreement(db:D1Database,accountId:string){
 const row=await db.prepare('SELECT document_hash,adult_confirmed FROM legal_acceptances WHERE account_id=? AND version=?').bind(accountId,LEGAL_VERSION).first<{document_hash:string;adult_confirmed:number}>();
 return !!row&&row.adult_confirmed===1&&row.document_hash===await agreementDigest();
}
