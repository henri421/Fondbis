import { executerTestsAcceptation } from './acceptanceTests';

const resultats = executerTestsAcceptation();
let allOk = true;

for (const r of resultats) {
  const status = r.succes ? 'OK  ' : 'FAIL';
  if (!r.succes) allOk = false;
  console.log(`[${status}] ${r.id} ${r.nom} — attendu ${r.valeurAttendue}, obtenu ${r.valeurObtenue} (écart ${r.ecartPourcentage}%)`);
}

console.log(allOk ? '\nTous les tests d\'acceptation passent.' : '\nÉchec — voir le détail ci-dessus.');
process.exit(allOk ? 0 : 1);
