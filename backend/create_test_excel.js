const XLSX = require('xlsx');
const path = require('path');

const data = [
  { nom: 'Ahmed Benali',    phone: '+212 6 12 34 56 78' },
  { nom: 'Fatima Zahra',   phone: '+212 6 98 76 54 32' },
  { nom: 'Mohamed Idrissi',phone: '+212 7 11 22 33 44' },
  { nom: 'Sara Boudali',   phone: '+212 6 55 44 33 22' },
  { nom: 'Youssef Rami',   phone: '+212 7 99 88 77 66' },
  { nom: 'Nadia Chraibi',  phone: '+212 6 33 22 11 00' },
  { nom: 'Khalid Mansouri',phone: '+212 7 44 55 66 77' },
  { nom: 'Loubna El Fassi',phone: '+212 6 77 88 99 11' },
  { nom: 'Omar Tahiri',    phone: '+212 7 22 33 44 55' },
  { nom: 'Rim Alaoui',     phone: '+212 6 66 55 44 33' },
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Customers');

const outputPath = path.resolve(__dirname, 'test_customers.xlsx');
XLSX.writeFile(wb, outputPath);

console.log('✅ Fichier créé:', outputPath);
