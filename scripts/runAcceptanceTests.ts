import { executerTestsAcceptation } from '../src/validation/acceptanceTests';
import { executerTestsAcceptationSolveur } from '../src/validation/acceptanceTestsSolveur';
import { executerTestsAcceptationSoutenement } from '../src/validation/acceptanceTestsSoutenement';
import { executerTestsAcceptationPieuxTransversal } from '../src/validation/acceptanceTestsPieuxTransversal';

console.log('================================================================');
console.log('  SUITE DE TESTS D\'ACCEPTATION NORMATIFS — GEOTECH EC7 (EN 1997-1)');
console.log('================================================================\n');

const testsEC7 = executerTestsAcceptation();
const testsSolveur = executerTestsAcceptationSolveur();
const testsSoutenement = executerTestsAcceptationSoutenement();
const testsPieuxTransversal = executerTestsAcceptationPieuxTransversal();
const tousLesTests = [...testsEC7, ...testsSolveur, ...testsSoutenement, ...testsPieuxTransversal];

let totalSucces = 0;

for (const t of tousLesTests) {
  const statut = t.succes ? '✅ [SUCCÈS]' : '❌ [ÉCHEC]';
  console.log(`${statut} ${t.id.padEnd(10)} | ${t.phase.padEnd(14)} | ${t.nom}`);
  console.log(`    Attendu : ${t.valeurAttendue}`);
  console.log(`    Obtenu  : ${t.valeurObtenue}`);
  console.log(`    Détail  : ${t.message}\n`);
  if (t.succes) totalSucces++;
}

console.log('----------------------------------------------------------------');
console.log(`BILAN : ${totalSucces} / ${tousLesTests.length} tests validés (${Math.round((totalSucces / tousLesTests.length) * 100)}%)\n`);

if (totalSucces !== tousLesTests.length) {
  process.exit(1);
} else {
  console.log('Tous les tests analytiques et éléments finis sont conformes au CDC.');
}
