const Database = require('better-sqlite3');
const path = require('path');

try {
  const dbPath = path.resolve(__dirname, '../dev.db');
  console.log('Connecting to db at:', dbPath);
  const db = new Database(dbPath);
  
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log('Tables:', tables);
  
  if (tables.some(t => t.name === 'AgentConfig')) {
    const info = db.prepare("PRAGMA table_info('AgentConfig')").all();
    console.log('AgentConfig Schema:');
    console.log(info.map(c => `${c.name}: ${c.type} (notnull=${c.notnull}, dflt=${c.dflt_value})`).join('\n'));
    
    const records = db.prepare("SELECT * FROM AgentConfig").all();
    console.log('AgentConfig Records:', records);
  } else {
    console.log('AgentConfig table does not exist!');
  }
  
  db.close();
} catch (err) {
  console.error('Error:', err);
}
