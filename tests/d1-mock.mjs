/** D1 transactional batch + all(), backed by the same SQLite database used by route tests. */
export function completeD1(binding,sqlite){
 const prepare=binding.prepare.bind(binding);
 binding.prepare=sql=>{const prepared=prepare(sql),bind=prepared.bind.bind(prepared);prepared.bind=(...args)=>{const statement=bind(...args);statement.all??=async()=>({results:sqlite.prepare(sql).all(...args)});return statement;};return prepared;};
 // D1 serializes transactions. A single SQLite test connection must do so too.
 let tail=Promise.resolve();
 binding.batch=statements=>{const result=tail.then(async()=>{sqlite.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sqlite.exec('COMMIT');return results;}catch(error){sqlite.exec('ROLLBACK');throw error;}});tail=result.catch(()=>{});return result;};
 return binding;
}
