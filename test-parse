import fs from 'fs';
const parseCSV = (text: string): string[][] => {
  const result: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(current.trim());
      if (row.length > 0 && row.some(cell => cell !== "")) {
        result.push(row);
      }
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  if (current !== "" || row.length > 0) {
    row.push(current.trim());
    if (row.some(cell => cell !== "")) {
      result.push(row);
    }
  }
  return result;
};

fetch('https://docs.google.com/spreadsheets/d/1oFb1cCak0DWTW6Ls9uymcxmqDBb7wR9nmTvEkbvzsWs/export?format=csv')
  .then(res => res.text())
  .then(text => {
    const allRows = parseCSV(text);
    console.log("Headers:", allRows[0]);
    console.log("First Row:", allRows[1]);
  });
